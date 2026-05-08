"""
Tenant Branding Management API

Allows System Admin and Admin to configure tenant-specific branding including:
- Logo (Full logo with text)
- Logo Mark (Icon/symbol only)
- Favicon (Browser tab icon)
- Primary and secondary colors

Note: Admin users can only modify their own tenant's branding.
      System Admin can modify any tenant's branding.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
import os
import logging
import shutil
import uuid as uuid_module

from database import get_sync_db
from models import Tenant, User
from config import settings
from api.v1.auth import get_current_user
from services.storage import (
    is_cloud_storage_configured,
    upload_branding_to_cloud,
    delete_branding_from_cloud
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Directory to store branding assets
BRANDING_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "branding")

# Ensure branding directory exists
os.makedirs(BRANDING_DIR, exist_ok=True)

# ==================== FILE SPECIFICATIONS ====================

BRANDING_FILE_SPECS = {
    "logo": {
        "name": "Full Logo",
        "description": "Primary logo with company name, used in headers and login pages",
        "formats": ["svg", "png"],
        "max_size_mb": 2,
        "recommended_dimensions": "400x200 pixels (for PNG) or scalable (for SVG)",
        "notes": "SVG is preferred for crisp rendering at all sizes. PNG should be at least 400px wide."
    },
    "logo_mark": {
        "name": "Logo Mark",
        "description": "Icon or symbol only, used in sidebars and compact spaces",
        "formats": ["svg", "png"],
        "max_size_mb": 1,
        "recommended_dimensions": "72x72 pixels minimum (for PNG) or scalable (for SVG)",
        "notes": "Square format recommended. Used when space is limited."
    },
    "favicon": {
        "name": "Favicon",
        "description": "Browser tab icon",
        "formats": ["ico", "png"],
        "max_size_mb": 0.5,
        "recommended_dimensions": "32x32 or 16x16 pixels",
        "notes": "ICO format supports multiple sizes. PNG should be 32x32 or 16x16."
    },
    "login_background": {
        "name": "Login Background",
        "description": "Background image for the login page",
        "formats": ["jpg", "jpeg", "png", "webp"],
        "max_size_mb": 5,
        "recommended_dimensions": "1920x1080 pixels",
        "notes": "High resolution image recommended. Will be cropped/scaled to fit."
    }
}

# ==================== SCHEMAS ====================

class BrandingColors(BaseModel):
    primary_color: Optional[str] = None  # e.g., "#00928F"
    secondary_color: Optional[str] = None  # e.g., "#13283E"
    accent_color: Optional[str] = None


class BrandingSettings(BaseModel):
    logo_url: Optional[str] = None
    logo_mark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    login_background_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    company_tagline: Optional[str] = None
    custom_css: Optional[str] = None


class BrandingFileSpecResponse(BaseModel):
    name: str
    description: str
    formats: list[str]
    max_size_mb: float
    recommended_dimensions: str
    notes: str


class BrandingResponse(BaseModel):
    tenant_id: str
    tenant_name: str
    branding: BrandingSettings
    file_specs: dict[str, BrandingFileSpecResponse]
    
    class Config:
        from_attributes = True


# ==================== HELPER FUNCTIONS ====================

def get_allowed_extensions(file_type: str) -> list[str]:
    """Get allowed file extensions for a branding file type"""
    if file_type in BRANDING_FILE_SPECS:
        return BRANDING_FILE_SPECS[file_type]["formats"]
    return []


def get_max_size_bytes(file_type: str) -> int:
    """Get maximum file size in bytes for a branding file type"""
    if file_type in BRANDING_FILE_SPECS:
        return int(BRANDING_FILE_SPECS[file_type]["max_size_mb"] * 1024 * 1024)
    return 2 * 1024 * 1024  # Default 2MB


def validate_file(file: UploadFile, file_type: str) -> tuple[bool, str]:
    """Validate uploaded file"""
    # Check file extension
    if not file.filename:
        return False, "No filename provided"
    
    ext = file.filename.lower().split('.')[-1]
    allowed_extensions = get_allowed_extensions(file_type)
    
    if ext not in allowed_extensions:
        return False, f"Invalid file format. Allowed formats: {', '.join(allowed_extensions)}"
    
    # Check content type
    content_type = file.content_type or ""
    valid_content_types = {
        "svg": ["image/svg+xml"],
        "png": ["image/png"],
        "ico": ["image/x-icon", "image/vnd.microsoft.icon"],
        "jpg": ["image/jpeg"],
        "jpeg": ["image/jpeg"],
        "webp": ["image/webp"]
    }
    
    expected_types = valid_content_types.get(ext, [])
    if expected_types and content_type not in expected_types:
        # Allow unknown content types but log warning
        logger.warning(f"Unexpected content type {content_type} for extension {ext}")
    
    return True, ""


def save_branding_file(file: UploadFile, tenant_id: UUID, file_type: str) -> tuple[str, Optional[str]]:
    """
    Save branding file and return the URL path.
    
    Tries cloud storage first (GCS), falls back to local storage.
    
    Returns:
        Tuple of (url, blob_name) - blob_name is None for local storage
    """
    # Read file content
    file_content = file.file.read()
    file.file.seek(0)  # Reset for potential local fallback
    
    # Determine content type
    ext = file.filename.split('.')[-1].lower()
    content_type_map = {
        "svg": "image/svg+xml",
        "png": "image/png",
        "ico": "image/x-icon",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp"
    }
    content_type = content_type_map.get(ext, file.content_type)
    
    # Try cloud storage first
    if is_cloud_storage_configured():
        public_url, blob_name = upload_branding_to_cloud(
            file_content=file_content,
            tenant_id=str(tenant_id),
            file_type=file_type,
            original_filename=file.filename,
            content_type=content_type
        )
        
        if public_url and blob_name:
            logger.info(f"Branding file uploaded to cloud: {public_url}")
            return public_url, blob_name
        else:
            logger.warning("Cloud upload failed, falling back to local storage")
    
    # Fallback to local storage
    tenant_dir = os.path.join(BRANDING_DIR, str(tenant_id))
    os.makedirs(tenant_dir, exist_ok=True)
    
    # Generate unique filename
    unique_id = str(uuid_module.uuid4())[:8]
    filename = f"{file_type}_{unique_id}.{ext}"
    filepath = os.path.join(tenant_dir, filename)
    
    # Save file
    with open(filepath, "wb") as buffer:
        buffer.write(file_content)
    
    # Return URL path (relative to API)
    return f"/api/v1/branding/files/{tenant_id}/{filename}", None


def delete_branding_file(tenant_id: UUID, file_url: str, blob_name: Optional[str] = None) -> bool:
    """
    Delete a branding file from storage.
    
    Args:
        tenant_id: Tenant ID
        file_url: The URL of the file
        blob_name: Cloud storage blob name (if stored in cloud)
    
    Returns:
        True on success, False on failure
    """
    if not file_url:
        return True
    
    # Check if it's a cloud URL (GCS public URL pattern)
    if file_url.startswith("https://storage.googleapis.com/"):
        # Extract blob name from URL if not provided
        if not blob_name:
            # URL format: https://storage.googleapis.com/bucket-name/path/to/file
            try:
                parts = file_url.replace("https://storage.googleapis.com/", "").split("/", 1)
                if len(parts) > 1:
                    blob_name = parts[1]
            except Exception as e:
                logger.error(f"Failed to extract blob name from URL: {e}")
        
        if blob_name:
            return delete_branding_from_cloud(blob_name)
        return False
    
    # Local file - extract filename from URL
    try:
        filename = file_url.split('/')[-1]
        filepath = os.path.join(BRANDING_DIR, str(tenant_id), filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"Deleted local branding file: {filepath}")
            return True
    except Exception as e:
        logger.error(f"Failed to delete branding file: {e}")
    
    return False


def get_tenant_branding(tenant: Tenant) -> BrandingSettings:
    """Extract branding settings from tenant settings"""
    tenant_settings = tenant.settings or {}
    branding = tenant_settings.get("branding", {})
    
    return BrandingSettings(
        logo_url=branding.get("logo_url"),
        logo_mark_url=branding.get("logo_mark_url"),
        favicon_url=branding.get("favicon_url"),
        login_background_url=branding.get("login_background_url"),
        primary_color=branding.get("primary_color"),
        secondary_color=branding.get("secondary_color"),
        accent_color=branding.get("accent_color"),
        company_tagline=branding.get("company_tagline"),
        custom_css=branding.get("custom_css")
    )


def update_tenant_branding(db: Session, tenant: Tenant, updates: dict) -> None:
    """Update tenant branding settings"""
    tenant_settings = dict(tenant.settings or {})
    branding = dict(tenant_settings.get("branding", {}))
    
    for key, value in updates.items():
        if value is not None:
            branding[key] = value
        elif key in branding:
            # Allow explicit None to remove a setting
            del branding[key]
    
    tenant_settings["branding"] = branding
    tenant.settings = tenant_settings
    db.commit()


def check_branding_access(current_user: Optional[User], tenant_id: UUID) -> None:
    """
    Check if the current user has access to modify branding for the given tenant.
    
    - System Admin: Can modify any tenant's branding
    - Admin: Can only modify their own tenant's branding
    - Other roles: No access
    
    Raises HTTPException if access is denied.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Get user's roles (it's an array)
    user_roles = current_user.roles or []
    
    # System Admin can modify any tenant
    if 'SYSTEM_ADMIN' in user_roles:
        return
    
    # Admin can only modify their own tenant
    if 'ADMIN' in user_roles:
        if str(current_user.tenant_id) != str(tenant_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify branding for your own tenant"
            )
        return
    
    # Other roles cannot modify branding
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to modify branding settings"
    )


