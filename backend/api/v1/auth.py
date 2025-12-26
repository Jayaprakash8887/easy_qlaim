"""
Authentication API endpoints supporting both Keycloak and local database authentication.
"""
import logging
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import bcrypt
from jose import jwt, JWTError

from database import get_sync_db as get_db
from models import User, Tenant
from services.keycloak_service import get_keycloak_service, KeycloakService
from services.role_service import get_user_roles
from services.security import audit_logger, get_client_ip
from services.storage import is_cloud_storage_configured, get_cloud_storage_status, upload_avatar_to_cloud, get_signed_url, delete_from_gcs
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hashed password."""
    try:
        # Use bcrypt directly to avoid passlib compatibility issues
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    roles: list[str] = []
    region: Optional[list[str]] = None
    avatar_url: Optional[str] = None


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
        # Verify token with Keycloak userinfo endpoint
        logger.info(f"Verifying token with Keycloak (token length: {len(token)})")
        user_info = await keycloak.verify_token(token)
        if user_info:
            logger.info(f"Keycloak token verified successfully for user: {user_info.get('email')}")
            email = user_info.get("email")
        else:
            # Fallback: Try to decode Keycloak JWT locally (for expired tokens)
            # This allows us to get the email claim even if the token is expired
            logger.warning(f"Keycloak userinfo failed, trying local JWT decode...")
            try:
                # Decode without verification to get claims (Keycloak tokens are JWTs)
                payload = jwt.decode(token, options={"verify_signature": False})
                email = payload.get("email") or payload.get("preferred_username")
                if email:
                    logger.info(f"Extracted email from Keycloak token: {email}")
                else:
                    logger.warning("Could not extract email from Keycloak token")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired token",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            except Exception as e:
                logger.warning(f"Failed to decode Keycloak token: {e}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
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
        "avatar_url": user.avatar_url,
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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    request: Request,
    password_data: ChangePasswordRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
    keycloak: KeycloakService = Depends(get_keycloak_service)
):
    """Change the current user's password."""
    client_ip = get_client_ip(request)
    
    # Verify current password
    if settings.KEYCLOAK_ENABLED:
        # When Keycloak is enabled, verify by attempting to authenticate with Keycloak
        auth_result = await keycloak.authenticate(user.email, password_data.current_password)
        if not auth_result:
            audit_logger.log_auth_event(
                event_type="PASSWORD_CHANGE_FAILED",
                user_email=user.email,
                success=False,
                ip_address=client_ip,
                details={"reason": "invalid_current_password_keycloak"}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
    else:
        # When Keycloak is disabled, verify against local database
        if not verify_password(password_data.current_password, user.hashed_password):
            audit_logger.log_auth_event(
                event_type="PASSWORD_CHANGE_FAILED",
                user_email=user.email,
                success=False,
                ip_address=client_ip,
                details={"reason": "invalid_current_password"}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
    
    # Validate new password
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters"
        )
    
    if password_data.new_password == password_data.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Update password
    try:
        # Update in Keycloak if enabled
        if settings.KEYCLOAK_ENABLED:
            # Get Keycloak user ID
            keycloak_user = await keycloak.get_user_by_email(user.email)
            if keycloak_user:
                keycloak_updated = await keycloak.update_user_password(
                    keycloak_user["id"], 
                    password_data.new_password
                )
                if not keycloak_updated:
                    logger.warning(f"Failed to update password in Keycloak for {user.email}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to update password in authentication server"
                    )
        
        # Also update in local database (for fallback/local auth)
        user.hashed_password = hash_password(password_data.new_password)
        db.commit()
        
        audit_logger.log_auth_event(
            event_type="PASSWORD_CHANGED",
            user_email=user.email,
            success=True,
            ip_address=client_ip
        )
        
        return {"success": True, "message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to change password for {user.email}: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )


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
        region=user.region,
        avatar_url=user.avatar_url
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


@router.get("/cloud-storage-status")
async def cloud_storage_status():
    """Check if cloud storage is configured and available for avatar uploads."""
    status = get_cloud_storage_status()
    return {
        "avatar_upload_enabled": status["configured"] and status["accessible"],
        "provider": status["provider"],
        "error": status["error"] if not status["accessible"] else None
    }


@router.post("/me/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Upload a profile picture/avatar for the current user.
    
    This endpoint is only available when cloud storage is configured.
    Supported formats: JPEG, PNG, GIF, WebP (max 5MB)
    """
    client_ip = get_client_ip(request)
    
    # Check if cloud storage is configured
    if not is_cloud_storage_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile picture upload is not available. Cloud storage is not configured."
        )
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB."
        )
    
    # Delete old avatar if exists
    if user.avatar_blob_name:
        try:
            delete_from_gcs(user.avatar_blob_name)
            logger.info(f"Deleted old avatar for user {user.id}")
        except Exception as e:
            logger.warning(f"Failed to delete old avatar: {e}")
    
    # Upload to cloud storage with tenant-based folder structure
    try:
        gcs_path, blob_name = upload_avatar_to_cloud(
            file_content=file_content,
            user_id=str(user.id),
            original_filename=file.filename or "avatar.jpg",
            content_type=file.content_type,
            tenant_id=str(user.tenant_id) if user.tenant_id else None
        )
        
        if not gcs_path or not blob_name:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload avatar to cloud storage"
            )
        
        # Generate signed URL for immediate display
        signed_url = get_signed_url(blob_name, expiration_minutes=60 * 24 * 7)  # 7 days
        
        # Update user record
        user.avatar_storage_path = gcs_path
        user.avatar_blob_name = blob_name
        user.avatar_url = signed_url
        db.commit()
        
        audit_logger.log_auth_event(
            event_type="AVATAR_UPLOADED",
            user_email=user.email,
            success=True,
            ip_address=client_ip
        )
        
        return {
            "success": True,
            "message": "Avatar uploaded successfully",
            "avatar_url": signed_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload avatar for {user.email}: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload avatar"
        )


@router.delete("/me/avatar")
async def delete_avatar(
    request: Request,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete the current user's avatar/profile picture."""
    client_ip = get_client_ip(request)
    
    if not user.avatar_blob_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No avatar to delete"
        )
    
    try:
        # Delete from cloud storage
        if delete_from_gcs(user.avatar_blob_name):
            # Clear user avatar fields
            user.avatar_url = None
            user.avatar_storage_path = None
            user.avatar_blob_name = None
            db.commit()
            
            audit_logger.log_auth_event(
                event_type="AVATAR_DELETED",
                user_email=user.email,
                success=True,
                ip_address=client_ip
            )
            
            return {"success": True, "message": "Avatar deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete avatar from storage"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete avatar for {user.email}: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete avatar"
        )


@router.get("/me/avatar-url")
async def get_avatar_url(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get a fresh signed URL for the user's avatar."""
    if not user.avatar_blob_name:
        return {"avatar_url": None}
    
    try:
        # Generate new signed URL
        signed_url = get_signed_url(user.avatar_blob_name, expiration_minutes=60 * 24)  # 24 hours
        
        if signed_url:
            # Update stored URL
            user.avatar_url = signed_url
            db.commit()
            return {"avatar_url": signed_url}
        else:
            return {"avatar_url": None, "error": "Could not generate URL"}
    except Exception as e:
        logger.error(f"Failed to get avatar URL: {e}")
        return {"avatar_url": None, "error": str(e)}
