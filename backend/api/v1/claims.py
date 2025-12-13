"""
Claims API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
import os

from database import get_async_db
from models import Claim, Employee, Document, User
from schemas import (
    ClaimCreate, ClaimUpdate, ClaimResponse, ClaimListResponse,
    ReturnToEmployee, SettleClaim, HRCorrection
)
from config import settings
from agents.orchestrator import process_claim_task

router = APIRouter()


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
        status="DRAFT",
        submission_date=None
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
    """Submit a claim for processing"""
    
    # Get claim
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    if claim.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft claims can be submitted"
        )
    
    # Update status
    claim.status = "SUBMITTED"
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
    """Update a claim"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    if not claim.can_edit and claim.status not in ["DRAFT", "RETURNED_TO_EMPLOYEE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Claim cannot be edited in current status"
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
    
    await db.commit()
    await db.refresh(claim)
    
    return claim


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Delete a claim (only drafts)"""
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    if claim.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft claims can be deleted"
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
    
    # Update claim
    claim.status = "RETURNED_TO_EMPLOYEE"
    claim.can_edit = True
    claim.return_count += 1
    claim.return_reason = return_data.return_reason
    claim.returned_at = datetime.utcnow()
    # claim.returned_by = current_user.id  # TODO: Add auth
    
    await db.commit()
    await db.refresh(claim)
    
    # TODO: Send notification to employee
    
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
