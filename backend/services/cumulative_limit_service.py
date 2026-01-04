"""
Cumulative Limit Validation Service

Validates that claims don't exceed cumulative limits per category
based on the policy's frequency_limit (MONTHLY, QUARTERLY, YEARLY, etc.)
and the tenant's fiscal year settings.
"""
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from typing import Optional, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from models import Claim, PolicyCategory, SystemSettings

import logging

logger = logging.getLogger(__name__)


# Month name to number mapping
MONTH_TO_NUMBER = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12
}


def get_tenant_fiscal_year_start(db: Session, tenant_id: UUID) -> int:
    """Get the fiscal year start month (1-12) from tenant settings."""
    try:
        setting = db.query(SystemSettings).filter(
            and_(
                SystemSettings.tenant_id == tenant_id,
                SystemSettings.setting_key == "fiscal_year_start",
            )
        ).first()
        
        if setting and setting.setting_value:
            month_str = setting.setting_value.lower()
            return MONTH_TO_NUMBER.get(month_str, 4)  # Default April
        return 4  # Default to April (Indian FY)
    except Exception as e:
        logger.error(f"Error getting fiscal year start: {e}")
        return 4


def get_period_date_range(
    frequency: str,
    reference_date: date,
    fiscal_year_start_month: int
) -> Tuple[date, date]:
    """
    Get the start and end date for a given frequency period.
    
    Args:
        frequency: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, ONCE, UNLIMITED
        reference_date: The date to calculate the period for
        fiscal_year_start_month: Month number (1-12) when fiscal year starts
    
    Returns:
        Tuple of (period_start_date, period_end_date)
    """
    if frequency == "DAILY":
        return reference_date, reference_date
    
    elif frequency == "WEEKLY":
        # Week starts on Monday
        start = reference_date - relativedelta(days=reference_date.weekday())
        end = start + relativedelta(days=6)
        return start, end
    
    elif frequency == "MONTHLY":
        start = reference_date.replace(day=1)
        end = start + relativedelta(months=1, days=-1)
        return start, end
    
    elif frequency == "QUARTERLY":
        # Quarters based on fiscal year
        month = reference_date.month
        # Calculate which fiscal quarter we're in
        fiscal_month = (month - fiscal_year_start_month) % 12 + 1
        quarter = (fiscal_month - 1) // 3
        
        # Calculate quarter start month in calendar terms
        quarter_start_fiscal_month = quarter * 3 + 1
        quarter_start_calendar_month = (fiscal_year_start_month + quarter_start_fiscal_month - 2) % 12 + 1
        
        if quarter_start_calendar_month > month:
            year = reference_date.year - 1
        else:
            year = reference_date.year
        
        start = date(year, quarter_start_calendar_month, 1)
        end = start + relativedelta(months=3, days=-1)
        return start, end
    
    elif frequency == "YEARLY":
        # Fiscal year
        if reference_date.month >= fiscal_year_start_month:
            fy_start_year = reference_date.year
        else:
            fy_start_year = reference_date.year - 1
        
        start = date(fy_start_year, fiscal_year_start_month, 1)
        end = start + relativedelta(years=1, days=-1)
        return start, end
    
    elif frequency == "ONCE":
        # For "ONCE" claims, we check all-time
        start = date(2000, 1, 1)  # Beginning of time
        end = date(2100, 12, 31)  # Far future
        return start, end
    
    else:  # UNLIMITED
        return None, None


def get_cumulative_amount_for_category(
    db: Session,
    tenant_id: UUID,
    employee_id: UUID,
    category_code: str,
    period_start: date,
    period_end: date,
    exclude_claim_id: Optional[UUID] = None
) -> Decimal:
    """
    Get the total amount claimed for a category within a period.
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        employee_id: Employee ID
        category_code: Category code to check
        period_start: Start of the period
        period_end: End of the period
        exclude_claim_id: Optional claim ID to exclude (for edits)
    
    Returns:
        Total claimed amount in the period
    """
    query = db.query(func.coalesce(func.sum(Claim.amount), 0)).filter(
        and_(
            Claim.tenant_id == tenant_id,
            Claim.employee_id == employee_id,
            Claim.category == category_code,
            Claim.claim_date >= period_start,
            Claim.claim_date <= period_end,
            # Exclude rejected and cancelled claims
            Claim.status.notin_(["REJECTED", "CANCELLED"])
        )
    )
    
    if exclude_claim_id:
        query = query.filter(Claim.id != exclude_claim_id)
    
    result = query.scalar()
    return Decimal(str(result)) if result else Decimal("0")


