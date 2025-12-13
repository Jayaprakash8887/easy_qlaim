"""
Approval Agent - Routes claims and manages approval lifecycle
"""
from typing import Dict, Any
from datetime import datetime
from agents.base_agent import BaseAgent
from celery_app import celery_app
from config import settings
import logging

logger = logging.getLogger(__name__)


class ApprovalAgent(BaseAgent):
    """Handles claim routing and approval workflow"""
    
    def __init__(self):
        super().__init__("approval_agent", "1.0")
    
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
            
            # Get validation results
            validation = claim.claim_payload.get("validation", {})
            confidence = validation.get("confidence", 0.0)
            recommendation = validation.get("recommendation", "REVIEW")
            
            # Determine routing
            new_status = self._determine_routing(
                confidence, 
                recommendation,
                claim
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
                    "auto_approved": new_status == "FINANCE_APPROVED"
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
        claim: Any
    ) -> str:
        """Determine next status based on confidence and recommendation"""
        
        # Auto-approve if high confidence and enabled
        if settings.ENABLE_AUTO_APPROVAL:
            if confidence >= settings.AUTO_APPROVAL_CONFIDENCE_THRESHOLD:
                if recommendation == "AUTO_APPROVE" or recommendation == "APPROVE":
                    self.logger.info(f"Auto-approving claim {claim.id}")
                    return "FINANCE_APPROVED"  # Skip to finance for settlement
        
        # Check for policy exceptions
        validation = claim.claim_payload.get("validation", {})
        failed_rules = [r for r in validation.get("rules_checked", []) 
                       if r.get("result") == "fail"]
        
        if failed_rules:
            # Has policy exceptions - route to HR
            return "PENDING_HR"
        
        # Medium confidence - manager review
        if confidence >= 0.80:
            return "PENDING_MANAGER"
        
        # Low confidence - reject or HR review
        if confidence < 0.60:
            return "REJECTED"
        
        # Default - manager review
        return "PENDING_MANAGER"
    
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
