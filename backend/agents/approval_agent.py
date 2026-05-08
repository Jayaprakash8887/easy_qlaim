"""
Approval Agent - Routes claims and manages approval lifecycle
"""
from typing import Dict, Any, Optional
from datetime import datetime
from agents.base_agent import BaseAgent
from celery_app import celery_app
from config import settings
from utils.timezone import (
    DEFAULT_AUTO_APPROVAL_THRESHOLD,
    DEFAULT_POLICY_COMPLIANCE_THRESHOLD,
    DEFAULT_ENABLE_AUTO_APPROVAL,
    DEFAULT_AUTO_SKIP_AFTER_MANAGER,
    DEFAULT_MAX_AUTO_APPROVAL_AMOUNT,
)
import logging

logger = logging.getLogger(__name__)


class ApprovalAgent(BaseAgent):
    """Handles claim routing and approval workflow"""
    
    def __init__(self):
        super().__init__("approval_agent", "1.0")
    
    def _get_tenant_settings(self, tenant_id) -> Dict[str, Any]:
        """
        Fetch tenant-specific settings from database.
        Returns default values if settings not found.
        """
        from database import get_sync_db
        from models import SystemSettings
        from sqlalchemy import and_
        
        defaults = {
            "enable_auto_approval": DEFAULT_ENABLE_AUTO_APPROVAL,
            "auto_skip_after_manager": DEFAULT_AUTO_SKIP_AFTER_MANAGER,
            "auto_approval_threshold": DEFAULT_AUTO_APPROVAL_THRESHOLD,
            "policy_compliance_threshold": DEFAULT_POLICY_COMPLIANCE_THRESHOLD,
            "max_auto_approval_amount": DEFAULT_MAX_AUTO_APPROVAL_AMOUNT,
        }
        
        try:
            db = next(get_sync_db())
            
            # Fetch relevant settings
            settings_to_fetch = [
                "enable_auto_approval", 
                "auto_skip_after_manager",
                "auto_approval_threshold", 
                "policy_compliance_threshold",
                "max_auto_approval_amount"
            ]
            
            for key in settings_to_fetch:
                setting = db.query(SystemSettings).filter(
                    and_(
                        SystemSettings.setting_key == key,
                        SystemSettings.tenant_id == tenant_id
                    )
                ).first()
                
                if setting:
                    value = setting.setting_value
                    # Convert to appropriate type
                    if key in ["enable_auto_approval", "auto_skip_after_manager"]:
                        defaults[key] = value.lower() in ("true", "1", "yes", "on")
                    elif key in ["auto_approval_threshold", "policy_compliance_threshold"]:
                        defaults[key] = int(value)
                    elif key == "max_auto_approval_amount":
                        defaults[key] = float(value)
            
            self.logger.info(f"Tenant settings loaded: {defaults}")
            return defaults
            
        except Exception as e:
            self.logger.warning(f"Failed to fetch tenant settings, using defaults: {e}")
            return defaults
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Route claim based on validation results
        
        Context should contain:
        - claim_id: UUID of the claim
        """
        self.validate_context(context, ["claim_id"])
        
        claim_id = context["claim_id"]
        start_time = datetime.utcnow()
        
        self.logger.info(f"Routing claim {claim_id}")
        
        try:
            # Get claim with validation results
            claim = self._get_claim(claim_id)
            
            # Get tenant-specific settings
            tenant_settings = self._get_tenant_settings(claim.tenant_id)
            
            # Get validation results
            validation = claim.claim_payload.get("validation", {})
            confidence = validation.get("confidence", 0.0)
            recommendation = validation.get("recommendation", "REVIEW")
            
            # Get claim amount for threshold check
            claim_amount = claim.amount or 0.0
            
            # Determine routing using tenant settings
            new_status = self._determine_routing(
                confidence, 
                recommendation,
                claim,
                claim_amount,
                tenant_settings
            )
            
            # Update claim status
            self._update_claim_status(claim_id, new_status)
            
            # Create approval record
            self._create_approval_record(claim_id, new_status)
            
            # Send notifications
            await self._send_notifications(claim, new_status)
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Log execution
            self.log_execution(
                claim_id=claim_id,
                status="SUCCESS",
                result_data={
                    "new_status": new_status,
                    "confidence": confidence,
                    "auto_approved": new_status == "FINANCE_APPROVED",
                    "tenant_settings_used": tenant_settings
                },
                execution_time_ms=int(execution_time)
            )
            
            return {
                "success": True,
                "claim_id": claim_id,
                "new_status": new_status,
                "routed_to": self._get_approver_role(new_status)
            }
            
        except Exception as e:
            self.logger.error(f"Routing failed: {e}")
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self.log_execution(
                claim_id=claim_id,
                status="FAILURE",
                result_data={},
                execution_time_ms=int(execution_time),
                error_message=str(e)
            )
            raise
    
    def _determine_routing(
        self, 
        confidence: float,
        recommendation: str,
        claim: Any,
        claim_amount: float,
        tenant_settings: Dict[str, Any]
    ) -> str:
        """
        Determine next status based on confidence, recommendation, tenant settings,
        and approval skip rules.
        
        Routing Logic (in priority order):
        1. FIRST: Check if Approval Skip Rules were applied at claim creation
           - If skip rules exist, respect them (don't override with auto-approval)
           - Return the claim's current status (already set by skip rules)
        2. If auto-approval enabled AND confidence >= AI threshold AND confidence >= Policy threshold 
           AND amount <= max AND APPROVE recommendation → FINANCE_APPROVED
        3. If policy exceptions exist → PENDING_HR
        4. If confidence < 60% → REJECTED
        5. Default → PENDING_MANAGER
        """
        
        # ============ CHECK APPROVAL SKIP RULES FIRST ============
        # Approval skip rules are applied at claim creation based on employee designation/email
        # If skip rules were applied, we should respect them and not override with auto-approval logic
        approval_skip_info = claim.claim_payload.get("approval_skip_info", {})
        
        if approval_skip_info.get("applied_rule_id"):
            # Skip rules were applied - respect them
            skip_manager = approval_skip_info.get("skip_manager", False)
            skip_hr = approval_skip_info.get("skip_hr", False)
            skip_finance = approval_skip_info.get("skip_finance", False)
            rule_name = approval_skip_info.get("applied_rule_name", "Unknown")
            
            self.logger.info(
                f"Approval skip rule '{rule_name}' was applied for claim {claim.id}. "
                f"Skip levels - Manager: {skip_manager}, HR: {skip_hr}, Finance: {skip_finance}"
            )
            
            # Check for policy exceptions - even with skip rules, policy violations may need HR review
            validation = claim.claim_payload.get("validation", {})
            failed_rules = [r for r in validation.get("rules_checked", []) 
                           if r.get("result") == "fail"]
            
            if failed_rules and not skip_hr:
                # Policy violations exist and HR is not skipped - route to HR
                self.logger.info(
                    f"Claim {claim.id} has {len(failed_rules)} policy violations, "
                    f"routing to HR despite skip rules"
                )
                return "PENDING_HR"
            
            # Determine status based on skip rules
            if skip_manager and skip_hr and skip_finance:
                self.logger.info(f"Claim {claim.id} auto-settled via skip rule '{rule_name}'")
                return "SETTLED"
            elif skip_manager and skip_hr:
                self.logger.info(f"Claim {claim.id} routed to Finance via skip rule '{rule_name}'")
                return "PENDING_FINANCE"
            elif skip_manager:
                self.logger.info(f"Claim {claim.id} routed to HR via skip rule '{rule_name}'")
                return "PENDING_HR"
            else:
                # No skips - follow normal flow but log that rule was checked
                self.logger.info(f"Skip rule '{rule_name}' matched but no levels skipped for claim {claim.id}")
        
        # ============ AUTO-APPROVAL LOGIC (only if no skip rules applied) ============
        enable_auto_approval = tenant_settings.get("enable_auto_approval", DEFAULT_ENABLE_AUTO_APPROVAL)
        auto_approval_threshold = tenant_settings.get("auto_approval_threshold", DEFAULT_AUTO_APPROVAL_THRESHOLD) / 100.0
        max_auto_approval_amount = tenant_settings.get("max_auto_approval_amount", DEFAULT_MAX_AUTO_APPROVAL_AMOUNT)
        policy_compliance_threshold = tenant_settings.get("policy_compliance_threshold", DEFAULT_POLICY_COMPLIANCE_THRESHOLD) / 100.0
        
        self.logger.info(f"Routing claim {claim.id} - confidence: {confidence}, amount: {claim_amount}")
        self.logger.info(f"Settings - auto_approval: {enable_auto_approval}, ai_threshold: {auto_approval_threshold}, policy_threshold: {policy_compliance_threshold}, max_amount: {max_auto_approval_amount}")
        
        # Auto-approve if enabled and ALL conditions met:
        # - confidence >= AI Confidence Threshold
        # - confidence >= Policy Compliance Threshold  
        # - amount <= Max Amount
        # - recommendation is APPROVE
        if enable_auto_approval:
            meets_ai_threshold = confidence >= auto_approval_threshold
            meets_policy_threshold = confidence >= policy_compliance_threshold
            meets_amount_limit = claim_amount <= max_auto_approval_amount
            has_approve_recommendation = recommendation in ("AUTO_APPROVE", "APPROVE")
            
            if meets_ai_threshold and meets_policy_threshold and meets_amount_limit and has_approve_recommendation:
                self.logger.info(
                    f"Auto-approving claim {claim.id} - confidence ({confidence*100:.1f}%) meets both "
                    f"AI threshold ({auto_approval_threshold*100:.1f}%) and policy threshold ({policy_compliance_threshold*100:.1f}%), "
                    f"amount (${claim_amount}) within limit (${max_auto_approval_amount})"
                )
                return "FINANCE_APPROVED"  # Skip to finance for settlement
            else:
                # Log why auto-approval failed
                reasons = []
                if not meets_ai_threshold:
                    reasons.append(f"confidence {confidence*100:.1f}% < AI threshold {auto_approval_threshold*100:.1f}%")
                if not meets_policy_threshold:
                    reasons.append(f"confidence {confidence*100:.1f}% < policy threshold {policy_compliance_threshold*100:.1f}%")
                if not meets_amount_limit:
                    reasons.append(f"amount ${claim_amount} > max ${max_auto_approval_amount}")
                if not has_approve_recommendation:
                    reasons.append(f"recommendation is {recommendation}, not APPROVE")
                self.logger.info(f"Auto-approval not eligible for claim {claim.id}: {', '.join(reasons)}")
        
        # Check for policy exceptions
        validation = claim.claim_payload.get("validation", {})
        failed_rules = [r for r in validation.get("rules_checked", []) 
                       if r.get("result") == "fail"]
        
        if failed_rules:
            self.logger.info(f"Claim {claim.id} has {len(failed_rules)} failed policy rules, routing to HR")
            return "PENDING_HR"
        
        # Low confidence - reject
        if confidence < 0.60:
            self.logger.info(f"Claim {claim.id} has low confidence ({confidence*100:.1f}%), rejecting")
            return "REJECTED"
        
        # Default - manager review
        self.logger.info(f"Routing claim {claim.id} to manager for review")
        return "PENDING_MANAGER"
    
    def process_manager_approval(self, claim_id: str, approved: bool) -> str:
        """
        Process manager approval and determine next routing.
        If auto_skip_after_manager is enabled and thresholds are met, skip HR/Finance.
        
        Returns the new status after manager action.
        """
        claim = self._get_claim(claim_id)
        tenant_settings = self._get_tenant_settings(claim.tenant_id)
        
        if not approved:
            return "REJECTED"
        
        # Check if auto-skip is enabled
        auto_skip = tenant_settings.get("auto_skip_after_manager", DEFAULT_AUTO_SKIP_AFTER_MANAGER)
        enable_auto_approval = tenant_settings.get("enable_auto_approval", DEFAULT_ENABLE_AUTO_APPROVAL)
        auto_approval_threshold = tenant_settings.get("auto_approval_threshold", DEFAULT_AUTO_APPROVAL_THRESHOLD) / 100.0
        max_auto_approval_amount = tenant_settings.get("max_auto_approval_amount", DEFAULT_MAX_AUTO_APPROVAL_AMOUNT)
        
        validation = claim.claim_payload.get("validation", {})
        confidence = validation.get("confidence", 0.0)
        claim_amount = claim.amount or 0.0
        
        # Check for policy exceptions
        failed_rules = [r for r in validation.get("rules_checked", []) 
                       if r.get("result") == "fail"]
        
        if auto_skip and enable_auto_approval:
            # If confidence is high enough and no policy violations
            if confidence >= auto_approval_threshold and not failed_rules:
                if claim_amount <= max_auto_approval_amount:
                    self.logger.info(f"Auto-skipping HR/Finance for claim {claim_id} after manager approval")
                    return "FINANCE_APPROVED"
        
        # If there were policy exceptions, must go to HR
        if failed_rules:
            self.logger.info(f"Claim {claim_id} has policy exceptions, routing to HR after manager approval")
            return "PENDING_HR"
        
        # Standard flow - route to finance after manager
        return "PENDING_FINANCE"
    
    def process_hr_approval(self, claim_id: str, approved: bool) -> str:
        """
        Process HR approval and determine next routing.
        If auto_skip_after_manager is enabled and thresholds are met, skip Finance.
        
        Returns the new status after HR action.
        """
        if not approved:
            return "REJECTED"
        
        claim = self._get_claim(claim_id)
        tenant_settings = self._get_tenant_settings(claim.tenant_id)
        
        auto_skip = tenant_settings.get("auto_skip_after_manager", DEFAULT_AUTO_SKIP_AFTER_MANAGER)
        enable_auto_approval = tenant_settings.get("enable_auto_approval", DEFAULT_ENABLE_AUTO_APPROVAL)
        auto_approval_threshold = tenant_settings.get("auto_approval_threshold", DEFAULT_AUTO_APPROVAL_THRESHOLD) / 100.0
        max_auto_approval_amount = tenant_settings.get("max_auto_approval_amount", DEFAULT_MAX_AUTO_APPROVAL_AMOUNT)
        
        validation = claim.claim_payload.get("validation", {})
        confidence = validation.get("confidence", 0.0)
        claim_amount = claim.amount or 0.0
        
        if auto_skip and enable_auto_approval:
            # If confidence is high and amount is within limits, skip finance
            if confidence >= auto_approval_threshold and claim_amount <= max_auto_approval_amount:
                self.logger.info(f"Auto-skipping Finance for claim {claim_id} after HR approval")
                return "FINANCE_APPROVED"
        
        # Standard flow - route to finance
        return "PENDING_FINANCE"
    
    def _get_approver_role(self, status: str) -> str:
        """Get approver role for status"""
        role_mapping = {
            "PENDING_MANAGER": "MANAGER",
            "PENDING_HR": "HR",
            "PENDING_FINANCE": "FINANCE",
            "FINANCE_APPROVED": "AUTO",
            "REJECTED": "SYSTEM"
        }
        return role_mapping.get(status, "UNKNOWN")
    
    def _get_claim(self, claim_id: str):
        """Get claim from database"""
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        return db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
    
    def _update_claim_status(self, claim_id: str, new_status: str):
        """Update claim status"""
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
        
        if claim:
            claim.status = new_status
            claim.updated_at = datetime.utcnow()
            db.commit()
            self.logger.info(f"Claim {claim_id} status updated to {new_status}")
    
    def _create_approval_record(self, claim_id: str, status: str):
        """Create approval record"""
        from database import get_sync_db
        from models import Approval, Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
        
        if claim:
            approval_stage = self._get_approver_role(status)
            
            approval = Approval(
                tenant_id=claim.tenant_id,
                claim_id=claim.id,
                approval_stage=approval_stage,
                status="PENDING" if "PENDING" in status else "APPROVED",
                created_at=datetime.utcnow()
            )
            
            db.add(approval)
            db.commit()
    
    async def _send_notifications(self, claim: Any, new_status: str):
        """Send notifications to stakeholders"""
        # Placeholder for notification logic
        self.logger.info(f"Sending notification for claim {claim.id} - Status: {new_status}")
        # Future: Implement email/SMS notifications


@celery_app.task(name="agents.approval_agent.route_claim")
def route_claim_task(claim_id: str):
    """Celery task to route claim"""
    import asyncio
    
    agent = ApprovalAgent()
    context = {"claim_id": claim_id}
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(agent.execute(context))
    
    return result
