"""
Dashboard and analytics endpoints with caching for performance
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from datetime import datetime, timedelta, timezone
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
    employee_id: Optional[UUID] = None,
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
    employee_id: Optional[UUID] = None,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get claim counts and amounts grouped by status with caching"""
    
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
        func.count(Claim.id).label('count'),
        func.coalesce(func.sum(Claim.amount), 0).label('amount')
    )
    
    if tenant_id:
        query = query.filter(Claim.tenant_id == tenant_id)
    
    if employee_id:
        query = query.filter(Claim.employee_id == employee_id)
    
    results = query.group_by(Claim.status).all()
    
    result = [{"status": status, "count": count, "amount": float(amount)} for status, count, amount in results]
    
    # Cache result
    await redis_cache.set_async(cache_key, result, DASHBOARD_CACHE_TTL)
    
    return result


@router.get("/claims-by-category")
async def get_claims_by_category(
    employee_id: Optional[UUID] = None,
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
    employee_id: Optional[UUID] = None,
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
    employee_id: Optional[UUID] = None,
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


# ==================== FINANCE REPORTS ====================

@router.get("/finance-metrics")
async def get_finance_metrics(
    tenant_id: Optional[UUID] = None,
    period: str = "month",  # month, quarter, year
    db: Session = Depends(get_sync_db)
):
    """Get Finance-specific metrics for reports dashboard"""
    from models import Project
    from datetime import date
    
    # Determine period start date
    today = date.today()
    if period == "month":
        period_start = today.replace(day=1)
    elif period == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        period_start = today.replace(month=quarter_month, day=1)
    else:  # year
        period_start = today.replace(month=1, day=1)
    
    # Base conditions
    base_conditions = []
    if tenant_id:
        base_conditions.append(Claim.tenant_id == tenant_id)
    
    # 1. Pending Finance Approval
    pending_conditions = base_conditions + [Claim.status == 'PENDING_FINANCE']
    pending_finance = db.query(func.count(Claim.id)).filter(
        and_(*pending_conditions)
    ).scalar() or 0
    
    pending_amount = db.query(func.sum(Claim.amount)).filter(
        and_(*pending_conditions)
    ).scalar() or 0
    
    # 2. Finance Approved (ready for settlement)
    approved_conditions = base_conditions + [Claim.status == 'FINANCE_APPROVED']
    approved_count = db.query(func.count(Claim.id)).filter(
        and_(*approved_conditions)
    ).scalar() or 0
    
    approved_amount = db.query(func.sum(Claim.amount)).filter(
        and_(*approved_conditions)
    ).scalar() or 0
    
    # 3. Settled this period
    settled_conditions = base_conditions + [
        Claim.status == 'SETTLED',
        Claim.settled_date >= period_start
    ]
    settled_count = db.query(func.count(Claim.id)).filter(
        and_(*settled_conditions)
    ).scalar() or 0
    
    settled_amount = db.query(func.sum(Claim.amount_paid)).filter(
        and_(*settled_conditions)
    ).scalar() or 0
    
    # 4. Total this period (all submitted)
    period_conditions = base_conditions + [Claim.submission_date >= period_start]
    total_period_count = db.query(func.count(Claim.id)).filter(
        and_(*period_conditions)
    ).scalar() or 0
    
    total_period_amount = db.query(func.sum(Claim.amount)).filter(
        and_(*period_conditions)
    ).scalar() or 0
    
    # 5. Average settlement time (days from finance approval to settlement)
    avg_settlement_time = 2.5  # TODO: Calculate actual average
    
    # 6. Rejection rate this period
    rejected_conditions = base_conditions + [
        Claim.status == 'REJECTED',
        Claim.updated_at >= period_start
    ]
    rejected_count = db.query(func.count(Claim.id)).filter(
        and_(*rejected_conditions)
    ).scalar() or 0
    
    rejection_rate = (rejected_count / total_period_count * 100) if total_period_count > 0 else 0
    
    return {
        "pending_finance": {
            "count": pending_finance,
            "amount": float(pending_amount)
        },
        "ready_for_settlement": {
            "count": approved_count,
            "amount": float(approved_amount)
        },
        "settled_this_period": {
            "count": settled_count,
            "amount": float(settled_amount or 0)
        },
        "total_this_period": {
            "count": total_period_count,
            "amount": float(total_period_amount)
        },
        "avg_settlement_time_days": avg_settlement_time,
        "rejection_rate_percentage": round(rejection_rate, 1),
        "period": period
    }


@router.get("/claims-by-project")
async def get_claims_by_project(
    tenant_id: Optional[UUID] = None,
    period: str = "month",
    db: Session = Depends(get_sync_db)
):
    """Get claims summary by project for budget vs actual analysis"""
    from models import Project
    from datetime import date
    
    # Determine period start date
    today = date.today()
    if period == "month":
        period_start = today.replace(day=1)
    elif period == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        period_start = today.replace(month=quarter_month, day=1)
    else:  # year
        period_start = today.replace(month=1, day=1)
    
    # Get projects with claims summary
    project_query = db.query(Project)
    if tenant_id:
        project_query = project_query.filter(Project.tenant_id == tenant_id)
    
    projects = project_query.all()
    
    result = []
    for project in projects:
        # Claims for this project
        claims_query = db.query(
            func.count(Claim.id).label('claim_count'),
            func.sum(Claim.amount).label('total_amount'),
            func.sum(case(
                (Claim.status == 'SETTLED', Claim.amount_paid),
                else_=0
            )).label('settled_amount')
        ).filter(
            Claim.claim_payload['project_code'].astext == project.code
        )
        
        if tenant_id:
            claims_query = claims_query.filter(Claim.tenant_id == tenant_id)
        
        claims_data = claims_query.first()
        
        budget_utilized = float(project.budget_spent or 0)
        budget_total = float(project.budget or 0)
        budget_percentage = (budget_utilized / budget_total * 100) if budget_total > 0 else 0
        
        result.append({
            "project_code": project.code,
            "project_name": project.name,
            "budget_total": budget_total,
            "budget_utilized": budget_utilized,
            "budget_percentage": round(budget_percentage, 1),
            "claims_count": claims_data.claim_count or 0,
            "claims_amount": float(claims_data.total_amount or 0),
            "settled_amount": float(claims_data.settled_amount or 0)
        })
    
    return sorted(result, key=lambda x: x['claims_amount'], reverse=True)


@router.get("/settlement-analytics")
async def get_settlement_analytics(
    tenant_id: Optional[UUID] = None,
    period: str = "6m",  # 1m, 3m, 6m, 1y
    db: Session = Depends(get_sync_db)
):
    """Get settlement analytics by payment method and time period"""
    from datetime import date, timedelta
    
    # Determine period start date
    today = date.today()
    period_days = {"1m": 30, "3m": 90, "6m": 180, "1y": 365}
    days_back = period_days.get(period, 180)
    period_start = today - timedelta(days=days_back)
    
    base_conditions = [Claim.status == 'SETTLED', Claim.settled_date >= period_start]
    if tenant_id:
        base_conditions.append(Claim.tenant_id == tenant_id)
    
    # 1. By payment method
    by_method = db.query(
        Claim.payment_method,
        func.count(Claim.id).label('count'),
        func.sum(Claim.amount_paid).label('amount')
    ).filter(
        and_(*base_conditions)
    ).group_by(Claim.payment_method).all()
    
    payment_methods = [
        {
            "method": method or "Unknown",
            "count": count,
            "amount": float(amount or 0)
        }
        for method, count, amount in by_method
    ]
    
    # 2. Monthly trend (last 6 months)
    monthly_trend = []
    for i in range(6):
        month_end = today.replace(day=1) - timedelta(days=1) if i == 0 else (today.replace(day=1) - timedelta(days=i*30)).replace(day=1) - timedelta(days=1)
        month_start = month_end.replace(day=1)
        
        if i > 0:
            month_start = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
            next_month = month_start.replace(day=28) + timedelta(days=4)
            month_end = next_month - timedelta(days=next_month.day)
        else:
            month_start = today.replace(day=1)
            month_end = today
        
        month_conditions = base_conditions + [
            Claim.settled_date >= month_start,
            Claim.settled_date <= month_end
        ]
        
        month_data = db.query(
            func.count(Claim.id),
            func.sum(Claim.amount_paid)
        ).filter(and_(*month_conditions)).first()
        
        monthly_trend.append({
            "month": month_start.strftime("%b %Y"),
            "count": month_data[0] or 0,
            "amount": float(month_data[1] or 0)
        })
    
    monthly_trend.reverse()  # Oldest first
    
    # 3. By category
    by_category = db.query(
        Claim.category,
        func.count(Claim.id).label('count'),
        func.sum(Claim.amount_paid).label('amount')
    ).filter(
        and_(*base_conditions)
    ).group_by(Claim.category).all()
    
    categories = [
        {
            "category": category,
            "count": count,
            "amount": float(amount or 0)
        }
        for category, count, amount in by_category
    ]
    
    return {
        "payment_methods": payment_methods,
        "monthly_trend": monthly_trend,
        "by_category": categories,
        "period": period
    }


@router.get("/pending-settlements")
async def get_pending_settlements(
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get claims pending settlement (Finance Approved)"""
    
    query = db.query(Claim).filter(Claim.status == 'FINANCE_APPROVED')
    
    if tenant_id:
        query = query.filter(Claim.tenant_id == tenant_id)
    
    claims = query.order_by(Claim.updated_at.asc()).all()
    
    result = []
    now = datetime.now(timezone.utc)
    for claim in claims:
        if claim.updated_at:
            # Handle both timezone-aware and naive datetimes
            updated_at = claim.updated_at
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
            days_pending = (now - updated_at).days
        else:
            days_pending = 0
        
        result.append({
            "id": str(claim.id),
            "claim_number": claim.claim_number,
            "employee_name": claim.employee_name,
            "employee_id": str(claim.employee_id),
            "category": claim.category,
            "amount": float(claim.amount),
            "currency": claim.currency or "INR",
            "approved_date": claim.updated_at.isoformat() if claim.updated_at else None,
            "days_pending": days_pending,
            "description": claim.description
        })
    
    # Group by aging
    aging_summary = {
        "0-7_days": sum(1 for c in result if c['days_pending'] <= 7),
        "8-14_days": sum(1 for c in result if 7 < c['days_pending'] <= 14),
        "15-30_days": sum(1 for c in result if 14 < c['days_pending'] <= 30),
        "over_30_days": sum(1 for c in result if c['days_pending'] > 30)
    }
    
    total_amount = sum(c['amount'] for c in result)
    
    return {
        "claims": result,
        "total_count": len(result),
        "total_amount": total_amount,
        "aging_summary": aging_summary
    }


@router.get("/claims-trend")
async def get_claims_trend(
    tenant_id: Optional[UUID] = None,
    period: str = "6m",
    db: Session = Depends(get_sync_db)
):
    """Get claims trend data for charts (submitted, approved, settled over time)"""
    from datetime import date, timedelta
    
    # Determine period
    today = date.today()
    period_days = {"1m": 30, "3m": 90, "6m": 180, "1y": 365}
    days_back = period_days.get(period, 180)
    
    # Build monthly data
    monthly_data = []
    for i in range(6):
        if i == 0:
            month_start = today.replace(day=1)
            month_end = today
        else:
            # Go back i months
            month_start = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
            next_month = month_start.replace(day=28) + timedelta(days=4)
            month_end = next_month - timedelta(days=next_month.day)
        
        base_conditions = []
        if tenant_id:
            base_conditions.append(Claim.tenant_id == tenant_id)
        
        # Submitted this month
        submitted_query = db.query(func.count(Claim.id)).filter(
            and_(*base_conditions),
            Claim.submission_date >= month_start,
            Claim.submission_date <= month_end
        )
        submitted = submitted_query.scalar() or 0
        
        # Approved (Finance approved)
        approved_query = db.query(func.count(Claim.id)).filter(
            and_(*base_conditions),
            Claim.status.in_(['FINANCE_APPROVED', 'SETTLED']),
            Claim.updated_at >= month_start,
            Claim.updated_at <= month_end
        )
        approved = approved_query.scalar() or 0
        
        # Settled
        settled_query = db.query(func.count(Claim.id)).filter(
            and_(*base_conditions),
            Claim.status == 'SETTLED',
            Claim.settled_date >= month_start,
            Claim.settled_date <= month_end
        )
        settled = settled_query.scalar() or 0
        
        # Total amount
        amount_query = db.query(func.sum(Claim.amount)).filter(
            and_(*base_conditions),
            Claim.submission_date >= month_start,
            Claim.submission_date <= month_end
        )
        total_amount = amount_query.scalar() or 0
        
        monthly_data.append({
            "month": month_start.strftime("%b"),
            "month_year": month_start.strftime("%b %Y"),
            "submitted": submitted,
            "approved": approved,
            "settled": settled,
            "amount": float(total_amount)
        })
    
    monthly_data.reverse()  # Oldest first
    
    return monthly_data


@router.get("/expense-breakdown")
async def get_expense_breakdown(
    tenant_id: Optional[UUID] = None,
    period: str = "month",
    db: Session = Depends(get_sync_db)
):
    """Get expense breakdown by category for pie charts"""
    from datetime import date
    
    # Determine period start date
    today = date.today()
    if period == "month":
        period_start = today.replace(day=1)
    elif period == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        period_start = today.replace(month=quarter_month, day=1)
    else:  # year
        period_start = today.replace(month=1, day=1)
    
    base_conditions = [Claim.submission_date >= period_start]
    if tenant_id:
        base_conditions.append(Claim.tenant_id == tenant_id)
    
    # By category
    by_category = db.query(
        Claim.category,
        func.count(Claim.id).label('count'),
        func.sum(Claim.amount).label('amount')
    ).filter(
        and_(*base_conditions)
    ).group_by(Claim.category).all()
    
    total_amount = sum(float(amount or 0) for _, _, amount in by_category)
    
    categories = []
    for category, count, amount in by_category:
        percentage = (float(amount or 0) / total_amount * 100) if total_amount > 0 else 0
        categories.append({
            "category": category,
            "count": count,
            "amount": float(amount or 0),
            "percentage": round(percentage, 1)
        })
    
    # By claim type
    by_type = db.query(
        Claim.claim_type,
        func.count(Claim.id).label('count'),
        func.sum(Claim.amount).label('amount')
    ).filter(
        and_(*base_conditions)
    ).group_by(Claim.claim_type).all()
    
    claim_types = [
        {
            "type": claim_type,
            "count": count,
            "amount": float(amount or 0)
        }
        for claim_type, count, amount in by_type
    ]
    
    # By department
    by_department = db.query(
        Claim.department,
        func.count(Claim.id).label('count'),
        func.sum(Claim.amount).label('amount')
    ).filter(
        and_(*base_conditions)
    ).group_by(Claim.department).all()
    
    departments = [
        {
            "department": dept or "Unknown",
            "count": count,
            "amount": float(amount or 0)
        }
        for dept, count, amount in by_department
    ]
    
    return {
        "by_category": sorted(categories, key=lambda x: x['amount'], reverse=True),
        "by_claim_type": claim_types,
        "by_department": sorted(departments, key=lambda x: x['amount'], reverse=True),
        "total_amount": total_amount,
        "period": period
    }


@router.get("/top-claimants")
async def get_top_claimants(
    tenant_id: Optional[UUID] = None,
    limit: int = 10,
    period: str = "month",
    db: Session = Depends(get_sync_db)
):
    """Get top claimants by amount"""
    from datetime import date
    
    # Determine period start date
    today = date.today()
    if period == "month":
        period_start = today.replace(day=1)
    elif period == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        period_start = today.replace(month=quarter_month, day=1)
    else:  # year
        period_start = today.replace(month=1, day=1)
    
    base_conditions = [Claim.submission_date >= period_start]
    if tenant_id:
        base_conditions.append(Claim.tenant_id == tenant_id)
    
    top_claimants = db.query(
        Claim.employee_id,
        Claim.employee_name,
        Claim.department,
        func.count(Claim.id).label('claim_count'),
        func.sum(Claim.amount).label('total_amount')
    ).filter(
        and_(*base_conditions)
    ).group_by(
        Claim.employee_id, Claim.employee_name, Claim.department
    ).order_by(
        func.sum(Claim.amount).desc()
    ).limit(limit).all()
    
    return [
        {
            "employee_id": str(emp_id),
            "employee_name": name,
            "department": dept,
            "claim_count": count,
            "total_amount": float(amount or 0)
        }
        for emp_id, name, dept, count, amount in top_claimants
    ]

