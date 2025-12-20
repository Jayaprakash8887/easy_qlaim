"""
Dashboard and analytics endpoints with caching for performance
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from uuid import UUID

from database import get_sync_db
from models import Claim, User, Approval, AgentExecution
from services.redis_cache import redis_cache
from utils.timezone import now_tz, first_day_of_month_tz
# Employee is now an alias for User (tables merged)
Employee = User

router = APIRouter()

# Dashboard cache TTL (5 minutes - balances freshness vs performance)
DASHBOARD_CACHE_TTL = 300


@router.get("/summary")
async def get_dashboard_summary(
    employee_id: str = None,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get dashboard summary statistics with caching"""
    
    # Build cache key based on parameters
    cache_key_parts = ["dashboard", "summary"]
    if tenant_id:
        cache_key_parts.append(str(tenant_id))
    if employee_id:
        cache_key_parts.append(str(employee_id))
    cache_key = ":".join(cache_key_parts)
    
    # Try cache first
    cached = await redis_cache.get_async(cache_key)
    if cached:
        return cached
    
    # Base query conditions
    base_conditions = []
    if tenant_id:
        base_conditions.append(Claim.tenant_id == tenant_id)
    if employee_id:
        base_conditions.append(Claim.employee_id == employee_id)
    
    # Total claims
    query = db.query(func.count(Claim.id))
    if base_conditions:
        query = query.filter(and_(*base_conditions))
    total_claims = query.scalar() or 0
    
    # Pending claims
    pending_conditions = base_conditions + [Claim.status.in_(['PENDING_MANAGER', 'PENDING_HR', 'PENDING_FINANCE'])]
    pending_claims = db.query(func.count(Claim.id)).filter(
        and_(*pending_conditions)
    ).scalar() or 0
    
    # Approved claims (this month) - use tenant timezone
    first_day_of_month = first_day_of_month_tz().replace(tzinfo=None)
    approved_conditions = base_conditions + [
        Claim.status == 'FINANCE_APPROVED',
        Claim.updated_at >= first_day_of_month
    ]
    approved_this_month = db.query(func.count(Claim.id)).filter(
        and_(*approved_conditions)
    ).scalar() or 0
    
    # Total amount claimed (this month) - convert to INR
    amount_conditions = base_conditions + [Claim.submission_date >= first_day_of_month]
    total_amount_query = db.query(
        func.sum(Claim.amount)
    ).filter(and_(*amount_conditions))
    total_amount = total_amount_query.scalar() or 0
    
    # Average processing time (in days)
    avg_processing_time = 3.5  # TODO: Calculate actual average
    
    result = {
        "total_claims": total_claims,
        "pending_claims": pending_claims,
        "approved_this_month": approved_this_month,
        "total_amount_claimed": float(total_amount),
        "average_processing_time_days": avg_processing_time
    }
    
    # Cache the result
    await redis_cache.set_async(cache_key, result, DASHBOARD_CACHE_TTL)
    
    return result


