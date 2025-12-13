"""
Learning Agent - Continuous improvement and pattern analysis
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta
from agents.base_agent import BaseAgent
from celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


class LearningAgent(BaseAgent):
    """Analyzes agent performance and identifies improvement opportunities"""
    
    def __init__(self):
        super().__init__("learning_agent", "1.0")
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform learning analysis
        
        Context can contain:
        - analysis_type: daily, weekly, monthly
        - days_back: number of days to analyze
        """
        
        analysis_type = context.get("analysis_type", "daily")
        days_back = context.get("days_back", 1)
        
        self.logger.info(f"Running {analysis_type} learning analysis for last {days_back} days")
        
        try:
            # Analyze agent accuracy
            accuracy_report = self._analyze_agent_accuracy(days_back)
            
            # Analyze OCR performance
            ocr_report = self._analyze_ocr_performance(days_back)
            
            # Identify policy gaps
            policy_gaps = self._identify_policy_gaps(days_back)
            
            # Detect patterns
            patterns = self._detect_patterns(days_back)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(
                accuracy_report,
                ocr_report,
                policy_gaps,
                patterns
            )
            
            report = {
                "analysis_type": analysis_type,
                "period": f"Last {days_back} days",
                "generated_at": datetime.utcnow().isoformat(),
                "accuracy_report": accuracy_report,
                "ocr_report": ocr_report,
                "policy_gaps": policy_gaps,
                "patterns": patterns,
                "recommendations": recommendations
            }
            
            # Store report
            self._store_learning_report(report)
            
            return {
                "success": True,
                "report": report
            }
            
        except Exception as e:
            self.logger.error(f"Learning analysis failed: {e}")
            raise
    
    def _analyze_agent_accuracy(self, days_back: int) -> Dict[str, Any]:
        """Analyze accuracy of agent predictions vs actual outcomes"""
        from database import get_sync_db
        from models import AgentExecution, Claim
        from datetime import datetime, timedelta
        
        db = next(get_sync_db())
        
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Get validation agent executions
        executions = db.query(AgentExecution).filter(
            AgentExecution.agent_name == "validation_agent",
            AgentExecution.started_at >= cutoff_date,
            AgentExecution.status == "SUCCESS"
        ).all()
        
        total = len(executions)
        high_confidence = sum(1 for e in executions if e.confidence_score and e.confidence_score >= 0.95)
        medium_confidence = sum(1 for e in executions if e.confidence_score and 0.80 <= e.confidence_score < 0.95)
        low_confidence = sum(1 for e in executions if e.confidence_score and e.confidence_score < 0.80)
        
        return {
            "total_validations": total,
            "high_confidence_count": high_confidence,
            "medium_confidence_count": medium_confidence,
            "low_confidence_count": low_confidence,
            "avg_confidence": sum(e.confidence_score for e in executions if e.confidence_score) / total if total > 0 else 0
        }
    
    def _analyze_ocr_performance(self, days_back: int) -> Dict[str, Any]:
        """Analyze OCR accuracy and frequently edited fields"""
        from database import get_sync_db
        from models import Document
        from datetime import datetime, timedelta
        
        db = next(get_sync_db())
        
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        documents = db.query(Document).filter(
            Document.ocr_processed == True,
            Document.ocr_processed_at >= cutoff_date
        ).all()
        
        total = len(documents)
        avg_confidence = sum(d.ocr_confidence for d in documents if d.ocr_confidence) / total if total > 0 else 0
        
        return {
            "total_documents_processed": total,
            "avg_ocr_confidence": avg_confidence,
            "low_confidence_count": sum(1 for d in documents if d.ocr_confidence and d.ocr_confidence < 0.8)
        }
    
    def _identify_policy_gaps(self, days_back: int) -> List[Dict[str, Any]]:
        """Identify claims frequently returned or rejected"""
        from database import get_sync_db
        from models import Claim
        from datetime import datetime, timedelta
        
        db = next(get_sync_db())
        
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Find claims with high return count
        returned_claims = db.query(Claim).filter(
            Claim.return_count >= 2,
            Claim.updated_at >= cutoff_date
        ).all()
        
        gaps = []
        for claim in returned_claims:
            gaps.append({
                "claim_id": str(claim.id),
                "category": claim.category,
                "return_count": claim.return_count,
                "reason": claim.return_reason
            })
        
        return gaps
    
    def _detect_patterns(self, days_back: int) -> Dict[str, Any]:
        """Detect claim patterns and trends"""
        from database import get_sync_db
        from models import Claim
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        db = next(get_sync_db())
        
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Category distribution
        category_dist = db.query(
            Claim.category,
            func.count(Claim.id).label('count'),
            func.avg(Claim.amount).label('avg_amount')
        ).filter(
            Claim.created_at >= cutoff_date
        ).group_by(Claim.category).all()
        
        patterns = {
            "category_distribution": [
                {
                    "category": cat,
                    "count": count,
                    "avg_amount": float(avg_amount) if avg_amount else 0
                }
                for cat, count, avg_amount in category_dist
            ]
        }
        
        return patterns
    
    def _generate_recommendations(
        self,
        accuracy_report: Dict,
        ocr_report: Dict,
        policy_gaps: List,
        patterns: Dict
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # OCR recommendations
        if ocr_report["avg_ocr_confidence"] < 0.85:
            recommendations.append(
                f"OCR confidence is {ocr_report['avg_ocr_confidence']:.2f}. "
                "Consider fine-tuning OCR model or improving document quality requirements."
            )
        
        # Policy gap recommendations
        if len(policy_gaps) > 5:
            recommendations.append(
                f"Found {len(policy_gaps)} claims with multiple returns. "
                "Review policy documentation for clarity."
            )
        
        # Validation recommendations
        if accuracy_report["low_confidence_count"] > accuracy_report["total_validations"] * 0.3:
            recommendations.append(
                "More than 30% of validations have low confidence. "
                "Consider updating policy rules or providing more training data."
            )
        
        return recommendations
    
    def _store_learning_report(self, report: Dict):
        """Store learning report for future reference"""
        # Future: Store in a dedicated learning_reports table
        self.logger.info(f"Learning report generated: {len(report['recommendations'])} recommendations")


@celery_app.task(name="agents.learning_agent.daily_learning_analysis")
def daily_learning_analysis():
    """Daily learning analysis task"""
    import asyncio
    
    agent = LearningAgent()
    context = {
        "analysis_type": "daily",
        "days_back": 1
    }
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(agent.execute(context))
    
    return result
