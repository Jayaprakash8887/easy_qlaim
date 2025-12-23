"""
Policy Management API endpoints.
Handles policy document upload, AI extraction, review, and approval workflow.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
import os
import logging

from database import get_sync_db
from models import PolicyUpload, PolicyCategory, PolicyAuditLog, User, Region
from schemas import (
    PolicyUploadResponse, PolicyUploadListResponse, PolicyCategoryResponse,
    PolicyCategoryUpdate, PolicyApprovalRequest, PolicyRejectRequest,
    ClaimValidationRequest, ClaimValidationResponse, ValidationCheckResult,
    ValidationStatus, ActiveCategoryResponse, PolicyAuditLogResponse,
    ExtractedClaimListResponse
)
from api.v1.auth import require_tenant_id

logger = logging.getLogger(__name__)


def validate_region_exists(db: Session, tenant_id: UUID, region_code: str) -> None:
    """Validate that the provided region code exists for the tenant"""
    if not region_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Region is required for policy upload"
        )
    
    existing_region = db.query(Region).filter(
        Region.tenant_id == tenant_id,
        Region.code == region_code,
        Region.is_active == True
    ).first()
    
    if not existing_region:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid region code: {region_code}. Please create this region first."
        )


def validate_regions_exist(db: Session, tenant_id: UUID, region_codes: List[str]) -> None:
    """Validate that all provided region codes exist for the tenant"""
    if not region_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one region is required for policy upload"
        )
    
    existing_regions = db.query(Region.code).filter(
        Region.tenant_id == tenant_id,
        Region.code.in_(region_codes),
        Region.is_active == True
    ).all()
    existing_codes = {r.code for r in existing_regions}
    
    invalid_codes = set(region_codes) - existing_codes
    if invalid_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid region codes: {', '.join(invalid_codes)}. Please create these regions first."
        )

router = APIRouter()

# Upload directory for policy documents
POLICY_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "policies")
os.makedirs(POLICY_UPLOAD_DIR, exist_ok=True)


async def _invalidate_policy_cache(policy_id: UUID = None, region: str = None):
    """Background task to invalidate policy and category cache"""
    try:
        from services.redis_cache import redis_cache
        from services.category_cache import category_cache
        
        if policy_id:
            await redis_cache.delete_async(f"policy:id:{str(policy_id)}")
        
        # Invalidate active policies cache
        if region:
            await redis_cache.delete_async(f"policy:active:{region.upper()}")
        await redis_cache.delete_async("policy:active:GLOBAL")
        
        # Invalidate category caches
        await redis_cache.delete_pattern_async("category:*")
        
        # Clear in-memory category cache as well
        category_cache.clear_cache()
        
        logger.info(f"Policy cache invalidated (policy_id={policy_id}, region={region})")
    except Exception as e:
        logger.warning(f"Failed to invalidate policy cache: {e}")


def generate_policy_number(db: Session) -> str:
    """Generate unique policy number like POL-2024-0001"""
    year = datetime.now().year
    prefix = f"POL-{year}-"
    
    # Get the latest policy number for this year
    latest = db.query(PolicyUpload).filter(
        PolicyUpload.policy_number.like(f"{prefix}%")
    ).order_by(PolicyUpload.policy_number.desc()).first()
    
    if latest:
        try:
            last_num = int(latest.policy_number.split("-")[-1])
            new_num = last_num + 1
        except:
            new_num = 1
    else:
        new_num = 1
    
    return f"{prefix}{new_num:04d}"


def log_policy_action(
    db: Session,
    tenant_id: UUID,
    entity_type: str,
    entity_id: UUID,
    action: str,
    performed_by: UUID,
    old_values: dict = None,
    new_values: dict = None,
    description: str = None
):
    """Create audit log entry for policy actions"""
    audit_log = PolicyAuditLog(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_values=old_values,
        new_values=new_values,
        description=description,
        performed_by=performed_by
    )
    db.add(audit_log)


# ==================== POLICY UPLOAD ENDPOINTS ====================

@router.post("/upload", response_model=PolicyUploadResponse)
async def upload_policy(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    policy_name: str = Form(...),
    description: str = Form(None),
    region: List[str] = Form(..., description="Region codes this policy applies to (required)"),
    uploaded_by: UUID = Form(...),
    tenant_id: str = Form(...),  # Required tenant_id from authenticated user
    db: Session = Depends(get_sync_db)
):
    """
    Upload a policy document for AI extraction.
    Supported formats: PDF, DOCX, JPG, PNG
    Region is mandatory - at least one valid region must be specified.
    """
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    # Validate all regions exist
    validate_regions_exist(db, tenant_uuid, region)
    
    # Validate file type
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                     "image/jpeg", "image/png"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not supported. Allowed: PDF, DOCX, JPG, PNG"
        )
    
    # Determine file type
    file_type_map = {
        "application/pdf": "PDF",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
        "image/jpeg": "JPG",
        "image/png": "PNG"
    }
    file_type = file_type_map.get(file.content_type, "PDF")
    
    # Generate policy number
    policy_number = generate_policy_number(db)
    
    # Save file locally
    file_extension = file.filename.split(".")[-1] if "." in file.filename else file_type.lower()
    storage_filename = f"{policy_number}.{file_extension}"
    storage_path = os.path.join(POLICY_UPLOAD_DIR, storage_filename)
    
    content = await file.read()
    with open(storage_path, "wb") as f:
        f.write(content)
    
    # Create policy upload record
    policy_upload = PolicyUpload(
        tenant_id=tenant_uuid,
        policy_name=policy_name,
        policy_number=policy_number,
        description=description,
        region=region,  # Region/location this policy applies to
        file_name=file.filename,
        file_type=file_type,
        file_size=len(content),
        storage_path=storage_path,
        storage_type="local",
        content_type=file.content_type,
        status="PENDING",
        uploaded_by=uploaded_by
    )
    
    db.add(policy_upload)
    db.commit()
    db.refresh(policy_upload)
    
    # Log the action
    log_policy_action(
        db, tenant_uuid, "POLICY_UPLOAD", policy_upload.id, "CREATE",
        uploaded_by, None, {"policy_number": policy_number, "file_name": file.filename},
        f"Policy document uploaded: {policy_name}"
    )
    db.commit()
    
    # Trigger AI extraction in background
    background_tasks.add_task(extract_policy_categories, policy_upload.id, db)
    
    # Update status to processing
    policy_upload.status = "AI_PROCESSING"
    db.commit()
    db.refresh(policy_upload)
    
    return PolicyUploadResponse(
        id=policy_upload.id,
        tenant_id=policy_upload.tenant_id,
        policy_name=policy_upload.policy_name,
        policy_number=policy_upload.policy_number,
        description=policy_upload.description,
        file_name=policy_upload.file_name,
        file_type=policy_upload.file_type,
        file_size=policy_upload.file_size,
        storage_path=policy_upload.storage_path,
        gcs_uri=policy_upload.gcs_uri,
        storage_type=policy_upload.storage_type,
        status=policy_upload.status,
        extracted_text=policy_upload.extracted_text,
        extraction_error=policy_upload.extraction_error,
        extracted_at=policy_upload.extracted_at,
        extracted_data=policy_upload.extracted_data or {},
        version=policy_upload.version,
        is_active=policy_upload.is_active,
        effective_from=policy_upload.effective_from,
        effective_to=policy_upload.effective_to,
        region=policy_upload.region,
        uploaded_by=policy_upload.uploaded_by,
        approved_by=policy_upload.approved_by,
        approved_at=policy_upload.approved_at,
        review_notes=policy_upload.review_notes,
        created_at=policy_upload.created_at,
        updated_at=policy_upload.updated_at,
        categories=[]
    )


async def extract_policy_categories(policy_id: UUID, db: Session):
    """
    Background task to extract categories from policy document using AI.
    This function will be called asynchronously after upload.
    """
    from services.policy_extraction_service import PolicyExtractionService
    from database import SyncSessionLocal
    
    # Create a new session for background task since original may be closed
    new_db = SyncSessionLocal()
    
    try:
        service = PolicyExtractionService(new_db)
        await service.extract_and_save_categories(policy_id)
    except Exception as e:
        logger.error(f"Error extracting policy categories: {e}")
        # Update policy status to failed
        policy = new_db.query(PolicyUpload).filter(PolicyUpload.id == policy_id).first()
        if policy:
            policy.status = "EXTRACTED"  # Still mark as extracted even if AI fails, use defaults
            policy.extraction_error = str(e)
            new_db.commit()
    finally:
        new_db.close()


@router.get("/", response_model=List[PolicyUploadListResponse])
def list_policies(
    tenant_id: str,  # Required - must be provided
    status: Optional[str] = None,
    is_active: Optional[bool] = None,
    region: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """List all policy uploads with optional filtering"""
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    query = db.query(PolicyUpload).filter(
        PolicyUpload.tenant_id == tenant_uuid
    )
    
    if status:
        query = query.filter(PolicyUpload.status == status)
    if is_active is not None:
        query = query.filter(PolicyUpload.is_active == is_active)
    if region:
        query = query.filter(PolicyUpload.region == region)
    
    policies = query.order_by(PolicyUpload.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for policy in policies:
        categories_count = db.query(func.count(PolicyCategory.id)).filter(
            PolicyCategory.policy_upload_id == policy.id
        ).scalar()
        
        result.append(PolicyUploadListResponse(
            id=policy.id,
            policy_name=policy.policy_name,
            policy_number=policy.policy_number,
            file_name=policy.file_name,
            status=policy.status,
            version=policy.version,
            is_active=policy.is_active,
            effective_from=policy.effective_from,
            region=policy.region,
            categories_count=categories_count,
            uploaded_by=policy.uploaded_by,
            created_at=policy.created_at
        ))
    
    return result


@router.get("/extracted-claims", response_model=List[ExtractedClaimListResponse])
def list_extracted_claims(
    tenant_id: str,  # Required - must be provided
    region: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """List all extracted claims (categories) from all policies AND custom claims"""
    from models import CustomClaim
    
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    result = []
    
    # ============ 1. Get PolicyCategory items ============
    query = db.query(PolicyCategory, PolicyUpload).join(
        PolicyUpload, PolicyCategory.policy_upload_id == PolicyUpload.id
    ).filter(
        PolicyCategory.tenant_id == tenant_uuid
    )
    
    if region:
        query = query.filter(PolicyUpload.region == region)
    
    categories = query.order_by(PolicyUpload.created_at.desc(), PolicyCategory.display_order).all()
    
    for cat, policy in categories:
        result.append(ExtractedClaimListResponse(
            # Category fields
            id=cat.id,
            tenant_id=cat.tenant_id,
            policy_upload_id=cat.policy_upload_id,
            category_name=cat.category_name,
            category_code=cat.category_code,
            category_type=cat.category_type,
            description=cat.description,
            max_amount=float(cat.max_amount) if cat.max_amount else None,
            min_amount=float(cat.min_amount) if cat.min_amount else None,
            currency=cat.currency,
            frequency_limit=cat.frequency_limit,
            frequency_count=cat.frequency_count,
            eligibility_criteria=cat.eligibility_criteria or {},
            requires_receipt=cat.requires_receipt,
            requires_approval_above=float(cat.requires_approval_above) if cat.requires_approval_above else None,
            allowed_document_types=cat.allowed_document_types or [],
            submission_window_days=cat.submission_window_days,
            is_active=cat.is_active,
            display_order=cat.display_order,
            source_text=cat.source_text,
            ai_confidence=cat.ai_confidence,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
            # Policy fields
            policy_name=policy.policy_name,
            policy_status=policy.status,
            policy_version=f"v{policy.version}" if policy.version else None,
            policy_effective_from=policy.effective_from,
            policy_region=policy.region
        ))
    
    # ============ 2. Get CustomClaim items (standalone) ============
    custom_query = db.query(CustomClaim).filter(
        CustomClaim.tenant_id == tenant_uuid
    )
    
    if region:
        custom_query = custom_query.filter(CustomClaim.region == region)
    
    custom_claims = custom_query.order_by(CustomClaim.created_at.desc(), CustomClaim.display_order).all()
    
    for cc in custom_claims:
        result.append(ExtractedClaimListResponse(
            # Map CustomClaim fields to ExtractedClaimListResponse
            id=cc.id,
            tenant_id=cc.tenant_id,
            policy_upload_id=None,  # Custom claims are not linked to policies
            category_name=cc.claim_name,
            category_code=cc.claim_code,
            category_type=cc.category_type,
            description=cc.description,
            max_amount=float(cc.max_amount) if cc.max_amount else None,
            min_amount=float(cc.min_amount) if cc.min_amount else None,
            currency=cc.currency,
            frequency_limit=cc.frequency_limit,
            frequency_count=cc.frequency_count,
            eligibility_criteria=cc.eligibility_criteria or {},
            requires_receipt=cc.requires_receipt,
            requires_approval_above=float(cc.requires_approval_above) if cc.requires_approval_above else None,
            allowed_document_types=cc.allowed_document_types or [],
            submission_window_days=cc.submission_window_days,
            is_active=cc.is_active,
            display_order=cc.display_order,
            source_text=None,  # Custom claims have no source text
            ai_confidence=None,  # Custom claims are manually defined
            created_at=cc.created_at,
            updated_at=cc.updated_at,
            # Custom claims use "Custom Claim" as policy name
            policy_name="Custom Claim",
            policy_status="ACTIVE" if cc.is_active else "INACTIVE",
            policy_version=None,
            policy_effective_from=None,
            policy_region=cc.region
        ))
    
    # Apply pagination after combining results
    return result[skip:skip + limit]


@router.get("/{policy_id}", response_model=PolicyUploadResponse)
def get_policy(
    policy_id: UUID,
    tenant_id: str,  # Required - must be provided
    db: Session = Depends(get_sync_db)
):
    """Get policy details with extracted categories"""
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    policy = db.query(PolicyUpload).filter(
        and_(
            PolicyUpload.id == policy_id,
            PolicyUpload.tenant_id == tenant_uuid
        )
    ).first()
    
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    categories = db.query(PolicyCategory).filter(
        PolicyCategory.policy_upload_id == policy_id
    ).order_by(PolicyCategory.display_order, PolicyCategory.category_name).all()
    
    return PolicyUploadResponse(
        id=policy.id,
        tenant_id=policy.tenant_id,
        policy_name=policy.policy_name,
        policy_number=policy.policy_number,
        description=policy.description,
        file_name=policy.file_name,
        file_type=policy.file_type,
        file_size=policy.file_size,
        storage_path=policy.storage_path,
        gcs_uri=policy.gcs_uri,
        storage_type=policy.storage_type,
        status=policy.status,
        extracted_text=policy.extracted_text,
        extraction_error=policy.extraction_error,
        extracted_at=policy.extracted_at,
        extracted_data=policy.extracted_data or {},
        version=policy.version,
        is_active=policy.is_active,
        effective_from=policy.effective_from,
        effective_to=policy.effective_to,
        region=policy.region,
        uploaded_by=policy.uploaded_by,
        approved_by=policy.approved_by,
        approved_at=policy.approved_at,
        review_notes=policy.review_notes,
        created_at=policy.created_at,
        updated_at=policy.updated_at,
        categories=[PolicyCategoryResponse(
            id=cat.id,
            tenant_id=cat.tenant_id,
            policy_upload_id=cat.policy_upload_id,
            category_name=cat.category_name,
            category_code=cat.category_code,
            category_type=cat.category_type,
            description=cat.description,
            max_amount=float(cat.max_amount) if cat.max_amount else None,
            min_amount=float(cat.min_amount) if cat.min_amount else None,
            currency=cat.currency,
            frequency_limit=cat.frequency_limit,
            frequency_count=cat.frequency_count,
            eligibility_criteria=cat.eligibility_criteria or {},
            requires_receipt=cat.requires_receipt,
            requires_approval_above=float(cat.requires_approval_above) if cat.requires_approval_above else None,
            allowed_document_types=cat.allowed_document_types or [],
            submission_window_days=cat.submission_window_days,
            is_active=cat.is_active,
            display_order=cat.display_order,
            source_text=cat.source_text,
            ai_confidence=cat.ai_confidence,
            created_at=cat.created_at,
            updated_at=cat.updated_at
        ) for cat in categories]
    )


@router.post("/{policy_id}/reextract")
async def reextract_policy(
    policy_id: UUID,
    tenant_id: str,  # Required - must be provided
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_sync_db)
):
    """Re-trigger AI extraction for a policy document"""
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    policy = db.query(PolicyUpload).filter(
        and_(
            PolicyUpload.id == policy_id,
            PolicyUpload.tenant_id == tenant_uuid
        )
    ).first()
    
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if policy.status == "ACTIVE":
        raise HTTPException(status_code=400, detail="Cannot re-extract active policy")
    
    # Update status
    policy.status = "AI_PROCESSING"
    policy.extraction_error = None
    db.commit()
    
    # Trigger extraction
    background_tasks.add_task(extract_policy_categories, policy_id, db)
    
    return {"message": "Re-extraction started", "policy_id": str(policy_id)}


@router.post("/{policy_id}/new-version", response_model=PolicyUploadResponse)
async def upload_new_version(
    policy_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    description: str = Form(None),
    region: List[str] = Form(..., description="Region codes this policy applies to (required)"),
    uploaded_by: UUID = Form(...),
    tenant_id: str = Form(...),  # Required - must be provided
    db: Session = Depends(get_sync_db)
):
    """
    Upload a new version of an existing policy document.
    The old policy will be archived when this new version is approved.
    Region is mandatory - at least one valid region must be specified.
    """
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    # Validate all regions exist
    validate_regions_exist(db, tenant_uuid, region)
    
    # Get the existing policy
    existing_policy = db.query(PolicyUpload).filter(
        and_(
            PolicyUpload.id == policy_id,
            PolicyUpload.tenant_id == tenant_uuid
        )
    ).first()
    
    if not existing_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    # Validate file type
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                     "image/jpeg", "image/png"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not supported. Allowed: PDF, DOCX, JPG, PNG"
        )
    
    # Determine file type
    file_type_map = {
        "application/pdf": "PDF",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
        "image/jpeg": "JPG",
        "image/png": "PNG"
    }
    file_type = file_type_map.get(file.content_type, "PDF")
    
    # Generate new policy number (same base, increment version)
    new_version = (existing_policy.version or 1) + 1
    policy_number = generate_policy_number(db)
    
    # Save file locally
    file_extension = file.filename.split(".")[-1] if "." in file.filename else file_type.lower()
    storage_filename = f"{policy_number}.{file_extension}"
    storage_path = os.path.join(POLICY_UPLOAD_DIR, storage_filename)
    
    content = await file.read()
    with open(storage_path, "wb") as f:
        f.write(content)
    
    # Create new policy upload record with reference to old policy
    new_policy = PolicyUpload(
        tenant_id=tenant_uuid,
        policy_name=existing_policy.policy_name,  # Keep same name
        policy_number=policy_number,
        description=description or existing_policy.description,
        file_name=file.filename,
        file_type=file_type,
        file_size=len(content),
        storage_path=storage_path,
        storage_type="local",
        content_type=file.content_type,
        status="PENDING",
        version=new_version,
        region=region,  # Use the provided region (now required)
        replaces_policy_id=existing_policy.id,  # Link to old policy
        uploaded_by=uploaded_by
    )
    
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    
    # Log the action
    log_policy_action(
        db, tenant_uuid, "POLICY_VERSION_UPLOAD", new_policy.id, "CREATE",
        uploaded_by, None, 
        {"policy_number": policy_number, "file_name": file.filename, "version": new_version, "replaces": str(existing_policy.id)},
        f"New version (v{new_version}) uploaded for policy: {existing_policy.policy_name}"
    )
    db.commit()
    
    # Trigger AI extraction in background
    background_tasks.add_task(extract_policy_categories, new_policy.id, db)
    
    # Update status to processing
    new_policy.status = "AI_PROCESSING"
    db.commit()
    db.refresh(new_policy)
    
    return PolicyUploadResponse(
        id=new_policy.id,
        tenant_id=new_policy.tenant_id,
        policy_name=new_policy.policy_name,
        policy_number=new_policy.policy_number,
        description=new_policy.description,
        file_name=new_policy.file_name,
        file_type=new_policy.file_type,
        file_size=new_policy.file_size,
        storage_path=new_policy.storage_path,
        gcs_uri=new_policy.gcs_uri,
        storage_type=new_policy.storage_type,
        content_type=new_policy.content_type,
        status=new_policy.status,
        version=new_policy.version,
        is_active=new_policy.is_active,
        replaces_policy_id=new_policy.replaces_policy_id,
        effective_from=new_policy.effective_from,
        effective_to=new_policy.effective_to,
        region=new_policy.region,
        uploaded_by=new_policy.uploaded_by,
        approved_by=new_policy.approved_by,
        approved_at=new_policy.approved_at,
        created_at=new_policy.created_at,
        updated_at=new_policy.updated_at,
        categories=[]
    )


# ==================== CATEGORY ENDPOINTS ====================

@router.get("/{policy_id}/categories", response_model=List[PolicyCategoryResponse])
def get_policy_categories(policy_id: UUID, db: Session = Depends(get_sync_db)):
    """Get all categories for a policy"""
    categories = db.query(PolicyCategory).filter(
        PolicyCategory.policy_upload_id == policy_id
    ).order_by(PolicyCategory.display_order, PolicyCategory.category_name).all()
    
    return [PolicyCategoryResponse(
        id=cat.id,
        tenant_id=cat.tenant_id,
        policy_upload_id=cat.policy_upload_id,
        category_name=cat.category_name,
        category_code=cat.category_code,
        category_type=cat.category_type,
        description=cat.description,
        max_amount=float(cat.max_amount) if cat.max_amount else None,
        min_amount=float(cat.min_amount) if cat.min_amount else None,
        currency=cat.currency,
        frequency_limit=cat.frequency_limit,
        frequency_count=cat.frequency_count,
        eligibility_criteria=cat.eligibility_criteria or {},
        requires_receipt=cat.requires_receipt,
        requires_approval_above=float(cat.requires_approval_above) if cat.requires_approval_above else None,
        allowed_document_types=cat.allowed_document_types or [],
        submission_window_days=cat.submission_window_days,
        is_active=cat.is_active,
        display_order=cat.display_order,
        source_text=cat.source_text,
        ai_confidence=cat.ai_confidence,
        created_at=cat.created_at,
        updated_at=cat.updated_at
    ) for cat in categories]


@router.put("/categories/{category_id}", response_model=PolicyCategoryResponse)
async def update_category(
    category_id: UUID,
    updates: PolicyCategoryUpdate,
    background_tasks: BackgroundTasks,
    tenant_id: str,  # Required - must be provided
    updated_by: UUID = None,
    db: Session = Depends(get_sync_db)
):
    """Update a policy category (admin can edit AI-extracted values)"""
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    category = db.query(PolicyCategory).filter(PolicyCategory.id == category_id).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Store old values for audit
    old_values = {
        "category_name": category.category_name,
        "max_amount": float(category.max_amount) if category.max_amount else None,
        "requires_receipt": category.requires_receipt
    }
    
    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    
    db.commit()
    db.refresh(category)
    
    # Log the update
    if updated_by:
        log_policy_action(
            db, tenant_uuid, "POLICY_CATEGORY", category_id, "UPDATE",
            updated_by, old_values, update_data,
            f"Category updated: {category.category_name}"
        )
        db.commit()
    
    # Invalidate cache in background
    # Get the policy to find its region
    policy = db.query(PolicyUpload).filter(PolicyUpload.id == category.policy_upload_id).first()
    region = policy.region if policy else None
    background_tasks.add_task(_invalidate_policy_cache, category.policy_upload_id, region)
    
    return PolicyCategoryResponse(
        id=category.id,
        tenant_id=category.tenant_id,
        policy_upload_id=category.policy_upload_id,
        category_name=category.category_name,
        category_code=category.category_code,
        category_type=category.category_type,
        description=category.description,
        max_amount=float(category.max_amount) if category.max_amount else None,
        min_amount=float(category.min_amount) if category.min_amount else None,
        currency=category.currency,
        frequency_limit=category.frequency_limit,
        frequency_count=category.frequency_count,
        eligibility_criteria=category.eligibility_criteria or {},
        requires_receipt=category.requires_receipt,
        requires_approval_above=float(category.requires_approval_above) if category.requires_approval_above else None,
        allowed_document_types=category.allowed_document_types or [],
        submission_window_days=category.submission_window_days,
        is_active=category.is_active,
        display_order=category.display_order,
        source_text=category.source_text,
        ai_confidence=category.ai_confidence,
        created_at=category.created_at,
        updated_at=category.updated_at
    )


# ==================== APPROVAL ENDPOINTS ====================

@router.post("/{policy_id}/approve", response_model=PolicyUploadResponse)
async def approve_policy(
    policy_id: UUID,
    approval: PolicyApprovalRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str,  # Required - must be provided
    db: Session = Depends(get_sync_db)
):
    """Approve a policy and make its categories active for claim submission"""
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    policy = db.query(PolicyUpload).filter(
        and_(
            PolicyUpload.id == policy_id,
            PolicyUpload.tenant_id == tenant_uuid
        )
    ).first()
    
    # Get approver - use provided ID or find HR Manager as default
    approved_by = approval.approved_by
    if not approved_by:
        # Find HR Manager user as default approver
        hr_manager = db.query(User).filter(
            and_(
                User.tenant_id == tenant_uuid,
                User.roles.any("HR")
            )
        ).first()
        if hr_manager:
            approved_by = hr_manager.id
        else:
            # Fallback to any admin user
            admin_user = db.query(User).filter(
                and_(
                    User.tenant_id == tenant_uuid,
                    User.roles.any("ADMIN")
                )
            ).first()
            if admin_user:
                approved_by = admin_user.id
            else:
                raise HTTPException(status_code=400, detail="No approver found. Please provide approved_by.")
    
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if policy.status not in ["EXTRACTED", "PENDING"]:
        raise HTTPException(status_code=400, detail=f"Policy in {policy.status} status cannot be approved")
    
    # Only archive the specific policy being replaced (if this is a new version)
    if policy.replaces_policy_id:
        old_policy = db.query(PolicyUpload).filter(
            PolicyUpload.id == policy.replaces_policy_id
        ).first()
        if old_policy:
            old_policy.is_active = False
            old_policy.status = "ARCHIVED"
    
    # Update policy status
    policy.status = "ACTIVE"
    policy.is_active = True
    policy.approved_by = approved_by
    policy.approved_at = datetime.utcnow()
    policy.review_notes = approval.review_notes
    policy.effective_from = approval.effective_from or date.today()
    
    # Apply any category updates from approval request
    if approval.categories:
        for cat_update in approval.categories:
            if hasattr(cat_update, 'id') and cat_update.id:
                category = db.query(PolicyCategory).filter(PolicyCategory.id == cat_update.id).first()
                if category:
                    update_data = cat_update.model_dump(exclude_unset=True, exclude={'id'})
                    for key, value in update_data.items():
                        setattr(category, key, value)
    
    db.commit()
    db.refresh(policy)
    
    # Log approval
    log_policy_action(
        db, tenant_uuid, "POLICY_UPLOAD", policy_id, "APPROVE",
        approved_by, {"status": "EXTRACTED"}, {"status": "ACTIVE"},
        f"Policy approved and activated: {policy.policy_name}"
    )
    db.commit()
    
    # Invalidate cache in background
    background_tasks.add_task(_invalidate_policy_cache, policy_id, policy.region)
    
    return get_policy(policy_id, tenant_id, db)


@router.post("/{policy_id}/reject")
def reject_policy(
    policy_id: UUID,
    rejection: PolicyRejectRequest,
    tenant_id: str,  # Required - must be provided
    db: Session = Depends(get_sync_db)
):
    """Reject a policy"""
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    policy = db.query(PolicyUpload).filter(
        and_(
            PolicyUpload.id == policy_id,
            PolicyUpload.tenant_id == tenant_uuid
        )
    ).first()
    
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    # Find rejector - use HR Manager as default
    hr_manager = db.query(User).filter(
        and_(
            User.tenant_id == tenant_uuid,
            User.roles.any("HR")
        )
    ).first()
    rejected_by = hr_manager.id if hr_manager else policy.uploaded_by
    
    old_status = policy.status
    policy.status = "REJECTED"
    policy.review_notes = rejection.review_notes
    
    db.commit()
    
    # Log rejection
    log_policy_action(
        db, tenant_uuid, "POLICY_UPLOAD", policy_id, "REJECT",
        rejected_by, {"status": old_status}, {"status": "REJECTED"},
        f"Policy rejected: {rejection.review_notes}"
    )
    db.commit()
    
    return {"message": "Policy rejected", "policy_id": str(policy_id)}


# ==================== ACTIVE CATEGORIES ENDPOINT ====================

@router.get("/categories/active", response_model=List[ActiveCategoryResponse])
def get_active_categories(
    tenant_id: str,  # Required - must be provided
    category_type: Optional[str] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Get all active categories from the currently active policy.
    Used for claim submission dropdown.
    """
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    # Find active policy
    active_policy = db.query(PolicyUpload).filter(
        and_(
            PolicyUpload.tenant_id == tenant_uuid,
            PolicyUpload.is_active == True,
            PolicyUpload.status == "ACTIVE"
        )
    ).first()
    
    if not active_policy:
        return []
    
    # Get categories
    query = db.query(PolicyCategory).filter(
        and_(
            PolicyCategory.policy_upload_id == active_policy.id,
            PolicyCategory.is_active == True
        )
    )
    
    if category_type:
        query = query.filter(PolicyCategory.category_type == category_type)
    
    categories = query.order_by(PolicyCategory.display_order, PolicyCategory.category_name).all()
    
    return [ActiveCategoryResponse(
        id=cat.id,
        category_name=cat.category_name,
        category_code=cat.category_code,
        category_type=cat.category_type,
        description=cat.description,
        max_amount=float(cat.max_amount) if cat.max_amount else None,
        min_amount=float(cat.min_amount) if cat.min_amount else None,
        currency=cat.currency,
        requires_receipt=cat.requires_receipt
    ) for cat in categories]


