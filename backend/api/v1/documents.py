"""
Document management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID, uuid4
import os
import shutil
from pathlib import Path

from database import get_sync_db
from models import Document, Claim
from schemas import DocumentResponse
from config import settings

router = APIRouter()

# Ensure upload directory exists
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    claim_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get list of documents with optional claim filter"""
    query = db.query(Document)
    
    if claim_id:
        query = query.filter(Document.claim_id == claim_id)
    
    documents = query.offset(skip).limit(limit).all()
    return documents


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get document by ID"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.post("/upload/{claim_id}", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    claim_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_sync_db)
):
    """Upload a document for a claim"""
    # Check if claim exists
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found"
        )
    
    # Generate unique filename
    file_extension = Path(file.filename or "document").suffix
    unique_filename = f"{uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Create document record
    document = Document(
        id=uuid4(),
        tenant_id=claim.tenant_id,
        claim_id=claim_id,
        document_type="INVOICE",  # Default type
        file_name=file.filename or unique_filename,
        file_path=str(file_path),
        file_size=file_path.stat().st_size,
        mime_type=file.content_type or "application/octet-stream",
        upload_status="UPLOADED"
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Delete a document"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete physical file
    if document.file_path:
        file_path = Path(document.file_path)
        if file_path.exists():
            file_path.unlink()
    
    # Delete database record
    db.delete(document)
    db.commit()
    
    return None
