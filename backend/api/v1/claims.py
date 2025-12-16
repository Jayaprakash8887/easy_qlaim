"""
Claims API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
import os
import shutil
from pathlib import Path
import json
import logging

from database import get_async_db
from models import Claim, Document, User, Comment
# Employee is now an alias for User
Employee = User
from schemas import (
    ClaimCreate, ClaimUpdate, ClaimResponse, ClaimListResponse,
    ReturnToEmployee, SettleClaim, HRCorrection,
    BatchClaimCreate, BatchClaimResponse, ApproveRejectClaim
)
from config import settings
from agents.orchestrator import process_claim_task
from services.storage import upload_to_gcs
from services.duplicate_detection import check_duplicate_claim, check_batch_duplicates
from services.ai_analysis import generate_ai_analysis, generate_policy_checks

logger = logging.getLogger(__name__)
router = APIRouter()

# Ensure upload directory exists
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _map_category(category_str: str) -> str:
    """
    Map/validate category string.
    
    Categories are now dynamic from policy_categories table.
    This function normalizes the category code to uppercase.
    Legacy category names are mapped for backward compatibility.
    """
    if not category_str:
        return 'OTHER'
    
    # Legacy category mapping for backward compatibility
    legacy_map = {
        'travel': 'TRAVEL',
        'food': 'FOOD',
        'team_lunch': 'TEAM_LUNCH',
        'certification': 'CERTIFICATION',
        'accommodation': 'ACCOMMODATION',
        'equipment': 'EQUIPMENT',
        'software': 'SOFTWARE',
        'office_supplies': 'OFFICE_SUPPLIES',
        'medical': 'MEDICAL',
        'communication': 'MOBILE',
        'phone_internet': 'MOBILE',
        'passport_visa': 'PASSPORT_VISA',
        'conveyance': 'CONVEYANCE',
        'client_meeting': 'CLIENT_MEETING',
    }
    
    # Check legacy map first
    lower_cat = category_str.lower()
    if lower_cat in legacy_map:
        return legacy_map[lower_cat]
    
    # For dynamic categories (from policy_categories table), 
    # return as uppercase to match category_code convention
    return category_str.upper()


@router.post("/batch", response_model=BatchClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_batch_claims(
    batch: BatchClaimCreate,
    db: AsyncSession = Depends(get_async_db),
):
    """Create multiple claims at once (for multi-receipt submissions)"""
    
    # Get employee
    result = await db.execute(select(Employee).where(Employee.id == batch.employee_id))
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee not found: {batch.employee_id}"
        )
    
    # Check for duplicate claims
    claims_data = [
        {
            "amount": claim_item.amount,
            "claim_date": claim_item.claim_date,
            "transaction_ref": claim_item.transaction_ref
        }
        for claim_item in batch.claims
    ]
    
    dup_result = await check_batch_duplicates(
        db=db,
        employee_id=batch.employee_id,
        claims_data=claims_data,
        tenant_id=UUID(settings.DEFAULT_TENANT_ID)
    )
    
    # Block submission if exact duplicates found
    if dup_result["exact_duplicates"]:
        duplicate_indices = dup_result["exact_duplicates"]
        duplicate_details = [
            dup_result["duplicate_details"].get(idx, {})
            for idx in duplicate_indices
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Duplicate claims detected. The following claims match existing submissions.",
                "duplicate_indices": duplicate_indices,
                "duplicate_details": duplicate_details
            }
        )
    
    created_claims = []
    claim_ids = []
    claim_numbers = []
    total_amount = 0.0
    
    for idx, claim_item in enumerate(batch.claims):
        # Generate unique claim number
        claim_number = f"CLM-{datetime.now().strftime('%Y%m%d')}-{str(uuid4())[:8].upper()}"
        
        # Map category
        category = _map_category(claim_item.category)
        
        # Build claim payload with field source tracking
        claim_payload = {
            "title": claim_item.title or f"{claim_item.category.title()} Expense",
            "vendor": claim_item.vendor,
            "transaction_ref": claim_item.transaction_ref,
            "payment_method": claim_item.payment_method,
            "project_code": batch.project_code,
            "batch_index": idx,
            "batch_total": len(batch.claims),
            # Field source tracking: 'ocr' for auto-extracted, 'manual' for user-entered
            "category_source": claim_item.category_source or 'manual',
            "title_source": claim_item.title_source or 'manual',
            "amount_source": claim_item.amount_source or 'manual',
            "date_source": claim_item.date_source or 'manual',
            "vendor_source": claim_item.vendor_source or 'manual',
            "description_source": claim_item.description_source or 'manual',
            "transaction_ref_source": claim_item.transaction_ref_source or 'manual',
            "payment_method_source": claim_item.payment_method_source or 'manual',
        }
        
        # Check if this specific claim is a potential duplicate (partial match)
        is_potential_dup = idx in dup_result.get("partial_duplicates", [])
        
        # Generate AI analysis for this claim
        ai_analysis = generate_ai_analysis(
            claim_data={
                "amount": claim_item.amount,
                "category": category,
                "claim_type": batch.claim_type.value,
                "claim_date": claim_item.claim_date,
                "description": claim_item.description,
                "vendor": claim_item.vendor,
                "transaction_ref": claim_item.transaction_ref,
                "title": claim_item.title,
                "amount_source": claim_item.amount_source,
                "date_source": claim_item.date_source,
                "vendor_source": claim_item.vendor_source,
                "category_source": claim_item.category_source,
            },
            has_document=False,  # No document in batch endpoint
            ocr_confidence=None,
            is_potential_duplicate=is_potential_dup
        )
        claim_payload["ai_analysis"] = ai_analysis
        
        # Generate policy compliance checks
        policy_checks = generate_policy_checks(
            claim_data={
                "amount": claim_item.amount,
                "category": category,
                "claim_type": batch.claim_type.value,
                "claim_date": claim_item.claim_date,
                "description": claim_item.description,
                "vendor": claim_item.vendor,
            },
            has_document=False,
            policy_limit=None,  # TODO: Get from policy_categories table
            submission_window_days=15,
            is_potential_duplicate=is_potential_dup
        )
        claim_payload["policy_checks"] = policy_checks
        
        # Create claim
        new_claim = Claim(
            tenant_id=UUID(settings.DEFAULT_TENANT_ID),
            claim_number=claim_number,
            employee_id=employee.id,
            employee_name=f"{employee.first_name} {employee.last_name}",
            department=employee.department,
            claim_type=batch.claim_type.value,
            category=category,
            amount=claim_item.amount,
            claim_date=claim_item.claim_date,
            description=claim_item.description or claim_item.title,
            claim_payload=claim_payload,
            status="PENDING_MANAGER",  # Direct submit to manager approval
            submission_date=datetime.utcnow(),
            can_edit=False
        )
        
        db.add(new_claim)
        created_claims.append(new_claim)
        total_amount += claim_item.amount
    
    await db.commit()
    
    # Refresh to get IDs
    for claim in created_claims:
        await db.refresh(claim)
        claim_ids.append(claim.id)
        claim_numbers.append(claim.claim_number)
    
    return BatchClaimResponse(
        success=True,
        total_claims=len(created_claims),
        total_amount=total_amount,
        claim_ids=claim_ids,
        claim_numbers=claim_numbers,
        message=f"Successfully created {len(created_claims)} claims totaling ₹{total_amount:.2f}"
    )


@router.post("/batch-with-document", response_model=BatchClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_batch_claims_with_document(
    batch_data: str = Form(...),  # JSON string of BatchClaimCreate
    file: Optional[UploadFile] = File(None),  # Optional document file
    db: AsyncSession = Depends(get_async_db),
):
    """
    Create multiple claims at once with an optional document attachment.
    The document will be uploaded to GCS and linked to all created claims.
    
    Args:
        batch_data: JSON string containing BatchClaimCreate data
        file: Optional document file (PDF or image) to attach to all claims
    """
    # Parse batch data from JSON string
    try:
        batch_dict = json.loads(batch_data)
        batch = BatchClaimCreate(**batch_dict)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid batch data format: {str(e)}"
        )
    
    # Get employee
    result = await db.execute(select(Employee).where(Employee.id == batch.employee_id))
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee not found: {batch.employee_id}"
        )
    
    # Check for duplicate claims
    claims_data = [
        {
            "amount": claim_item.amount,
            "claim_date": claim_item.claim_date,
            "transaction_ref": claim_item.transaction_ref
        }
        for claim_item in batch.claims
    ]
    
    dup_result = await check_batch_duplicates(
        db=db,
        employee_id=batch.employee_id,
        claims_data=claims_data,
        tenant_id=UUID(settings.DEFAULT_TENANT_ID)
    )
    
    # Block submission if exact duplicates found
    if dup_result["exact_duplicates"]:
        duplicate_indices = dup_result["exact_duplicates"]
        duplicate_details = [
            dup_result["duplicate_details"].get(idx, {})
            for idx in duplicate_indices
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Duplicate claims detected. The following claims match existing submissions.",
                "duplicate_indices": duplicate_indices,
                "duplicate_details": duplicate_details
            }
        )
    
    # Handle document upload if provided
    document_id = None
    gcs_uri = None
    gcs_blob_name = None
    file_path = None
    
    if file and file.filename:
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid4()}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file locally first
        try:
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            logger.info(f"Saved document locally: {file_path}")
        except Exception as e:
            logger.error(f"Failed to save file locally: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save document: {str(e)}"
            )
        
        # Upload to GCS
        try:
            gcs_uri, gcs_blob_name = upload_to_gcs(
                file_path=file_path,
                claim_id="batch_upload",  # Temporary - will be updated per claim
                original_filename=file.filename,
                content_type=file.content_type
            )
            if gcs_uri:
                logger.info(f"Document uploaded to GCS: {gcs_uri}")
        except Exception as e:
            logger.warning(f"GCS upload failed, using local storage: {e}")
    
    created_claims = []
    claim_ids = []
    claim_numbers = []
    total_amount = 0.0
    
    for idx, claim_item in enumerate(batch.claims):
        # Generate unique claim number
        claim_number = f"CLM-{datetime.now().strftime('%Y%m%d')}-{str(uuid4())[:8].upper()}"
        
        # Map category
        category = _map_category(claim_item.category)
        
        # Build claim payload with field source tracking
        claim_payload = {
            "title": claim_item.title or f"{claim_item.category.title()} Expense",
            "vendor": claim_item.vendor,
            "transaction_ref": claim_item.transaction_ref,
            "payment_method": claim_item.payment_method,
            "project_code": batch.project_code,
            "batch_index": idx,
            "batch_total": len(batch.claims),
            # Field source tracking
            "category_source": claim_item.category_source or 'manual',
            "title_source": claim_item.title_source or 'manual',
            "amount_source": claim_item.amount_source or 'manual',
            "date_source": claim_item.date_source or 'manual',
            "vendor_source": claim_item.vendor_source or 'manual',
            "description_source": claim_item.description_source or 'manual',
            "transaction_ref_source": claim_item.transaction_ref_source or 'manual',
            "payment_method_source": claim_item.payment_method_source or 'manual',
        }
        
        # Check if this specific claim is a potential duplicate (partial match)
        is_potential_dup = idx in dup_result.get("partial_duplicates", [])
        
        # Generate AI analysis - document attachment boosts score
        has_doc = file is not None and file.filename
        ai_analysis = generate_ai_analysis(
            claim_data={
                "amount": claim_item.amount,
                "category": category,
                "claim_type": batch.claim_type.value,
                "claim_date": claim_item.claim_date,
                "description": claim_item.description,
                "vendor": claim_item.vendor,
                "transaction_ref": claim_item.transaction_ref,
                "title": claim_item.title,
                "amount_source": claim_item.amount_source,
                "date_source": claim_item.date_source,
                "vendor_source": claim_item.vendor_source,
                "category_source": claim_item.category_source,
            },
            has_document=has_doc,
            ocr_confidence=None,  # Could be enhanced to use OCR results
            is_potential_duplicate=is_potential_dup
        )
        claim_payload["ai_analysis"] = ai_analysis
        
        # Generate policy compliance checks
        policy_checks = generate_policy_checks(
            claim_data={
                "amount": claim_item.amount,
                "category": category,
                "claim_type": batch.claim_type.value,
                "claim_date": claim_item.claim_date,
                "description": claim_item.description,
                "vendor": claim_item.vendor,
            },
            has_document=has_doc,
            policy_limit=None,  # TODO: Get from policy_categories table
            submission_window_days=15,
            is_potential_duplicate=is_potential_dup
        )
        claim_payload["policy_checks"] = policy_checks
        
        # Create claim
        new_claim = Claim(
            tenant_id=UUID(settings.DEFAULT_TENANT_ID),
            claim_number=claim_number,
            employee_id=employee.id,
            employee_name=f"{employee.first_name} {employee.last_name}",
            department=employee.department,
            claim_type=batch.claim_type.value,
            category=category,
            amount=claim_item.amount,
            claim_date=claim_item.claim_date,
            description=claim_item.description or claim_item.title,
            claim_payload=claim_payload,
            status="PENDING_MANAGER",
            submission_date=datetime.utcnow(),
            can_edit=False
        )
        
        db.add(new_claim)
        created_claims.append(new_claim)
        total_amount += claim_item.amount
    
    await db.commit()
    
    # Refresh to get claim IDs
    for claim in created_claims:
        await db.refresh(claim)
        claim_ids.append(claim.id)
        claim_numbers.append(claim.claim_number)
    
    # Now create document records for each claim if file was uploaded
    if file and file.filename and file_path:
        for claim in created_claims:
            # Create document record linked to this claim
            document = Document(
                id=uuid4(),
                tenant_id=claim.tenant_id,
                claim_id=claim.id,
                document_type="INVOICE",
                filename=file.filename,
                storage_path=str(file_path),
                file_size=file_path.stat().st_size if file_path.exists() else 0,
                file_type=file_path.suffix.lstrip('.').upper(),
                content_type=file.content_type or "application/octet-stream",
                gcs_uri=gcs_uri,
                gcs_blob_name=gcs_blob_name,
                storage_type="gcs" if gcs_uri else "local",
            )
            db.add(document)
        
        await db.commit()
        logger.info(f"Created {len(created_claims)} document records linked to claims")
    
    return BatchClaimResponse(
        success=True,
        total_claims=len(created_claims),
        total_amount=total_amount,
        claim_ids=claim_ids,
        claim_numbers=claim_numbers,
        message=f"Successfully created {len(created_claims)} claims totaling ₹{total_amount:.2f}" + 
                (f" with document attached" if file else "")
    )


@router.post("/", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    claim: ClaimCreate,
    db: AsyncSession = Depends(get_async_db),
    # current_user: User = Depends(get_current_user)  # TODO: Add auth
):
    """Create a new claim"""
    
    # Generate claim number
    claim_number = f"CLM-{datetime.now().strftime('%Y%m%d')}-{str(uuid4())[:8].upper()}"
    
    # Get employee (for now, using first employee - TODO: Use current_user)
    result = await db.execute(select(Employee).limit(1))
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Create claim
    new_claim = Claim(
        tenant_id=UUID(settings.DEFAULT_TENANT_ID),
        claim_number=claim_number,
        employee_id=employee.id,
        employee_name=f"{employee.first_name} {employee.last_name}",
        department=employee.department,
        claim_type=claim.claim_type,
        category=claim.category,
        amount=claim.amount,
        claim_date=claim.claim_date,
        description=claim.description,
        claim_payload=claim.claim_payload,
        status="PENDING_MANAGER",
        submission_date=datetime.utcnow()
    )
    
    db.add(new_claim)
    await db.commit()
    await db.refresh(new_claim)
    
    return new_claim


@router.post("/{claim_id}/submit", response_model=ClaimResponse)
async def submit_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Submit a claim for processing - moves to PENDING_MANAGER status"""
    
    # Get claim
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    if claim.status not in ["PENDING_MANAGER", "RETURNED_TO_EMPLOYEE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending or returned claims can be resubmitted"
        )
    
    # Check for duplicate claims (only for returned claims being resubmitted)
    if claim.status == "RETURNED_TO_EMPLOYEE":
        transaction_ref = claim.claim_payload.get("transaction_ref") if claim.claim_payload else None
        
        dup_result = await check_duplicate_claim(
            db=db,
            employee_id=claim.employee_id,
            amount=float(claim.amount),
            claim_date=claim.claim_date,
            transaction_ref=transaction_ref,
            exclude_claim_id=claim.id,
            tenant_id=claim.tenant_id
        )
        
        # Block submission if exact duplicate found
        if dup_result["is_duplicate"] and dup_result["match_type"] == "exact":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "This claim appears to be a duplicate of an existing submission.",
                    "duplicate_claims": dup_result["duplicate_claims"]
                }
            )
    
    # Update status - ensure it's PENDING_MANAGER for manager review
    claim.status = "PENDING_MANAGER"
    claim.submission_date = datetime.utcnow()
    claim.can_edit = False
    await db.commit()
    await db.refresh(claim)
    
    # Queue for processing
    has_documents = await _check_has_documents(db, claim_id)
    process_claim_task.delay(
        claim_id=str(claim_id),
        claim_type=claim.claim_type,
        has_documents=has_documents
    )
    
    return claim


