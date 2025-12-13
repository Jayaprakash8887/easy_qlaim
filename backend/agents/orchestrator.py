"""
Orchestrator Agent - Master coordinator for claim processing
"""
from typing import Dict, Any
from datetime import datetime
from celery import chain, group
from agents.base_agent import BaseAgent
from celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


class OrchestratorAgent(BaseAgent):
    """Orchestrates the entire claim processing workflow"""
    
    def __init__(self):
        super().__init__("orchestrator", "1.0")
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Orchestrate claim processing workflow
        
        Context should contain:
        - claim_id: UUID of the claim
        - claim_type: REIMBURSEMENT or ALLOWANCE
        - has_documents: Boolean
        """
        self.validate_context(context, ["claim_id", "claim_type"])
        
        claim_id = context["claim_id"]
        claim_type = context["claim_type"]
        has_documents = context.get("has_documents", False)
        
        self.logger.info(f"Orchestrating claim {claim_id} - Type: {claim_type}")
        
        try:
            # Update claim status to AI_PROCESSING
            self._update_claim_status(claim_id, "AI_PROCESSING")
            
            # Build workflow based on claim type
            if claim_type == "ALLOWANCE":
                # Allowance: Skip document processing
                workflow = self._build_allowance_workflow(claim_id)
            else:
                # Reimbursement: Full workflow with OCR
                workflow = self._build_reimbursement_workflow(claim_id, has_documents)
            
            # Execute workflow
            result = await workflow
            
            self.logger.info(f"Claim {claim_id} processed successfully")
            
            return {
                "success": True,
                "claim_id": claim_id,
                "workflow_result": result
            }
            
        except Exception as e:
            self.logger.error(f"Orchestration failed for claim {claim_id}: {e}")
            self._update_claim_status(claim_id, "REJECTED")
            raise
    
    def _build_reimbursement_workflow(self, claim_id: str, has_documents: bool) -> chain:
        """Build workflow for reimbursement claims"""
        from agents.document_agent import process_documents_task
        from agents.integration_agent import fetch_employee_data_task
        from agents.validation_agent import validate_claim_task
        from agents.approval_agent import route_claim_task
        
        tasks = []
        
        # Step 1: Document processing (if documents uploaded)
        if has_documents:
            tasks.append(process_documents_task.s(claim_id))
        
        # Step 2: Fetch employee and project data
        tasks.append(fetch_employee_data_task.s(claim_id))
        
        # Step 3: Validate against policies
        tasks.append(validate_claim_task.s(claim_id))
        
        # Step 4: Route for approval
        tasks.append(route_claim_task.s(claim_id))
        
        # Create chain workflow
        return chain(*tasks)()
    
    def _build_allowance_workflow(self, claim_id: str) -> chain:
        """Build workflow for allowance claims"""
        from agents.integration_agent import fetch_employee_data_task
        from agents.validation_agent import validate_claim_task
        from agents.approval_agent import route_claim_task
        
        # Allowance workflow: No document processing
        return chain(
            fetch_employee_data_task.s(claim_id),
            validate_claim_task.s(claim_id),
            route_claim_task.s(claim_id),
        )()
    
    def _update_claim_status(self, claim_id: str, status: str):
        """Update claim status in database"""
        try:
            from database import get_sync_db
            from models import Claim
            from uuid import UUID
            
            db = next(get_sync_db())
            claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
            
            if claim:
                claim.status = status
                claim.updated_at = datetime.utcnow()
                db.commit()
                self.logger.info(f"Claim {claim_id} status updated to {status}")
            else:
                self.logger.error(f"Claim {claim_id} not found")
                
        except Exception as e:
            self.logger.error(f"Error updating claim status: {e}")


@celery_app.task(name="agents.orchestrator.process_claim")
def process_claim_task(claim_id: str, claim_type: str, has_documents: bool = False):
    """
    Celery task to process a claim through the orchestrator
    
    Args:
        claim_id: UUID string of the claim
        claim_type: REIMBURSEMENT or ALLOWANCE
        has_documents: Whether documents were uploaded
    """
    import asyncio
    
    orchestrator = OrchestratorAgent()
    
    context = {
        "claim_id": claim_id,
        "claim_type": claim_type,
        "has_documents": has_documents,
    }
    
    # Run async execute in sync context
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(orchestrator.execute(context))
    
    return result