# ==================== VALIDATION ENDPOINT ====================

@router.post("/validate-claim", response_model=ClaimValidationResponse)
async def validate_claim(
    request: ClaimValidationRequest,
    db: Session = Depends(get_sync_db)
):
    """
    Validate a claim against policy rules.
    Called during claim submission to check compliance.
    """
    from services.claim_validation_service import ClaimValidationService
    
    service = ClaimValidationService(db)
    return await service.validate_claim(request)


# ==================== AUDIT LOG ENDPOINT ====================

@router.get("/audit-logs", response_model=List[PolicyAuditLogResponse])
def get_audit_logs(
    tenant_id: str,  # Required - must be provided
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get policy audit logs"""
    # Validate tenant_id
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    query = db.query(PolicyAuditLog).filter(
        PolicyAuditLog.tenant_id == tenant_uuid
    )
    
    if entity_type:
        query = query.filter(PolicyAuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(PolicyAuditLog.entity_id == entity_id)
    if action:
        query = query.filter(PolicyAuditLog.action == action)
    
    logs = query.order_by(PolicyAuditLog.performed_at.desc()).offset(skip).limit(limit).all()
    
    return [PolicyAuditLogResponse(
        id=log.id,
        tenant_id=log.tenant_id,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        action=log.action,
        old_values=log.old_values,
        new_values=log.new_values,
        description=log.description,
        performed_by=log.performed_by,
        performed_at=log.performed_at
    ) for log in logs]


# =====================================================
# EMBEDDING MANAGEMENT ENDPOINTS
# =====================================================

@router.post("/embeddings/refresh/{region}")
async def refresh_region_embeddings(
    region: str,
    category_type: Optional[str] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Force refresh embeddings for a region.
    
    This regenerates all category embeddings for the specified region,
    which is useful when:
    - Categories have been updated
    - Embeddings are corrupted
    - Manual refresh is needed
    
    Args:
        region: The region to refresh (e.g., 'INDIA', 'US', 'GLOBAL')
        category_type: Optional filter - 'REIMBURSEMENT' or 'ALLOWANCE'
        
    Returns:
        Number of embeddings generated
    """
    try:
        from services.embedding_service import get_embedding_service
        
        embedding_service = get_embedding_service()
        count = await embedding_service.refresh_region_embeddings(region, category_type)
        
        # Also invalidate category cache
        from services.category_cache import get_category_cache
        get_category_cache().invalidate_cache(region)
        
        logger.info(f"Refreshed {count} embeddings for region: {region}")
        
        return {
            "success": True,
            "region": region,
            "category_type": category_type,
            "embeddings_generated": count,
            "message": f"Successfully refreshed {count} embeddings"
        }
        
    except Exception as e:
        logger.error(f"Failed to refresh embeddings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh embeddings: {str(e)}"
        )


@router.get("/embeddings/stats")
async def get_embedding_stats():
    """
    Get embedding cache statistics.
    
    Returns information about:
    - Cached regions
    - Number of embeddings per region
    - Cache expiry times
    """
    try:
        from services.embedding_service import get_embedding_service
        
        embedding_service = get_embedding_service()
        stats = embedding_service.get_cache_stats()
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Failed to get embedding stats: {e}")
        return {
            "success": False,
            "error": str(e),
            "stats": {}
        }


@router.post("/embeddings/invalidate")
async def invalidate_embedding_cache(
    region: Optional[str] = None
):
    """
    Invalidate embedding cache.
    
    Args:
        region: Optional region to invalidate. If not provided, invalidates all.
    """
    try:
        from services.embedding_service import get_embedding_service
        from services.category_cache import get_category_cache
        
        embedding_service = get_embedding_service()
        category_cache = get_category_cache()
        
        if region:
            embedding_service._invalidate_region_cache(region)
            category_cache.invalidate_cache(region)
            message = f"Cache invalidated for region: {region}"
        else:
            embedding_service.invalidate_all_caches()
            category_cache.invalidate_cache()
            message = "All caches invalidated"
        
        logger.info(message)
        
        return {
            "success": True,
            "message": message
        }
        
    except Exception as e:
        logger.error(f"Failed to invalidate cache: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to invalidate cache: {str(e)}"
        )


@router.post("/embeddings/match")
async def test_embedding_match(
    text: str,
    tenant_id: UUID,
    region: str = "INDIA",
    category_type: str = "REIMBURSEMENT",
    top_k: int = 3
):
    """
    Test embedding-based category matching.
    
    Useful for debugging and testing the semantic matching.
    
    Args:
        text: Text to match (e.g., vendor name + description)
        tenant_id: Tenant UUID (required)
        region: Employee region
        category_type: REIMBURSEMENT or ALLOWANCE
        top_k: Number of top matches to return
        
    Returns:
        Top matching categories with similarity scores
    """
    require_tenant_id(tenant_id)
    
    try:
        from services.embedding_service import get_embedding_service
        
        embedding_service = get_embedding_service()
        matches = await embedding_service.match_category(
            text, region, category_type, top_k, tenant_id
        )
        
        return {
            "success": True,
            "query": text,
            "region": region,
            "category_type": category_type,
            "matches": [
                {
                    "category": cat,
                    "similarity": round(score, 4),
                    "is_valid_match": valid
                }
                for cat, score, valid in matches
            ],
            "best_match": matches[0][0] if matches else "other",
            "best_score": round(matches[0][1], 4) if matches else 0.0
        }
        
    except Exception as e:
        logger.error(f"Embedding match test failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding match failed: {str(e)}"
        )
