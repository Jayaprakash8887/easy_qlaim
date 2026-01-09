"""
Notifications API endpoints for bell icon functionality.
Provides CRUD operations for user notifications with read/unread/clear functionality.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from database import get_sync_db
from models import Notification, User, Claim

router = APIRouter()


# ===================== Pydantic Schemas =====================

class NotificationCreate(BaseModel):
    """Schema for creating a notification"""
    user_id: UUID
    tenant_id: Optional[UUID] = None
    type: str
    title: str
    message: str
    priority: str = "medium"
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    action_url: Optional[str] = None


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: UUID
    tenant_id: Optional[UUID]
    user_id: UUID
    type: str
    title: str
    message: str
    priority: str
    related_entity_type: Optional[str]
    related_entity_id: Optional[UUID]
    action_url: Optional[str]
    is_read: bool
    read_at: Optional[datetime]
    is_cleared: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationSummary(BaseModel):
    """Summary of notifications count"""
    total: int
    unread: int
    high_priority_unread: int


class BulkActionRequest(BaseModel):
    """Request for bulk notification actions"""
    notification_ids: List[UUID]


# ===================== API Endpoints =====================

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    user_id: UUID,
    tenant_id: Optional[UUID] = None,
    include_read: bool = True,
    include_cleared: bool = False,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
    db: Session = Depends(get_sync_db)
):
    """
    Get notifications for a user.
    Filters by tenant_id and read/cleared status.
    """
    query = db.query(Notification).filter(Notification.user_id == user_id)
    
    # Filter by tenant if provided
    if tenant_id:
        query = query.filter(
            or_(Notification.tenant_id == tenant_id, Notification.tenant_id.is_(None))
        )
    
    # Filter out read notifications if requested
    if not include_read:
        query = query.filter(Notification.is_read == False)
    
    # Filter out cleared notifications by default
    if not include_cleared:
        query = query.filter(Notification.is_cleared == False)
    
    # Order by priority (high first) and created_at (newest first)
    query = query.order_by(
        # High priority first
        Notification.priority.desc(),
        Notification.created_at.desc()
    )
    
    notifications = query.offset(offset).limit(limit).all()
    return notifications


@router.get("/summary", response_model=NotificationSummary)
async def get_notification_summary(
    user_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Get notification summary (counts) for a user.
    """
    base_query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_cleared == False
    )
    
    if tenant_id:
        base_query = base_query.filter(
            or_(Notification.tenant_id == tenant_id, Notification.tenant_id.is_(None))
        )
    
    total = base_query.count()
    unread = base_query.filter(Notification.is_read == False).count()
    high_priority_unread = base_query.filter(
        Notification.is_read == False,
        Notification.priority == "high"
    ).count()
    
    return NotificationSummary(
        total=total,
        unread=unread,
        high_priority_unread=high_priority_unread
    )


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Mark a single notification as read.
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Notification marked as read"}