@router.get("/", response_model=ClaimListResponse)
async def list_claims(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    claim_type: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
):
    """List claims with pagination and filters"""
    
    query = select(Claim)
    
    if status:
        query = query.where(Claim.status == status)
    if claim_type:
        query = query.where(Claim.claim_type == claim_type)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results
    query = query.offset(skip).limit(limit).order_by(Claim.created_at.desc())
    result = await db.execute(query)
    claims = result.scalars().all()
    
    return {
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
        "claims": claims
    }


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Get claim by ID"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    return claim


@router.put("/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: UUID,
    claim_update: ClaimUpdate,
    db: AsyncSession = Depends(get_async_db),
):
    """Update a claim - only claims in RETURNED_TO_EMPLOYEE status can be edited"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Only allow editing if claim was returned to employee
    if claim.status != "RETURNED_TO_EMPLOYEE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only claims returned for correction can be edited"
        )
    
    # Update fields
    if claim_update.amount is not None:
        claim.amount = claim_update.amount
    if claim_update.claim_date is not None:
        claim.claim_date = claim_update.claim_date
    if claim_update.description is not None:
        claim.description = claim_update.description
    if claim_update.claim_payload is not None:
        claim.claim_payload = claim_update.claim_payload
    
    # Update data source flags for edited fields
    if claim_update.edited_sources:
        payload = dict(claim.claim_payload or {})  # Make a copy
        source_field_map = {
            'amount': 'amount_source',
            'date': 'date_source',
            'description': 'description_source',
            'vendor': 'vendor_source',
            'category': 'category_source',
            'title': 'title_source',
            'transaction_ref': 'transaction_ref_source',
            'payment_method': 'payment_method_source',
        }
        for field in claim_update.edited_sources:
            source_key = source_field_map.get(field)
            if source_key:
                payload[source_key] = 'manual'
        claim.claim_payload = payload
        # Force SQLAlchemy to detect the change in JSONB field
        flag_modified(claim, 'claim_payload')
    
    # Handle status update for resubmission
    if claim_update.status == 'PENDING_MANAGER':
        # Check for duplicate claims before resubmission
        # Use updated values if provided, otherwise use existing values
        check_amount = float(claim_update.amount if claim_update.amount is not None else claim.amount)
        check_date = claim_update.claim_date if claim_update.claim_date is not None else claim.claim_date
        
        # Get transaction_ref from updated payload or existing payload
        if claim_update.claim_payload is not None:
            check_txn_ref = claim_update.claim_payload.get("transaction_ref")
        else:
            check_txn_ref = claim.claim_payload.get("transaction_ref") if claim.claim_payload else None
        
        dup_result = await check_duplicate_claim(
            db=db,
            employee_id=claim.employee_id,
            amount=check_amount,
            claim_date=check_date,
            transaction_ref=check_txn_ref,
            exclude_claim_id=claim.id,
            tenant_id=claim.tenant_id
        )
        
        # Block submission if exact duplicate found
        if dup_result["is_duplicate"] and dup_result["match_type"] == "exact":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "This claim appears to be a duplicate of an existing submission.",
                    "duplicate_claims": dup_result["duplicate_claims"]
                }
            )
        
        claim.status = 'PENDING_MANAGER'
        # Clear return-related fields on resubmission
        claim.return_reason = None
        claim.returned_at = None
    
    await db.commit()
    await db.refresh(claim)
    
    return claim


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Delete a claim (employees can delete their pending claims)"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Allow deletion for pending and returned claims only
    deletable_statuses = ["PENDING_MANAGER", "RETURNED_TO_EMPLOYEE"]
    if claim.status not in deletable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete claims in {claim.status} status. Only pending or returned claims can be deleted."
        )
    
    await db.delete(claim)
    await db.commit()


@router.post("/{claim_id}/return", response_model=ClaimResponse)
async def return_to_employee(
    claim_id: UUID,
    return_data: ReturnToEmployee,
    db: AsyncSession = Depends(get_async_db),
):
    """Return claim to employee for corrections"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Store previous status for approval history
    previous_status = claim.status
    
    # Update claim
    claim.status = "RETURNED_TO_EMPLOYEE"
    claim.can_edit = True
    claim.return_count += 1
    claim.return_reason = return_data.return_reason
    claim.returned_at = datetime.utcnow()
    # claim.returned_by = current_user.id  # TODO: Add auth
    
    # Add to approval history in claim_payload
    if not claim.claim_payload:
        claim.claim_payload = {}
    if "approval_history" not in claim.claim_payload:
        claim.claim_payload["approval_history"] = []
    
    claim.claim_payload["approval_history"].append({
        "action": "returned",
        "from_status": previous_status,
        "comment": return_data.return_reason,
        "timestamp": datetime.utcnow().isoformat()
    })
    # Flag claim_payload as modified for SQLAlchemy to detect JSONB changes
    flag_modified(claim, "claim_payload")
    
    # Create a Comment record for visibility in Edit Claim page
    # Find a user with MANAGER role to attribute the comment to (TODO: use actual auth user)
    approver_user = await db.execute(
        select(User).where(User.roles.contains(["MANAGER"])).limit(1)
    )
    approver = approver_user.scalar_one_or_none()
    
    if approver:
        comment = Comment(
            id=uuid4(),
            tenant_id=claim.tenant_id,
            claim_id=claim.id,
            comment_text=return_data.return_reason,
            comment_type="RETURN",
            user_id=approver.id,
            user_name=approver.full_name or approver.username,
            user_role="MANAGER",
            visible_to_employee=True
        )
        db.add(comment)
    
    await db.commit()
    await db.refresh(claim)
    
    # TODO: Send notification to employee
    
    return claim


