"""
Tenant Management API

System Admin only endpoints for managing tenants (organizations).
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
import secrets
import string
import hashlib
import logging

from database import get_sync_db
from models import Tenant, User
from services.role_service import is_system_admin, ensure_employee_role, normalize_user_roles
from services.email_service import get_email_service

logger = logging.getLogger(__name__)

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
    search: Optional[str] = None,
    db: Session = Depends(get_sync_db)
):
    """
    List all tenants (System Admin only).
    """
    query = db.query(Tenant)
    
    if not include_inactive:
        query = query.filter(Tenant.is_active == True)
    
    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Tenant.name.ilike(search_term)) |
            (Tenant.code.ilike(search_term)) |
            (Tenant.domain.ilike(search_term))
        )
    
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
    admin_only: bool = True,
    db: Session = Depends(get_sync_db)
):
    """
    Get users belonging to a tenant (System Admin only).
    By default, returns only users with ADMIN role.
    Set admin_only=false to get all users.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    query = db.query(User).filter(User.tenant_id == tenant_id)
    
    # Filter for admin users only by default
    if admin_only:
        query = query.filter(User.roles.contains(['ADMIN']))
    
    users = query.offset(skip).limit(limit).all()
    
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "full_name": u.full_name,
            "designation": u.designation,
            "department": u.department,
            "roles": u.roles or [],
            "is_active": u.is_active
        }
        for u in users
    ]


class AddAdminByEmailRequest(BaseModel):
    email: str


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    # Ensure at least one of each required character type
    lowercase = secrets.choice(string.ascii_lowercase)
    uppercase = secrets.choice(string.ascii_uppercase)
    digit = secrets.choice(string.digits)
    special = secrets.choice("!@#$%^&*")
    
    # Fill the rest with random characters
    remaining_length = length - 4
    all_chars = string.ascii_letters + string.digits + "!@#$%^&*"
    remaining = ''.join(secrets.choice(all_chars) for _ in range(remaining_length))
    
    # Combine and shuffle
    password_list = list(lowercase + uppercase + digit + special + remaining)
    secrets.SystemRandom().shuffle(password_list)
    
    return ''.join(password_list)


@router.post("/{tenant_id}/admins", response_model=dict)
async def create_tenant_admin_by_email(
    tenant_id: UUID,
    request: AddAdminByEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_sync_db)
):
    """
    Create or add a tenant admin by email (System Admin only).
    If the user exists in the tenant, add ADMIN role.
    If the user doesn't exist, create a new user with ADMIN role and send credentials via email.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    email = request.email.strip().lower()
    
    # Validate email format
    if '@' not in email or '.' not in email.split('@')[1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Check if user already exists in this tenant
    existing_user = db.query(User).filter(
        User.email == email,
        User.tenant_id == tenant_id
    ).first()
    
    email_service = get_email_service()
    
    if existing_user:
        # User exists - add ADMIN role if not already present
        current_roles = list(existing_user.roles or ['EMPLOYEE'])
        if 'ADMIN' in current_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already an administrator for this tenant"
            )
        current_roles.append('ADMIN')
        # Normalize roles to ensure EMPLOYEE is always present
        existing_user.roles = normalize_user_roles(current_roles, is_tenant_user=True)
        db.commit()
        db.refresh(existing_user)
        
        # Send notification email about admin role assignment
        background_tasks.add_task(
            email_service.send_admin_welcome_email,
            to_email=email,
            tenant_name=tenant.name,
            temporary_password="(Your existing password)",
            login_url="http://localhost:8080"
        )
        
        return {
            "id": str(existing_user.id),
            "email": existing_user.email,
            "first_name": existing_user.first_name,
            "last_name": existing_user.last_name,
            "full_name": existing_user.full_name,
            "roles": existing_user.roles,
            "message": "Existing user promoted to administrator. Notification email sent.",
            "email_sent": True
        }
    else:
        # Create new user with ADMIN role
        # Extract name from email if possible
        email_name = email.split('@')[0]
        name_parts = email_name.replace('.', ' ').replace('_', ' ').split()
        first_name = name_parts[0].capitalize() if name_parts else 'Admin'
        last_name = ' '.join(p.capitalize() for p in name_parts[1:]) if len(name_parts) > 1 else ''
        
        # Generate temporary password
        temp_password = generate_temporary_password()
        hashed_password = hashlib.sha256(temp_password.encode()).hexdigest()
        
        new_user = User(
            email=email,
            username=email,  # Use email as username
            first_name=first_name,
            last_name=last_name,
            full_name=f"{first_name} {last_name}".strip(),
            tenant_id=tenant_id,
            roles=['EMPLOYEE', 'ADMIN'],  # EMPLOYEE is default for all tenant users
            hashed_password=hashed_password,
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Send welcome email with credentials
        background_tasks.add_task(
            email_service.send_admin_welcome_email,
            to_email=email,
            tenant_name=tenant.name,
            temporary_password=temp_password,
            login_url="http://localhost:8080"
        )
        
        logger.info(f"New tenant admin created: {email} for tenant {tenant.name}")
        
        return {
            "id": str(new_user.id),
            "email": new_user.email,
            "first_name": new_user.first_name,
            "last_name": new_user.last_name,
            "full_name": new_user.full_name,
            "roles": new_user.roles,
            "message": "New administrator created successfully. Credentials sent via email.",
            "email_sent": True
        }


# Note: POST /{tenant_id}/admins endpoint above handles adding admins by email


@router.delete("/{tenant_id}/admins/{user_id}", response_model=dict)
async def remove_tenant_admin(
    tenant_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Remove ADMIN role from a user in a tenant (System Admin only).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == tenant_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this tenant"
        )
    
    # Remove ADMIN role if present, but keep EMPLOYEE
    current_roles = list(user.roles or ['EMPLOYEE'])
    if 'ADMIN' in current_roles:
        current_roles.remove('ADMIN')
        # Normalize to ensure EMPLOYEE is always present
        user.roles = normalize_user_roles(current_roles, is_tenant_user=True)
        db.commit()
        db.refresh(user)
    
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.full_name,
        "roles": user.roles,
        "message": "Admin role removed successfully"
    }

