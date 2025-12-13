"""
Document Agent - OCR processing and document verification
"""
from typing import Dict, Any, List
from datetime import datetime
from agents.base_agent import BaseAgent
from celery_app import celery_app
from config import settings
import logging

logger = logging.getLogger(__name__)


class DocumentAgent(BaseAgent):
    """Handles OCR extraction and document verification"""
    
    def __init__(self):
        super().__init__("document_agent", "1.0")
        self.ocr_engine = None
        if settings.ENABLE_OCR:
            self._init_ocr()
    
    def _init_ocr(self):
        """Initialize PaddleOCR"""
        try:
            from paddleocr import PaddleOCR
            self.ocr_engine = PaddleOCR(
                use_angle_cls=True,
                lang=settings.OCR_LANG,
                use_gpu=False,
                show_log=False
            )
            self.logger.info("PaddleOCR initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize OCR: {e}")
            self.ocr_engine = None
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process documents for a claim
        
        Context should contain:
        - claim_id: UUID of the claim
        """
        self.validate_context(context, ["claim_id"])
        
        claim_id = context["claim_id"]
        start_time = datetime.utcnow()
        
        self.logger.info(f"Processing documents for claim {claim_id}")
        
        try:
            # Get documents for claim
            documents = self._get_claim_documents(claim_id)
            
            if not documents:
                self.logger.warning(f"No documents found for claim {claim_id}")
                return {"success": True, "documents_processed": 0}
            
            # Process each document
            results = []
            for doc in documents:
                result = await self._process_document(doc)
                results.append(result)
            
            # Update claim with OCR data
            self._update_claim_ocr_data(claim_id, results)
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Log execution
            self.log_execution(
                claim_id=claim_id,
                status="SUCCESS",
                result_data={
                    "documents_processed": len(results),
                    "average_confidence": sum(r["confidence"] for r in results) / len(results)
                },
                execution_time_ms=int(execution_time)
            )
            
            return {
                "success": True,
                "claim_id": claim_id,
                "documents_processed": len(results),
                "results": results
            }
            
        except Exception as e:
            self.logger.error(f"Document processing failed: {e}")
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self.log_execution(
                claim_id=claim_id,
                status="FAILURE",
                result_data={},
                execution_time_ms=int(execution_time),
                error_message=str(e)
            )
            raise
    
    async def _process_document(self, document: Any) -> Dict[str, Any]:
        """Process a single document with OCR"""
        try:
            # Download document from storage
            file_path = await self._download_document(document.storage_path)
            
            # Run OCR
            ocr_result = self._run_ocr(file_path)
            
            # Extract structured data using LLM
            structured_data = await self._extract_structured_data(ocr_result)
            
            # Update document record
            self._update_document_ocr(document.id, ocr_result, structured_data)
            
            return {
                "document_id": str(document.id),
                "confidence": structured_data.get("confidence", 0.0),
                "extracted_data": structured_data
            }
            
        except Exception as e:
            self.logger.error(f"Error processing document {document.id}: {e}")
            return {
                "document_id": str(document.id),
                "confidence": 0.0,
                "error": str(e)
            }
    
    def _run_ocr(self, file_path: str) -> Dict[str, Any]:
        """Run OCR on document"""
        if not self.ocr_engine:
            raise ValueError("OCR engine not initialized")
        
        try:
            result = self.ocr_engine.ocr(file_path, cls=True)
            
            # Extract text and confidence scores
            text_lines = []
            confidences = []
            
            if result and result[0]:
                for line in result[0]:
                    text = line[1][0]
                    confidence = line[1][1]
                    text_lines.append(text)
                    confidences.append(confidence)
            
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return {
                "text": "\n".join(text_lines),
                "lines": text_lines,
                "confidence": avg_confidence,
                "raw_result": result
            }
            
        except Exception as e:
            self.logger.error(f"OCR failed: {e}")
            return {
                "text": "",
                "lines": [],
                "confidence": 0.0,
                "error": str(e)
            }
    
    async def _extract_structured_data(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """Use LLM to extract structured data from OCR text"""
        if not settings.ENABLE_AI_VALIDATION:
            return {"confidence": ocr_result.get("confidence", 0.0)}
        
        ocr_text = ocr_result.get("text", "")
        if not ocr_text:
            return {"confidence": 0.0}
        
        prompt = f"""
Extract structured information from this document text:

{ocr_text}

Please extract and return in JSON format:
- amount: The total amount (number only)
- date: The date in YYYY-MM-DD format
- vendor: The vendor/merchant name
- category: The expense category (e.g., certification, travel, meal)
- description: Brief description of the expense

If any field cannot be determined, set it to null.
Return ONLY valid JSON.
"""
        
        try:
            response = await self.call_llm(
                prompt=prompt,
                system_instruction="You are a document parser. Extract structured data accurately. Return only JSON.",
                temperature=0.1
            )
            
            # Parse JSON response
            import json
            data = json.loads(response)
            data["confidence"] = ocr_result.get("confidence", 0.0)
            
            return data
            
        except Exception as e:
            self.logger.error(f"LLM extraction failed: {e}")
            return {"confidence": 0.0, "error": str(e)}
    
    async def _download_document(self, storage_path: str) -> str:
        """Download document from GCP storage to local temp file"""
        # Implementation for GCP Storage download
        # For now, return the storage path (assuming local for development)
        return storage_path
    
    def _get_claim_documents(self, claim_id: str) -> List[Any]:
        """Get all documents for a claim"""
        from database import get_sync_db
        from models import Document
        from uuid import UUID
        
        db = next(get_sync_db())
        documents = db.query(Document).filter(
            Document.claim_id == UUID(claim_id)
        ).all()
        
        return documents
    
    def _update_document_ocr(self, document_id: Any, ocr_result: Dict, structured_data: Dict):
        """Update document with OCR results"""
        from database import get_sync_db
        from models import Document
        
        db = next(get_sync_db())
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if document:
            document.ocr_text = ocr_result.get("text", "")
            document.ocr_data = structured_data
            document.ocr_confidence = ocr_result.get("confidence", 0.0)
            document.ocr_processed = True
            document.ocr_processed_at = datetime.utcnow()
            db.commit()
    
    def _update_claim_ocr_data(self, claim_id: str, results: List[Dict]):
        """Update claim with aggregated OCR data"""
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
        
        if claim:
            # Aggregate OCR text
            ocr_texts = []
            for result in results:
                if "extracted_data" in result:
                    ocr_texts.append(str(result["extracted_data"]))
            
            claim.ocr_text = "\n".join(ocr_texts)
            
            # Update claim payload with OCR fields
            if not claim.claim_payload:
                claim.claim_payload = {}
            
            claim.claim_payload["ocr_results"] = results
            db.commit()


@celery_app.task(name="agents.document_agent.process_documents")
def process_documents_task(claim_id: str):
    """Celery task to process documents"""
    import asyncio
    
    agent = DocumentAgent()
    context = {"claim_id": claim_id}
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(agent.execute(context))
    
    return result
