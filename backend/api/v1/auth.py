"""
Authentication API endpoints using Keycloak.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_sync_db as get_db
from models import User
from services.keycloak_service import get_keycloak_service, KeycloakService
from services.role_service import get_user_roles
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


# ============ Request/Response Models ============

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class LogoutRequest(BaseModel):
    refresh_token: str


class UserInfoResponse(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    email: str
    first_name: str
    last_name: str
    full_name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    roles: list[str] = []
    region: Optional[str] = None


# ============ Helper Functions ============

def map_backend_roles_to_frontend(roles: list[str]) -> str:
    """Map backend roles to frontend role."""
    if not roles:
        return 'employee'
    if 'SYSTEM_ADMIN' in roles:
        return 'system_admin'
    if 'ADMIN' in roles:
        return 'admin'
    if 'FINANCE' in roles:
        return 'finance'
    if 'HR' in roles:
        return 'hr'
    if 'MANAGER' in roles:
        return 'manager'
    return 'employee'


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
    keycloak: KeycloakService = Depends(get_keycloak_service)
) -> Optional[User]:
    """Get the current authenticated user from the Keycloak token."""
    if not credentials:
        return None
    
    token = credentials.credentials
    
    # Verify token with Keycloak
    user_info = await keycloak.verify_token(token)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get email from token
    email = user_info.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain email",
        )
    
    # Find user in database
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in system",
        )
    
    return user


async def require_auth(
    user: Optional[User] = Depends(get_current_user)
) -> User:
    """Require authentication - raises 401 if not authenticated."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ============ API Endpoints ============

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """
    Authenticate user with email and password.
    Returns access token, refresh token, and user info.
    """
    # First check if user exists in our database
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Authenticate with Keycloak
    tokens = await keycloak.authenticate(request.email, request.password)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Derive user roles using role_service:
    # - SYSTEM_ADMIN role comes from user.roles (platform-level)
    # - All other roles are derived from designation-to-role mappings
    effective_roles = get_user_roles(user, db)
    logger.info(f"User {user.email} with designation '{user.designation}' has roles: {effective_roles}")
    
    # Build user info response
    user_data = {
        "id": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.full_name or f"{user.first_name} {user.last_name}",
        "department": user.department,
        "designation": user.designation,
        "roles": effective_roles,
        "region": user.region,
        "role": map_backend_roles_to_frontend(effective_roles),
    }
    
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type="Bearer",
        expires_in=tokens.get("expires_in", 1800),
        user=user_data
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    request: RefreshRequest,
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Refresh access token using refresh token."""
    tokens = await keycloak.refresh_token(request.refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    return RefreshResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type="Bearer",
        expires_in=tokens.get("expires_in", 1800)
    )


@router.post("/logout")
async def logout(
    request: LogoutRequest,
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Logout user by invalidating refresh token."""
    success = await keycloak.logout(request.refresh_token)
    return {"success": success, "message": "Logged out successfully" if success else "Logout may have failed"}


@router.get("/me", response_model=UserInfoResponse)
async def get_me(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get current authenticated user info."""
    # Derive user roles using role_service (same logic as login)
    effective_roles = get_user_roles(user, db)
    
    return UserInfoResponse(
        id=str(user.id),
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name or f"{user.first_name} {user.last_name}",
        department=user.department,
        designation=user.designation,
        roles=effective_roles,
        region=user.region
    )


@router.get("/verify")
async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Verify if the provided token is valid."""
    if not credentials:
        return {"valid": False, "message": "No token provided"}
    
    user_info = await keycloak.verify_token(credentials.credentials)
    if user_info:
        return {"valid": True, "email": user_info.get("email")}
    return {"valid": False, "message": "Invalid token"}
