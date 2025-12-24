"""
Custom Claims API endpoints.
Handles custom claim definitions that are not linked to any policy document.
These custom claims are included in policy validation like PolicyCategory items.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import logging

from database import get_sync_db
from models import CustomClaim, User, Region
from schemas import (
    CustomClaimCreate, CustomClaimUpdate, CustomClaimResponse, CustomClaimListResponse
)
from api.v1.auth import require_tenant_id


def validate_regions_exist(db: Session, tenant_id: UUID, region_codes: List[str]) -> None:
    """Validate that all provided region codes or names exist for the tenant.
    'GLOBAL' is a special value meaning the claim applies to all regions.
    Accepts both region codes (e.g., 'IND') or region names (e.g., 'India', 'INDIA').
    """
    if not region_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one region is required"
        )
    
    # Filter out 'GLOBAL' as it's a special value, not a database region
    codes_to_validate = [code for code in region_codes if code.upper() != 'GLOBAL']
    
    # If only GLOBAL was provided, that's valid
    if not codes_to_validate:
        return
    
    # Query regions by code OR name (case-insensitive)
    from sqlalchemy import func
    existing_regions = db.query(Region).filter(
        Region.tenant_id == tenant_id,
        Region.is_active == True,
        (Region.code.in_(codes_to_validate)) | (func.upper(Region.name).in_([c.upper() for c in codes_to_validate]))
    ).all()
    
    # Build set of valid identifiers (both codes and uppercase names)
    valid_identifiers = set()
    for r in existing_regions:
        valid_identifiers.add(r.code)
        valid_identifiers.add(r.name.upper())
    
    # Check which provided values are invalid
    invalid_codes = [c for c in codes_to_validate if c not in valid_identifiers and c.upper() not in valid_identifiers]
    if invalid_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid regions: {', '.join(invalid_codes)}. Please create these regions first."
        )

logger = logging.getLogger(__name__)

router = APIRouter()


def invalidate_custom_claim_caches(region: Optional[str] = None):
    """Invalidate category and embedding caches when custom claims change"""
    try:
        from services.category_cache import get_category_cache
        category_cache = get_category_cache()
        category_cache.invalidate_cache(region)
        logger.info(f"Invalidated category cache for region: {region or 'ALL'}")
    except Exception as e:
        logger.warning(f"Failed to invalidate category cache: {e}")
    
    try:
        from services.embedding_service import EmbeddingService
        embedding_service = EmbeddingService()
        embedding_service._invalidate_region_cache(region or "GLOBAL")
        logger.info(f"Invalidated embedding cache for region: {region or 'GLOBAL'}")
    except Exception as e:
        logger.warning(f"Failed to invalidate embedding cache: {e}")


def generate_custom_claim_code(db: Session) -> str:
    """Generate unique custom claim code like CC-2024-0001"""
    year = datetime.now().year
    prefix = f"CC-{year}-"
    
    # Get the latest custom claim code for this year
    latest = db.query(CustomClaim).filter(
        CustomClaim.claim_code.like(f"{prefix}%")
    ).order_by(CustomClaim.claim_code.desc()).first()
    
    if latest:
        try:
            last_num = int(latest.claim_code.split("-")[-1])
            new_num = last_num + 1
        except:
            new_num = 1
    else:
        new_num = 1
    
    return f"{prefix}{new_num:04d}"


def normalize_custom_fields_for_response(custom_fields: List[dict]) -> List[dict]:
    """
    Normalize custom fields from database format to frontend-expected format.
    Maps field_name -> name, field_label -> label, field_type -> type
    """
    if not custom_fields:
        return []
    
    normalized = []
    for field in custom_fields:
        normalized_field = {
            'name': field.get('field_name') or field.get('name', ''),
            'label': field.get('field_label') or field.get('label', ''),
            'type': field.get('field_type') or field.get('type', 'text'),
            'required': field.get('required', False),
            'placeholder': field.get('placeholder'),
            'help_text': field.get('help_text'),
            'options': field.get('options', []),
            'validation': field.get('validation'),
            'default_value': field.get('default_value'),
            'display_order': field.get('display_order', 0),
        }
        normalized.append(normalized_field)
    
    return normalized


# ==================== CUSTOM CLAIM ENDPOINTS ====================

@router.post("/", response_model=CustomClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_claim(
    claim_data: CustomClaimCreate,
    created_by: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Create a new custom claim definition.
    Custom claims are standalone claim types not linked to any policy document.
    Region is mandatory - at least one valid region must be specified.
    """
    # Validate that regions exist
    validate_regions_exist(db, tenant_id, claim_data.region)
    
    # Generate unique claim code
    claim_code = generate_custom_claim_code(db)
    
    # Create custom claim record
    custom_claim = CustomClaim(
        tenant_id=tenant_id,
        claim_name=claim_data.claim_name,
        claim_code=claim_code,
        description=claim_data.description,
        category_type=claim_data.category_type.value,
        region=claim_data.region if claim_data.region else None,
        max_amount=claim_data.max_amount,
        min_amount=claim_data.min_amount,
        default_amount=claim_data.default_amount,
        currency=claim_data.currency,
        frequency_limit=claim_data.frequency_limit,
        frequency_count=claim_data.frequency_count,
        custom_fields=[f.dict() for f in claim_data.custom_fields],
        eligibility_criteria=claim_data.eligibility_criteria,
        requires_receipt=claim_data.requires_receipt,
        requires_approval_above=claim_data.requires_approval_above,
        allowed_document_types=claim_data.allowed_document_types,
        submission_window_days=claim_data.submission_window_days,
        is_active=claim_data.is_active,
        display_order=claim_data.display_order,
        created_by=created_by
    )
    
    db.add(custom_claim)
    db.commit()
    db.refresh(custom_claim)
    
    logger.info(f"Created custom claim: {claim_code} - {claim_data.claim_name}")
    
    # Invalidate caches so the new custom claim is picked up in policy validation
    invalidate_custom_claim_caches(custom_claim.region)
    
    return CustomClaimResponse(
        id=custom_claim.id,
        tenant_id=custom_claim.tenant_id,
        claim_name=custom_claim.claim_name,
        claim_code=custom_claim.claim_code,
        description=custom_claim.description,
        category_type=custom_claim.category_type,
        region=custom_claim.region,
        max_amount=float(custom_claim.max_amount) if custom_claim.max_amount else None,
        min_amount=float(custom_claim.min_amount) if custom_claim.min_amount else None,
        default_amount=float(custom_claim.default_amount) if custom_claim.default_amount else None,
        currency=custom_claim.currency,
        frequency_limit=custom_claim.frequency_limit,
        frequency_count=custom_claim.frequency_count,
        custom_fields=normalize_custom_fields_for_response(custom_claim.custom_fields),
        eligibility_criteria=custom_claim.eligibility_criteria or {},
        requires_receipt=custom_claim.requires_receipt,
        requires_approval_above=float(custom_claim.requires_approval_above) if custom_claim.requires_approval_above else None,
        allowed_document_types=custom_claim.allowed_document_types or [],
        submission_window_days=custom_claim.submission_window_days,
        is_active=custom_claim.is_active,
        display_order=custom_claim.display_order,
        created_by=custom_claim.created_by,
        updated_by=custom_claim.updated_by,
        created_at=custom_claim.created_at,
        updated_at=custom_claim.updated_at
    )


