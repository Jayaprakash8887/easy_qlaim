"""
Claims API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
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

from database import get_async_db, get_sync_db
from models import Claim, Document, User, Comment, Designation
# Employee is now an alias for User
Employee = User
from schemas import (
    ClaimCreate, ClaimUpdate, ClaimResponse, ClaimListResponse,
    ReturnToEmployee, SettleClaim, HRCorrection, HREdit,
    BatchClaimCreate, BatchClaimResponse, ApproveRejectClaim
)
from agents.orchestrator import process_claim_task
from services.storage import upload_to_gcs
from services.duplicate_detection import check_duplicate_claim, check_batch_duplicates
from services.ai_analysis import generate_ai_analysis, generate_policy_checks
from services.security import audit_logger, get_client_ip
from services.redis_cache import redis_cache
from services.email_service import get_email_service
from services.communication_service import send_claim_notification as send_teams_notification
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Ensure upload directory exists
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Get settings for email notifications
_settings = get_settings()


async def _send_claim_notification(
    notification_type: str,
    claim: Claim,
    db: AsyncSession,
    **kwargs
):
    """
    Send email notification for claim events.
    
    notification_type: 'submitted', 'returned', 'rejected', 'settled'
    """
    try:
        # Check if SMTP is configured
        if not _settings.SMTP_HOST or not _settings.SMTP_USER:
            logger.debug("SMTP not configured, skipping email notification")
            return
        
        email_service = get_email_service()
        login_url = _settings.FRONTEND_URL or "http://localhost:8080"
        
        # Get employee email
        emp_result = await db.execute(select(User).where(User.id == claim.employee_id))
        employee = emp_result.scalar_one_or_none()
        
        if not employee or not employee.email:
            logger.warning(f"Cannot send notification: employee not found or no email for claim {claim.claim_number}")
            return
        
        if notification_type == 'submitted':
            # Send notification to the next approver
            approver_email = kwargs.get('approver_email')
            approver_name = kwargs.get('approver_name', 'Approver')
            
            if approver_email:
                email_service.send_claim_submitted_notification(
                    to_email=approver_email,
                    approver_name=approver_name,
                    employee_name=employee.full_name or employee.username,
                    claim_number=claim.claim_number,
                    amount=float(claim.amount),
                    category=claim.category,
                    description=claim.description or '',
                    login_url=login_url
                )
                logger.info(f"Sent claim submitted notification to {approver_email} for claim {claim.claim_number}")
        
        elif notification_type == 'returned':
            return_reason = kwargs.get('return_reason', 'Please review and correct')
            returned_by = kwargs.get('returned_by', 'Approver')
            
            email_service.send_claim_returned_notification(
                to_email=employee.email,
                employee_name=employee.full_name or employee.username,
                claim_number=claim.claim_number,
                amount=float(claim.amount),
                return_reason=return_reason,
                returned_by=returned_by,
                login_url=login_url
            )
            logger.info(f"Sent claim returned notification to {employee.email} for claim {claim.claim_number}")
        
        elif notification_type == 'rejected':
            rejection_reason = kwargs.get('rejection_reason', 'Claim does not meet policy requirements')
            rejected_by = kwargs.get('rejected_by', 'Approver')
            
            email_service.send_claim_rejected_notification(
                to_email=employee.email,
                employee_name=employee.full_name or employee.username,
                claim_number=claim.claim_number,
                amount=float(claim.amount),
                rejection_reason=rejection_reason,
                rejected_by=rejected_by,
                login_url=login_url
            )
            logger.info(f"Sent claim rejected notification to {employee.email} for claim {claim.claim_number}")
        
        elif notification_type == 'settled':
            payment_reference = kwargs.get('payment_reference')
            payment_method = kwargs.get('payment_method')
            settled_date = kwargs.get('settled_date')
            
            email_service.send_claim_settled_notification(
                to_email=employee.email,
                employee_name=employee.full_name or employee.username,
                claim_number=claim.claim_number,
                amount=float(claim.amount),
                payment_reference=payment_reference,
                payment_method=payment_method,
                settled_date=settled_date,
                login_url=login_url
            )
            logger.info(f"Sent claim settled notification to {employee.email} for claim {claim.claim_number}")
        
        # Also send Teams/Slack notification for claim events
        # (approval/rejection handled separately in their endpoints with more detail)
        if notification_type == 'submitted':
            try:
                from database import SyncSessionLocal as SessionLocal
                sync_db = SessionLocal()
                try:
                    await send_teams_notification(
                        db=sync_db,
                        tenant_id=claim.tenant_id,
                        event_type='submitted',
                        claim_number=claim.claim_number,
                        employee_name=employee.full_name or employee.username,
                        amount=float(claim.amount) if claim.amount else 0,
                        currency=claim.currency or "INR"
                    )
                finally:
                    sync_db.close()
            except Exception as teams_err:
                logger.error(f"Failed to send Teams notification for claim {claim.claim_number}: {str(teams_err)}")
            
    except Exception as e:
        logger.error(f"Failed to send email notification for claim {claim.claim_number}: {str(e)}")


async def _get_next_approver(db: AsyncSession, claim: Claim, employee: User) -> tuple:
    """
    Get the next approver for a claim based on its status.
    Returns (email, name) tuple or (None, None) if not found.
    """
    try:
        status = claim.status
        
        if status == "PENDING_MANAGER":
            # Get employee's manager
            if employee.manager_id:
                mgr_result = await db.execute(select(User).where(User.id == employee.manager_id))
                manager = mgr_result.scalar_one_or_none()
                if manager and manager.email:
                    return (manager.email, manager.full_name or manager.username)
        
        elif status == "PENDING_HR":
            # Get any HR user in the same tenant
            hr_result = await db.execute(
                select(User).where(
                    User.tenant_id == claim.tenant_id,
                    User.is_active == True,
                    User.roles.contains(["HR"])
                ).limit(1)
            )
            hr_user = hr_result.scalar_one_or_none()
            if hr_user and hr_user.email:
                return (hr_user.email, hr_user.full_name or hr_user.username)
        
        elif status == "PENDING_FINANCE":
            # Get any Finance user in the same tenant
            fin_result = await db.execute(
                select(User).where(
                    User.tenant_id == claim.tenant_id,
                    User.is_active == True,
                    User.roles.contains(["FINANCE"])
                ).limit(1)
            )
            fin_user = fin_result.scalar_one_or_none()
            if fin_user and fin_user.email:
                return (fin_user.email, fin_user.full_name or fin_user.username)
        
        return (None, None)
    except Exception as e:
        logger.error(f"Error getting next approver: {str(e)}")
        return (None, None)


def _map_category(category_str: str) -> str:
    """
    Map/validate category string.
    
    Categories are now dynamic from policy_categories table.
    This function normalizes the category code to uppercase.
    Common category names are mapped to standard codes.
    """
    if not category_str:
        return 'OTHER'
    
    # Standard category mapping
    category_map = {
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
    
    # Check category map first
    lower_cat = category_str.lower()
    if lower_cat in category_map:
        return category_map[lower_cat]
    
    # For dynamic categories (from policy_categories table), 
    # return as uppercase to match category_code convention
    return category_str.upper()


def _get_tenant_fiscal_year_start(tenant_id: UUID) -> str:
    """
    Get the fiscal year start month for a tenant.
    Returns month code like 'jan', 'apr', etc. Default is 'apr'.
    """
    from database import SyncSessionLocal
    from models import SystemSettings
    from sqlalchemy import and_
    
    sync_db = SyncSessionLocal()
    try:
        setting = sync_db.query(SystemSettings).filter(
            and_(
                SystemSettings.setting_key == "fiscal_year_start",
                SystemSettings.tenant_id == tenant_id
            )
        ).first()
        
        if setting and setting.setting_value:
            return setting.setting_value.lower().strip()
        return "apr"  # Default to April
    except Exception as e:
        logger.warning(f"Failed to get fiscal year start for tenant {tenant_id}: {e}")
        return "apr"
    finally:
        sync_db.close()


def _get_initial_claim_status(
    tenant_id: UUID,
    employee_email: str,
    employee_designation_code: Optional[str],
    claim_amount: float,
    category_code: Optional[str] = None
) -> tuple[str, dict]:
    """
    Determine the initial claim status based on approval skip rules.
    
    Returns:
        tuple: (initial_status, skip_info_dict)
        
    The skip_info_dict contains details about which levels were skipped and why.
    """
    from api.v1.approval_skip_rules import get_approval_skip_for_employee
    from database import SyncSessionLocal
    
    # Use a sync session for the skip rule check
    sync_db = SyncSessionLocal()
    try:
        # Check if any skip rules apply
        skip_result = get_approval_skip_for_employee(
            db=sync_db,
            tenant_id=tenant_id,
            employee_email=employee_email,
            employee_designation=employee_designation_code,
            claim_amount=claim_amount,
            category_code=category_code
        )
    finally:
        sync_db.close()
    
    skip_info = {
        "skip_manager": skip_result.skip_manager,
        "skip_hr": skip_result.skip_hr,
        "skip_finance": skip_result.skip_finance,
        "applied_rule_id": str(skip_result.applied_rule_id) if skip_result.applied_rule_id else None,
        "applied_rule_name": skip_result.applied_rule_name,
        "reason": skip_result.reason
    }
    
    # Determine initial status based on skipped levels
    # Normal flow: PENDING_MANAGER -> PENDING_HR -> PENDING_FINANCE -> SETTLED
    
    if skip_result.skip_manager and skip_result.skip_hr and skip_result.skip_finance:
        # All approvals skipped - go directly to settled
        initial_status = "SETTLED"
        skip_info["auto_settled"] = True
        logger.info(f"Claim auto-settled due to skip rules: {skip_result.reason}")
    elif skip_result.skip_manager and skip_result.skip_hr:
        # Manager and HR skipped - go to Finance
        initial_status = "PENDING_FINANCE"
        logger.info(f"Claim skipping manager and HR approval: {skip_result.reason}")
    elif skip_result.skip_manager:
        # Only manager skipped - go to HR
        initial_status = "PENDING_HR"
        logger.info(f"Claim skipping manager approval: {skip_result.reason}")
    else:
        # Normal flow - start with manager
        initial_status = "PENDING_MANAGER"
    
    return initial_status, skip_info


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
        tenant_id=employee.tenant_id
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
        
        # Get tenant's fiscal year start for policy checks
        fiscal_year_start = _get_tenant_fiscal_year_start(employee.tenant_id)
        
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
            is_potential_duplicate=is_potential_dup,
            fiscal_year_start=fiscal_year_start
        )
        claim_payload["policy_checks"] = policy_checks
        
        # Check approval skip rules for this employee
        initial_status, skip_info = _get_initial_claim_status(
            tenant_id=employee.tenant_id,
            employee_email=employee.email,
            employee_designation_code=employee.designation,
            claim_amount=claim_item.amount,
            category_code=category
        )
        
        # Store skip info in claim payload for audit trail
        if skip_info.get("applied_rule_id"):
            claim_payload["approval_skip_info"] = skip_info
        
        # Create claim
        new_claim = Claim(
            tenant_id=employee.tenant_id,
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
            status=initial_status,  # Use status from skip rule check
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
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(employee.tenant_id) if employee.tenant_id else None,
        employee_id=str(employee.id) if employee.id else None
    )
    
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
        tenant_id=employee.tenant_id
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
        
        # Create tenant-based local folder structure
        tenant_id_str = str(employee.tenant_id) if employee.tenant_id else "default"
        tenant_upload_dir = UPLOAD_DIR / "tenants" / tenant_id_str / "claims" / "batch_upload" / "documents"
        tenant_upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = tenant_upload_dir / unique_filename
        
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
        
        # Upload to GCS with tenant-based folder structure
        try:
            gcs_uri, gcs_blob_name = upload_to_gcs(
                file_path=file_path,
                claim_id="batch_upload",  # Temporary - will be updated per claim
                original_filename=file.filename,
                content_type=file.content_type,
                tenant_id=str(employee.tenant_id) if employee.tenant_id else None
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
        
        # Get tenant's fiscal year start for policy checks
        fiscal_year_start = _get_tenant_fiscal_year_start(employee.tenant_id)
        
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
            is_potential_duplicate=is_potential_dup,
            fiscal_year_start=fiscal_year_start
        )
        claim_payload["policy_checks"] = policy_checks
        
        # Check approval skip rules for this employee
        initial_status, skip_info = _get_initial_claim_status(
            tenant_id=employee.tenant_id,
            employee_email=employee.email,
            employee_designation_code=employee.designation,
            claim_amount=claim_item.amount,
            category_code=category
        )
        
        # Store skip info in claim payload for audit trail
        if skip_info.get("applied_rule_id"):
            claim_payload["approval_skip_info"] = skip_info
        
        # Create claim
        new_claim = Claim(
            tenant_id=employee.tenant_id,
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
            status=initial_status,  # Use status from skip rule check
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
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(employee.tenant_id) if employee.tenant_id else None,
        employee_id=str(employee.id) if employee.id else None
    )
    
    # Send email notifications to approvers for each created claim
    for claim in created_claims:
        approver_email, approver_name = await _get_next_approver(db, claim, employee)
        if approver_email:
            await _send_claim_notification(
                'submitted',
                claim,
                db,
                approver_email=approver_email,
                approver_name=approver_name
            )
    
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
    
    # Check approval skip rules for this employee
    initial_status, skip_info = _get_initial_claim_status(
        tenant_id=employee.tenant_id,
        employee_email=employee.email,
        employee_designation_code=employee.designation,
        claim_amount=float(claim.amount),
        category_code=claim.category
    )
    
    # Prepare claim payload with skip info if applicable
    claim_payload = claim.claim_payload or {}
    if skip_info.get("applied_rule_id"):
        claim_payload["approval_skip_info"] = skip_info
    
    # Create claim
    new_claim = Claim(
        tenant_id=employee.tenant_id,
        claim_number=claim_number,
        employee_id=employee.id,
        employee_name=f"{employee.first_name} {employee.last_name}",
        department=employee.department,
        claim_type=claim.claim_type,
        category=claim.category,
        amount=claim.amount,
        claim_date=claim.claim_date,
        description=claim.description,
        claim_payload=claim_payload,
        status=initial_status,  # Use status from skip rule check
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
    """Submit a claim for processing - moves to appropriate status based on skip rules"""
    
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
    
    # Get employee for skip rule check
    emp_result = await db.execute(select(Employee).where(Employee.id == claim.employee_id))
    employee = emp_result.scalar_one_or_none()
    
    # Check approval skip rules
    if employee:
        initial_status, skip_info = _get_initial_claim_status(
            tenant_id=claim.tenant_id,
            employee_email=employee.email,
            employee_designation_code=employee.designation,
            claim_amount=float(claim.amount),
            category_code=claim.category
        )
        
        # Store skip info in claim payload if rules applied
        if skip_info.get("applied_rule_id"):
            if not claim.claim_payload:
                claim.claim_payload = {}
            claim.claim_payload["approval_skip_info"] = skip_info
            flag_modified(claim, "claim_payload")
        
        claim.status = initial_status
    else:
        # Fallback to normal flow if employee not found
        claim.status = "PENDING_MANAGER"
    
    claim.submission_date = datetime.utcnow()
    claim.can_edit = False
    await db.commit()
    await db.refresh(claim)
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(claim.tenant_id) if claim.tenant_id else None,
        employee_id=str(claim.employee_id) if claim.employee_id else None
    )
    
    # Send Teams/Slack notification for claim submission
    try:
        employee_name = employee.full_name if employee else "Unknown"
        
        # Get sync db session for communication service
        from database import SyncSessionLocal as SessionLocal
        sync_db = SessionLocal()
        try:
            await send_teams_notification(
                db=sync_db,
                tenant_id=claim.tenant_id,
                event_type='submitted',
                claim_number=claim.claim_number,
                employee_name=employee_name,
                amount=float(claim.amount) if claim.amount else 0,
                currency=claim.currency or "INR"
            )
        finally:
            sync_db.close()
    except Exception as e:
        logger.error(f"Failed to send Teams notification for claim {claim.claim_number}: {str(e)}")
    
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
    tenant_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    role: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
):
    """List claims with pagination and filters
    
    Role-based filtering:
    - manager: Only sees claims from direct reports (employees where manager_id = user_id)
    - hr: Sees claims in PENDING_HR, MANAGER_APPROVED status
    - finance: Sees claims in PENDING_FINANCE, HR_APPROVED status
    - admin: Sees all claims
    - employee: Sees only their own claims
    """
    from services.category_cache import category_cache
    from services.cached_data import cached_data
    
    query = select(Claim)
    
    # Filter by tenant if provided
    if tenant_id:
        query = query.where(Claim.tenant_id == tenant_id)
    
    # Role-based filtering for managers - show claims from direct reports only
    if role == 'manager' and user_id:
        # Get direct reports (employees where manager_id = current user)
        direct_reports_query = select(User.id).where(
            User.manager_id == user_id,
            User.is_active == True
        )
        direct_reports_result = await db.execute(direct_reports_query)
        direct_report_ids = [row[0] for row in direct_reports_result.fetchall()]
        
        if direct_report_ids:
            # Filter claims to only those from direct reports
            query = query.where(Claim.employee_id.in_(direct_report_ids))
        else:
            # No direct reports - return empty list by filtering for impossible condition
            query = query.where(Claim.employee_id == None)
    elif role == 'employee' and user_id:
        # Employees only see their own claims
        query = query.where(Claim.employee_id == user_id)
    
    if status:
        query = query.where(Claim.status == status)
    if claim_type:
        query = query.where(Claim.claim_type == claim_type)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results - order by updated_at desc so latest modified comes first
    query = query.offset(skip).limit(limit).order_by(Claim.updated_at.desc())
    result = await db.execute(query)
    claims = result.scalars().all()
    
    # Collect unique project codes for batch lookup
    project_codes = set()
    for claim in claims:
        payload = claim.claim_payload or {}
        if payload.get('project_code'):
            project_codes.add(payload['project_code'])
    
    # Batch lookup project names using cached data service (tenant-scoped)
    project_names = {}
    if project_codes and tenant_id:
        project_names = await cached_data.get_project_names_for_codes(db, tenant_id, list(project_codes))
    
    # Add category_name and project_name to each claim
    claims_with_names = []
    for claim in claims:
        payload = claim.claim_payload or {}
        project_code = payload.get('project_code', '')
        claim_dict = {
            **{c.name: getattr(claim, c.name) for c in claim.__table__.columns},
            "category_name": category_cache.get_category_name_by_code(claim.category, tenant_id=claim.tenant_id),
            "project_name": project_names.get(project_code, '')
        }
        claims_with_names.append(claim_dict)
    
    return {
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
        "claims": claims_with_names
    }


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Get claim by ID"""
    from services.category_cache import category_cache
    from services.cached_data import cached_data
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Lookup project name using cached data service (tenant-scoped)
    payload = claim.claim_payload or {}
    project_code = payload.get('project_code', '')
    project_name = ''
    if project_code and claim.tenant_id:
        project = await cached_data.get_project_by_code(db, claim.tenant_id, project_code)
        if project:
            project_name = project.get('project_name', '')
    
    # Add category_name and project_name to the response
    claim_dict = {
        **{c.name: getattr(claim, c.name) for c in claim.__table__.columns},
        "category_name": category_cache.get_category_name_by_code(claim.category, tenant_id=claim.tenant_id),
        "project_name": project_name
    }
    
    return claim_dict


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
    if claim_update.category is not None:
        claim.category = claim_update.category
    if claim_update.claim_payload is not None:
        claim.claim_payload = claim_update.claim_payload
    
    # Update payload fields (title, project_code, transaction_ref)
    payload = dict(claim.claim_payload or {})
    if claim_update.title is not None:
        payload['title'] = claim_update.title
    if claim_update.project_code is not None:
        payload['project_code'] = claim_update.project_code
    if claim_update.transaction_ref is not None:
        payload['transaction_ref'] = claim_update.transaction_ref
    
    # Update data source flags for edited fields
    if claim_update.edited_sources:
        source_field_map = {
            'amount': 'amount_source',
            'date': 'date_source',
            'description': 'description_source',
            'vendor': 'vendor_source',
            'category': 'category_source',
            'title': 'title_source',
            'transaction_ref': 'transaction_ref_source',
            'payment_method': 'payment_method_source',
            'project_code': 'project_code_source',
        }
        for field in claim_update.edited_sources:
            source_key = source_field_map.get(field)
            if source_key:
                payload[source_key] = 'manual'
    
    # Always save payload if we made changes
    if payload != (claim.claim_payload or {}):
        claim.claim_payload = payload
        # Force SQLAlchemy to detect the change in JSONB field
        flag_modified(claim, 'claim_payload')
    
    # Handle status update for resubmission
    if claim_update.status == 'PENDING_MANAGER':
        # Regenerate policy checks with updated claim data
        check_amount = float(claim_update.amount if claim_update.amount is not None else claim.amount)
        check_date = claim_update.claim_date if claim_update.claim_date is not None else claim.claim_date
        check_category = claim_update.category if claim_update.category is not None else claim.category
        check_description = claim_update.description if claim_update.description is not None else claim.description
        
        # Get transaction_ref from updated payload or existing payload
        if claim_update.claim_payload is not None:
            check_txn_ref = claim_update.claim_payload.get("transaction_ref")
        else:
            check_txn_ref = claim.claim_payload.get("transaction_ref") if claim.claim_payload else None
        
        # Get tenant's fiscal year start for policy checks
        fiscal_year_start = _get_tenant_fiscal_year_start(claim.tenant_id)
        
        # Check for potential duplicate
        dup_result = await check_duplicate_claim(
            db=db,
            employee_id=claim.employee_id,
            amount=check_amount,
            claim_date=check_date,
            transaction_ref=check_txn_ref,
            exclude_claim_id=claim.id,
            tenant_id=claim.tenant_id
        )
        
        is_potential_dup = dup_result.get("is_duplicate", False)
        
        # Check if claim has documents - use claim_payload since documents relationship requires lazy load
        # The document_urls or documents array in claim_payload indicates attached documents
        claim_payload_data = claim.claim_payload or {}
        has_documents = bool(
            claim_payload_data.get("document_urls") or 
            claim_payload_data.get("documents") or
            claim_payload_data.get("document_id")
        )
        
        # Regenerate policy checks
        policy_checks = generate_policy_checks(
            claim_data={
                "amount": check_amount,
                "category": check_category,
                "claim_type": claim.claim_type,
                "claim_date": check_date,
                "description": check_description,
                "vendor": payload.get("vendor") or (claim.claim_payload or {}).get("vendor"),
            },
            has_document=has_documents,
            policy_limit=None,  # TODO: Get from policy_categories table based on category
            submission_window_days=15,
            is_potential_duplicate=is_potential_dup,
            fiscal_year_start=fiscal_year_start
        )
        
        # Update policy_checks in payload
        payload = dict(claim.claim_payload or {})
        payload["policy_checks"] = policy_checks
        claim.claim_payload = payload
        flag_modified(claim, 'claim_payload')
        
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
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(claim.tenant_id) if claim.tenant_id else None,
        employee_id=str(claim.employee_id) if claim.employee_id else None
    )
    
    return claim


