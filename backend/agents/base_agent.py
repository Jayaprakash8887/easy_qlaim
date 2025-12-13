"""
Base Agent class for all AI agents
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import logging
from config import settings
import google.generativeai as genai

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all agents in the system"""
    
    def __init__(self, agent_name: str, version: str = "1.0"):
        self.agent_name = agent_name
        self.version = version
        self.logger = logging.getLogger(f"agents.{agent_name}")
        
        # Initialize Gemini if needed
        if settings.ENABLE_AI_VALIDATION:
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        else:
            self.model = None
    
    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent's task
        
        Args:
            context: Dictionary containing task context and data
            
        Returns:
            Dictionary containing execution results
        """
        pass
    
    def log_execution(
        self, 
        claim_id: Optional[str], 
        status: str, 
        result_data: Dict[str, Any],
        execution_time_ms: int,
        error_message: Optional[str] = None
    ):
        """Log agent execution for learning and monitoring"""
        try:
            from database import get_sync_db
            from models import AgentExecution
            from uuid import UUID
            
            db = next(get_sync_db())
            
            execution = AgentExecution(
                tenant_id=UUID(settings.DEFAULT_TENANT_ID),
                claim_id=UUID(claim_id) if claim_id else None,
                agent_name=self.agent_name,
                agent_version=self.version,
                status=status,
                result_data=result_data,
                error_message=error_message,
                execution_time_ms=execution_time_ms,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
                confidence_score=result_data.get("confidence"),
                llm_tokens_used=result_data.get("tokens_used"),
            )
            
            db.add(execution)
            db.commit()
            
        except Exception as e:
            self.logger.error(f"Error logging execution: {e}")
    
    async def call_llm(
        self, 
        prompt: str, 
        system_instruction: Optional[str] = None,
        temperature: Optional[float] = None
    ) -> str:
        """
        Call Gemini LLM with prompt
        
        Args:
            prompt: User prompt
            system_instruction: System instruction for the model
            temperature: Temperature for generation
            
        Returns:
            Generated text response
        """
        if not self.model:
            raise ValueError("LLM is not enabled")
        
        try:
            temp = temperature if temperature is not None else settings.GEMINI_TEMPERATURE
            
            if system_instruction:
                model = genai.GenerativeModel(
                    settings.GEMINI_MODEL,
                    system_instruction=system_instruction
                )
            else:
                model = self.model
            
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=temp,
                    max_output_tokens=settings.GEMINI_MAX_TOKENS,
                )
            )
            
            return response.text
            
        except Exception as e:
            self.logger.error(f"LLM call failed: {e}")
            raise
    
    def validate_context(self, context: Dict[str, Any], required_keys: list) -> bool:
        """Validate that required context keys are present"""
        missing_keys = [key for key in required_keys if key not in context]
        if missing_keys:
            raise ValueError(f"Missing required context keys: {missing_keys}")
        return True