@router.get("/", response_model=List[CustomClaimListResponse])
async def list_custom_claims(
    tenant_id: UUID,
    region: Optional[str] = None,
    category_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_sync_db)
):
    """
    List all custom claim definitions with optional filters.
    """
    query = db.query(CustomClaim).filter(
        CustomClaim.tenant_id == tenant_id
    )
    
    # Apply filters
    if region:
        query = query.filter(CustomClaim.region == region)
    if category_type:
        query = query.filter(CustomClaim.category_type == category_type)
    if is_active is not None:
        query = query.filter(CustomClaim.is_active == is_active)
    
    # Order by display order and name
    query = query.order_by(CustomClaim.display_order, CustomClaim.claim_name)
    
    custom_claims = query.all()
    
    return [
        CustomClaimListResponse(
            id=cc.id,
            claim_name=cc.claim_name,
            claim_code=cc.claim_code,
            description=cc.description,
            category_type=cc.category_type,
            region=cc.region,
            max_amount=float(cc.max_amount) if cc.max_amount else None,
            currency=cc.currency,
            requires_receipt=cc.requires_receipt,
            is_active=cc.is_active,
            fields_count=len(cc.custom_fields) if cc.custom_fields else 0,
            created_at=cc.created_at
        )
        for cc in custom_claims
    ]