@router.put("/{claim_id}/hr-edit", response_model=ClaimResponse)
async def hr_edit_claim(
    claim_id: UUID,
    hr_edit: HREdit,
    request: Request,
    tenant_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_async_db),
):
    """
    HR Edit endpoint - allows HR role to edit claim fields during review.
    Fields edited by HR are marked with 'hr' source indicator.
    """
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Only allow HR edit for claims pending HR approval
    if claim.status != "PENDING_HR":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only claims pending HR approval can be edited by HR"
        )
    
    # Update direct fields
    if hr_edit.amount is not None:
        claim.amount = hr_edit.amount
    if hr_edit.description is not None:
        claim.description = hr_edit.description
    if hr_edit.category is not None:
        claim.category = hr_edit.category
    
    # Update claim_payload with HR edits and source tracking
    payload = dict(claim.claim_payload or {})
    payload_modified = False
    
    # Handle project_code - stored in claim_payload
    if hr_edit.project_code is not None:
        payload['project_code'] = hr_edit.project_code if hr_edit.project_code else None
        payload_modified = True
    
    if hr_edit.claim_payload is not None:
        # Merge the new payload data
        for key, value in hr_edit.claim_payload.items():
            payload[key] = value
        payload_modified = True
    
    # Update source fields for HR-edited fields
    if hr_edit.hr_edited_fields:
        source_field_map = {
            'amount': 'amount_source',
            'date': 'date_source',
            'description': 'description_source',
            'vendor': 'vendor_source',
            'category': 'category_source',
            'title': 'title_source',
            'transactionRef': 'transaction_ref_source',
            'transaction_ref': 'transaction_ref_source',
            'payment_method': 'payment_method_source',
            'projectCode': 'project_code_source',
            'project_code': 'project_code_source',
        }
        
        for field in hr_edit.hr_edited_fields:
            source_key = source_field_map.get(field)
            if source_key:
                payload[source_key] = 'hr'
                payload_modified = True
    
    if payload_modified:
        claim.claim_payload = payload
        flag_modified(claim, 'claim_payload')
    
    # Add HR edit comment to claim history
    if hr_edit.hr_edited_fields:
        edited_fields_str = ', '.join(hr_edit.hr_edited_fields)
        payload = dict(claim.claim_payload or {})
        comments_list = payload.get('comments', [])
        if isinstance(comments_list, list):
            comments_list.append({
                'timestamp': datetime.utcnow().isoformat(),
                'user': 'HR',
                'role': 'HR',
                'comment': f'HR edited the following fields: {edited_fields_str}',
                'type': 'HR_EDIT'
            })
            payload['comments'] = comments_list
            claim.claim_payload = payload
            flag_modified(claim, 'claim_payload')
    
    await db.commit()
    await db.refresh(claim)
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(claim.tenant_id) if claim.tenant_id else None,
        employee_id=str(claim.employee_id) if claim.employee_id else None
    )
    
    logger.info(f"HR edited claim {claim_id}, fields: {hr_edit.hr_edited_fields}")
    
    # Audit log for HR edit
    audit_logger.log_claim_action(
        user_id="hr",
        tenant_id=str(claim.tenant_id),
        claim_id=str(claim_id),
        action="edit",
        details={
            "edited_by": "HR",
            "edited_fields": hr_edit.hr_edited_fields,
            "new_amount": float(hr_edit.amount) if hr_edit.amount else None
        },
        ip_address=get_client_ip(request)
    )
    
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
    
    # Store tenant and employee IDs before deletion for cache invalidation
    tenant_id = str(claim.tenant_id) if claim.tenant_id else None
    employee_id = str(claim.employee_id) if claim.employee_id else None
    
    await db.delete(claim)
    await db.commit()
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=tenant_id,
        employee_id=employee_id
    )


