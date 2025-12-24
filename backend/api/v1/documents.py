"""
Document management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import RedirectResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
from uuid import UUID, uuid4
import os
import shutil
from pathlib import Path
import logging
import json
import re

from database import get_sync_db
from models import Document, Claim
from schemas import DocumentResponse
from config import settings
from services.storage import upload_to_gcs, get_signed_url, delete_from_gcs
from services.security import file_validator, audit_logger, get_client_ip

logger = logging.getLogger(__name__)
router = APIRouter()

# Ensure upload directory exists - use local directory for development
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def normalize_region(region: Union[str, List[str]]) -> List[str]:
    """
    Normalize region parameter to handle various input formats.
    
    The user's region in the database is stored as an array (e.g., ['IND']),
    but the API receives it as a string. This function handles:
    - List input: ["IND", "USA"] -> ["IND", "USA"] (pass through)
    - Comma-separated strings: "IND,USA" -> ["IND", "USA"]
    - Array-like strings: "['IND']" -> ["IND"]
    - Simple strings: "IND" -> ["IND"]
    - Empty/None: -> ["IND"] (default)
    
    Returns a list of normalized region codes.
    """
    # If already a list, normalize each element and return
    if isinstance(region, list):
        normalized = [r.strip().upper() for r in region if r and r.strip()]
        return normalized if normalized else ["IND"]
    
    if not region or not region.strip():
        return ["IND"]
    
    region = region.strip()
    
    # Handle array-like strings: "['IND']" or '["IND"]' or "{IND}"
    if region.startswith(('[', '{')) and region.endswith((']', '}')):
        # Remove brackets and quotes
        cleaned = region.strip('[]{}').replace('"', '').replace("'", "")
        # Split by comma and clean each element
        regions = [r.strip().upper() for r in cleaned.split(',') if r.strip()]
        return regions if regions else ["IND"]
    
    # Handle comma-separated: "IND,USA"
    if ',' in region:
        regions = [r.strip().upper() for r in region.split(',') if r.strip()]
        return regions if regions else ["IND"]
    
    return [region.upper()] if region else ["IND"]


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    tenant_id: UUID,
    claim_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get list of documents with optional claim and tenant filter"""
    query = db.query(Document)
    
    # Filter by tenant if provided
    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)
    
    if claim_id:
        query = query.filter(Document.claim_id == claim_id)
    
    documents = query.offset(skip).limit(limit).all()
    
    # Add download URLs to each document
    result = []
    for doc in documents:
        doc_dict = {
            "id": doc.id,
            "claim_id": doc.claim_id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "document_type": doc.document_type,
            "storage_path": doc.storage_path,
            "file_size": doc.file_size,
            "ocr_processed": doc.ocr_processed,
            "ocr_confidence": doc.ocr_confidence,
            "uploaded_at": doc.uploaded_at,
            "gcs_uri": doc.gcs_uri,
            "gcs_blob_name": doc.gcs_blob_name,
            "storage_type": doc.storage_type,
            "content_type": doc.content_type,
            "download_url": f"/api/v1/documents/{doc.id}/view"
        }
        result.append(doc_dict)
    
    return result


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get document by ID"""
    query = db.query(Document).filter(Document.id == document_id)
    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)
    document = query.first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.post("/upload/{claim_id}", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    claim_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_sync_db)
):
    """Upload a document for a claim - stores in GCS with local fallback"""
    # Check if claim exists
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Read file content for validation
    file_content = await file.read()
    await file.seek(0)  # Reset file pointer for later use
    
    # Validate file using security service
    allowed_extensions = settings.allowed_extensions_list
    is_valid, error_message = file_validator.validate_file(
        file_content=file_content,
        filename=file.filename or "document",
        allowed_extensions=allowed_extensions
    )
    
    if not is_valid:
        # Log security event for invalid file upload
        audit_logger.log(
            event_type="SECURITY_ALERT",
            tenant_id=str(claim.tenant_id),
            action="invalid_file_upload",
            details={
                "filename": file.filename,
                "error": error_message,
                "claim_id": str(claim_id)
            },
            ip_address=get_client_ip(request),
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File validation failed: {error_message}"
        )
    
    # Sanitize filename to prevent path traversal attacks
    safe_filename = file_validator.get_safe_filename(file.filename or "document")
    
    # Generate unique filename
    file_extension = Path(safe_filename).suffix
    unique_filename = f"{uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file locally first (needed for OCR processing)
    try:
        with file_path.open("wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Try to upload to GCS
    gcs_uri = None
    gcs_blob_name = None
    storage_type = "local"
    
    try:
        gcs_uri, gcs_blob_name = upload_to_gcs(
            file_path=file_path,
            claim_id=str(claim_id),
            original_filename=file.filename or unique_filename,
            content_type=file.content_type
        )
        if gcs_uri and gcs_blob_name:
            storage_type = "gcs"
            logger.info(f"Document uploaded to GCS: {gcs_uri}")
    except Exception as e:
        logger.warning(f"GCS upload failed, using local storage: {e}")
    
    # Create document record
    document = Document(
        id=uuid4(),
        tenant_id=claim.tenant_id,
        claim_id=claim_id,
        document_type="INVOICE",  # Default type
        filename=file.filename or unique_filename,
        storage_path=str(file_path),
        file_size=file_path.stat().st_size,
        file_type=file_extension.lstrip('.').upper(),
        content_type=file.content_type or "application/octet-stream",
        gcs_uri=gcs_uri,
        gcs_blob_name=gcs_blob_name,
        storage_type=storage_type,
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return document


@router.get("/{document_id}/view")
async def view_document(
    document_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Get a viewable URL for a document.
    For GCS documents, returns a signed URL redirect.
    For local documents, serves the file directly.
    """
    query = db.query(Document).filter(Document.id == document_id)
    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)
    document = query.first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # If document is in GCS, generate signed URL and redirect
    if document.storage_type == "gcs" and document.gcs_blob_name:
        signed_url = get_signed_url(document.gcs_blob_name, expiration_minutes=60)
        if signed_url:
            return RedirectResponse(url=signed_url, status_code=302)
        else:
            logger.warning(f"Failed to get signed URL for {document.gcs_blob_name}, falling back to local")
    
    # Fallback to local file
    if document.storage_path:
        file_path = Path(document.storage_path)
        if file_path.exists():
            return FileResponse(
                path=str(file_path),
                filename=document.filename,
                media_type=document.content_type or "application/octet-stream"
            )
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Document file not found"
    )