# ==================== ENDPOINTS ====================

@router.get("/specs", response_model=dict)
async def get_branding_file_specs():
    """
    Get branding file specifications.
    Returns the requirements for each branding file type.
    """
    return {
        "file_specs": BRANDING_FILE_SPECS,
        "notes": {
            "general": "All branding assets should follow your organization's brand guidelines.",
            "color_format": "Colors should be specified in hex format (e.g., #00928F)",
            "svg_preference": "SVG files are preferred for logos as they scale perfectly at any size.",
            "accessibility": "Ensure logos have sufficient contrast for visibility."
        }
    }


@router.get("/{tenant_id}", response_model=BrandingResponse)
async def get_tenant_branding_settings(
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Get branding settings for a tenant.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    branding = get_tenant_branding(tenant)
    
    return BrandingResponse(
        tenant_id=str(tenant.id),
        tenant_name=tenant.name,
        branding=branding,
        file_specs={
            k: BrandingFileSpecResponse(**v) 
            for k, v in BRANDING_FILE_SPECS.items()
        }
    )


@router.post("/{tenant_id}/upload/{file_type}")
async def upload_branding_file(
    tenant_id: UUID,
    file_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_sync_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Upload a branding file for a tenant.
    
    Authorization:
    - System Admin: Can upload for any tenant
    - Admin: Can only upload for their own tenant
    
    File types:
    - logo: Full logo with company name (SVG or PNG, max 2MB, 400x200px recommended)
    - logo_mark: Icon/symbol only (SVG or PNG, max 1MB, 72x72px minimum)
    - favicon: Browser tab icon (ICO or PNG, max 0.5MB, 32x32px)
    - login_background: Login page background (JPG/PNG/WebP, max 5MB, 1920x1080px)
    """
    # Check authorization
    check_branding_access(current_user, tenant_id)
    
    # Validate file type
    if file_type not in BRANDING_FILE_SPECS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Must be one of: {', '.join(BRANDING_FILE_SPECS.keys())}"
        )
    
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Validate file
    is_valid, error_msg = validate_file(file, file_type)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Seek back to start
    
    max_size = get_max_size_bytes(file_type)
    if file_size > max_size:
        max_mb = max_size / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size for {file_type}: {max_mb}MB"
        )
    
    # Delete old file if exists
    branding = get_tenant_branding(tenant)
    old_url = getattr(branding, f"{file_type}_url", None)
    if old_url:
        # Get old blob name from tenant settings if available
        tenant_settings = tenant.settings or {}
        branding_settings = tenant_settings.get("branding", {})
        old_blob_name = branding_settings.get(f"{file_type}_blob_name")
        delete_branding_file(tenant_id, old_url, old_blob_name)
    
    # Save new file
    file_url, blob_name = save_branding_file(file, tenant_id, file_type)
    
    # Update tenant settings with URL and blob_name (for cloud storage)
    updates = {f"{file_type}_url": file_url}
    if blob_name:
        updates[f"{file_type}_blob_name"] = blob_name
    update_tenant_branding(db, tenant, updates)
    db.refresh(tenant)
    
    return {
        "message": f"{BRANDING_FILE_SPECS[file_type]['name']} uploaded successfully",
        "file_type": file_type,
        "url": file_url,
        "storage": "cloud" if blob_name else "local",
        "specs": BRANDING_FILE_SPECS[file_type]
    }


@router.delete("/{tenant_id}/files/{file_type}")
async def delete_branding_file_endpoint(
    tenant_id: UUID,
    file_type: str,
    db: Session = Depends(get_sync_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Delete a branding file for a tenant.
    
    Authorization:
    - System Admin: Can delete for any tenant
    - Admin: Can only delete for their own tenant
    """
    # Check authorization
    check_branding_access(current_user, tenant_id)
    
    if file_type not in BRANDING_FILE_SPECS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Must be one of: {', '.join(BRANDING_FILE_SPECS.keys())}"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Get current branding URL and blob name
    tenant_settings = dict(tenant.settings or {})
    branding_settings = dict(tenant_settings.get("branding", {}))
    
    file_url = branding_settings.get(f"{file_type}_url")
    blob_name = branding_settings.get(f"{file_type}_blob_name")
    
    if file_url:
        delete_branding_file(tenant_id, file_url, blob_name)
    
    # Update tenant settings to remove the URL and blob_name
    url_key = f"{file_type}_url"
    blob_key = f"{file_type}_blob_name"
    if url_key in branding_settings:
        del branding_settings[url_key]
    if blob_key in branding_settings:
        del branding_settings[blob_key]
    tenant_settings["branding"] = branding_settings
    tenant.settings = tenant_settings
    db.commit()
    
    return {"message": f"{BRANDING_FILE_SPECS[file_type]['name']} deleted successfully"}


@router.put("/{tenant_id}/colors")
async def update_branding_colors(
    tenant_id: UUID,
    colors: BrandingColors,
    db: Session = Depends(get_sync_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Update branding colors for a tenant.
    
    Authorization:
    - System Admin: Can update for any tenant
    - Admin: Can only update for their own tenant
    
    Colors should be in hex format (e.g., #00928F).
    """
    # Check authorization
    check_branding_access(current_user, tenant_id)
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Validate hex colors
    for color_name, color_value in colors.model_dump().items():
        if color_value:
            if not color_value.startswith('#') or len(color_value) not in [4, 7]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid color format for {color_name}. Use hex format (e.g., #00928F)"
                )
    
    update_tenant_branding(db, tenant, colors.model_dump(exclude_none=True))
    db.refresh(tenant)
    
    return {
        "message": "Branding colors updated successfully",
        "colors": colors.model_dump(exclude_none=True)
    }


@router.put("/{tenant_id}/settings")
async def update_branding_settings(
    tenant_id: UUID,
    branding: BrandingSettings,
    db: Session = Depends(get_sync_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Update all branding settings for a tenant.
    Note: File URLs should be set via the upload endpoint, not directly.
    
    Authorization:
    - System Admin: Can update for any tenant
    - Admin: Can only update for their own tenant
    """
    # Check authorization
    check_branding_access(current_user, tenant_id)
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Only update non-URL fields via this endpoint
    allowed_fields = ["primary_color", "secondary_color", "accent_color", "company_tagline", "custom_css"]
    updates = {k: v for k, v in branding.model_dump().items() if k in allowed_fields and v is not None}
    
    update_tenant_branding(db, tenant, updates)
    db.refresh(tenant)
    
    return {
        "message": "Branding settings updated successfully",
        "branding": get_tenant_branding(tenant).model_dump()
    }


@router.get("/{tenant_id}/preview")
async def preview_branding(
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Get a preview of how branding will appear.
    Returns complete branding data including CSS variables.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    branding = get_tenant_branding(tenant)
    
    # Generate CSS variables
    css_variables = []
    if branding.primary_color:
        css_variables.append(f"--primary: {branding.primary_color}")
    if branding.secondary_color:
        css_variables.append(f"--secondary: {branding.secondary_color}")
    if branding.accent_color:
        css_variables.append(f"--accent: {branding.accent_color}")
    
    return {
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "branding": branding.model_dump(),
        "css_variables": css_variables,
        "preview_html": f"""
        <style>
            :root {{
                {'; '.join(css_variables)}
            }}
        </style>
        """
    }


# ==================== FILE SERVING ====================

@router.get("/files/{tenant_id}/{filename}")
async def serve_branding_file(
    tenant_id: UUID,
    filename: str
):
    """
    Serve a branding file for a tenant.
    This endpoint allows the frontend to fetch branding assets.
    """
    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(BRANDING_DIR, str(tenant_id), safe_filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branding file not found"
        )
    
    # Determine content type
    ext = safe_filename.lower().split('.')[-1]
    content_types = {
        "svg": "image/svg+xml",
        "png": "image/png",
        "ico": "image/x-icon",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp"
    }
    
    media_type = content_types.get(ext, "application/octet-stream")
    
    return FileResponse(
        filepath,
        media_type=media_type,
        filename=safe_filename
    )
