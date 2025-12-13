"""
Agents package initialization
"""
from agents.base_agent import BaseAgent
from agents.orchestrator import OrchestratorAgent, process_claim_task
from agents.document_agent import DocumentAgent, process_documents_task
from agents.validation_agent import ValidationAgent, validate_claim_task
from agents.integration_agent import IntegrationAgent, fetch_employee_data_task
from agents.approval_agent import ApprovalAgent, route_claim_task
from agents.learning_agent import LearningAgent, daily_learning_analysis

__all__ = [
    "BaseAgent",
    "OrchestratorAgent",
    "DocumentAgent",
    "ValidationAgent",
    "IntegrationAgent",
    "ApprovalAgent",
    "LearningAgent",
    "process_claim_task",
    "process_documents_task",
    "validate_claim_task",
    "fetch_employee_data_task",
    "route_claim_task",
    "daily_learning_analysis",
]
