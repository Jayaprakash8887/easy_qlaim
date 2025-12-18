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
from services.security import audit_logger, get_client_ip
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


def require_tenant_id(tenant_id: Optional[str]) -> str:
    """
    Validate that tenant_id is provided.
    Raises HTTP 400 if tenant_id is missing.
    
    Args:
        tenant_id: The tenant ID string (can be None)
    
    Returns:
        The validated tenant_id string
        
    Raises:
        HTTPException: If tenant_id is None or empty
    """
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tenant_id is required. Please ensure you are logged in."
        )
    return tenant_id


# ============ API Endpoints ============

@router.post("/login", response_model=LoginResponse)
async def login(
    login_request: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """
    Authenticate user with email and password.
    Returns access token, refresh token, and user info.
    """
    # Get client info for audit logging
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    
    # First check if user exists in our database
    user = db.query(User).filter(User.email == login_request.email).first()
    if not user:
        # Log failed login attempt
        audit_logger.log_auth_event(
            event_type=audit_logger.AUTH_FAILED,
            user_email=login_request.email,
            success=False,
            ip_address=client_ip,
            user_agent=user_agent,
            error_message="User not found in database"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Authenticate with Keycloak
    tokens = await keycloak.authenticate(login_request.email, login_request.password)
    if not tokens:
        # Log failed login attempt
        audit_logger.log_auth_event(
            event_type=audit_logger.AUTH_FAILED,
            user_email=login_request.email,
            success=False,
            ip_address=client_ip,
            user_agent=user_agent,
            error_message="Invalid credentials (Keycloak rejection)"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Derive user roles using role_service:
    # - SYSTEM_ADMIN role comes from user.roles (platform-level)
    # - All other roles are derived from designation-to-role mappings
    effective_roles = get_user_roles(user, db)
    logger.info(f"User {user.email} with designation '{user.designation}' has roles: {effective_roles}")
    
    # Log successful login
    audit_logger.log_auth_event(
        event_type=audit_logger.AUTH_LOGIN,
        user_email=user.email,
        success=True,
        ip_address=client_ip,
        user_agent=user_agent,
        details={
            "user_id": str(user.id),
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "roles": effective_roles
        }
    )
    
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
    refresh_request: RefreshRequest,
    request: Request,
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Refresh access token using refresh token."""
    client_ip = get_client_ip(request)
    
    tokens = await keycloak.refresh_token(refresh_request.refresh_token)
    if not tokens:
        audit_logger.log_auth_event(
            event_type=audit_logger.AUTH_TOKEN_REFRESH,
            user_email="unknown",
            success=False,
            ip_address=client_ip,
            error_message="Invalid refresh token"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    audit_logger.log_auth_event(
        event_type=audit_logger.AUTH_TOKEN_REFRESH,
        user_email="token_refresh",
        success=True,
        ip_address=client_ip
    )
    
    return RefreshResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type="Bearer",
        expires_in=tokens.get("expires_in", 1800)
    )


@router.post("/logout")
async def logout(
    logout_request: LogoutRequest,
    request: Request,
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Logout user by invalidating refresh token."""
    client_ip = get_client_ip(request)
    
    success = await keycloak.logout(logout_request.refresh_token)
    
    audit_logger.log_auth_event(
        event_type=audit_logger.AUTH_LOGOUT,
        user_email="logout",
        success=success,
        ip_address=client_ip
    )
    
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