@router.get("/{document_id}/signed-url")
async def get_document_signed_url(
    document_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Get a signed URL for a document (returns JSON instead of redirect).
    Useful for frontend apps that need to fetch the URL directly.
    """
    query = db.query(Document).filter(Document.id == document_id)
    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)
    document = query.first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # If document is in GCS, generate signed URL
    if document.storage_type == "gcs" and document.gcs_blob_name:
        signed_url = get_signed_url(document.gcs_blob_name, expiration_minutes=60)
        if signed_url:
            return {
                "url": signed_url,
                "expires_in_minutes": 60,
                "content_type": document.content_type,
                "filename": document.filename
            }
    
    # For local files, return the view endpoint URL
    return {
        "url": f"/api/v1/documents/{document_id}/view",
        "expires_in_minutes": None,
        "content_type": document.content_type,
        "filename": document.filename
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Download a document file.
    For GCS documents, returns a signed URL redirect.
    For local documents, serves the file with download headers.
    """
    query = db.query(Document).filter(Document.id == document_id)
    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)
    document = query.first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # If document is in GCS, generate signed URL and redirect
    if document.storage_type == "gcs" and document.gcs_blob_name:
        signed_url = get_signed_url(document.gcs_blob_name, expiration_minutes=60)
        if signed_url:
            return RedirectResponse(url=signed_url, status_code=302)
        else:
            logger.warning(f"Failed to get signed URL for {document.gcs_blob_name}, falling back to local")
    
    # Fallback to local file
    if document.storage_path:
        file_path = Path(document.storage_path)
        if file_path.exists():
            return FileResponse(
                path=str(file_path),
                filename=document.filename,
                media_type=document.content_type or "application/octet-stream",
                headers={
                    "Content-Disposition": f'attachment; filename="{document.filename}"'
                }
            )
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Document file not found"
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Delete a document"""
    query = db.query(Document).filter(Document.id == document_id)
    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)
    document = query.first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete from GCS if applicable
    if document.storage_type == "gcs" and document.gcs_blob_name:
        try:
            delete_from_gcs(document.gcs_blob_name)
        except Exception as e:
            logger.warning(f"Failed to delete from GCS: {e}")
    
    # Delete local file
    if document.storage_path:
        file_path = Path(document.storage_path)
        if file_path.exists():
            file_path.unlink()
    
    # Delete database record
    db.delete(document)
    db.commit()
    
    return None


def convert_pdf_to_images(pdf_path: Path) -> List[Path]:
    """Convert PDF pages to images for OCR processing"""
    image_paths = []
    
    try:
        # Try using pdf2image (requires poppler)
        from pdf2image import convert_from_path
        
        images = convert_from_path(str(pdf_path), dpi=200, first_page=1, last_page=5)
        
        for i, image in enumerate(images):
            image_path = pdf_path.parent / f"{pdf_path.stem}_page_{i+1}.png"
            image.save(str(image_path), 'PNG')
            image_paths.append(image_path)
            
        logger.info(f"Converted PDF to {len(image_paths)} images using pdf2image")
        return image_paths
        
    except ImportError:
        logger.warning("pdf2image not available, trying PyMuPDF")
    except Exception as e:
        logger.warning(f"pdf2image failed: {e}, trying PyMuPDF")
    
    try:
        # Fallback to PyMuPDF (fitz)
        import fitz  # PyMuPDF
        
        doc = fitz.open(str(pdf_path))
        
        for i, page in enumerate(doc):
            if i >= 5:  # Limit to first 5 pages
                break
            
            # Render page to image with higher resolution
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=mat)
            
            image_path = pdf_path.parent / f"{pdf_path.stem}_page_{i+1}.png"
            pix.save(str(image_path))
            image_paths.append(image_path)
        
        doc.close()
        logger.info(f"Converted PDF to {len(image_paths)} images using PyMuPDF")
        return image_paths
        
    except ImportError:
        logger.warning("PyMuPDF not available")
    except Exception as e:
        logger.error(f"PyMuPDF failed: {e}")
    
    return image_paths


def extract_text_from_pdf_directly(pdf_path: Path) -> Dict[str, Any]:
    """Extract text directly from PDF using PyMuPDF without OCR"""
    text_lines = []
    pages_processed = 0
    
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(str(pdf_path))
        
        for i, page in enumerate(doc):
            if i >= 20:  # Limit to first 20 pages (increased from 5)
                break
            
            # Extract text directly from PDF
            text = page.get_text()
            page_lines = [line.strip() for line in text.split('\n') if line.strip()]
            text_lines.extend(page_lines)
            pages_processed += 1
        
        doc.close()
        logger.info(f"Extracted {len(text_lines)} lines from {pages_processed} pages directly from PDF using PyMuPDF")
        
        return {
            "text": "\n".join(text_lines),
            "lines": text_lines,
            "confidence": 0.95,  # Direct text extraction is usually very accurate
            "method": "pymupdf_text"
        }
        
    except Exception as e:
        logger.error(f"PyMuPDF text extraction failed: {e}")
        return {
            "text": "",
            "lines": [],
            "confidence": 0.0,
            "method": "none",
            "error": str(e)
        }


def run_ocr_on_image(image_path: Path) -> Dict[str, Any]:
    """Run OCR on a single image and return extracted text.
    Uses Tesseract first (fast ~1s). Vision AI fallback is handled separately.
    """
    text_lines = []
    confidence_scores = []
    method = "none"
    
    # Try Tesseract (fastest - ~1s per page)
    try:
        import pytesseract
        from PIL import Image
        
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        text_lines = [line for line in text.split('\n') if line.strip()]
        
        if text_lines:
            # Get confidence scores from Tesseract
            try:
                data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
                confidences = [int(c)/100.0 for c in data['conf'] if int(c) > 0]
                confidence_scores = confidences if confidences else [0.75] * len(text_lines)
            except:
                confidence_scores = [0.75] * len(text_lines)
            
            method = "tesseract"
            logger.info(f"Tesseract extracted {len(text_lines)} lines from {image_path.name}")
        
    except Exception as e:
        logger.warning(f"Tesseract OCR failed on {image_path.name}: {e}")
    
    avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
    
    return {
        "text": "\n".join(text_lines),
        "lines": text_lines,
        "confidence": avg_confidence,
        "confidence_scores": confidence_scores,
        "method": method
    }


async def extract_text_with_llm_vision(file_path: Path) -> Dict[str, Any]:
    """
    Use Gemini's vision capabilities to perform OCR on an image.
    This is used as a fallback when traditional OCR confidence is low.
    """
    try:
        import google.generativeai as genai
        from PIL import Image
        import io
        
        # Configure Gemini
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        
        # Determine MIME type
        suffix = file_path.suffix.lower()
        
        # Load and prepare the image using PIL for better compatibility
        try:
            img = Image.open(file_path)
            # Convert to RGB if necessary (handles RGBA, P mode, etc.)
            if img.mode in ('RGBA', 'P', 'LA'):
                img = img.convert('RGB')
            
            # Save to bytes buffer as JPEG for consistent handling
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=95)
            buffer.seek(0)
            image_data = buffer.read()
            mime_type = 'image/jpeg'
            
            logger.info(f"Prepared image for LLM Vision: {file_path.name}, size={len(image_data)} bytes")
        except Exception as img_err:
            logger.warning(f"PIL image processing failed: {img_err}, trying raw file")
            # Fallback to raw file
            with open(file_path, 'rb') as f:
                image_data = f.read()
            mime_types = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.tiff': 'image/tiff',
            }
            mime_type = mime_types.get(suffix, 'image/jpeg')
        
        # Create the prompt for OCR
        prompt = """Extract ALL text from this receipt/invoice image exactly as it appears.

