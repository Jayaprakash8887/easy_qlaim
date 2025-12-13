"""
Integration Agent - Fetch employee, project, and external system data
"""
from typing import Dict, Any, Optional
from datetime import datetime
from agents.base_agent import BaseAgent
from celery_app import celery_app
from config import settings
import logging

logger = logging.getLogger(__name__)


class IntegrationAgent(BaseAgent):
    """Handles data fetching from internal DB and external systems"""
    
    def __init__(self):
        super().__init__("integration_agent", "1.0")
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetch employee and project data
        
        Context should contain:
        - claim_id: UUID of the claim
        """
        self.validate_context(context, ["claim_id"])
        
        claim_id = context["claim_id"]
        start_time = datetime.utcnow()
        
        self.logger.info(f"Fetching integration data for claim {claim_id}")
        
        try:
            # Get claim
            claim = self._get_claim(claim_id)
            
            # Fetch employee data
            employee_data = await self._fetch_employee_data(claim.employee_id)
            
            # Fetch project data if applicable
            project_data = None
            if claim.claim_payload.get("project_code"):
                project_data = await self._fetch_project_data(
                    claim.claim_payload["project_code"]
                )
            
            # Fetch timesheet data for allowance claims
            timesheet_data = None
            if claim.claim_type == "ALLOWANCE":
                timesheet_data = await self._fetch_timesheet_data(
                    claim.employee_id,
                    claim.claim_date
                )
            
            # Update claim with fetched data
            self._update_claim_integration_data(
                claim_id,
                employee_data,
                project_data,
                timesheet_data
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Log execution
            self.log_execution(
                claim_id=claim_id,
                status="SUCCESS",
                result_data={
                    "employee_data_fetched": employee_data is not None,
                    "project_data_fetched": project_data is not None,
                    "timesheet_data_fetched": timesheet_data is not None
                },
                execution_time_ms=int(execution_time)
            )
            
            return {
                "success": True,
                "claim_id": claim_id,
                "employee_data": employee_data,
                "project_data": project_data,
                "timesheet_data": timesheet_data
            }
            
        except Exception as e:
            self.logger.error(f"Integration failed: {e}")
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self.log_execution(
                claim_id=claim_id,
                status="FAILURE",
                result_data={},
                execution_time_ms=int(execution_time),
                error_message=str(e)
            )
            raise
    
    async def _fetch_employee_data(self, employee_id: Any) -> Optional[Dict[str, Any]]:
        """Fetch employee data from HRMS or local DB"""
        
        # Try HRMS first if enabled
        if settings.HRMS_ENABLED:
            try:
                data = await self._fetch_from_hrms(employee_id)
                if data:
                    return data
            except Exception as e:
                self.logger.warning(f"HRMS fetch failed: {e}")
                if not settings.HRMS_FALLBACK_TO_LOCAL:
                    raise
        
        # Fallback to local DB
        return self._fetch_employee_from_db(employee_id)
    
    async def _fetch_from_hrms(self, employee_id: Any) -> Optional[Dict[str, Any]]:
        """Fetch employee data from external HRMS API"""
        # Placeholder for future HRMS integration
        self.logger.info(f"HRMS integration not yet implemented for employee {employee_id}")
        return None
    
    def _fetch_employee_from_db(self, employee_id: Any) -> Dict[str, Any]:
        """Fetch employee data from local database"""
        from database import get_sync_db
        from models import Employee
        
        db = next(get_sync_db())
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        
        if not employee:
            raise ValueError(f"Employee {employee_id} not found")
        
        # Calculate tenure
        tenure_months = 0
        if employee.date_of_joining:
            from datetime import date
            today = date.today()
            tenure_months = (today.year - employee.date_of_joining.year) * 12 + \
                          (today.month - employee.date_of_joining.month)
        
        return {
            "employee_id": str(employee.id),
            "name": f"{employee.first_name} {employee.last_name}",
            "email": employee.email,
            "department": employee.department,
            "designation": employee.designation,
            "date_of_joining": employee.date_of_joining.isoformat() if employee.date_of_joining else None,
            "tenure_months": tenure_months,
            "status": employee.employment_status
        }
    
    async def _fetch_project_data(self, project_code: str) -> Optional[Dict[str, Any]]:
        """Fetch project data from local database"""
        from database import get_sync_db
        from models import Project
        
        db = next(get_sync_db())
        project = db.query(Project).filter(Project.project_code == project_code).first()
        
        if not project:
            self.logger.warning(f"Project {project_code} not found")
            return None
        
        return {
            "project_id": str(project.id),
            "project_code": project.project_code,
            "project_name": project.project_name,
            "budget_allocated": float(project.budget_allocated) if project.budget_allocated else 0,
            "budget_spent": float(project.budget_spent) if project.budget_spent else 0,
            "budget_available": float(project.budget_available) if project.budget_available else 0,
            "status": project.status
        }
    
    async def _fetch_timesheet_data(
        self, 
        employee_id: Any, 
        claim_date: Any
    ) -> Optional[Dict[str, Any]]:
        """Fetch timesheet data for allowance validation"""
        
        # Try Kronos first if enabled
        if settings.KRONOS_ENABLED:
            try:
                data = await self._fetch_from_kronos(employee_id, claim_date)
                if data:
                    return data
            except Exception as e:
                self.logger.warning(f"Kronos fetch failed: {e}")
                if not settings.KRONOS_FALLBACK_TO_LOCAL:
                    raise
        
        # For now, return placeholder
        # Future: implement local timesheet storage
        return {
            "source": "manual",
            "on_call_hours": 0,
            "overtime_hours": 0,
            "note": "Manual entry required - Kronos integration pending"
        }
    
    async def _fetch_from_kronos(self, employee_id: Any, claim_date: Any) -> Optional[Dict[str, Any]]:
        """Fetch timesheet from Kronos API"""
        # Placeholder for future Kronos integration
        self.logger.info(f"Kronos integration not yet implemented")
        return None
    
    def _get_claim(self, claim_id: str):
        """Get claim from database"""
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        return db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
    
    def _update_claim_integration_data(
        self,
        claim_id: str,
        employee_data: Dict,
        project_data: Optional[Dict],
        timesheet_data: Optional[Dict]
    ):
        """Update claim with integration data"""
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
        
        if claim:
            if not claim.claim_payload:
                claim.claim_payload = {}
            
            claim.claim_payload["integration_data"] = {
                "employee": employee_data,
                "project": project_data,
                "timesheet": timesheet_data,
                "fetched_at": datetime.utcnow().isoformat()
            }
            
            db.commit()


@celery_app.task(name="agents.integration_agent.fetch_employee_data")
def fetch_employee_data_task(claim_id: str):
    """Celery task to fetch employee data"""
    import asyncio
    
    agent = IntegrationAgent()
    context = {"claim_id": claim_id}
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(agent.execute(context))
    
    return result


@celery_app.task(name="agents.integration_agent.sync_external_data")
def sync_external_data():
    """Periodic task to sync data from external systems"""
    logger.info("Syncing external data (placeholder)")
    # Future: Implement periodic sync from HRMS/Kronos
    return {"synced": True}
