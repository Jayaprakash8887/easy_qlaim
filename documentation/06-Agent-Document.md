# Document Agent

## OCR Processing and Document Verification

### 1. Overview

The Document Agent is responsible for extracting text and structured data from uploaded expense documents (receipts, invoices, certificates). It uses a hybrid approach combining Tesseract OCR with LLM Vision API fallback for high accuracy.

---

## 2. Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **OCR Extraction** | Extract text from images and PDFs |
| **Data Parsing** | Identify amounts, dates, vendors from text |
| **Confidence Scoring** | Rate extraction quality |
| **LLM Enhancement** | Use Vision API for low-confidence results |
| **Document Storage** | Track processing status |

---

## 3. OCR Strategy

### 3.1 Hybrid OCR Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OCR PROCESSING STRATEGY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────────┐                             │
│                         │  Document Uploaded  │                             │
│                         └──────────┬──────────┘                             │
│                                    │                                         │
│                                    ▼                                         │
│                    ┌──────────────────────────────┐                         │
│                    │   PRIMARY: Tesseract OCR     │                         │
│                    │   (Free, Fast, Local)        │                         │
│                    └──────────────┬───────────────┘                         │
│                                   │                                          │
│                                   ▼                                          │
│                    ┌──────────────────────────────┐                         │
│                    │   Confidence Score Check     │                         │
│                    │   Threshold: 0.9             │                         │
│                    └──────────────┬───────────────┘                         │
│                                   │                                          │
│               ┌───────────────────┴───────────────────┐                     │
│               │                                       │                     │
│      Confidence >= 0.9                      Confidence < 0.9               │
│               │                                       │                     │
│               ▼                                       ▼                     │
│  ┌────────────────────────┐           ┌────────────────────────┐           │
│  │  ✅ Use Tesseract      │           │  FALLBACK: LLM Vision  │           │
│  │     Results            │           │  API for Enhancement   │           │
│  │     (No cost)          │           │  (Cost per call)       │           │
│  └────────────────────────┘           └────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Configuration

```python
# OCR Settings
OCR_ENGINE = "tesseract"
OCR_LANG = "en"
OCR_CONFIDENCE_THRESHOLD = 0.8          # Minimum acceptable
OCR_LLM_FALLBACK_THRESHOLD = 0.9        # Below this, try LLM
OCR_USE_LLM_FALLBACK = True             # Enable/disable fallback
```

---

## 4. Implementation

### 4.1 DocumentAgent Class

```python
class DocumentAgent(BaseAgent):
    """Handles OCR extraction and document verification"""
    
    def __init__(self):
        super().__init__("document_agent", "1.0")
        self.ocr_engine = None
        if settings.ENABLE_OCR:
            self._init_ocr()
    
    def _init_ocr(self):
        """Initialize Tesseract OCR with LLM Vision API fallback"""
        self.tesseract_available = False
        
        # Check Tesseract availability
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self.tesseract_available = True
            self.logger.info("Tesseract OCR initialized successfully")
        except Exception as e:
            self.logger.warning(f"Tesseract not available: {e}")
        
        # LLM Vision API fallback
        if settings.ENABLE_AI_VALIDATION and settings.OCR_USE_LLM_FALLBACK:
            self.logger.info("LLM Vision API available as fallback OCR")
```

### 4.2 Execute Method

```python
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
        self.log_execution(
            claim_id=claim_id,
            status="FAILURE",
            result_data={},
            execution_time_ms=int(execution_time),
            error_message=str(e)
        )
        raise
```

---

## 5. OCR Processing

### 5.1 Tesseract OCR

```python
def _run_tesseract(self, file_path: str) -> Dict[str, Any]:
    """Run Tesseract OCR on document"""
    import pytesseract
    from PIL import Image
    
    try:
        # Handle PDF files
        if file_path.lower().endswith('.pdf'):
            from pdf2image import convert_from_path
            images = convert_from_path(file_path)
            text_lines = []
            for img in images:
                text = pytesseract.image_to_string(img)
                text_lines.extend([
                    line.strip() for line in text.split('\n') 
                    if line.strip()
                ])
        else:
            # Handle image files
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img)
            text_lines = [
                line.strip() for line in text.split('\n') 
                if line.strip()
            ]
        
        # Get confidence using detailed data
        try:
            if file_path.lower().endswith('.pdf'):
                data = pytesseract.image_to_data(
                    images[0], 
                    output_type=pytesseract.Output.DICT
                )
            else:
                data = pytesseract.image_to_data(
                    Image.open(file_path), 
                    output_type=pytesseract.Output.DICT
                )
            
            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.5
        except:
            avg_confidence = 0.5
        
        return {
            "text": "\n".join(text_lines),
            "lines": text_lines,
            "confidence": avg_confidence,
            "method": "tesseract"
        }
        
    except Exception as e:
        self.logger.error(f"Tesseract OCR failed: {e}")
        raise
```

### 5.2 OCR with LLM Fallback