Include:
- Restaurant/vendor name
- Date and time
- All item names and prices
- Subtotal, tax, total amounts
- Invoice/bill numbers
- Any addresses or contact information
- Payment method details

Output the extracted text directly, preserving the layout."""

        # Call Gemini with vision using inline data
        import base64
        
        response = model.generate_content(
            [
                prompt,
                {
                    "mime_type": mime_type,
                    "data": base64.b64encode(image_data).decode('utf-8')
                }
            ],
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=4096,
            )
        )
        
        # Check if response has valid content
        if not response.candidates:
            logger.warning("LLM Vision returned no candidates - image may have been blocked")
            # Try with safety settings relaxed
            response = model.generate_content(
                [
                    prompt,
                    {
                        "mime_type": mime_type,
                        "data": base64.b64encode(image_data).decode('utf-8')
                    }
                ],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=4096,
                ),
                safety_settings={
                    "HARM_CATEGORY_HARASSMENT": "BLOCK_NONE",
                    "HARM_CATEGORY_HATE_SPEECH": "BLOCK_NONE",
                    "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_NONE",
                    "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_NONE",
                }
            )
        
        if not response.candidates:
            raise ValueError("LLM returned empty response even with relaxed safety settings")
        
        extracted_text = response.text.strip()
        text_lines = [line for line in extracted_text.split('\n') if line.strip()]
        
        logger.info(f"LLM Vision OCR extracted {len(text_lines)} lines from {file_path.name}")
        
        return {
            "text": extracted_text,
            "lines": text_lines,
            "confidence": 0.95,  # LLM vision typically has high accuracy
            "confidence_scores": [0.95] * len(text_lines),
            "method": "llm_vision"
        }
        
    except ImportError:
        logger.warning("google-generativeai not installed, LLM vision OCR unavailable")
        return {
            "text": "",
            "lines": [],
            "confidence": 0.0,
            "confidence_scores": [],
            "method": "none",
            "error": "google-generativeai not installed"
        }
    except Exception as e:
        logger.error(f"LLM Vision OCR failed: {e}")
        return {
            "text": "",
            "lines": [],
            "confidence": 0.0,
            "confidence_scores": [],
            "method": "none",
            "error": str(e)
        }


async def run_ocr_with_llm_fallback(image_path: Path) -> Dict[str, Any]:
    """
    Run OCR on an image with Gemini Vision AI fallback for low confidence results.
    
    Flow:
    1. Try Tesseract OCR first (fast, ~1s per image)
    2. If confidence < OCR_LLM_FALLBACK_THRESHOLD, use Gemini Vision AI for OCR
    
    Vision AI provides superior accuracy for complex documents, receipts, and
    images with challenging layouts or fonts.
    """
    # First, try traditional OCR (Tesseract)
    ocr_result = run_ocr_on_image(image_path)
    
    ocr_confidence = ocr_result.get("confidence", 0.0)
    ocr_method = ocr_result.get("method", "none")
    
    logger.info(f"Tesseract OCR result: method={ocr_method}, confidence={ocr_confidence:.2f}, lines={len(ocr_result.get('lines', []))}")
    
    # Check if we should fall back to Vision AI
    llm_threshold = settings.OCR_LLM_FALLBACK_THRESHOLD
    use_llm_fallback = settings.OCR_USE_LLM_FALLBACK
    
    if use_llm_fallback and ocr_confidence < llm_threshold:
        logger.info(f"OCR confidence ({ocr_confidence:.2f}) below threshold ({llm_threshold}), using Gemini Vision AI...")
        
        llm_result = await extract_text_with_llm_vision(image_path)
        
        if llm_result.get("lines") and len(llm_result.get("lines", [])) > 0:
            # Vision AI got results
            logger.info(f"Gemini Vision AI OCR successful: {len(llm_result['lines'])} lines extracted")
            
            # Compare results and use the better one
            traditional_line_count = len(ocr_result.get("lines", []))
            llm_line_count = len(llm_result.get("lines", []))
            
            # Use Vision AI result if:
            # 1. Traditional OCR was very low confidence (< 0.5), OR
            # 2. Vision AI got at least 50% as many lines as traditional OCR
            if ocr_confidence < 0.5 or llm_line_count >= traditional_line_count * 0.5:
                llm_result["original_ocr_confidence"] = ocr_confidence
                llm_result["original_ocr_method"] = ocr_method
                llm_result["used_llm_vision_ocr"] = True
                llm_result["llm_fallback_threshold"] = llm_threshold
                return llm_result
            else:
                logger.info(f"Tesseract had more content ({traditional_line_count} vs {llm_line_count} lines), keeping Tesseract result")
    
    ocr_result["used_llm_vision_ocr"] = False
    ocr_result["llm_fallback_threshold"] = llm_threshold
    return ocr_result


async def extract_receipts_with_llm(
    ocr_text: str,
    employee_region: Union[str, List[str]] = "IND",
    use_embedding_validation: bool = True,
    tenant_id: Optional[UUID] = None
) -> List[Dict[str, Any]]:
    """
    Use Gemini LLM to extract structured receipt data from OCR text.
    
    HYBRID APPROACH:
    1. Pass cached category list to LLM (small token overhead)
    2. LLM returns best category match
    3. Validate LLM response against cached categories
    4. Optionally use embedding-based semantic matching for uncertain cases
    5. Default to 'other' if no valid match
    
    Args:
        ocr_text: The OCR-extracted text from the document
        employee_region: Employee's region(s) for loading applicable categories.
                        Can be string or List[str]
        use_embedding_validation: If True, use semantic embeddings for validation
        tenant_id: Tenant UUID for multi-tenant category filtering
        
    Returns:
        List of receipt dictionaries with validated categories
    """
    if not ocr_text or len(ocr_text.strip()) < 20:
        logger.warning("OCR text too short for LLM extraction")
        return []
    
    # Normalize region to handle array-like strings from frontend - returns List[str]
    regions = normalize_region(employee_region)
    
    try:
        import google.generativeai as genai
        from services.category_cache import get_category_cache
        
        # Configure Gemini
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        
        # Get cached category list for all employee's regions
        # This is cached for 24 hours to minimize DB queries
        category_cache = get_category_cache()
        categories_prompt = category_cache.get_llm_prompt_categories(regions, tenant_id)
        
        # Pre-detect document type to provide hint to LLM
        text_lower = ocr_text.lower()
        document_hint = ""
        
        # Detect ride-sharing patterns
        # Indian vehicle registration: 2 letters + 2 digits + 2 letters + 4 digits (e.g., UP16CD2491)
        vehicle_pattern = r'\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b'
        vehicle_matches = re.findall(vehicle_pattern, ocr_text, re.IGNORECASE)
        
        # Check for ride indicators
        has_vehicle_numbers = len(vehicle_matches) >= 2
        has_location_addresses = any(kw in text_lower for kw in ['sector', 'block', 'road', 'noida', 'delhi', 'bengaluru', 'mumbai', 'hyderabad', 'pune', 'chennai', 'kolkata'])
        has_transaction_ids = bool(re.search(r'\d{15,20}', ocr_text))
        has_ride_keywords = any(kw in text_lower for kw in ['rapido', 'ola', 'uber', 'ride', 'trip', 'fare', 'cab', 'taxi', 'bike'])
        
        # If strong ride indicators, add hint
        if (has_vehicle_numbers and has_location_addresses) or has_ride_keywords:
            document_hint = """
