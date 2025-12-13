"""
Approval workflow endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from uuid import UUID, uuid4
from datetime import datetime

from database import get_sync_db
from models import Approval, Claim, User
from schemas import ApprovalCreate, ApprovalResponse, ApprovalUpdate

router = APIRouter()


@router.get("/", response_model=List[ApprovalResponse])
async def list_approvals(
    claim_id: UUID | None = None,
    approver_id: UUID | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get list of approvals with optional filters"""
    query = db.query(Approval)
    
    if claim_id:
        query = query.filter(Approval.claim_id == claim_id)
    if approver_id:
        query = query.filter(Approval.approver_id == approver_id)
    if status:
        query = query.filter(Approval.status == status)
    
    approvals = query.offset(skip).limit(limit).all()
    return approvals


@router.get("/pending", response_model=List[ApprovalResponse])
async def get_pending_approvals(
    approver_id: UUID | None = None,
    db: Session = Depends(get_sync_db)
):
    """Get pending approvals for a specific approver"""
    query = db.query(Approval).filter(Approval.status == "PENDING")
    
    if approver_id:
        query = query.filter(Approval.approver_id == approver_id)
    
    approvals = query.all()
    return approvals


@router.get("/{approval_id}", response_model=ApprovalResponse)
async def get_approval(
    approval_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get approval by ID"""
    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found"
        )
    return approval


@router.post("/", response_model=ApprovalResponse, status_code=status.HTTP_201_CREATED)
async def create_approval(
    approval_data: ApprovalCreate,
    db: Session = Depends(get_sync_db)
):
    """Create a new approval request"""
    # Check if claim exists
    claim = db.query(Claim).filter(Claim.id == approval_data.claim_id).first()
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Create approval
    approval = Approval(
        id=uuid4(),
        tenant_id=claim.tenant_id,
        claim_id=approval_data.claim_id,
        approver_id=approval_data.approver_id,
        approval_level=approval_data.approval_level,
        status="PENDING",
        remarks=approval_data.remarks
    )
    
    db.add(approval)
    db.commit()
    db.refresh(approval)
    
    return approval


@router.put("/{approval_id}", response_model=ApprovalResponse)
async def update_approval(
    approval_id: UUID,
    approval_data: ApprovalUpdate,
    db: Session = Depends(get_sync_db)
):
    """Update an approval (approve/reject)"""
    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found"
        )
    
    # Update fields
    if approval_data.status:
        approval.status = approval_data.status
        if approval_data.status in ["APPROVED", "REJECTED"]:
            approval.decision_date = datetime.utcnow()
    
    if approval_data.remarks:
        approval.remarks = approval_data.remarks
    
    db.commit()
    db.refresh(approval)
    
    # Update claim status based on approval
    claim = db.query(Claim).filter(Claim.id == approval.claim_id).first()
    if claim and approval_data.status == "APPROVED":
        # Logic to move claim to next approval level or approve
        if approval.approval_level == "MANAGER":
            claim.status = "PENDING_HR"
        elif approval.approval_level == "HR":
            claim.status = "PENDING_FINANCE"
        elif approval.approval_level == "FINANCE":
            claim.status = "FINANCE_APPROVED"
        db.commit()
    elif claim and approval_data.status == "REJECTED":
        claim.status = "REJECTED"
        db.commit()
    
    return approval