```python
def _run_ocr(self, file_path: str) -> Dict[str, Any]:
    """Run OCR on document with LLM Vision API fallback"""
    
    # Try Tesseract first (primary OCR)
    if self.tesseract_available:
        try:
            result = self._run_tesseract(file_path)
            
            # Check confidence threshold
            if (result.get("text") and 
                result.get("confidence", 0) >= settings.OCR_LLM_FALLBACK_THRESHOLD):
                return result
            
            # Low confidence - mark for LLM enhancement
            if (settings.OCR_USE_LLM_FALLBACK and 
                result.get("confidence", 0) < settings.OCR_LLM_FALLBACK_THRESHOLD):
                self.logger.info(
                    f"Tesseract confidence {result.get('confidence', 0):.2f} "
                    f"below threshold, trying LLM Vision fallback"
                )
                result["needs_llm_enhancement"] = True
                return result
            
            return result
            
        except Exception as e:
            self.logger.error(f"Tesseract OCR failed: {e}")
    
    # Tesseract not available
    return {
        "text": "",
        "lines": [],
        "confidence": 0.0,
        "error": "Tesseract OCR not available"
    }
```

---

## 6. Data Extraction

### 6.1 LLM-Powered Extraction

```python
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
            system_instruction=(
                "You are a document parser. "
                "Extract structured data accurately. "
                "Return only JSON."
            ),
            temperature=0.1  # Low temperature for factual extraction
        )
        
        # Parse JSON response
        import json
        data = json.loads(response)
        data["confidence"] = ocr_result.get("confidence", 0.0)
        
        return data
        
    except Exception as e:
        self.logger.error(f"LLM extraction failed: {e}")
        return {"confidence": 0.0, "error": str(e)}
```

### 6.2 Extracted Data Schema

```json
{
  "amount": 5000.00,
  "date": "2024-12-01",
  "vendor": "AWS Training & Certification",
  "category": "certification",
  "description": "AWS Solutions Architect Professional exam fee",
  "confidence": 0.95,
  "raw_text": "...",
  "extraction_method": "tesseract+llm"
}
```

---

## 7. Document Processing Flow

### 7.1 Single Document Processing

```python
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
```

### 7.2 Database Updates

```python
def _update_document_ocr(
    self, 
    document_id: Any, 
    ocr_result: Dict, 
    structured_data: Dict
):
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
```

---

## 8. Supported Document Types

### 8.1 File Formats

| Format | Support | Notes |
|--------|---------|-------|
| PDF | ✅ Full | Multi-page support |
| JPEG/JPG | ✅ Full | Primary image format |
| PNG | ✅ Full | Good for screenshots |
| TIFF | ✅ Full | High-quality scans |
| GIF | ⚠️ Limited | Single frame only |

### 8.2 Document Categories

| Category | Common Documents |
|----------|------------------|
| Certification | Exam receipts, certificates |
| Travel | Tickets, hotel invoices, taxi receipts |
| Meals | Restaurant bills, food delivery receipts |
| Equipment | Purchase invoices, warranties |
| Training | Course fees, workshop receipts |

---

## 9. Error Handling

### 9.1 OCR Failures

```python
# Handle OCR failures gracefully
try:
    ocr_result = self._run_ocr(file_path)
except TesseractError as e:
    self.logger.warning(f"Tesseract failed: {e}")
    ocr_result = {
        "text": "",
        "confidence": 0.0,
        "error": str(e),
        "needs_manual_review": True
    }
```

### 9.2 LLM Extraction Failures

```python
try:
    structured_data = await self._extract_structured_data(ocr_result)
except LLMError as e:
    self.logger.warning(f"LLM extraction failed: {e}")
    structured_data = {
        "confidence": ocr_result.get("confidence", 0.0),
        "raw_text": ocr_result.get("text", ""),
        "extraction_failed": True
    }
```

---

## 10. Performance Optimization

### 10.1 Processing Times

| Operation | Typical Time | Max Time |
|-----------|--------------|----------|
| PDF to Image | 1-2s | 5s |
| Tesseract OCR | 2-3s | 8s |
| LLM Extraction | 1-2s | 5s |
| Total (simple doc) | 3-5s | 10s |

### 10.2 Optimization Techniques

1. **Image preprocessing:** Resize large images
2. **Parallel processing:** Multiple documents concurrently
3. **Caching:** Store extracted data
4. **Early termination:** Skip if high confidence

```python
# Parallel document processing
async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
    documents = self._get_claim_documents(claim_id)
    
    # Process all documents in parallel
    tasks = [self._process_document(doc) for doc in documents]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out failed results
    successful_results = [
        r for r in results 
        if not isinstance(r, Exception)
    ]
    
    return {
        "success": True,
        "documents_processed": len(successful_results),
        "results": successful_results
    }
```

---

## 11. Celery Task

```python
@celery_app.task(
    name="agents.document_agent.process_documents",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def process_documents_task(self, claim_id: str):
    """Celery task to process documents"""
    import asyncio
    
    try:
        agent = DocumentAgent()
        context = {"claim_id": claim_id}
        
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(agent.execute(context))
        
        return result
    except Exception as e:
        self.retry(exc=e)
```

---

## 12. Monitoring

### 12.1 Metrics

- Documents processed per hour
- Average OCR confidence
- LLM fallback rate
- Processing time distribution
- Error rate by document type

### 12.2 Logging

```python
self.logger.info(f"Processing documents for claim {claim_id}")
self.logger.info(f"Tesseract OCR initialized successfully")
self.logger.info(f"Tesseract extracted {len(text_lines)} lines")
self.logger.warning(f"Tesseract confidence {confidence:.2f} below threshold")
self.logger.error(f"Document processing failed: {e}")
```

---

*Document Version: 1.0 | Last Updated: December 2024*