@router.get("/{claim_id}", response_model=CustomClaimResponse)
async def get_custom_claim(
    claim_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Get a specific custom claim definition by ID.
    """
    custom_claim = db.query(CustomClaim).filter(
        and_(
            CustomClaim.id == claim_id,
            CustomClaim.tenant_id == tenant_id
        )
    ).first()
    
    if not custom_claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom claim not found"
        )
    
    return CustomClaimResponse(
        id=custom_claim.id,
        tenant_id=custom_claim.tenant_id,
        claim_name=custom_claim.claim_name,
        claim_code=custom_claim.claim_code,
        description=custom_claim.description,
        category_type=custom_claim.category_type,
        region=custom_claim.region,
        max_amount=float(custom_claim.max_amount) if custom_claim.max_amount else None,
        min_amount=float(custom_claim.min_amount) if custom_claim.min_amount else None,
        default_amount=float(custom_claim.default_amount) if custom_claim.default_amount else None,
        currency=custom_claim.currency,
        frequency_limit=custom_claim.frequency_limit,
        frequency_count=custom_claim.frequency_count,
        custom_fields=normalize_custom_fields_for_response(custom_claim.custom_fields),
        eligibility_criteria=custom_claim.eligibility_criteria or {},
        requires_receipt=custom_claim.requires_receipt,
        requires_approval_above=float(custom_claim.requires_approval_above) if custom_claim.requires_approval_above else None,
        allowed_document_types=custom_claim.allowed_document_types or [],
        submission_window_days=custom_claim.submission_window_days,
        is_active=custom_claim.is_active,
        display_order=custom_claim.display_order,
        created_by=custom_claim.created_by,
        updated_by=custom_claim.updated_by,
        created_at=custom_claim.created_at,
        updated_at=custom_claim.updated_at
    )


@router.put("/{claim_id}", response_model=CustomClaimResponse)
async def update_custom_claim(
    claim_id: UUID,
    claim_data: CustomClaimUpdate,
    updated_by: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Update an existing custom claim definition.
    """
    custom_claim = db.query(CustomClaim).filter(
        and_(
            CustomClaim.id == claim_id,
            CustomClaim.tenant_id == tenant_id
        )
    ).first()
    
    if not custom_claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom claim not found"
        )
    
    # Validate regions if being updated
    if claim_data.region is not None:
        validate_regions_exist(db, tenant_id, claim_data.region)
    
    # Update fields if provided
    update_data = claim_data.dict(exclude_unset=True)
    
    if 'category_type' in update_data and update_data['category_type']:
        update_data['category_type'] = update_data['category_type'].value
    
    if 'custom_fields' in update_data and update_data['custom_fields']:
        update_data['custom_fields'] = [f.dict() if hasattr(f, 'dict') else f for f in update_data['custom_fields']]
    
    for field, value in update_data.items():
        setattr(custom_claim, field, value)
    
    custom_claim.updated_by = updated_by
    custom_claim.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(custom_claim)
    
    logger.info(f"Updated custom claim: {custom_claim.claim_code}")
    
    # Invalidate caches so the updated custom claim is reflected in policy validation
    invalidate_custom_claim_caches(custom_claim.region)
    
    return CustomClaimResponse(
        id=custom_claim.id,
        tenant_id=custom_claim.tenant_id,
        claim_name=custom_claim.claim_name,
        claim_code=custom_claim.claim_code,
        description=custom_claim.description,
        category_type=custom_claim.category_type,
        region=custom_claim.region,
        max_amount=float(custom_claim.max_amount) if custom_claim.max_amount else None,
        min_amount=float(custom_claim.min_amount) if custom_claim.min_amount else None,
        default_amount=float(custom_claim.default_amount) if custom_claim.default_amount else None,
        currency=custom_claim.currency,
        frequency_limit=custom_claim.frequency_limit,
        frequency_count=custom_claim.frequency_count,
        custom_fields=normalize_custom_fields_for_response(custom_claim.custom_fields),
        eligibility_criteria=custom_claim.eligibility_criteria or {},
        requires_receipt=custom_claim.requires_receipt,
        requires_approval_above=float(custom_claim.requires_approval_above) if custom_claim.requires_approval_above else None,
        allowed_document_types=custom_claim.allowed_document_types or [],
        submission_window_days=custom_claim.submission_window_days,
        is_active=custom_claim.is_active,
        display_order=custom_claim.display_order,
        created_by=custom_claim.created_by,
        updated_by=custom_claim.updated_by,
        created_at=custom_claim.created_at,
        updated_at=custom_claim.updated_at
    )


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_claim(
    claim_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Delete a custom claim definition.
    """
    custom_claim = db.query(CustomClaim).filter(
        and_(
            CustomClaim.id == claim_id,
            CustomClaim.tenant_id == tenant_id
        )
    ).first()
    
    if not custom_claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom claim not found"
        )
    
    logger.info(f"Deleting custom claim: {custom_claim.claim_code}")
    
    region = custom_claim.region  # Save before deletion
    
    db.delete(custom_claim)
    db.commit()
    
    # Invalidate caches so the deleted custom claim is removed from policy validation
    invalidate_custom_claim_caches(region)
    
    return None


@router.post("/{claim_id}/toggle-status", response_model=CustomClaimResponse)
async def toggle_custom_claim_status(
    claim_id: UUID,
    updated_by: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Toggle the active status of a custom claim.
    """
    custom_claim = db.query(CustomClaim).filter(
        and_(
            CustomClaim.id == claim_id,
            CustomClaim.tenant_id == tenant_id
        )
    ).first()
    
    if not custom_claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom claim not found"
        )
    
    custom_claim.is_active = not custom_claim.is_active
    custom_claim.updated_by = updated_by
    custom_claim.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(custom_claim)
    
    logger.info(f"Toggled custom claim status: {custom_claim.claim_code} -> {'Active' if custom_claim.is_active else 'Inactive'}")
    
    # Invalidate caches so the status change is reflected in policy validation
    invalidate_custom_claim_caches(custom_claim.region)
    
    return CustomClaimResponse(
        id=custom_claim.id,
        tenant_id=custom_claim.tenant_id,
        claim_name=custom_claim.claim_name,
        claim_code=custom_claim.claim_code,
        description=custom_claim.description,
        category_type=custom_claim.category_type,
        region=custom_claim.region,
        max_amount=float(custom_claim.max_amount) if custom_claim.max_amount else None,
        min_amount=float(custom_claim.min_amount) if custom_claim.min_amount else None,
        default_amount=float(custom_claim.default_amount) if custom_claim.default_amount else None,
        currency=custom_claim.currency,
        frequency_limit=custom_claim.frequency_limit,
        frequency_count=custom_claim.frequency_count,
        custom_fields=custom_claim.custom_fields or [],
        eligibility_criteria=custom_claim.eligibility_criteria or {},
        requires_receipt=custom_claim.requires_receipt,
        requires_approval_above=float(custom_claim.requires_approval_above) if custom_claim.requires_approval_above else None,
        allowed_document_types=custom_claim.allowed_document_types or [],
        submission_window_days=custom_claim.submission_window_days,
        is_active=custom_claim.is_active,
        display_order=custom_claim.display_order,
        created_by=custom_claim.created_by,
        updated_by=custom_claim.updated_by,
        created_at=custom_claim.created_at,
        updated_at=custom_claim.updated_at
    )
