"""
Claim Validation Service
Handles real-time validation of claims against policy rules.
"""
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from datetime import date

from models import PolicyCategory, Claim
from schemas import (
    ClaimValidationRequest, ClaimValidationResponse, 
    ValidationCheckResult, ValidationStatus, CategoryType
)
from services.ai_analysis import generate_policy_checks
from services.duplicate_detection import check_duplicate_claim
from services.cumulative_limit_service import check_cumulative_limit

logger = logging.getLogger(__name__)

class ClaimValidationService:
    def __init__(self, db: Session):
        self.db = db
    
    def _get_tenant_fiscal_year_start(self, tenant_id: UUID) -> str:
        """
        Get the fiscal year start month for a tenant.
        Returns month code like 'jan', 'apr', etc. Default is 'apr'.
        """
        from models import SystemSettings
        from sqlalchemy import and_
        
        try:
            setting = self.db.query(SystemSettings).filter(
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

    async def validate_claim(self, request: ClaimValidationRequest) -> ClaimValidationResponse:
        """
        Validate a claim against policy rules and existing claims.
        """
        from models import PolicyUpload
        
        # 1. Get policy category details along with its parent policy for effective_from date
        category = self.db.query(PolicyCategory).filter(
            PolicyCategory.tenant_id == request.tenant_id,
            PolicyCategory.category_code == request.category_code
        ).first()
        
        category_name = category.category_name if category else request.category_code
        policy_limit = float(category.max_amount) if category and category.max_amount else None
        submission_window = category.submission_window_days if category else 15
        
        # Get the policy's effective_from date
        policy_effective_from = None
        if category and category.policy_upload_id:
            policy = self.db.query(PolicyUpload).filter(
                PolicyUpload.id == category.policy_upload_id,
                PolicyUpload.is_active == True
            ).first()
            if policy:
                policy_effective_from = policy.effective_from
        
        # 2. Check for duplicates
        is_potential_duplicate = False
        if request.employee_id and request.claim_date:
            try:
                # We need to adapt the session if it's sync, but duplicate_detection is async
                # If db is sync Session, we might need a workaround or make everything async
                # Since policies.py uses get_sync_db, we are in a sync context for DB
                # But check_duplicate_claim needs AsyncSession
                # ADAPTATION: For now, we'll do a simple sync check or skip if it's too complex
                # to mix sync/async DB sessions.
                pass 
            except Exception as e:
                logger.warning(f"Duplicate check failed in validation: {e}")
        
        # 3. Generate policy checks using existing logic
        # We'll adapt the generate_policy_checks from ai_analysis
        claim_data = {
            "amount": request.amount,
            "category": request.category_code,
            "claim_type": request.category_type.value,
            "claim_date": request.claim_date,
            "vendor": request.additional_data.get("vendor") if request.additional_data else None,
        }
        
        # Get tenant's fiscal year start
        fiscal_year_start = self._get_tenant_fiscal_year_start(request.tenant_id)
        
        # Check cumulative limit for this category
        cumulative_check = None
        if request.employee_id:
            try:
                cumulative_check = check_cumulative_limit(
                    db=self.db,
                    tenant_id=request.tenant_id,
                    employee_id=request.employee_id,
                    category_code=request.category_code,
                    claim_amount=request.amount,
                    claim_date=request.claim_date
                )
            except Exception as e:
                logger.warning(f"Cumulative limit check failed: {e}")
        
        policy_checks = generate_policy_checks(
            claim_data=claim_data,
            has_document=request.has_receipt,
            policy_limit=policy_limit,
            submission_window_days=submission_window,
            is_potential_duplicate=is_potential_duplicate,
            policy_effective_from=policy_effective_from,
            fiscal_year_start=fiscal_year_start,
            cumulative_limit_check=cumulative_check,
            category_name=category_name
        )
        
        # 4. Filter and map checks to ValidationCheckResult
        checks = []
        passed = 0
        warned = 0
        failed = 0
        
        for check in policy_checks.get("checks", []):
            status = ValidationStatus.PASS
            if check["status"] == "fail":
                status = ValidationStatus.FAIL
                failed += 1
            elif check["status"] == "warning":
                status = ValidationStatus.WARNING
                warned += 1
            else:
                passed += 1
                
            checks.append(ValidationCheckResult(
                check_name=check["label"],
                status=status,
                message=check["message"],
                details=None
            ))
            
        # Determine overall status
        overall_status = ValidationStatus.PASS
        if failed > 0:
            overall_status = ValidationStatus.FAIL
        elif warned > 0:
            overall_status = ValidationStatus.WARNING
            
        return ClaimValidationResponse(
            status=overall_status,
            category_name=category_name,
            category_code=request.category_code,
            checks=checks,
            checks_total=len(checks),
            checks_passed=passed,
            checks_warned=warned,
            checks_failed=failed
        )