@router.post("/{claim_id}/return", response_model=ClaimResponse)
async def return_to_employee(
    claim_id: UUID,
    return_data: ReturnToEmployee,
    request: Request,
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
        "approver_id": str(return_data.approver_id) if return_data.approver_id else None,
        "approver_name": return_data.approver_name,
        "approver_role": return_data.approver_role,
        "timestamp": datetime.utcnow().isoformat()
    })
    # Flag claim_payload as modified for SQLAlchemy to detect JSONB changes
    flag_modified(claim, "claim_payload")
    
    # Determine role for comment based on previous status
    role_map = {
        "PENDING_MANAGER": "MANAGER",
        "PENDING_HR": "HR",
        "PENDING_FINANCE": "FINANCE"
    }
    comment_role = return_data.approver_role or role_map.get(previous_status, "APPROVER")
    
    # Create a Comment record for visibility in Edit Claim page
    if return_data.approver_id and return_data.approver_name:
        comment = Comment(
            id=uuid4(),
            tenant_id=claim.tenant_id,
            claim_id=claim.id,
            comment_text=f"[RETURNED] {return_data.return_reason}",
            comment_type="RETURN",
            user_id=return_data.approver_id,
            user_name=return_data.approver_name,
            user_role=comment_role,
            visible_to_employee=True
        )
        db.add(comment)
    else:
        # Fallback: find a user with appropriate role
        role_to_find = role_map.get(previous_status, "MANAGER")
        approver_user = await db.execute(
            select(User).where(User.roles.contains([role_to_find])).limit(1)
        )
        approver = approver_user.scalar_one_or_none()
        if approver:
            comment = Comment(
                id=uuid4(),
                tenant_id=claim.tenant_id,
                claim_id=claim.id,
                comment_text=f"[RETURNED] {return_data.return_reason}",
                comment_type="RETURN",
                user_id=approver.id,
                user_name=approver.full_name or approver.username,
                user_role=comment_role,
                visible_to_employee=True
            )
            db.add(comment)
    
    await db.commit()
    await db.refresh(claim)
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(claim.tenant_id) if claim.tenant_id else None,
        employee_id=str(claim.employee_id) if claim.employee_id else None
    )
    
    # Audit log for claim return
    audit_logger.log_claim_action(
        user_id="approver",
        tenant_id=str(claim.tenant_id),
        claim_id=str(claim_id),
        action="return",
        details={
            "previous_status": previous_status,
            "return_reason": return_data.return_reason,
            "return_count": claim.return_count
        },
        ip_address=get_client_ip(request)
    )
    
    # Send email notification to employee
    await _send_claim_notification(
        'returned',
        claim,
        db,
        return_reason=return_data.return_reason,
        returned_by=return_data.approver_name or comment_role
    )
    
    return claim