DOCUMENT TYPE HINT: This appears to be a RIDE-SHARING/TAXI receipt batch export.
- Multiple vehicle registration numbers detected (format: XX00XX0000)
- Location addresses indicate pickup/drop points
- Treat this as TRAVEL category with vendor "Rapido" or "Ride Service"
- Each transaction ID + amount + date block is a SEPARATE receipt

"""
            logger.info(f"Pre-detected ride-sharing document: vehicles={len(vehicle_matches)}, locations={has_location_addresses}")
        
        # Create the prompt for receipt extraction with region-specific categories
        prompt = f"""You are an expert at extracting receipt/invoice information from OCR text.
Analyze the following OCR-extracted text and identify ALL receipts/invoices present.

{document_hint}{categories_prompt}

For EACH receipt found, extract:
1. amount: The total/final amount paid (number only, no currency symbol)
2. date: The transaction date in YYYY-MM-DD format
3. vendor: The merchant/vendor/company name
4. category: Use ONLY the category codes listed above. If no match, use 'other'
5. description: A brief description of what was purchased/service provided
6. currency: The currency code (INR, USD, etc.) - default to INR if Indian context
7. transaction_ref: The unique transaction/invoice/order ID (e.g., CRN9814090954, INV-2025-001, PNR123456)

RIDE-SHARING / TAXI RECEIPT DETECTION (CRITICAL):
- If you see patterns like: transaction ID + amount + date + vehicle number + driver name + pickup location + drop location, this is a RIDE/TAXI receipt
- Indian vehicle registration formats: XX00XX0000 (e.g., UP16CD2491, KA51AC1234, DL4CAB1234) indicate rides
- Ride-sharing services include: Rapido, Ola, Uber, Meru, BluSmart - even if the company name is NOT visible in text
- If text shows two addresses/locations (pickup and drop points), it's likely a ride receipt
- Location names like "Mithaas", "Film City", "Sector X" are pickup/drop LOCATIONS, NOT vendors
- For ride receipts: vendor should be "Rapido"/"Ola"/"Uber" or "Ride Service" if unknown, category should be "travel"
- Description should be like "Ride from [pickup] to [drop]" or "Cab/Bike ride"