@router.post("/{notification_id}/unread")
async def mark_notification_unread(
    notification_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Mark a single notification as unread.
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = False
    notification.read_at = None
    db.commit()
    
    return {"success": True, "message": "Notification marked as unread"}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    user_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Mark all notifications as read for a user.
    """
    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
        Notification.is_cleared == False
    )
    
    if tenant_id:
        query = query.filter(
            or_(Notification.tenant_id == tenant_id, Notification.tenant_id.is_(None))
        )
    
    now = datetime.utcnow()
    updated_count = query.update({
        Notification.is_read: True,
        Notification.read_at: now
    }, synchronize_session=False)
    
    db.commit()
    
    return {"success": True, "updated_count": updated_count}


@router.post("/mark-bulk-read")
async def mark_bulk_notifications_read(
    request: BulkActionRequest,
    db: Session = Depends(get_sync_db)
):
    """
    Mark multiple specific notifications as read.
    """
    now = datetime.utcnow()
    updated_count = db.query(Notification).filter(
        Notification.id.in_(request.notification_ids)
    ).update({
        Notification.is_read: True,
        Notification.read_at: now
    }, synchronize_session=False)
    
    db.commit()
    
    return {"success": True, "updated_count": updated_count}


@router.delete("/{notification_id}")
async def clear_notification(
    notification_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Clear (soft delete) a single notification.
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_cleared = True
    notification.cleared_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Notification cleared"}


@router.post("/clear-all")
async def clear_all_notifications(
    user_id: UUID,
    tenant_id: Optional[UUID] = None,
    only_read: bool = False,
    db: Session = Depends(get_sync_db)
):
    """
    Clear all notifications for a user.
    Optionally clear only read notifications.
    """
    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_cleared == False
    )
    
    if tenant_id:
        query = query.filter(
            or_(Notification.tenant_id == tenant_id, Notification.tenant_id.is_(None))
        )
    
    if only_read:
        query = query.filter(Notification.is_read == True)
    
    now = datetime.utcnow()
    cleared_count = query.update({
        Notification.is_cleared: True,
        Notification.cleared_at: now
    }, synchronize_session=False)
    
    db.commit()
    
    return {"success": True, "cleared_count": cleared_count}


@router.post("/clear-bulk")
async def clear_bulk_notifications(
    request: BulkActionRequest,
    db: Session = Depends(get_sync_db)
):
    """
    Clear multiple specific notifications.
    """
    now = datetime.utcnow()
    cleared_count = db.query(Notification).filter(
        Notification.id.in_(request.notification_ids)
    ).update({
        Notification.is_cleared: True,
        Notification.cleared_at: now
    }, synchronize_session=False)
    
    db.commit()
    
    return {"success": True, "cleared_count": cleared_count}


@router.post("/", response_model=NotificationResponse)
async def create_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_sync_db)
):
    """
    Create a new notification.
    This is typically called by other services/background tasks.
    """
    # Validate type
    valid_types = ['claim_approved', 'claim_rejected', 'claim_returned', 
                   'pending_approval', 'claim_submitted', 'system', 'tenant']
    if notification.type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid notification type. Must be one of: {valid_types}")
    
    # Validate priority
    valid_priorities = ['high', 'medium', 'low']
    if notification.priority not in valid_priorities:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {valid_priorities}")
    
    # Validate user exists
    user = db.query(User).filter(User.id == notification.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_notification = Notification(
        user_id=notification.user_id,
        tenant_id=notification.tenant_id,
        type=notification.type,
        title=notification.title,
        message=notification.message,
        priority=notification.priority,
        related_entity_type=notification.related_entity_type,
        related_entity_id=notification.related_entity_id,
        action_url=notification.action_url
    )
    
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    return db_notification


# ===================== Notification Generation Helpers =====================

@router.post("/generate-from-claim/{claim_id}")
async def generate_notification_from_claim(
    claim_id: UUID,
    notification_type: str = Query(..., description="Type of notification to generate"),
    db: Session = Depends(get_sync_db)
):
    """
    Generate a notification based on a claim status change.
    This is called when claim status changes during approval workflow.
    """
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Get employee (claim owner)
    employee = db.query(User).filter(User.id == claim.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Determine notification details based on type
    title = ""
    message = ""
    priority = "medium"
    action_url = f"/claims/{claim_id}"
    
    if notification_type == "claim_approved":
        status_labels = {
            "MANAGER_APPROVED": "Manager",
            "HR_APPROVED": "HR",
            "FINANCE_APPROVED": "Finance"
        }
        approver = status_labels.get(claim.status, "")
        title = f"Claim {approver} Approved"
        message = f"Your claim {claim.claim_number} for ₹{claim.amount:,.2f} has been approved by {approver}."
        priority = "medium"
        
    elif notification_type == "claim_rejected":
        title = "Claim Rejected"
        message = f"Your claim {claim.claim_number} for ₹{claim.amount:,.2f} has been rejected."
        priority = "high"
        
    elif notification_type == "claim_returned":
        title = "Action Required: Claim Returned"
        message = f"Your claim {claim.claim_number} has been returned for correction. Please review and resubmit."
        priority = "high"
        
    elif notification_type == "claim_submitted":
        title = "New Claim Submitted"
        message = f"A new claim {claim.claim_number} for ₹{claim.amount:,.2f} has been submitted by {employee.full_name or employee.username}."
        priority = "medium"
        
    else:
        raise HTTPException(status_code=400, detail="Invalid notification type for claim")
    
    # Create notification for the employee
    db_notification = Notification(
        user_id=claim.employee_id,
        tenant_id=claim.tenant_id,
        type=notification_type,
        title=title,
        message=message,
        priority=priority,
        related_entity_type="claim",
        related_entity_id=claim_id,
        action_url=action_url
    )
    
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    return {"success": True, "notification_id": str(db_notification.id)}


@router.post("/notify-approvers/{claim_id}")
async def notify_approvers(
    claim_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Notify relevant approvers when a claim needs their attention.
    Creates notifications for managers/HR/finance based on claim status.
    """
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    employee = db.query(User).filter(User.id == claim.employee_id).first()
    notifications_created = 0
    
    if claim.status == "PENDING_MANAGER":
        # Notify the employee's manager
        if employee and employee.manager_id:
            notification = Notification(
                user_id=employee.manager_id,
                tenant_id=claim.tenant_id,
                type="pending_approval",
                title="Pending Manager Approval",
                message=f"Claim {claim.claim_number} from {employee.full_name or employee.username} requires your approval.",
                priority="high",
                related_entity_type="claim",
                related_entity_id=claim_id,
                action_url=f"/approvals?claim={claim_id}"
            )
            db.add(notification)
            notifications_created += 1
    
    elif claim.status == "PENDING_HR":
        # Notify all HR users in the same tenant (via designation-to-role mapping)
        from services.role_service import get_users_with_role
        hr_users = get_users_with_role(claim.tenant_id, "HR", db)
        
        for hr_user in hr_users:
            notification = Notification(
                user_id=hr_user.id,
                tenant_id=claim.tenant_id,
                type="pending_approval",
                title="Pending HR Approval",
                message=f"Claim {claim.claim_number} from {employee.full_name or employee.username} requires HR review.",
                priority="high",
                related_entity_type="claim",
                related_entity_id=claim_id,
                action_url=f"/approvals?claim={claim_id}"
            )
            db.add(notification)
            notifications_created += 1
    
    elif claim.status == "PENDING_FINANCE":
        # Notify all Finance users in the same tenant (via designation-to-role mapping)
        from services.role_service import get_users_with_role
        finance_users = get_users_with_role(claim.tenant_id, "FINANCE", db)
        
        for finance_user in finance_users:
            notification = Notification(
                user_id=finance_user.id,
                tenant_id=claim.tenant_id,
                type="pending_approval",
                title="Pending Finance Approval",
                message=f"Claim {claim.claim_number} from {employee.full_name or employee.username} requires finance processing.",
                priority="high",
                related_entity_type="claim",
                related_entity_id=claim_id,
                action_url=f"/approvals?claim={claim_id}"
            )
            db.add(notification)
            notifications_created += 1
    
    db.commit()
    
    return {"success": True, "notifications_created": notifications_created}