def get_claim_count_for_category(
    db: Session,
    tenant_id: UUID,
    employee_id: UUID,
    category_code: str,
    period_start: date,
    period_end: date,
    exclude_claim_id: Optional[UUID] = None
) -> int:
    """Get the count of claims for a category within a period."""
    query = db.query(func.count(Claim.id)).filter(
        and_(
            Claim.tenant_id == tenant_id,
            Claim.employee_id == employee_id,
            Claim.category == category_code,
            Claim.claim_date >= period_start,
            Claim.claim_date <= period_end,
            Claim.status.notin_(["REJECTED", "CANCELLED"])
        )
    )
    
    if exclude_claim_id:
        query = query.filter(Claim.id != exclude_claim_id)
    
    return query.scalar() or 0


def check_cumulative_limit(
    db: Session,
    tenant_id: UUID,
    employee_id: UUID,
    category_code: str,
    claim_amount: float,
    claim_date: date,
    exclude_claim_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Check if a claim would exceed the cumulative limit for its category.
    
    Returns:
        Dict with:
        - status: 'pass', 'warning', 'fail'
        - message: Human-readable message
        - details: Additional info (cumulative_used, limit, remaining, etc.)
    """
    try:
        # Get the policy category
        category = db.query(PolicyCategory).filter(
            and_(
                PolicyCategory.tenant_id == tenant_id,
                PolicyCategory.category_code == category_code,
                PolicyCategory.is_active == True
            )
        ).first()
        
        if not category:
            # Try case-insensitive match
            category = db.query(PolicyCategory).filter(
                and_(
                    PolicyCategory.tenant_id == tenant_id,
                    func.upper(PolicyCategory.category_code) == category_code.upper(),
                    PolicyCategory.is_active == True
                )
            ).first()
        
        if not category:
            return {
                "status": "warning",
                "message": f"Category '{category_code}' not found in policy",
                "details": {}
            }
        
        # Check if there's a max_amount limit
        max_amount = float(category.max_amount) if category.max_amount else None
        frequency = category.frequency_limit or "UNLIMITED"
        frequency_count = category.frequency_count
        
        if not max_amount and frequency == "UNLIMITED":
            return {
                "status": "pass",
                "message": "No limit defined for this category",
                "details": {"frequency": frequency}
            }
        
        # Get fiscal year start for period calculation
        fiscal_year_start = get_tenant_fiscal_year_start(db, tenant_id)
        
        # Get period date range
        period_start, period_end = get_period_date_range(
            frequency, claim_date, fiscal_year_start
        )
        
        if period_start is None:  # UNLIMITED
            return {
                "status": "pass",
                "message": "Unlimited claims allowed for this category",
                "details": {"frequency": frequency}
            }
        
        # Get cumulative amount and count
        cumulative_used = get_cumulative_amount_for_category(
            db, tenant_id, employee_id, category_code,
            period_start, period_end, exclude_claim_id
        )
        
        claim_count = get_claim_count_for_category(
            db, tenant_id, employee_id, category_code,
            period_start, period_end, exclude_claim_id
        )
        
        # Calculate new totals
        new_cumulative = cumulative_used + Decimal(str(claim_amount))
        
        # Format period for display
        frequency_display = {
            "DAILY": "today",
            "WEEKLY": "this week",
            "MONTHLY": "this month",
            "QUARTERLY": "this quarter",
            "YEARLY": "this fiscal year",
            "ONCE": "lifetime"
        }.get(frequency, frequency.lower())
        
        result = {
            "frequency": frequency,
            "frequency_display": frequency_display,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "cumulative_used": float(cumulative_used),
            "claim_count": claim_count,
            "new_total": float(new_cumulative),
            "max_amount": max_amount,
            "frequency_count": frequency_count
        }
        
        # Check amount limit
        if max_amount:
            result["remaining_before"] = float(Decimal(str(max_amount)) - cumulative_used)
            result["remaining_after"] = float(Decimal(str(max_amount)) - new_cumulative)
            
            if new_cumulative > Decimal(str(max_amount)):
                excess = float(new_cumulative - Decimal(str(max_amount)))
                return {
                    "status": "fail",
                    "message": f"Exceeds {frequency_display} limit of ₹{max_amount:,.2f}. "
                               f"Already claimed: ₹{float(cumulative_used):,.2f}, "
                               f"This claim: ₹{claim_amount:,.2f}, "
                               f"Excess: ₹{excess:,.2f}",
                    "details": result
                }
            
            # Warning if close to limit (>80%)
            utilization = float(new_cumulative) / max_amount * 100
            result["utilization_percent"] = utilization
            
            if utilization > 80:
                return {
                    "status": "warning",
                    "message": f"After this claim, you'll have used {utilization:.1f}% of "
                               f"your {frequency_display} limit (₹{float(new_cumulative):,.2f} of ₹{max_amount:,.2f})",
                    "details": result
                }
        
        # Check frequency count limit
        if frequency_count and claim_count >= frequency_count:
            return {
                "status": "fail",
                "message": f"Maximum {frequency_count} claim(s) allowed {frequency_display}. "
                           f"Already submitted: {claim_count}",
                "details": result
            }
        
        return {
            "status": "pass",
            "message": f"Within {frequency_display} limit" + 
                      (f" (₹{float(new_cumulative):,.2f} of ₹{max_amount:,.2f})" if max_amount else ""),
            "details": result
        }
        
    except Exception as e:
        logger.error(f"Error checking cumulative limit: {e}")
        return {
            "status": "warning",
            "message": f"Could not verify cumulative limit: {str(e)}",
            "details": {}
        }


def get_category_utilization_summary(
    db: Session,
    tenant_id: UUID,
    employee_id: UUID,
    category_code: str,
    reference_date: Optional[date] = None
) -> Dict[str, Any]:
    """
    Get a summary of category utilization for an employee.
    Useful for displaying in the UI before claim submission.
    """
    if reference_date is None:
        reference_date = date.today()
    
    try:
        # Get the policy category
        category = db.query(PolicyCategory).filter(
            and_(
                PolicyCategory.tenant_id == tenant_id,
                func.upper(PolicyCategory.category_code) == category_code.upper(),
                PolicyCategory.is_active == True
            )
        ).first()
        
        if not category:
            return {"error": "Category not found"}
        
        max_amount = float(category.max_amount) if category.max_amount else None
        frequency = category.frequency_limit or "UNLIMITED"
        
        if frequency == "UNLIMITED":
            return {
                "category_name": category.category_name,
                "frequency": "UNLIMITED",
                "message": "No limit for this category"
            }
        
        fiscal_year_start = get_tenant_fiscal_year_start(db, tenant_id)
        period_start, period_end = get_period_date_range(
            frequency, reference_date, fiscal_year_start
        )
        
        cumulative_used = get_cumulative_amount_for_category(
            db, tenant_id, employee_id, category_code,
            period_start, period_end
        )
        
        claim_count = get_claim_count_for_category(
            db, tenant_id, employee_id, category_code,
            period_start, period_end
        )
        
        return {
            "category_name": category.category_name,
            "category_code": category_code,
            "frequency": frequency,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "max_amount": max_amount,
            "cumulative_used": float(cumulative_used),
            "remaining": float(Decimal(str(max_amount or 0)) - cumulative_used) if max_amount else None,
            "utilization_percent": float(cumulative_used) / max_amount * 100 if max_amount else None,
            "claim_count": claim_count,
            "frequency_count": category.frequency_count
        }
        
    except Exception as e:
        logger.error(f"Error getting utilization summary: {e}")
        return {"error": str(e)}