IMPORTANT:
- A single invoice may contain multiple line items, but it's still ONE receipt. Don't split line items into separate receipts.
- Look for clear indicators of separate receipts like different invoice numbers, different dates, or different vendors.
- For the amount, use the FINAL/TOTAL amount, not subtotals or line items.
- If the date format is DD/MM/YYYY, convert it properly (11/09/2025 means September 11, 2025, not November 9).
- For transaction_ref, look for: Invoice ID, CRN (Customer Ride Number), Order ID, Booking ID, PNR, Receipt Number, long numeric IDs (15+ digits).
- CRITICAL: If the expense category doesn't match any of the listed categories, you MUST use 'other'
- CRITICAL: Do NOT confuse location/landmark names (like restaurants, shops at pickup/drop points) with the actual vendor

OCR Text:
```
{ocr_text[:4000]}
```

Respond ONLY with a valid JSON array. Example format:
[
  {{
    "amount": "450",
    "date": "2025-11-17",
    "vendor": "Rapido",
    "category": "travel",
    "description": "Bike ride from Film City Noida to Sector 76",
    "currency": "INR",
    "transaction_ref": "17539588439959322"
  }},
  {{
    "amount": "727",
    "date": "2025-09-11",
    "vendor": "Ola",
    "category": "travel",
    "description": "Cab ride to Kempegowda Airport",
    "currency": "INR",
    "transaction_ref": "CRN9814090954"
  }}
]

