"""
Dashboard and analytics endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import Dict, List, Any

from database import get_sync_db
from models import Claim, Employee, Approval, AgentExecution

router = APIRouter()


@router.get("/summary")
async def get_dashboard_summary(
    db: Session = Depends(get_sync_db)
):
    """Get dashboard summary statistics"""
    
    # Total claims
    total_claims = db.query(func.count(Claim.id)).scalar() or 0
    
    # Pending claims
    pending_claims = db.query(func.count(Claim.id)).filter(
        Claim.status.in_(['PENDING_MANAGER', 'PENDING_HR', 'PENDING_FINANCE'])
    ).scalar() or 0
    
    # Approved claims (this month)
    first_day_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    approved_this_month = db.query(func.count(Claim.id)).filter(
        and_(
            Claim.status == 'FINANCE_APPROVED',
            Claim.updated_at >= first_day_of_month
        )
    ).scalar() or 0
    
    # Total amount claimed (this month)
    total_amount = db.query(func.sum(Claim.amount)).filter(
        Claim.submission_date >= first_day_of_month
    ).scalar() or 0
    
    # Average processing time (in days)
    avg_processing_time = 3.5  # TODO: Calculate actual average
    
    return {
        "total_claims": total_claims,
        "pending_claims": pending_claims,
        "approved_this_month": approved_this_month,
        "total_amount_claimed": float(total_amount),
        "average_processing_time_days": avg_processing_time
    }


@router.get("/claims-by-status")
async def get_claims_by_status(
    db: Session = Depends(get_sync_db)
):
    """Get claim counts grouped by status"""
    
    results = db.query(
        Claim.status,
        func.count(Claim.id).label('count')
    ).group_by(Claim.status).all()
    
    return [{"status": status, "count": count} for status, count in results]


@router.get("/claims-by-category")
async def get_claims_by_category(
    db: Session = Depends(get_sync_db)
):
    """Get claim counts and amounts grouped by category"""
    
    results = db.query(
        Claim.category,
        func.count(Claim.id).label('count'),
        func.sum(Claim.amount).label('total_amount')
    ).group_by(Claim.category).all()
    
    return [
        {
            "category": category,
            "count": count,
            "total_amount": float(total_amount or 0)
        }
        for category, count, total_amount in results
    ]


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 10,
    db: Session = Depends(get_sync_db)
):
    """Get recent claim activities"""
    
    recent_claims = db.query(Claim).order_by(
        Claim.updated_at.desc()
    ).limit(limit).all()
    
    activities = []
    for claim in recent_claims:
        activities.append({
            "id": str(claim.id),
            "claim_number": claim.claim_number,
            "employee_name": claim.employee_name,
            "category": claim.category,
            "amount": float(claim.amount),
            "status": claim.status,
            "updated_at": claim.updated_at.isoformat()
        })
    
    return activities


@router.get("/ai-metrics")
async def get_ai_metrics(
    db: Session = Depends(get_sync_db)
):
    """Get AI processing metrics"""
    
    # Total AI processed claims
    total_ai_processed = db.query(func.count(AgentExecution.id)).scalar() or 0
    
    # Average confidence score
    avg_confidence = db.query(func.avg(AgentExecution.confidence_score)).scalar() or 0
    
    # Success rate
    successful_executions = db.query(func.count(AgentExecution.id)).filter(
        AgentExecution.status == 'COMPLETED'
    ).scalar() or 0
    
    success_rate = (successful_executions / total_ai_processed * 100) if total_ai_processed > 0 else 0
    
    return {
        "total_ai_processed": total_ai_processed,
        "average_confidence_score": float(avg_confidence),
        "success_rate_percentage": float(success_rate),
        "total_time_saved_hours": total_ai_processed * 0.5  # Estimated time saved per claim
    }


@router.get("/pending-approvals")
async def get_pending_approvals_count(
    db: Session = Depends(get_sync_db)
):
    """Get pending approvals count by level"""
    
    results = db.query(
        Approval.approval_level,
        func.count(Approval.id).label('count')
    ).filter(
        Approval.status == 'PENDING'
    ).group_by(Approval.approval_level).all()
    
    return [
        {"level": level, "count": count}
        for level, count in results
    ]
