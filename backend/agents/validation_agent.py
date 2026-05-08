"""
Validation Agent - Policy validation with rule-based and AI reasoning
"""
from typing import Dict, Any, List
from datetime import datetime, date
from agents.base_agent import BaseAgent
from celery_app import celery_app
from config import settings
import logging

logger = logging.getLogger(__name__)

# Month name to number mapping for fiscal year calculation
MONTH_TO_NUMBER = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


class ValidationAgent(BaseAgent):
    """Validates claims against policies using hybrid approach"""
    
    def __init__(self):
        super().__init__("validation_agent", "1.0")
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate claim against policies
        
        Context should contain:
        - claim_id: UUID of the claim
        """
        self.validate_context(context, ["claim_id"])
        
        claim_id = context["claim_id"]
        start_time = datetime.utcnow()
        
        self.logger.info(f"Validating claim {claim_id}")
        
        try:
            # Get claim data
            claim = self._get_claim(claim_id)
            
            # Get applicable policies
            policies = self._get_policies(claim.claim_type, claim.category)
            
            # Layer 1: Rule-based validation (fast, free, deterministic)
            rule_results = self._validate_rules(claim, policies)
            
            # Check if all rules passed
            all_rules_passed = all(r["result"] == "pass" for r in rule_results)
            
            # Layer 2: AI reasoning (only if needed)
            if all_rules_passed:
                # High confidence - no LLM needed
                confidence = 0.98
                recommendation = "AUTO_APPROVE"
                reasoning = "All policy rules satisfied through deterministic checks."
                llm_used = False
            else:
                # Some rules failed - use LLM for edge case reasoning
                llm_result = await self._llm_validation(claim, policies, rule_results)
                confidence = llm_result["confidence"]
                recommendation = llm_result["recommendation"]
                reasoning = llm_result["reasoning"]
                llm_used = True
            
            # Prepare validation result
            validation_result = {
                "agent_name": self.agent_name,
                "executed_at": datetime.utcnow().isoformat(),
                "confidence": confidence,
                "recommendation": recommendation,
                "reasoning": reasoning,
                "rules_checked": rule_results,
                "llm_used": llm_used
            }
            
            # Update claim with validation results
            self._update_claim_validation(claim_id, validation_result)
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Log execution
            self.log_execution(
                claim_id=claim_id,
                status="SUCCESS",
                result_data={
                    "confidence": confidence,
                    "recommendation": recommendation,
                    "llm_used": llm_used
                },
                execution_time_ms=int(execution_time)
            )
            
            return {
                "success": True,
                "claim_id": claim_id,
                "validation": validation_result
            }
            
        except Exception as e:
            self.logger.error(f"Validation failed: {e}")
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self.log_execution(
                claim_id=claim_id,
                status="FAILURE",
                result_data={},
                execution_time_ms=int(execution_time),
                error_message=str(e)
            )
            raise
    
    def _validate_rules(self, claim: Any, policies: List[Any]) -> List[Dict[str, Any]]:
        """Rule-based validation - Layer 1"""
        results = []
        
        # Get employee data for tenure check
        employee = self._get_employee(claim.employee_id)
        
        # Rule 1: Amount limit check
        amount_limit = self._get_amount_limit(claim.category, policies)
        if amount_limit:
            results.append({
                "rule_id": f"{claim.category}_AMOUNT",
                "result": "pass" if claim.amount <= amount_limit else "fail",
                "evidence": f"{claim.amount} <= {amount_limit}"
            })
        
        # Rule 2: Tenure requirement
        tenure_months = self._calculate_tenure_months(employee.date_of_joining)
        min_tenure = self._get_min_tenure(claim.category, policies)
        if min_tenure:
            results.append({
                "rule_id": f"{claim.category}_TENURE",
                "result": "pass" if tenure_months >= min_tenure else "fail",
                "evidence": f"{tenure_months} months >= {min_tenure} months"
            })
        
        # Rule 3: Document completeness
        documents = self._get_claim_documents(claim.id)
        required_docs = self._get_required_documents(claim.category, policies)
        has_required_docs = len(documents) >= required_docs
        results.append({
            "rule_id": f"{claim.category}_DOCS",
            "result": "pass" if has_required_docs else "fail",
            "evidence": f"{len(documents)} documents uploaded, {required_docs} required"
        })
        
        # Rule 4: Date validity
        max_age_days = 90  # Claims must be within 90 days
        days_old = (date.today() - claim.claim_date).days
        results.append({
            "rule_id": "DATE_VALIDITY",
            "result": "pass" if days_old <= max_age_days else "fail",
            "evidence": f"Claim is {days_old} days old, max allowed: {max_age_days}"
        })
        
        # Rule 5: Financial Year Check
        # Verify claim belongs to current financial year based on tenant settings
        fy_check = self._check_financial_year(claim.claim_date, claim.tenant_id)
        results.append({
            "rule_id": "FINANCIAL_YEAR",
            "result": "pass" if fy_check["is_current_fy"] else "fail",
            "evidence": fy_check["evidence"]
        })
        
        return results
    
    async def _llm_validation(
        self, 
        claim: Any, 
        policies: List[Any], 
        rule_results: List[Dict]
    ) -> Dict[str, Any]:
        """AI-powered validation for edge cases"""
        
        # Build context for LLM
        failed_rules = [r for r in rule_results if r["result"] == "fail"]
        
        policy_text = "\n\n".join([p.policy_text for p in policies]) if policies else "No specific policy found"
        
        prompt = f"""
