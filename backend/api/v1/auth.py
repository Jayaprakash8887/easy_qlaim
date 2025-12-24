"""
Authentication API endpoints supporting both Keycloak and local database authentication.
"""
import logging
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError

from database import get_sync_db as get_db
from models import User, Tenant
from services.keycloak_service import get_keycloak_service, KeycloakService
from services.role_service import get_user_roles
from services.security import audit_logger, get_client_ip
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Password hashing context for local authentication
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hashed password."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token for local authentication."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token for local authentication."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

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
    """Get the current authenticated user from the token (Keycloak or local JWT)."""
    if not credentials:
        return None
    
    token = credentials.credentials
    email = None
    
    if settings.KEYCLOAK_ENABLED:
        # Verify token with Keycloak
        user_info = await keycloak.verify_token(token)
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        email = user_info.get("email")
    else:
        # Verify local JWT token
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            if payload.get("type") == "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Cannot use refresh token for authentication",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            email = payload.get("sub")
        except JWTError as e:
            logger.warning(f"JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    # Get email from token
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
    Supports both Keycloak and local database authentication based on KEYCLOAK_ENABLED setting.
    """
    # Get client info for audit logging
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    
    logger.info(f"Login attempt for {login_request.email}, KEYCLOAK_ENABLED={settings.KEYCLOAK_ENABLED}")
    
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
    
    # Check if user's tenant is active (skip for system admin users)
    if user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant and not tenant.is_active:
            # Log failed login due to inactive tenant
            audit_logger.log_auth_event(
                event_type=audit_logger.AUTH_FAILED,
                user_email=login_request.email,
                success=False,
                ip_address=client_ip,
                user_agent=user_agent,
                error_message=f"Tenant '{tenant.name}' is inactive"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your organization's access has been suspended. Please contact your administrator."
            )
    
    # Authenticate based on KEYCLOAK_ENABLED setting
    if settings.KEYCLOAK_ENABLED:
        # Use Keycloak authentication
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
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]
        expires_in = tokens.get("expires_in", 1800)
    else:
        # Use local database authentication
        if not user.hashed_password:
            audit_logger.log_auth_event(
                event_type=audit_logger.AUTH_FAILED,
                user_email=login_request.email,
                success=False,
                ip_address=client_ip,
                user_agent=user_agent,
                error_message="User has no password set"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not verify_password(login_request.password, user.hashed_password):
            audit_logger.log_auth_event(
                event_type=audit_logger.AUTH_FAILED,
                user_email=login_request.email,
                success=False,
                ip_address=client_ip,
                user_agent=user_agent,
                error_message="Invalid credentials (password mismatch)"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Create JWT tokens for local auth
        token_data = {
            "sub": user.email,
            "user_id": str(user.id),
            "tenant_id": str(user.tenant_id) if user.tenant_id else None
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    
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
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        expires_in=expires_in,
        user=user_data
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token_endpoint(
    refresh_request: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Refresh access token using refresh token."""
    client_ip = get_client_ip(request)
    
    if settings.KEYCLOAK_ENABLED:
        # Use Keycloak to refresh token
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
    else:
        # Use local JWT refresh
        try:
            payload = jwt.decode(
                refresh_request.refresh_token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type"
                )
            
            # Create new tokens
            token_data = {
                "sub": payload.get("sub"),
                "user_id": payload.get("user_id"),
                "tenant_id": payload.get("tenant_id")
            }
            new_access_token = create_access_token(token_data)
            new_refresh_token = create_refresh_token(token_data)
            
            audit_logger.log_auth_event(
                event_type=audit_logger.AUTH_TOKEN_REFRESH,
                user_email=payload.get("sub", "unknown"),
                success=True,
                ip_address=client_ip
            )
            
            return RefreshResponse(
                access_token=new_access_token,
                refresh_token=new_refresh_token,
                token_type="Bearer",
                expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )
        except JWTError as e:
            logger.warning(f"JWT refresh failed: {e}")
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


@router.post("/logout")
async def logout(
    logout_request: LogoutRequest,
    request: Request,
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Logout user by invalidating refresh token."""
    client_ip = get_client_ip(request)
    
    if settings.KEYCLOAK_ENABLED:
        success = await keycloak.logout(logout_request.refresh_token)
    else:
        # For local JWT auth, we can't invalidate tokens server-side without a blacklist
        # Client should just discard the token
        success = True
    
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