@router.post("/{claim_id}/approve", response_model=ClaimResponse)
async def approve_claim(
    claim_id: UUID,
    request: Request,
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
    previous_status = claim.status
    next_status = status_transitions[claim.status]
    
    # If manager approved, move directly to pending HR
    if next_status == "MANAGER_APPROVED":
        claim.status = "PENDING_HR"
    elif next_status == "HR_APPROVED":
        claim.status = "PENDING_FINANCE"
    else:
        claim.status = next_status
    
    claim.can_edit = False
    
    # Always record approval history
    if not claim.claim_payload:
        claim.claim_payload = {}
    if "approval_history" not in claim.claim_payload:
        claim.claim_payload["approval_history"] = []
    
    # Determine role for this approval based on previous status
    role_map = {
        "PENDING_MANAGER": "MANAGER",
        "PENDING_HR": "HR",
        "PENDING_FINANCE": "FINANCE"
    }
    approver_role = (approve_data.approver_role if approve_data else None) or role_map.get(previous_status, "APPROVER")
    approver_name = (approve_data.approver_name if approve_data else None) or approver_role
    approver_id = str(approve_data.approver_id) if approve_data and approve_data.approver_id else None
    comment_text = approve_data.comment if approve_data and approve_data.comment else None
    
    claim.claim_payload["approval_history"].append({
        "action": "approved",
        "from_status": previous_status,
        "to_status": claim.status,
        "comment": comment_text,
        "approver_id": approver_id,
        "approver_name": approver_name,
        "approver_role": approver_role,
        "timestamp": datetime.utcnow().isoformat()
    })
    # Flag claim_payload as modified for SQLAlchemy to detect JSONB changes
    flag_modified(claim, "claim_payload")
    
    # Create a Comment record for visibility (only if comment provided)
    if approve_data and approve_data.comment:
        comment_role = approver_role
        
        # Use provided approver info or find a fallback user
        if approve_data.approver_id and approve_data.approver_name:
            comment = Comment(
                id=uuid4(),
                tenant_id=claim.tenant_id,
                claim_id=claim.id,
                comment_text=f"[APPROVED] {approve_data.comment}",
                comment_type="APPROVAL",
                user_id=approve_data.approver_id,
                user_name=approve_data.approver_name,
                user_role=comment_role,
                visible_to_employee=True
            )
            db.add(comment)
        else:
            # Fallback: find a user with appropriate role
            role_to_find = role_map.get(previous_status, "MANAGER")
            approver_user = await db.execute(
                select(User).where(User.roles.contains([role_to_find])).limit(1)
            )
            approver = approver_user.scalar_one_or_none()
            if approver:
                comment = Comment(
                    id=uuid4(),
                    tenant_id=claim.tenant_id,
                    claim_id=claim.id,
                    comment_text=f"[APPROVED] {approve_data.comment}",
                    comment_type="APPROVAL",
                    user_id=approver.id,
                    user_name=approver.full_name or approver.username,
                    user_role=comment_role,
                    visible_to_employee=True
                )
                db.add(comment)
    
    await db.commit()
    await db.refresh(claim)
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(claim.tenant_id) if claim.tenant_id else None,
        employee_id=str(claim.employee_id) if claim.employee_id else None
    )
    
    # Audit log for claim approval
    audit_logger.log_claim_action(
        user_id="system",  # Approver ID not passed in current request body
        tenant_id=str(claim.tenant_id),
        claim_id=str(claim_id),
        action="approve",
        details={
            "previous_status": previous_status,
            "new_status": claim.status,
            "amount": float(claim.amount) if claim.amount else None,
            "comment": approve_data.comment if approve_data else None
        },
        ip_address=get_client_ip(request)
    )
    
    # Send Teams/Slack notification for approval
    try:
        # Get employee name for notification
        employee_result = await db.execute(select(User).where(User.id == claim.employee_id))
        employee = employee_result.scalar_one_or_none()
        employee_name = employee.full_name if employee else "Unknown"
        
        # Get sync db session for communication service
        from database import SyncSessionLocal as SessionLocal
        sync_db = SessionLocal()
        try:
            await send_teams_notification(
                db=sync_db,
                tenant_id=claim.tenant_id,
                event_type='approved',
                claim_number=claim.claim_number,
                employee_name=employee_name,
                amount=float(claim.amount) if claim.amount else 0,
                currency=claim.currency or "INR",
                approver_name=approver_name
            )
        finally:
            sync_db.close()
    except Exception as e:
        logger.error(f"Failed to send Teams notification for claim {claim.claim_number}: {str(e)}")
    
    return claim