@router.get("/claims-by-status")
async def get_claims_by_status(
    employee_id: str = None,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get claim counts grouped by status with caching"""
    
    # Build cache key
    cache_key_parts = ["dashboard", "claims_by_status"]
    if tenant_id:
        cache_key_parts.append(str(tenant_id))
    if employee_id:
        cache_key_parts.append(str(employee_id))
    cache_key = ":".join(cache_key_parts)
    
    # Try cache first
    cached = await redis_cache.get_async(cache_key)
    if cached:
        return cached
    
    query = db.query(
        Claim.status,
        func.count(Claim.id).label('count')
    )
    
    if tenant_id:
        query = query.filter(Claim.tenant_id == tenant_id)
    
    if employee_id:
        query = query.filter(Claim.employee_id == employee_id)
    
    results = query.group_by(Claim.status).all()
    
    result = [{"status": status, "count": count} for status, count in results]
    
    # Cache result
    await redis_cache.set_async(cache_key, result, DASHBOARD_CACHE_TTL)
    
    return result


@router.get("/claims-by-category")
async def get_claims_by_category(
    employee_id: str = None,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get claim counts and amounts grouped by category with caching"""
    
    # Build cache key
    cache_key_parts = ["dashboard", "claims_by_category"]
    if tenant_id:
        cache_key_parts.append(str(tenant_id))
    if employee_id:
        cache_key_parts.append(str(employee_id))
    cache_key = ":".join(cache_key_parts)
    
    # Try cache first
    cached = await redis_cache.get_async(cache_key)
    if cached:
        return cached
    
    query = db.query(
        Claim.category,
        func.count(Claim.id).label('count'),
        func.sum(Claim.amount).label('total_amount')
    )
    
    if tenant_id:
        query = query.filter(Claim.tenant_id == tenant_id)
    
    if employee_id:
        query = query.filter(Claim.employee_id == employee_id)
    
    results = query.group_by(Claim.category).all()
    
    result = [
        {
            "category": category,
            "count": count,
            "total_amount": float(total_amount or 0)
        }
        for category, count, total_amount in results
    ]
    
    # Cache result
    await redis_cache.set_async(cache_key, result, DASHBOARD_CACHE_TTL)
    
    return result


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 10,
    employee_id: str = None,
    status: str = None,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get recent claim activities"""
    
    query = db.query(Claim)
    
    if tenant_id:
        query = query.filter(Claim.tenant_id == tenant_id)
    
    if employee_id:
        query = query.filter(Claim.employee_id == employee_id)
    
    if status:
        query = query.filter(Claim.status == status)
    
    recent_claims = query.order_by(
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
            "currency": claim.currency or "INR",
            "status": claim.status,
            "updated_at": claim.updated_at.isoformat()
        })
    
    return activities


@router.get("/ai-metrics")
async def get_ai_metrics(
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get AI processing metrics"""
    
    # Base query with tenant filter
    base_query = db.query(AgentExecution)
    if tenant_id:
        base_query = base_query.filter(AgentExecution.tenant_id == tenant_id)
    
    # Total AI processed claims
    total_ai_processed = base_query.count() or 0
    
    # Average confidence score
    avg_confidence = db.query(func.avg(AgentExecution.confidence_score))
    if tenant_id:
        avg_confidence = avg_confidence.filter(AgentExecution.tenant_id == tenant_id)
    avg_confidence = avg_confidence.scalar() or 0
    
    # Success rate
    success_query = db.query(func.count(AgentExecution.id)).filter(
        AgentExecution.status == 'COMPLETED'
    )
    if tenant_id:
        success_query = success_query.filter(AgentExecution.tenant_id == tenant_id)
    successful_executions = success_query.scalar() or 0
    
    success_rate = (successful_executions / total_ai_processed * 100) if total_ai_processed > 0 else 0
    
    return {
        "total_ai_processed": total_ai_processed,
        "average_confidence_score": float(avg_confidence),
        "success_rate_percentage": float(success_rate),
        "total_time_saved_hours": total_ai_processed * 0.5  # Estimated time saved per claim
    }


@router.get("/pending-approvals")
async def get_pending_approvals_count(
    tenant_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_sync_db)
):
    """Get pending approvals count by level based on claim status.
    
    For managers, filters to show only claims from their direct reports.
    For HR, shows all pending HR claims.
    For Finance, shows all pending Finance claims.
    Admin users don't get approval notifications (returns 0s).
    """
    
    manager_pending = 0
    hr_pending = 0
    finance_pending = 0
    
    # Admin role doesn't need approval notifications - return zeros
    if role == 'admin':
        return {
            "manager_pending": 0,
            "hr_pending": 0,
            "finance_pending": 0,
            "total_pending": 0
        }
    
    # For manager role, only count claims from their direct reports
    if role == 'manager' and user_id:
        # Get direct reports (employees where manager_id = user_id)
        direct_report_ids = db.query(User.id).filter(
            User.manager_id == user_id,
            User.is_active == True
        )
        if tenant_id:
            direct_report_ids = direct_report_ids.filter(User.tenant_id == tenant_id)
        direct_report_ids = [r[0] for r in direct_report_ids.all()]
        
        if direct_report_ids:
            manager_query = db.query(func.count(Claim.id)).filter(
                Claim.status == 'PENDING_MANAGER',
                Claim.employee_id.in_(direct_report_ids)
            )
            if tenant_id:
                manager_query = manager_query.filter(Claim.tenant_id == tenant_id)
            manager_pending = manager_query.scalar() or 0
    elif not role:
        # When no role provided (backward compatibility), count all manager pending
        manager_query = db.query(func.count(Claim.id)).filter(
            Claim.status == 'PENDING_MANAGER'
        )
        if tenant_id:
            manager_query = manager_query.filter(Claim.tenant_id == tenant_id)
        manager_pending = manager_query.scalar() or 0
    
    # HR pending - only for HR role
    if role == 'hr' or not role:
        hr_query = db.query(func.count(Claim.id)).filter(
            Claim.status == 'PENDING_HR'
        )
        if tenant_id:
            hr_query = hr_query.filter(Claim.tenant_id == tenant_id)
        hr_pending = hr_query.scalar() or 0
    
    # Finance pending - only for Finance role
    if role == 'finance' or not role:
        finance_query = db.query(func.count(Claim.id)).filter(
            Claim.status == 'PENDING_FINANCE'
        )
        if tenant_id:
            finance_query = finance_query.filter(Claim.tenant_id == tenant_id)
        finance_pending = finance_query.scalar() or 0
    
    total_pending = manager_pending + hr_pending + finance_pending
    
    return {
        "manager_pending": manager_pending,
        "hr_pending": hr_pending,
        "finance_pending": finance_pending,
        "total_pending": total_pending
    }