If no valid receipts can be identified, return an empty array: []
"""

        # Call Gemini
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,  # Low temperature for more deterministic output
                max_output_tokens=2048,
            )
        )
        
        response_text = response.text.strip()
        logger.info(f"LLM response: {response_text[:500]}")
        
        # Parse JSON from response
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            receipts = json.loads(json_match.group())
            logger.info(f"LLM extracted {len(receipts)} receipts")
            
            # Initialize embedding service for semantic validation (if enabled)
            embedding_service = None
            if use_embedding_validation:
                try:
                    from services.embedding_service import get_embedding_service
                    embedding_service = get_embedding_service()
                except Exception as e:
                    logger.warning(f"Embedding service unavailable: {e}")
            
            # Validate and normalize categories
            for receipt in receipts:
                llm_category = receipt.get('category', 'other')
                
                # Step 1: Validate against cached categories (checks all regions)
                validated_cat, is_valid = category_cache.validate_category(
                    llm_category,
                    regions,
                    "REIMBURSEMENT",
                    tenant_id
                )
                
                # Step 2: If LLM returned 'other' or invalid, try embedding-based matching
                if (not is_valid or llm_category == 'other') and embedding_service:
                    try:
                        # Build search text from receipt data
                        search_text = " ".join(filter(None, [
                            receipt.get('vendor', ''),
                            receipt.get('description', ''),
                            llm_category if llm_category != 'other' else ''
                        ]))
                        
                        if search_text.strip():
                            # Get best embedding match (checks all regions)
                            emb_category, emb_score, emb_valid = await embedding_service.get_best_category_match(
                                search_text,
                                regions,
                                "REIMBURSEMENT",
                                tenant_id=tenant_id
                            )
                            
                            # Lower threshold to 0.55 for better matching
                            if emb_valid and emb_score > 0.55:
                                logger.info(
                                    f"Embedding matched '{search_text}' to '{emb_category}' "
                                    f"(score: {emb_score:.2f})"
                                )
                                validated_cat = emb_category
                                is_valid = True
                                receipt['embedding_matched'] = True
                                receipt['embedding_score'] = emb_score
                    except Exception as e:
                        logger.warning(f"Embedding matching failed: {e}")
                
                # Step 3: Apply final validation result
                if not is_valid:
                    regions_str = ', '.join(regions) if isinstance(regions, list) else regions
                    logger.info(
                        f"Category '{llm_category}' not validated for region(s) "
                        f"'{regions_str}' - setting to 'other'"
                    )
                    validated_cat = 'other'
                
                receipt['category'] = validated_cat
                receipt['category_validated'] = is_valid
                receipt['llm_category'] = llm_category  # Keep original for debugging
            
            return receipts
        else:
            logger.warning("No JSON array found in LLM response")
            return []
            
    except ImportError:
        logger.warning("google-generativeai not installed, skipping LLM extraction")
        return []
    except Exception as e:
        logger.error(f"LLM receipt extraction failed: {e}")
        return []


def extract_receipts_with_regex(ocr_text: str) -> List[Dict[str, Any]]:
    """
    Fallback: Extract receipt data using regex patterns when LLM is unavailable.
    Handles both single receipts and multi-receipt documents (like batch ride exports).
    """
    if not ocr_text or len(ocr_text.strip()) < 20:
        return []
    
    receipts = []
    text_lower = ocr_text.lower()
    
    try:
        # Known vendors and their categories
        known_vendors = {
            'ola': ('Ola', 'travel'),
            'uber': ('Uber', 'travel'),
            'rapido': ('Rapido', 'travel'),
            'swiggy': ('Swiggy', 'food'),
            'zomato': ('Zomato', 'food'),
            'makemytrip': ('MakeMyTrip', 'travel'),
            'irctc': ('IRCTC', 'travel'),
            'indigo': ('IndiGo', 'travel'),
            'air india': ('Air India', 'travel'),
            'spicejet': ('SpiceJet', 'travel'),
            'vistara': ('Vistara', 'travel'),
            'oyo': ('OYO', 'accommodation'),
            'airbnb': ('Airbnb', 'accommodation'),
        }
        
        # Detect global vendor from text
        global_vendor = ''
        global_category = 'other'
        
        for key, (name, cat) in known_vendors.items():
            if key in text_lower:
                global_vendor = name
                global_category = cat
                break
        
        # If no known vendor, try category detection
        if not global_vendor:
            if any(kw in text_lower for kw in ['travel', 'flight', 'train', 'cab', 'taxi', 'airport', 'fare', 'trip', 'ride', 'sector', 'noida', 'delhi', 'bengaluru']):
                global_category = 'travel'
            elif any(kw in text_lower for kw in ['food', 'meal', 'restaurant', 'cafe', 'lunch', 'dinner']):
                # Check if it's a team lunch (multiple people mentioned)
                if any(kw in text_lower for kw in ['persons', 'people', 'pax', 'guests', 'covers', 'heads', 'members', 'team', 'group']):
                    global_category = 'team_lunch'
                # Check for number patterns indicating multiple people (e.g., "4 persons", "no. of persons: 5")
                elif re.search(r'\b(\d+)\s*(?:persons?|people|pax|guests?|covers?|heads?|members?)\b', text_lower):
                    global_category = 'team_lunch'
                # Check for "no. of persons" or similar
                elif re.search(r'(?:no\.?\s*of|number\s*of)\s*(?:persons?|people|guests?|pax)\s*[:\s]*\d+', text_lower):
                    global_category = 'team_lunch'
                else:
                    global_category = 'food'
            elif any(kw in text_lower for kw in ['hotel', 'stay', 'room', 'accommodation', 'lodging']):
                global_category = 'accommodation'
            elif any(kw in text_lower for kw in ['certificate', 'exam', 'course', 'training']):
                global_category = 'certification'
        
        # ========== MULTI-RECEIPT DETECTION ==========
        # Pattern for batch ride exports: transaction_id + amount + date pattern
        # Example: "17539588439959322\n450.00\nNov 17th 2025, 09:32 AM"
        
        # Find all transaction IDs (15-20 digit numbers at start of line or after newline)
        transaction_ids = re.findall(r'(?:^|\n)(\d{15,20})\b', ocr_text)
        
        # Find all amounts in format xxx.00 or xxxx.00
        amounts = re.findall(r'\b(\d{2,5}\.\d{2})\b', ocr_text)
        
        # Find all dates in format "Nov 17th 2025" or similar
        date_pattern = r'\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4})'
        dates = re.findall(date_pattern, ocr_text, re.IGNORECASE)
        
        logger.info(f"Multi-receipt detection: {len(transaction_ids)} transaction IDs, {len(amounts)} amounts, {len(dates)} dates")
        
        # If we have multiple transaction IDs and amounts, this is likely a batch export
        if len(transaction_ids) >= 2 and len(amounts) >= 2:
            # Parse the document line by line to extract receipt blocks
            lines = ocr_text.strip().split('\n')
            
            current_receipt = {}
            receipt_list = []
            
            month_map = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
            }
            
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                # Check if this line is a transaction ID (15-20 digits)
                if re.match(r'^\d{15,20}$', line):
                    # If we have a previous receipt with data, save it
                    if current_receipt.get('transaction_ref') and current_receipt.get('amount'):
                        receipt_list.append(current_receipt)
                    
                    # Start a new receipt
                    current_receipt = {
                        'transaction_ref': line,
                        'vendor': global_vendor,
                        'category': global_category,
                        'currency': 'INR'
                    }
                
                # Check for amount (xxx.00 format)
                elif re.match(r'^\d{2,5}\.\d{2}$', line) and 'amount' not in current_receipt:
                    current_receipt['amount'] = line.replace('.00', '') if line.endswith('.00') else line
                
                # Check for date
                elif 'date' not in current_receipt:
                    date_match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})', line, re.IGNORECASE)
                    if date_match:
                        month = month_map.get(date_match.group(1).lower()[:3], 1)
                        day = int(date_match.group(2))
                        year = int(date_match.group(3))
                        current_receipt['date'] = f"{year:04d}-{month:02d}-{day:02d}"
                        current_receipt['description'] = f"Ride on {date_match.group(0)}"
                
                i += 1
            
            # Don't forget the last receipt
            if current_receipt.get('transaction_ref') and current_receipt.get('amount'):
                receipt_list.append(current_receipt)
            
            logger.info(f"Extracted {len(receipt_list)} receipts from batch document")
            
            if receipt_list:
                return receipt_list
        
        # ========== SINGLE RECEIPT EXTRACTION ==========
        # If not a batch document, try single receipt extraction
        
        # Extract amount - look for total/final amounts
        amount = None
        amount_patterns = [
            r'(?:total\s*bill|total\s*amount|total\s*fare|paid\s*by\s*cash|total)[:\s]*[₹%=rR]?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)',
            r'(?:₹|%|rs\.?|inr)[:\s]*(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)',
            r'[=]\s*(\d{3,6})\b',
        ]
        
        for pattern in amount_patterns:
            match = re.search(pattern, ocr_text, re.IGNORECASE)
            if match:
                amount = match.group(1).replace(',', '')
                # Validate amount is reasonable
                try:
                    amt_val = float(amount)
                    if 10 <= amt_val <= 100000:
                        break
                    amount = None
                except:
                    amount = None
        
        # Extract date
        date = None
        date_patterns = [
            # Invoice Date DD/MM/YYYY
            (r'invoice\s*date[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})', 'dmy'),
            # DD Mon YYYY or DD Mon, YYYY
            (r'\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,\s]+(\d{4})\b', 'dmy_month'),
            # Mon DD YYYY
            (r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})\b', 'mdy_month'),
            # DD/MM/YYYY
            (r'\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b', 'dmy'),
        ]
        
        month_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        
        for pattern, fmt in date_patterns:
            match = re.search(pattern, ocr_text, re.IGNORECASE)
            if match:
                try:
                    if fmt == 'dmy':
                        day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    elif fmt == 'dmy_month':
                        day = int(match.group(1))
                        month = month_map.get(match.group(2).lower()[:3], 1)
                        year = int(match.group(3))
                    elif fmt == 'mdy_month':
                        month = month_map.get(match.group(1).lower()[:3], 1)
                        day = int(match.group(2))
                        year = int(match.group(3))
                    
                    date = f"{year:04d}-{month:02d}-{day:02d}"
                    break
                except:
                    pass
        
        # Build description
        description = ''
        if 'airport' in text_lower:
            description = 'Trip to Airport'
        elif 'ride' in text_lower or 'cab' in text_lower:
            description = 'Cab ride'
        elif 'flight' in text_lower:
            description = 'Flight booking'
        elif 'train' in text_lower:
            description = 'Train booking'
        
        # Extract transaction reference ID (invoice number, ride ID, order ID, etc.)
        transaction_ref = None
        ref_patterns = [
            # CRN (Customer Ride Number) for Ola/Uber
            r'\b(?:crn|ride\s*(?:id|no|number)?)[:\s#]*([A-Z0-9]{8,20})\b',
            # Invoice ID/Number
            r'\b(?:invoice\s*(?:id|no|number)?)[:\s#]*([A-Z0-9]{6,25})\b',
            # Order ID
            r'\b(?:order\s*(?:id|no|number)?)[:\s#]*([A-Z0-9\-]{6,25})\b',
            # Transaction ID
            r'\b(?:transaction\s*(?:id|ref|no|number)?)[:\s#]*([A-Z0-9\-]{6,25})\b',
            # Booking ID
            r'\b(?:booking\s*(?:id|ref|no|number)?)[:\s#]*([A-Z0-9\-]{6,25})\b',
            # PNR for trains/flights
            r'\b(?:pnr)[:\s#]*([A-Z0-9]{6,10})\b',
            # Receipt number
            r'\b(?:receipt\s*(?:id|no|number)?)[:\s#]*([A-Z0-9\-]{6,20})\b',
            # Bill number
            r'\b(?:bill\s*(?:id|no|number)?)[:\s#]*([A-Z0-9\-]{6,20})\b',
            # Generic alphanumeric ID patterns (like CRN9814090954)
            r'\b([A-Z]{2,4}[0-9]{8,15})\b',
        ]
        
        for pattern in ref_patterns:
            match = re.search(pattern, ocr_text, re.IGNORECASE)
            if match:
                transaction_ref = match.group(1).upper()
                logger.info(f"Extracted transaction ref: {transaction_ref} using pattern: {pattern}")
                break
        
        # Only return a receipt if we found at least an amount
        if amount:
            receipts.append({
                'amount': amount,
                'date': date,
                'vendor': vendor,
                'category': category,
                'description': description,
                'currency': 'INR',
                'transaction_ref': transaction_ref
            })
            logger.info(f"Regex extracted receipt: amount={amount}, vendor={vendor}, date={date}, ref={transaction_ref}")
        
    except Exception as e:
        logger.error(f"Regex receipt extraction failed: {e}")
    
    return receipts


@router.post("/ocr", response_model=Dict[str, Any])
async def extract_text_ocr(
    file: UploadFile = File(...),
    employee_region: str = "IND",
    tenant_id: Optional[UUID] = None
):
    """
    Extract text from image or PDF using OCR.
    Supports JPEG, PNG, GIF, WebP, TIFF and PDF formats.
    For PDFs, pages are converted to images first.
    
    Args:
        file: The document file to process
        employee_region: Employee's region for loading applicable expense categories.
                        Can be a single region string or comma-separated list.
                        Categories are cached by region for 24 hours to optimize costs.
        tenant_id: Tenant UUID for multi-tenant category filtering.
    """
    # Normalize region to handle array-like strings from frontend - returns List[str]
    regions = normalize_region(employee_region)
    
    # Validate file type - now includes PDF
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'application/pdf']
    
    # Check content type
    content_type = file.content_type or ''
    filename = file.filename or 'document'
    
    # Also check by extension if content_type is not reliable
    is_pdf = content_type == 'application/pdf' or filename.lower().endswith('.pdf')
    is_image = content_type.startswith('image/') or any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff'])
    
    if not is_pdf and not is_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed: images (JPEG, PNG, GIF, WebP, TIFF) and PDF"
        )
    
    # Save temp file
    file_extension = Path(filename).suffix or ('.pdf' if is_pdf else '.png')
    temp_filename = f"temp_ocr_{uuid4()}{file_extension}"
    temp_path = UPLOAD_DIR / temp_filename
    temp_image_paths = []  # Track generated images for cleanup
    
    try:
        with temp_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Processing file: {filename}, is_pdf: {is_pdf}, is_image: {is_image}")
        
        all_text_lines = []
        all_confidence_scores = []
        method = "none"
        
        if is_pdf:
            # FIRST: Try direct text extraction from PDF (works for text-based PDFs)
            logger.info(f"Trying direct text extraction from PDF: {temp_path}")
            direct_result = extract_text_from_pdf_directly(temp_path)
            
            if direct_result.get("lines") and len(direct_result.get("lines", [])) > 5:
                # Direct extraction worked - use it
                logger.info(f"Direct PDF text extraction successful: {len(direct_result['lines'])} lines")
                full_text = direct_result["text"]
                
                # Extract receipts using LLM with region-specific categories, fallback to regex
                receipts = await extract_receipts_with_llm(full_text, region, tenant_id=tenant_id)
                if not receipts:
                    logger.info("LLM extraction failed or returned empty, trying regex extraction")
                    receipts = extract_receipts_with_regex(full_text)
                
                logger.info(f"Extracted {len(receipts)} receipts from PDF text")
                
                return {
                    "text": direct_result["text"],
                    "lines": direct_result["lines"],
                    "confidence": direct_result["confidence"],
                    "method": direct_result["method"],
                    "pages_processed": 1,
                    "receipts": receipts,
                    "receipt_count": len(receipts)
                }
            
            # If direct extraction didn't get much text, try OCR on images
            logger.info(f"Direct extraction got only {len(direct_result.get('lines', []))} lines, trying OCR on images...")
            
            # Convert PDF to images for OCR
            logger.info(f"Converting PDF to images: {temp_path}")
            temp_image_paths = convert_pdf_to_images(temp_path)
            
            if not temp_image_paths:
                # If image conversion failed but direct extraction got some text, return that
                if direct_result.get("lines"):
                    full_text = direct_result["text"]
                    # Try LLM with region-specific categories, then fallback to regex
                    receipts = await extract_receipts_with_llm(full_text, region, tenant_id=tenant_id)
                    if not receipts:
                        receipts = extract_receipts_with_regex(full_text)
                    return {
                        "text": full_text,
                        "lines": direct_result["lines"],
                        "confidence": direct_result["confidence"],
                        "method": direct_result["method"],
                        "pages_processed": 1,
                        "receipts": receipts,
                        "receipt_count": len(receipts)
                    }
                
                logger.error("Failed to convert PDF to images and no direct text extracted")
                return {
                    "text": "",
                    "lines": [],
                    "confidence": 0.0,
                    "method": "none",
                    "error": "Failed to extract text from PDF. The PDF may be image-based and OCR engines are not available.",
                    "receipts": [],
                    "receipt_count": 0
                }
            
            # Run OCR on each page image with LLM fallback for low confidence
            for image_path in temp_image_paths:
                result = await run_ocr_with_llm_fallback(image_path)
                all_text_lines.extend(result.get("lines", []))
                if result.get("confidence", 0) > 0:
                    all_confidence_scores.append(result["confidence"])
                if result.get("method") != "none":
                    method = result["method"]
            
            # If OCR didn't get text but direct extraction did, use direct extraction
            if not all_text_lines and direct_result.get("lines"):
                full_text = direct_result["text"]
                # Try LLM with region-specific categories, then fallback to regex
                receipts = await extract_receipts_with_llm(full_text, regions, tenant_id=tenant_id)
                if not receipts:
                    receipts = extract_receipts_with_regex(full_text)
                return {
                    "text": full_text,
                    "lines": direct_result["lines"],
                    "confidence": direct_result["confidence"],
                    "method": direct_result["method"],
                    "pages_processed": 1,
                    "receipts": receipts,
                    "receipt_count": len(receipts)
                }
        else:
            # Direct OCR on image with LLM fallback for low confidence
            result = await run_ocr_with_llm_fallback(temp_path)
            all_text_lines = result.get("lines", [])
            all_confidence_scores = [result.get("confidence", 0)] if result.get("confidence", 0) > 0 else []
            method = result.get("method", "none")
        
        avg_confidence = sum(all_confidence_scores) / len(all_confidence_scores) if all_confidence_scores else 0.0
        full_text = "\n".join(all_text_lines)
        
        # Check if LLM vision was used
        used_llm_vision = method == "llm_vision"
        
        logger.info(f"OCR completed. Method: {method}, Lines: {len(all_text_lines)}, Confidence: {avg_confidence:.2f}, LLM Vision: {used_llm_vision}")
        
        # Try LLM with region-specific categories first, then fallback to regex extraction
        receipts = await extract_receipts_with_llm(full_text, regions, tenant_id=tenant_id)
        if not receipts:
            logger.info("LLM extraction returned empty, using regex fallback")
            receipts = extract_receipts_with_regex(full_text)
        
        return {
            "text": full_text,
            "lines": all_text_lines,
            "confidence": avg_confidence,
            "method": method,
            "used_llm_vision_ocr": used_llm_vision,
            "llm_fallback_threshold": settings.OCR_LLM_FALLBACK_THRESHOLD,
            "pages_processed": len(temp_image_paths) if is_pdf else 1,
            "receipts": receipts,
            "receipt_count": len(receipts)
        }
        
    except Exception as e:
        logger.error(f"OCR processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )
    finally:
        # Clean up temp files
        if temp_path.exists():
            temp_path.unlink()
        # Clean up any generated image files from PDF conversion
        for img_path in temp_image_paths:
            if img_path.exists():
                img_path.unlink()
