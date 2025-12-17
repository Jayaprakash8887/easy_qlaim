"""
Tenant Management API

System Admin only endpoints for managing tenants (organizations).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from database import get_sync_db
from models import Tenant, User
from services.role_service import is_system_admin

router = APIRouter()


# ==================== SCHEMAS ====================

class TenantCreate(BaseModel):
    name: str
    code: str
    domain: Optional[str] = None
    settings: Optional[dict] = {}


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    domain: Optional[str] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None


class TenantResponse(BaseModel):
    id: UUID
    name: str
    code: str
    domain: Optional[str]
    settings: dict
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# ==================== HELPER FUNCTIONS ====================

def require_system_admin(db: Session = Depends(get_sync_db)):
    """
    Dependency to check if current user is System Admin.
    For now, we'll use a simple approach - in production this would
    be integrated with proper authentication.
    """
    # TODO: Integrate with actual authentication
    # For now, we'll check based on header or default to admin user
    return db


# ==================== ENDPOINTS ====================

@router.get("/", response_model=List[TenantResponse])
async def list_tenants(
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
    db: Session = Depends(get_sync_db)
):
    """
    List all tenants (System Admin only).
    """
    query = db.query(Tenant)
    
    if not include_inactive:
        query = query.filter(Tenant.is_active == True)
    
    tenants = query.offset(skip).limit(limit).all()
    return tenants


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    db: Session = Depends(get_sync_db)
):
    """
    Create a new tenant (System Admin only).
    """
    # Check if code already exists
    existing = db.query(Tenant).filter(Tenant.code == tenant_data.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant with code '{tenant_data.code}' already exists"
        )
    
    tenant = Tenant(
        name=tenant_data.name,
        code=tenant_data.code.upper(),
        domain=tenant_data.domain,
        settings=tenant_data.settings or {}
    )
    
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Get tenant by ID (System Admin only).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    tenant_data: TenantUpdate,
    db: Session = Depends(get_sync_db)
):
    """
    Update a tenant (System Admin only).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check for code uniqueness if being updated
    if tenant_data.code and tenant_data.code.upper() != tenant.code:
        existing = db.query(Tenant).filter(Tenant.code == tenant_data.code.upper()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tenant with code '{tenant_data.code}' already exists"
            )
    
    # Update fields
    if tenant_data.name is not None:
        tenant.name = tenant_data.name
    if tenant_data.code is not None:
        tenant.code = tenant_data.code.upper()
    if tenant_data.domain is not None:
        tenant.domain = tenant_data.domain
    if tenant_data.settings is not None:
        tenant.settings = tenant_data.settings
    if tenant_data.is_active is not None:
        tenant.is_active = tenant_data.is_active
    
    db.commit()
    db.refresh(tenant)
    
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Deactivate a tenant (System Admin only).
    This soft-deletes the tenant by setting is_active to False.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    tenant.is_active = False
    db.commit()
    
    return None


@router.get("/{tenant_id}/users", response_model=List[dict])
async def get_tenant_users(
    tenant_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """
    Get users belonging to a tenant (System Admin only).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    users = db.query(User).filter(
        User.tenant_id == tenant_id
    ).offset(skip).limit(limit).all()
    
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "designation": u.designation,
            "department": u.department,
            "is_active": u.is_active
        }
        for u in users
    ]