@router.post("/{claim_id}/reject", response_model=ClaimResponse)
async def reject_claim(
    claim_id: UUID,
    request: Request,
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
            "approver_id": str(reject_data.approver_id) if reject_data.approver_id else None,
            "approver_name": reject_data.approver_name,
            "approver_role": reject_data.approver_role,
            "timestamp": datetime.utcnow().isoformat()
        })
        # Flag claim_payload as modified for SQLAlchemy to detect JSONB changes
        flag_modified(claim, "claim_payload")
        
        # Determine role for comment based on previous status
        role_map = {
            "PENDING_MANAGER": "MANAGER",
            "PENDING_HR": "HR",
            "PENDING_FINANCE": "FINANCE"
        }
        comment_role = reject_data.approver_role or role_map.get(previous_status, "APPROVER")
        
        # Create a Comment record for visibility
        if reject_data.approver_id and reject_data.approver_name:
            comment = Comment(
                id=uuid4(),
                tenant_id=claim.tenant_id,
                claim_id=claim.id,
                comment_text=f"[REJECTED] {reject_data.comment}",
                comment_type="REJECTION",
                user_id=reject_data.approver_id,
                user_name=reject_data.approver_name,
                user_role=comment_role,
                visible_to_employee=True
            )
            db.add(comment)
        else:
            # Fallback: find a user with appropriate role
            role_to_find = role_map.get(previous_status, "MANAGER")
            approver_user = await db.execute(
                select(User).where(User.roles.contains([role_to_find])).limit(1)
            )
            approver = approver_user.scalar_one_or_none()
            if approver:
                comment = Comment(
                    id=uuid4(),
                    tenant_id=claim.tenant_id,
                    claim_id=claim.id,
                    comment_text=f"[REJECTED] {reject_data.comment}",
                    comment_type="REJECTION",
                    user_id=approver.id,
                    user_name=approver.full_name or approver.username,
                    user_role=comment_role,
                    visible_to_employee=True
                )
                db.add(comment)
    
    await db.commit()
    await db.refresh(claim)
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(claim.tenant_id) if claim.tenant_id else None,
        employee_id=str(claim.employee_id) if claim.employee_id else None
    )
    
    # Audit log for claim rejection
    audit_logger.log_claim_action(
        user_id="system",  # Approver ID not passed in current request body
        tenant_id=str(claim.tenant_id),
        claim_id=str(claim_id),
        action="reject",
        details={
            "previous_status": previous_status,
            "amount": float(claim.amount) if claim.amount else None,
            "comment": reject_data.comment if reject_data else None
        },
        ip_address=get_client_ip(request)
    )
    
    # Determine who rejected for email notification
    role_map = {
        "PENDING_MANAGER": "MANAGER",
        "PENDING_HR": "HR",
        "PENDING_FINANCE": "FINANCE"
    }
    rejected_by = (reject_data.approver_name if reject_data else None) or role_map.get(previous_status, "Approver")
    rejection_reason = (reject_data.comment if reject_data else None) or "Claim does not meet policy requirements"
    
    # Send email notification to employee
    await _send_claim_notification(
        'rejected',
        claim,
        db,
        rejection_reason=rejection_reason,
        rejected_by=rejected_by
    )
    
    # Send Teams/Slack notification
    try:
        # Get employee name for notification
        employee_result = await db.execute(select(User).where(User.id == claim.employee_id))
        employee = employee_result.scalar_one_or_none()
        employee_name = employee.full_name if employee else "Unknown"
        
        # Get sync db session for communication service
        from database import SyncSessionLocal as SessionLocal
        sync_db = SessionLocal()
        try:
            await send_teams_notification(
                db=sync_db,
                tenant_id=claim.tenant_id,
                event_type='rejected',
                claim_number=claim.claim_number,
                employee_name=employee_name,
                amount=float(claim.amount) if claim.amount else 0,
                currency=claim.currency or "INR",
                approver_name=rejected_by,
                reason=rejection_reason
            )
        finally:
            sync_db.close()
    except Exception as e:
        logger.error(f"Failed to send Teams notification for claim {claim.claim_number}: {str(e)}")
    
    return claim