Analyze this reimbursement claim for policy compliance:

CLAIM DETAILS:
- Category: {claim.category}
- Amount: {claim.amount} {claim.currency}
- Date: {claim.claim_date}
- Description: {claim.description or 'N/A'}

POLICY RULES:
{policy_text}

RULE-BASED VALIDATION RESULTS:
{self._format_rules(rule_results)}

FAILED RULES:
{self._format_rules(failed_rules) if failed_rules else 'None'}

TASK:
1. Assess if this claim should be approved despite failed rules
2. Consider if there are valid business justifications
3. Provide confidence score (0.0 to 1.0)
4. Make a recommendation: APPROVE, REVIEW, or REJECT

Return in JSON format:
{{
    "confidence": <float>,
    "recommendation": "<APPROVE|REVIEW|REJECT>",
    "reasoning": "<detailed explanation>",
    "justification": "<why this decision makes sense>"
}}
"""
        
        try:
            response = await self.call_llm(
                prompt=prompt,
                system_instruction="You are a policy compliance expert. Analyze claims carefully and provide balanced recommendations.",
                temperature=0.3
            )
            
            import json
            result = json.loads(response)
            
            # Adjust confidence based on failed rules
            if failed_rules:
                result["confidence"] = min(result.get("confidence", 0.5), 0.85)
            
            return result
            
        except Exception as e:
            self.logger.error(f"LLM validation failed: {e}")
            return {
                "confidence": 0.5,
                "recommendation": "REVIEW",
                "reasoning": f"LLM validation failed: {e}. Recommend manual review.",
                "justification": "Unable to perform AI validation"
            }
    
    def _format_rules(self, rules: List[Dict]) -> str:
        """Format rules for display"""
        return "\n".join([
            f"- {r['rule_id']}: {r['result'].upper()} ({r['evidence']})"
            for r in rules
        ])
    
    def _get_amount_limit(self, category: str, policies: List[Any]) -> float:
        """Get amount limit for category"""
        # Simplified - should parse from policy rules
        limits = {
            "CERTIFICATION": 25000,
            "TRAVEL": 50000,
            "TEAM_LUNCH": 500,
            "ONCALL": 2000,
            "OVERTIME": 3000,
        }
        return limits.get(category, 10000)
    
    def _get_min_tenure(self, category: str, policies: List[Any]) -> int:
        """Get minimum tenure in months for category"""
        # Simplified - should parse from policy rules
        tenure_requirements = {
            "CERTIFICATION": 6,
            "TRAVEL": 3,
            "TEAM_LUNCH": 0,
            "ONCALL": 1,
        }
        return tenure_requirements.get(category, 0)
    
    def _get_required_documents(self, category: str, policies: List[Any]) -> int:
        """Get required document count"""
        # Simplified
        if category in ["CERTIFICATION", "TRAVEL"]:
            return 1
        return 0
    
    def _calculate_tenure_months(self, date_of_joining: Any) -> int:
        """Calculate tenure in months"""
        if not date_of_joining:
            return 0
        
        today = date.today()
        months = (today.year - date_of_joining.year) * 12 + (today.month - date_of_joining.month)
        return months
    
    def _get_fiscal_year_start(self, tenant_id: Any) -> int:
        """
        Get the fiscal year start month for the tenant.
        Returns month number (1-12). Default is April (4) if not set.
        """
        from database import get_sync_db
        from models import SystemSettings
        from sqlalchemy import and_
        
        db = next(get_sync_db())
        setting = db.query(SystemSettings).filter(
            and_(
                SystemSettings.setting_key == "fiscal_year_start",
                SystemSettings.tenant_id == tenant_id
            )
        ).first()
        
        if setting and setting.setting_value:
            month_str = setting.setting_value.lower().strip()
            return MONTH_TO_NUMBER.get(month_str, 4)  # Default to April
        
        return 4  # Default fiscal year starts in April
    
    def _get_current_financial_year_range(self, fiscal_start_month: int) -> tuple:
        """
        Get the start and end dates of the current financial year.
        
        Args:
            fiscal_start_month: Month number when fiscal year starts (1-12)
        
        Returns:
            Tuple of (fy_start_date, fy_end_date)
        """
        today = date.today()
        current_year = today.year
        current_month = today.month
        
        # Determine the fiscal year based on current date
        if current_month >= fiscal_start_month:
            # We're in the fiscal year that started this calendar year
            fy_start_year = current_year
        else:
            # We're in the fiscal year that started last calendar year
            fy_start_year = current_year - 1
        
        fy_end_year = fy_start_year + 1
        
        # Calculate fiscal year start date
        fy_start = date(fy_start_year, fiscal_start_month, 1)
        
        # Calculate fiscal year end date (last day of month before fiscal start)
        # If fiscal year starts in April, it ends on March 31
        fy_end_month = fiscal_start_month - 1 if fiscal_start_month > 1 else 12
        
        # Get last day of the ending month
        if fy_end_month == 12:
            fy_end = date(fy_end_year, 12, 31)
        else:
            # Get last day of month by going to first day of next month and subtracting 1 day
            from calendar import monthrange
            last_day = monthrange(fy_end_year, fy_end_month)[1]
            fy_end = date(fy_end_year, fy_end_month, last_day)
        
        return fy_start, fy_end
    
    def _check_financial_year(self, claim_date: Any, tenant_id: Any) -> Dict[str, Any]:
        """
        Check if the claim date falls within the current financial year.
        
        Args:
            claim_date: The date of the claim
            tenant_id: Tenant ID to get fiscal year settings
        
        Returns:
            Dict with is_current_fy (bool) and evidence (str)
        """
        if not claim_date:
            return {
                "is_current_fy": False,
                "evidence": "Claim date is missing"
            }
        
        # Convert claim_date to date if it's datetime
        if isinstance(claim_date, datetime):
            claim_date = claim_date.date()
        
        # Get fiscal year start month for tenant
        fiscal_start_month = self._get_fiscal_year_start(tenant_id)
        
        # Get current financial year range
        fy_start, fy_end = self._get_current_financial_year_range(fiscal_start_month)
        
        # Check if claim date is within current financial year
        is_current_fy = fy_start <= claim_date <= fy_end
        
        # Format month name for evidence
        month_names = {1: "January", 2: "February", 3: "March", 4: "April", 
                       5: "May", 6: "June", 7: "July", 8: "August",
                       9: "September", 10: "October", 11: "November", 12: "December"}
        
        fy_label = f"FY {fy_start.year}-{str(fy_end.year)[-2:]}"  # e.g., "FY 2025-26"
        
        if is_current_fy:
            evidence = f"Claim date {claim_date} is within current {fy_label} ({fy_start} to {fy_end})"
        else:
            evidence = f"Claim date {claim_date} is outside current {fy_label} ({fy_start} to {fy_end})"
        
        return {
            "is_current_fy": is_current_fy,
            "evidence": evidence,
            "fy_start": fy_start.isoformat(),
            "fy_end": fy_end.isoformat(),
            "fiscal_start_month": month_names.get(fiscal_start_month, "Unknown")
        }
    
    def _get_claim(self, claim_id: str):
        """Get claim from database"""
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        return db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
    
    def _get_employee(self, employee_id: Any):
        """Get employee from database"""
        from database import get_sync_db
        from models import User as Employee
        
        db = next(get_sync_db())
        return db.query(Employee).filter(Employee.id == employee_id).first()
    
    def _get_policies(self, claim_type: str, category: str) -> List[Any]:
        """Get applicable policies"""
        from database import get_sync_db
        from models import Policy
        
        db = next(get_sync_db())
        return db.query(Policy).filter(
            Policy.policy_type == claim_type,
            Policy.category == category,
            Policy.is_active == True
        ).all()
    
    def _get_claim_documents(self, claim_id: Any) -> List[Any]:
        """Get claim documents"""
        from database import get_sync_db
        from models import Document
        
        db = next(get_sync_db())
        return db.query(Document).filter(Document.claim_id == claim_id).all()
    
    def _update_claim_validation(self, claim_id: str, validation_result: Dict):
        """Update claim with validation results"""
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
        
        if claim:
            if not claim.claim_payload:
                claim.claim_payload = {}
            
            claim.claim_payload["validation"] = validation_result
            db.commit()


@celery_app.task(name="agents.validation_agent.validate_claim")
def validate_claim_task(claim_id: str):
    """Celery task to validate claim"""
    import asyncio
    
    agent = ValidationAgent()
    context = {"claim_id": claim_id}
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(agent.execute(context))
    
    return result