@router.get("/hr-metrics")
async def get_hr_metrics(
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get HR-specific metrics including employee count"""
    
    # Total active employees
    employee_query = db.query(func.count(User.id)).filter(User.is_active == True)
    if tenant_id:
        employee_query = employee_query.filter(User.tenant_id == tenant_id)
    total_employees = employee_query.scalar() or 0
    
    # HR pending claims
    hr_pending_query = db.query(func.count(Claim.id)).filter(Claim.status == 'PENDING_HR')
    if tenant_id:
        hr_pending_query = hr_pending_query.filter(Claim.tenant_id == tenant_id)
    hr_pending = hr_pending_query.scalar() or 0
    
    # Claims approved by HR this month - use tenant timezone
    first_day_of_month = first_day_of_month_tz().replace(tzinfo=None)
    hr_approved_query = db.query(func.count(Claim.id)).filter(
        Claim.status.in_(['HR_APPROVED', 'PENDING_FINANCE', 'FINANCE_APPROVED', 'SETTLED']),
        Claim.updated_at >= first_day_of_month
    )
    if tenant_id:
        hr_approved_query = hr_approved_query.filter(Claim.tenant_id == tenant_id)
    hr_approved_this_month = hr_approved_query.scalar() or 0
    
    # Total claims value this month
    amount_query = db.query(func.sum(Claim.amount)).filter(
        Claim.submission_date >= first_day_of_month
    )
    if tenant_id:
        amount_query = amount_query.filter(Claim.tenant_id == tenant_id)
    monthly_claims_value = amount_query.scalar() or 0
    
    # Active claims (not settled or rejected)
    active_claims_query = db.query(func.count(Claim.id)).filter(
        ~Claim.status.in_(['SETTLED', 'REJECTED'])
    )
    if tenant_id:
        active_claims_query = active_claims_query.filter(Claim.tenant_id == tenant_id)
    active_claims = active_claims_query.scalar() or 0
    
    return {
        "total_employees": total_employees,
        "hr_pending": hr_pending,
        "hr_approved_this_month": hr_approved_this_month,
        "monthly_claims_value": float(monthly_claims_value),
        "active_claims": active_claims
    }


@router.get("/allowance-summary")
async def get_allowance_summary(
    employee_id: str = None,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get allowance summary by category"""
    
    # Base query for allowance claims
    query = db.query(
        Claim.category,
        func.count(Claim.id).label('total_count'),
        func.sum(
            case(
                (Claim.status.in_(['PENDING_MANAGER', 'PENDING_HR', 'PENDING_FINANCE']), 1),
                else_=0
            )
        ).label('pending_count'),
        func.sum(
            case(
                (Claim.status == 'FINANCE_APPROVED', 1),
                else_=0
            )
        ).label('approved_count'),
        func.sum(Claim.amount).label('total_value')
    ).filter(
        Claim.claim_type == 'ALLOWANCE'
    )
    
    if tenant_id:
        query = query.filter(Claim.tenant_id == tenant_id)
    
    if employee_id:
        query = query.filter(Claim.employee_id == employee_id)
    
    # Filter for current month - use tenant timezone
    first_day_of_month = first_day_of_month_tz().replace(tzinfo=None)
    query = query.filter(Claim.created_at >= first_day_of_month)
    
    results = query.group_by(Claim.category).all()
    
    allowances = []
    for category, total, pending, approved, value in results:
        allowances.append({
            "category": category,
            "total": int(total or 0),
            "pending": int(pending or 0),
            "approved": int(approved or 0),
            "total_value": float(value or 0)
        })
    
    return allowances

@router.get("/admin-stats")
async def get_admin_stats(
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get admin-specific dashboard statistics"""
    from models import Project, AgentExecution
    
    # 1. Unique claimants (distinct employees who raised claims)
    unique_claimants_query = db.query(func.count(func.distinct(Claim.employee_id)))
    if tenant_id:
        unique_claimants_query = unique_claimants_query.filter(Claim.tenant_id == tenant_id)
    unique_claimants = unique_claimants_query.scalar() or 0
    
    # 2. Active projects count
    active_projects_query = db.query(func.count(Project.id)).filter(
        func.lower(Project.status) == 'active'
    )
    if tenant_id:
        active_projects_query = active_projects_query.filter(Project.tenant_id == tenant_id)
    active_projects = active_projects_query.scalar() or 0
    
    # 3. Active employees count
    active_employees_query = db.query(func.count(User.id)).filter(User.is_active == True)
    if tenant_id:
        active_employees_query = active_employees_query.filter(User.tenant_id == tenant_id)
    active_employees = active_employees_query.scalar() or 0
    
    # 4. AI processing rate
    # Base query for AI executions
    base_ai_query = db.query(AgentExecution)
    if tenant_id:
        base_ai_query = base_ai_query.filter(AgentExecution.tenant_id == tenant_id)
    
    total_executions = base_ai_query.count() or 0
    
    success_query = base_ai_query.filter(AgentExecution.status == 'COMPLETED')
    successful_executions = success_query.count() or 0
    
    ai_success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0
    
    return {
        "unique_claimants": unique_claimants,
        "active_projects": active_projects,
        "active_employees": active_employees,
        "ai_success_rate": round(float(ai_success_rate), 1)
    }