@router.post("/{claim_id}/approve", response_model=ClaimResponse)
async def approve_claim(
    claim_id: UUID,
    approve_data: ApproveRejectClaim = None,
    db: AsyncSession = Depends(get_async_db),
):
    """Approve a claim - moves to next approval stage"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Define status transitions
    status_transitions = {
        "PENDING_MANAGER": "MANAGER_APPROVED",
        "MANAGER_APPROVED": "PENDING_HR",  # Auto-transition to HR
        "PENDING_HR": "HR_APPROVED",
        "HR_APPROVED": "PENDING_FINANCE",  # Auto-transition to Finance
        "PENDING_FINANCE": "FINANCE_APPROVED",
    }
    
    if claim.status not in status_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve claim in {claim.status} status"
        )
    
    # Get next status
    next_status = status_transitions[claim.status]
    
    # If manager approved, move directly to pending HR
    if next_status == "MANAGER_APPROVED":
        claim.status = "PENDING_HR"
    elif next_status == "HR_APPROVED":
        claim.status = "PENDING_FINANCE"
    else:
        claim.status = next_status
    
    claim.can_edit = False
    
    # Store approval comment in payload
    if approve_data and approve_data.comment:
        if not claim.claim_payload:
            claim.claim_payload = {}
        if "approval_history" not in claim.claim_payload:
            claim.claim_payload["approval_history"] = []
        claim.claim_payload["approval_history"].append({
            "action": "approved",
            "from_status": claim.status,
            "to_status": next_status,
            "comment": approve_data.comment,
            "timestamp": datetime.utcnow().isoformat()
        })
        # Flag claim_payload as modified for SQLAlchemy to detect JSONB changes
        flag_modified(claim, "claim_payload")
    
    await db.commit()
    await db.refresh(claim)
    
    return claim


@router.post("/{claim_id}/reject", response_model=ClaimResponse)
async def reject_claim(
    claim_id: UUID,
    reject_data: ApproveRejectClaim = None,
    db: AsyncSession = Depends(get_async_db),
):
    """Reject a claim"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Can only reject claims that are pending approval
    rejectable_statuses = ["PENDING_MANAGER", "PENDING_HR", "PENDING_FINANCE"]
    if claim.status not in rejectable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject claim in {claim.status} status"
        )
    
    previous_status = claim.status
    claim.status = "REJECTED"
    claim.can_edit = False
    
    # Store rejection comment in payload and create Comment record
    if reject_data and reject_data.comment:
        if not claim.claim_payload:
            claim.claim_payload = {}
        if "approval_history" not in claim.claim_payload:
            claim.claim_payload["approval_history"] = []
        claim.claim_payload["approval_history"].append({
            "action": "rejected",
            "from_status": previous_status,
            "comment": reject_data.comment,
            "timestamp": datetime.utcnow().isoformat()
        })
        # Flag claim_payload as modified for SQLAlchemy to detect JSONB changes
        flag_modified(claim, "claim_payload")
        
        # Create a Comment record for visibility
        # Find a user with appropriate role to attribute the comment to (TODO: use actual auth user)
        approver_user = await db.execute(
            select(User).where(User.roles.contains(["MANAGER"])).limit(1)
        )
        approver = approver_user.scalar_one_or_none()
        
        if approver:
            comment = Comment(
                id=uuid4(),
                tenant_id=claim.tenant_id,
                claim_id=claim.id,
                comment_text=reject_data.comment,
                comment_type="REJECTION",
                user_id=approver.id,
                user_name=approver.full_name or approver.username,
                user_role="APPROVER",
                visible_to_employee=True
            )
            db.add(comment)
    
    await db.commit()
    await db.refresh(claim)
    
    return claim


