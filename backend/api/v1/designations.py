"""
Designation Management API

Endpoints for managing tenant-specific designations and role mappings.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from database import get_sync_db
from models import Tenant, Designation, DesignationRoleMapping
from services.role_service import get_available_roles

router = APIRouter()


# ==================== SCHEMAS ====================

class DesignationCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    level: Optional[int] = 0


class DesignationUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None
    is_active: Optional[bool] = None


class RoleMappingCreate(BaseModel):
    role: str  # EMPLOYEE, MANAGER, HR, FINANCE, ADMIN


class DesignationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    code: str
    description: Optional[str]
    level: int
    is_active: bool
    roles: List[str] = []  # Populated from role_mappings
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class RoleMappingResponse(BaseModel):
    id: UUID
    designation_id: UUID
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== HELPER FUNCTIONS ====================

def get_tenant_id_from_context(db: Session) -> UUID:
    """
    Get tenant_id from request context.
    For now, using default tenant. In production, this would come from auth.
    """
    # TODO: Get from authentication context
    from config import settings
    return UUID(settings.DEFAULT_TENANT_ID)


def designation_to_response(designation: Designation, db: Session) -> dict:
    """Convert designation model to response with roles."""
    roles = [m.role for m in designation.role_mappings]
    return {
        "id": designation.id,
        "tenant_id": designation.tenant_id,
        "name": designation.name,
        "code": designation.code,
        "description": designation.description,
        "level": designation.level,
        "is_active": designation.is_active,
        "roles": roles,
        "created_at": designation.created_at,
        "updated_at": designation.updated_at
    }


# ==================== UTILITY ENDPOINTS (must be before path params) ====================

@router.get("/available-roles", response_model=List[str])
async def list_available_roles():
    """
    Get list of available application roles for designation mapping.
    Note: SYSTEM_ADMIN is excluded as it's a platform-level role.
    """
    return get_available_roles()


# ==================== DESIGNATION ENDPOINTS ====================

@router.get("/", response_model=List[DesignationResponse])
async def list_designations(
    tenant_id: Optional[UUID] = None,
    include_inactive: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """
    List designations for a tenant.
    If tenant_id not provided, uses default tenant from context.
    """
    if not tenant_id:
        tenant_id = get_tenant_id_from_context(db)
    
    query = db.query(Designation).filter(Designation.tenant_id == tenant_id)
    
    if not include_inactive:
        query = query.filter(Designation.is_active == True)
    
    designations = query.order_by(Designation.level, Designation.name).offset(skip).limit(limit).all()
    
    return [designation_to_response(d, db) for d in designations]


@router.post("/", response_model=DesignationResponse, status_code=status.HTTP_201_CREATED)
async def create_designation(
    designation_data: DesignationCreate,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Create a new designation for a tenant.
    """
    if not tenant_id:
        tenant_id = get_tenant_id_from_context(db)
    
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check if designation name already exists for this tenant
    existing = db.query(Designation).filter(
        and_(
            Designation.tenant_id == tenant_id,
            Designation.name.ilike(designation_data.name)
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Designation '{designation_data.name}' already exists for this tenant"
        )
    
    designation = Designation(
        tenant_id=tenant_id,
        name=designation_data.name,
        code=designation_data.code.upper().replace(" ", "_"),
        description=designation_data.description,
        level=designation_data.level or 0
    )
    
    db.add(designation)
    db.commit()
    db.refresh(designation)
    
    return designation_to_response(designation, db)


@router.get("/{designation_id}", response_model=DesignationResponse)
async def get_designation(
    designation_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Get designation by ID.
    """
    designation = db.query(Designation).filter(Designation.id == designation_id).first()
    if not designation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Designation not found"
        )
    return designation_to_response(designation, db)


@router.put("/{designation_id}", response_model=DesignationResponse)
async def update_designation(
    designation_id: UUID,
    designation_data: DesignationUpdate,
    db: Session = Depends(get_sync_db)
):
    """
    Update a designation.
    """
    designation = db.query(Designation).filter(Designation.id == designation_id).first()
    if not designation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Designation not found"
        )
    
    # Check for name uniqueness if being updated
    if designation_data.name and designation_data.name.lower() != designation.name.lower():
        existing = db.query(Designation).filter(
            and_(
                Designation.tenant_id == designation.tenant_id,
                Designation.name.ilike(designation_data.name),
                Designation.id != designation_id
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Designation '{designation_data.name}' already exists"
            )
    
    # Update fields
    if designation_data.name is not None:
        designation.name = designation_data.name
    if designation_data.code is not None:
        designation.code = designation_data.code.upper().replace(" ", "_")
    if designation_data.description is not None:
        designation.description = designation_data.description
    if designation_data.level is not None:
        designation.level = designation_data.level
    if designation_data.is_active is not None:
        designation.is_active = designation_data.is_active
    
    db.commit()
    db.refresh(designation)
    
    return designation_to_response(designation, db)


@router.delete("/{designation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_designation(
    designation_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Delete a designation (deactivates it).
    """
    designation = db.query(Designation).filter(Designation.id == designation_id).first()
    if not designation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Designation not found"
        )
    
    designation.is_active = False
    db.commit()
    
    return None


# ==================== ROLE MAPPING ENDPOINTS ====================

@router.get("/{designation_id}/roles", response_model=List[RoleMappingResponse])
async def get_designation_roles(
    designation_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Get all role mappings for a designation.
    """
    designation = db.query(Designation).filter(Designation.id == designation_id).first()
    if not designation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Designation not found"
        )
    
    return designation.role_mappings


@router.post("/{designation_id}/roles", response_model=RoleMappingResponse, status_code=status.HTTP_201_CREATED)
async def add_role_to_designation(
    designation_id: UUID,
    role_data: RoleMappingCreate,
    db: Session = Depends(get_sync_db)
):
    """
    Add a role mapping to a designation.
    Note: SYSTEM_ADMIN role cannot be added to designations.
    """
    designation = db.query(Designation).filter(Designation.id == designation_id).first()
    if not designation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Designation not found"
        )
    
    role = role_data.role.upper()
    
    # Validate role
    available_roles = get_available_roles()
    if role not in available_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{role}'. Available roles: {available_roles}"
        )
    
    # Check if SYSTEM_ADMIN is being added (not allowed)
    if role == 'SYSTEM_ADMIN':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SYSTEM_ADMIN role cannot be assigned to designations. It's a platform-level role."
        )
    
    # Check if mapping already exists
    existing = db.query(DesignationRoleMapping).filter(
        and_(
            DesignationRoleMapping.designation_id == designation_id,
            DesignationRoleMapping.role == role
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role}' is already assigned to this designation"
        )
    
    mapping = DesignationRoleMapping(
        tenant_id=designation.tenant_id,
        designation_id=designation_id,
        role=role
    )
    
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    
    return mapping


@router.delete("/{designation_id}/roles/{role}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role_from_designation(
    designation_id: UUID,
    role: str,
    db: Session = Depends(get_sync_db)
):
    """
    Remove a role mapping from a designation.
    """
    mapping = db.query(DesignationRoleMapping).filter(
        and_(
            DesignationRoleMapping.designation_id == designation_id,
            DesignationRoleMapping.role == role.upper()
        )
    ).first()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role mapping not found"
        )
    
    db.delete(mapping)
    db.commit()
    
    return None


@router.put("/{designation_id}/roles", response_model=List[str])
async def set_designation_roles(
    designation_id: UUID,
    roles: List[str],
    db: Session = Depends(get_sync_db)
):
    """
    Set all roles for a designation (replaces existing mappings).
    """
    designation = db.query(Designation).filter(Designation.id == designation_id).first()
    if not designation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Designation not found"
        )
    
    # Validate roles
    available_roles = get_available_roles()
    roles_upper = [r.upper() for r in roles]
    
    for role in roles_upper:
        if role not in available_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{role}'. Available roles: {available_roles}"
            )
        if role == 'SYSTEM_ADMIN':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SYSTEM_ADMIN role cannot be assigned to designations"
            )
    
    # Delete existing mappings
    db.query(DesignationRoleMapping).filter(
        DesignationRoleMapping.designation_id == designation_id
    ).delete()
    
    # Create new mappings
    for role in roles_upper:
        mapping = DesignationRoleMapping(
            tenant_id=designation.tenant_id,
            designation_id=designation_id,
            role=role
        )
        db.add(mapping)
    
    db.commit()
    
    return roles_upper