@router.post("/{claim_id}/settle", response_model=ClaimResponse)
async def settle_claim(
    claim_id: UUID,
    settlement_data: SettleClaim,
    request: Request,
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
    
    settlement_time = datetime.utcnow()
    
    # Update settlement details
    claim.settled = True
    claim.settled_date = settlement_time
    # claim.settled_by = current_user.id  # TODO: Add auth
    claim.payment_reference = settlement_data.payment_reference
    claim.payment_method = settlement_data.payment_method
    claim.amount_paid = settlement_data.amount_paid
    claim.status = "SETTLED"
    
    # Update payload
    if not claim.claim_payload:
        claim.claim_payload = {}
    claim.claim_payload["settlement"] = {
        "settled_date": settlement_time.isoformat(),
        "payment_reference": settlement_data.payment_reference,
        "payment_method": settlement_data.payment_method,
        "amount_paid": float(settlement_data.amount_paid),
        "notes": settlement_data.settlement_notes
    }
    
    # Create settlement comment text
    settlement_comment = f"**Claim Settled**\n\n"
    settlement_comment += f"• **Transaction ID:** {settlement_data.payment_reference}\n"
    settlement_comment += f"• **Payment Method:** {settlement_data.payment_method}\n"
    settlement_comment += f"• **Amount Paid:** ₹{float(settlement_data.amount_paid):,.2f}\n"
    settlement_comment += f"• **Settlement Date:** {settlement_time.strftime('%B %d, %Y at %I:%M %p')}\n"
    if settlement_data.settlement_notes:
        settlement_comment += f"• **Notes:** {settlement_data.settlement_notes}\n"
    
    # Create a Comment record in the database
    comment = Comment(
        tenant_id=claim.tenant_id,
        claim_id=claim_id,
        comment_text=settlement_comment,
        comment_type="SETTLEMENT",
        user_id=claim.employee_id,  # Using employee_id as placeholder for now
        user_name="Finance Team",
        user_role="FINANCE",
        visible_to_employee=True,
    )
    db.add(comment)
    
    # Flag the payload as modified for SQLAlchemy to detect the change
    flag_modified(claim, "claim_payload")
    
    await db.commit()
    await db.refresh(claim)
    
    # Invalidate dashboard cache for tenant and employee
    await redis_cache.invalidate_dashboard_cache(
        tenant_id=str(claim.tenant_id) if claim.tenant_id else None,
        employee_id=str(claim.employee_id) if claim.employee_id else None
    )
    
    # Audit log for claim settlement
    audit_logger.log_claim_action(
        user_id="finance",
        tenant_id=str(claim.tenant_id),
        claim_id=str(claim_id),
        action="settle",
        details={
            "payment_reference": settlement_data.payment_reference,
            "payment_method": settlement_data.payment_method,
            "amount_paid": float(settlement_data.amount_paid),
            "claimed_amount": float(claim.amount) if claim.amount else None
        },
        ip_address=get_client_ip(request)
    )
    
    # Send email notification to employee about payment
    await _send_claim_notification(
        'settled',
        claim,
        db,
        payment_reference=settlement_data.payment_reference,
        payment_method=settlement_data.payment_method,
        settled_date=settlement_time.strftime('%B %d, %Y')
    )
    
    # Send Teams/Slack notification for settlement
    try:
        employee_result = await db.execute(select(User).where(User.id == claim.employee_id))
        employee = employee_result.scalar_one_or_none()
        employee_name = employee.full_name if employee else "Unknown"
        
        from database import SyncSessionLocal as SessionLocal
        sync_db = SessionLocal()
        try:
            await send_teams_notification(
                db=sync_db,
                tenant_id=claim.tenant_id,
                event_type='settled',
                claim_number=claim.claim_number,
                employee_name=employee_name,
                amount=float(claim.amount) if claim.amount else 0,
                currency=claim.currency or "INR",
                approver_name="Finance Team"
            )
        finally:
            sync_db.close()
    except Exception as e:
        logger.error(f"Failed to send Teams notification for claim settlement {claim.claim_number}: {str(e)}")
    
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
    
    # Get employee to retrieve tenant_id
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee not found: {employee_id}"
        )
    
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
            tenant_id=employee.tenant_id
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