@router.post("/{claim_id}/settle", response_model=ClaimResponse)
async def settle_claim(
    claim_id: UUID,
    settlement_data: SettleClaim,
    db: AsyncSession = Depends(get_async_db),
):
    """Mark claim as settled with payment details"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    if claim.status != "FINANCE_APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only finance-approved claims can be settled"
        )
    
    # Update settlement details
    claim.settled = True
    claim.settled_date = datetime.utcnow()
    # claim.settled_by = current_user.id  # TODO: Add auth
    claim.payment_reference = settlement_data.payment_reference
    claim.payment_method = settlement_data.payment_method
    claim.amount_paid = settlement_data.amount_paid
    claim.status = "SETTLED"
    
    # Update payload
    if not claim.claim_payload:
        claim.claim_payload = {}
    claim.claim_payload["settlement"] = {
        "settled_date": datetime.utcnow().isoformat(),
        "payment_reference": settlement_data.payment_reference,
        "payment_method": settlement_data.payment_method,
        "amount_paid": float(settlement_data.amount_paid),
        "notes": settlement_data.settlement_notes
    }
    
    await db.commit()
    await db.refresh(claim)
    
    return claim


async def _check_has_documents(db: AsyncSession, claim_id: UUID) -> bool:
    """Check if claim has uploaded documents"""
    result = await db.execute(
        select(func.count()).select_from(Document).where(Document.claim_id == claim_id)
    )
    count = result.scalar()
    return count > 0


@router.post("/check-duplicate")
async def check_duplicate(
    employee_id: UUID,
    amount: float,
    claim_date: str,
    transaction_ref: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Check if a claim would be a duplicate before submission.
    
    Returns duplicate check result for real-time validation during form entry.
    """
    from datetime import datetime
    
    try:
        # Parse claim_date
        if 'T' in claim_date:
            parsed_date = datetime.fromisoformat(claim_date.replace('Z', '+00:00')).date()
        else:
            parsed_date = datetime.strptime(claim_date, "%Y-%m-%d").date()
        
        result = await check_duplicate_claim(
            db=db,
            employee_id=employee_id,
            amount=amount,
            claim_date=parsed_date,
            transaction_ref=transaction_ref,
            tenant_id=UUID(settings.DEFAULT_TENANT_ID)
        )
        
        return {
            "is_duplicate": result["is_duplicate"],
            "match_type": result["match_type"],
            "duplicate_claims": result["duplicate_claims"]
        }
    except Exception as e:
        logger.error(f"Error checking for duplicates: {e}")
        return {
            "is_duplicate": False,
            "match_type": None,
            "duplicate_claims": [],
            "error": str(e)
        }
