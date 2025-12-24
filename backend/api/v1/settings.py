"""
Settings API endpoints for system configuration
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
import json
import logging

from database import get_sync_db
from models import SystemSettings
from api.v1.auth import require_tenant_id
from utils.timezone import (
    TIMEZONE_CHOICES, DEFAULT_TIMEZONE,
    DATE_FORMAT_CHOICES, DEFAULT_DATE_FORMAT,
    NUMBER_FORMAT_CHOICES, DEFAULT_NUMBER_FORMAT,
    WORKING_DAYS_CHOICES, DEFAULT_WORKING_DAYS,
    WEEK_START_CHOICES, DEFAULT_WEEK_START,
    SESSION_TIMEOUT_CHOICES, DEFAULT_SESSION_TIMEOUT,
    DEFAULT_AUTO_APPROVAL_THRESHOLD, DEFAULT_MAX_AUTO_APPROVAL_AMOUNT,
    DEFAULT_POLICY_COMPLIANCE_THRESHOLD,
    DEFAULT_ENABLE_AUTO_APPROVAL, DEFAULT_AUTO_SKIP_AFTER_MANAGER,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def get_tenant_timezone(db: Session, tenant_id: UUID) -> str:
    """Get the timezone setting for a tenant. Returns default if not set."""
    setting = db.query(SystemSettings).filter(
        and_(
            SystemSettings.setting_key == "timezone",
            SystemSettings.tenant_id == tenant_id
        )
    ).first()
    return setting.setting_value if setting else DEFAULT_TIMEZONE


# Pydantic models
class SettingUpdate(BaseModel):
    """Model for updating a single setting"""
    value: Any
    
    class Config:
        from_attributes = True


class GeneralSettingsUpdate(BaseModel):
    """Model for updating general settings"""
    ai_processing: Optional[bool] = None
    auto_approval: Optional[bool] = None
    enable_auto_approval: Optional[bool] = None  # Admin toggle to enable/disable auto-approval
    auto_skip_after_manager: Optional[bool] = None  # Auto-skip HR/Finance after Manager approval
    auto_approval_threshold: Optional[int] = Field(None, ge=50, le=100)  # 50-100%
    max_auto_approval_amount: Optional[float] = Field(None, ge=0)  # Max amount for auto-approval
    policy_compliance_threshold: Optional[int] = Field(None, ge=50, le=100)  # 50-100%
    default_currency: Optional[str] = None
    fiscal_year_start: Optional[str] = None
    email_notifications: Optional[bool] = None
    notification_email: Optional[str] = None
    timezone: Optional[str] = None  # Timezone code (IST, UTC, EST, PST, etc.)
    date_format: Optional[str] = None  # Date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
    number_format: Optional[str] = None  # Number format locale (en-IN, en-US, de-DE)
    working_days: Optional[str] = None  # Working days (mon-fri, mon-sat, sun-thu)
    week_start: Optional[str] = None  # Week start day (sunday, monday, saturday)
    session_timeout: Optional[str] = None  # Session timeout in minutes
    
    class Config:
        from_attributes = True


class GeneralSettingsResponse(BaseModel):
    """Response model for general settings"""
    ai_processing: bool = True
    auto_approval: bool = True
    enable_auto_approval: bool = DEFAULT_ENABLE_AUTO_APPROVAL  # Admin toggle
    auto_skip_after_manager: bool = DEFAULT_AUTO_SKIP_AFTER_MANAGER  # Auto-skip after Manager approval
    auto_approval_threshold: int = DEFAULT_AUTO_APPROVAL_THRESHOLD  # 95%
    max_auto_approval_amount: float = DEFAULT_MAX_AUTO_APPROVAL_AMOUNT  # 5000
    policy_compliance_threshold: int = DEFAULT_POLICY_COMPLIANCE_THRESHOLD  # 80%
    default_currency: str = "inr"
    fiscal_year_start: str = "apr"
    email_notifications: bool = True
    notification_email: str = ""
    timezone: str = DEFAULT_TIMEZONE
    date_format: str = DEFAULT_DATE_FORMAT
    number_format: str = DEFAULT_NUMBER_FORMAT
    working_days: str = DEFAULT_WORKING_DAYS
    week_start: str = DEFAULT_WEEK_START
    session_timeout: str = DEFAULT_SESSION_TIMEOUT
    
    class Config:
        from_attributes = True


# Default settings
DEFAULT_SETTINGS = {
    "ai_processing": {"value": "true", "type": "boolean", "description": "Enable AI for OCR and validation", "category": "general"},
    "auto_approval": {"value": "true", "type": "boolean", "description": "Auto-approve high confidence claims", "category": "general"},
    "enable_auto_approval": {"value": str(DEFAULT_ENABLE_AUTO_APPROVAL).lower(), "type": "boolean", "description": "Enable/disable auto-approval feature (Admin setting)", "category": "general"},
    "auto_skip_after_manager": {"value": str(DEFAULT_AUTO_SKIP_AFTER_MANAGER).lower(), "type": "boolean", "description": "Auto-skip HR/Finance after Manager approval if thresholds met", "category": "general"},
    "auto_approval_threshold": {"value": str(DEFAULT_AUTO_APPROVAL_THRESHOLD), "type": "number", "description": "AI confidence threshold for auto-approval (%)", "category": "general"},
    "max_auto_approval_amount": {"value": str(DEFAULT_MAX_AUTO_APPROVAL_AMOUNT), "type": "number", "description": "Maximum amount for auto-approval", "category": "general"},
    "policy_compliance_threshold": {"value": str(DEFAULT_POLICY_COMPLIANCE_THRESHOLD), "type": "number", "description": "AI confidence threshold for policy compliance (%)", "category": "general"},
    "default_currency": {"value": "inr", "type": "string", "description": "Default currency for expenses", "category": "general"},
    "fiscal_year_start": {"value": "apr", "type": "string", "description": "Fiscal year start month", "category": "general"},
    "email_notifications": {"value": "true", "type": "boolean", "description": "Send email notifications for claim updates", "category": "notifications"},
    "notification_email": {"value": "", "type": "string", "description": "System notification email address", "category": "notifications"},
    "timezone": {"value": DEFAULT_TIMEZONE, "type": "string", "description": "Default timezone for dates and times", "category": "regional"},
    "date_format": {"value": DEFAULT_DATE_FORMAT, "type": "string", "description": "Date display format", "category": "regional"},
    "number_format": {"value": DEFAULT_NUMBER_FORMAT, "type": "string", "description": "Number/currency display format", "category": "regional"},
    "working_days": {"value": DEFAULT_WORKING_DAYS, "type": "string", "description": "Working days of the week", "category": "regional"},
    "week_start": {"value": DEFAULT_WEEK_START, "type": "string", "description": "First day of the week", "category": "regional"},
    "session_timeout": {"value": DEFAULT_SESSION_TIMEOUT, "type": "string", "description": "Session timeout duration", "category": "security"},
}


def get_setting_value(db: Session, key: str, tenant_id: UUID) -> Optional[str]:
    """Get a setting value from the database"""
    setting = db.query(SystemSettings).filter(
        and_(
            SystemSettings.setting_key == key,
            SystemSettings.tenant_id == tenant_id
        )
    ).first()
    return setting.setting_value if setting else None


def set_setting_value(db: Session, key: str, value: str, tenant_id: UUID, setting_type: str = "string", description: str = None, category: str = "general") -> SystemSettings:
    """Set a setting value in the database"""
    setting = db.query(SystemSettings).filter(
        and_(
            SystemSettings.setting_key == key,
            SystemSettings.tenant_id == tenant_id
        )
    ).first()
    
    if setting:
        setting.setting_value = value
        setting.updated_at = datetime.utcnow()
    else:
        setting = SystemSettings(
            tenant_id=tenant_id,
            setting_key=key,
            setting_value=value,
            setting_type=setting_type,
            description=description,
            category=category
        )
        db.add(setting)
    
    db.commit()
    db.refresh(setting)
    return setting


def parse_bool(value: str) -> bool:
    """Parse a boolean value from string"""
    return value.lower() in ("true", "1", "yes", "on")


@router.get("/general", response_model=GeneralSettingsResponse)
def get_general_settings(
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get all general settings"""
    require_tenant_id(str(tenant_id))
    
    result = GeneralSettingsResponse()
    
    for key, default in DEFAULT_SETTINGS.items():
        value = get_setting_value(db, key, tenant_id)
        if value is None:
            value = default["value"]
        
        # Convert to appropriate type
        if default["type"] == "boolean":
            setattr(result, key, parse_bool(value))
        else:
            setattr(result, key, value)
    
    return result


@router.put("/general", response_model=GeneralSettingsResponse)
def update_general_settings(
    tenant_id: UUID,
    updates: GeneralSettingsUpdate,
    db: Session = Depends(get_sync_db)
):
    """Update general settings"""
    require_tenant_id(str(tenant_id))
    
    # Update each provided setting
    updates_dict = updates.model_dump(exclude_none=True)
    
    for key, value in updates_dict.items():
        if key in DEFAULT_SETTINGS:
            default = DEFAULT_SETTINGS[key]
            # Convert value to string for storage
            if isinstance(value, bool):
                str_value = "true" if value else "false"
            else:
                str_value = str(value)
            
            set_setting_value(
                db, 
                key, 
                str_value, 
                tenant_id,
                setting_type=default["type"],
                description=default["description"],
                category=default["category"]
            )
            logger.info(f"Updated setting {key} to {str_value}")
    
    # Return updated settings
    return get_general_settings(tenant_id=tenant_id, db=db)


@router.get("/{key}")
def get_setting(
    key: str,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get a specific setting by key"""
    require_tenant_id(str(tenant_id))
    
    value = get_setting_value(db, key, tenant_id)
    if value is None and key in DEFAULT_SETTINGS:
        value = DEFAULT_SETTINGS[key]["value"]
    
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    
    # Get type info
    setting_type = DEFAULT_SETTINGS.get(key, {}).get("type", "string")
    
    # Parse value based on type
    if setting_type == "boolean":
        parsed_value = parse_bool(value)
    elif setting_type == "number":
        try:
            parsed_value = float(value)
        except ValueError:
            parsed_value = value
    elif setting_type == "json":
        try:
            parsed_value = json.loads(value)
        except json.JSONDecodeError:
            parsed_value = value
    else:
        parsed_value = value
    
    return {
        "key": key,
        "value": parsed_value,
        "type": setting_type
    }


@router.put("/{key}")
def update_setting(
    key: str,
    tenant_id: UUID,
    update: SettingUpdate,
    db: Session = Depends(get_sync_db)
):
    """Update a specific setting"""
    require_tenant_id(str(tenant_id))
    
    # Get default info if available
    default = DEFAULT_SETTINGS.get(key, {"type": "string", "description": None, "category": "general"})
    
    # Convert value to string for storage
    value = update.value
    if isinstance(value, bool):
        str_value = "true" if value else "false"
    elif isinstance(value, (dict, list)):
        str_value = json.dumps(value)
    else:
        str_value = str(value)
    
    setting = set_setting_value(
        db,
        key,
        str_value,
        tenant_id,
        setting_type=default["type"],
        description=default.get("description"),
        category=default.get("category", "general")
    )
    
    return {
        "key": key,
        "value": update.value,
        "updated_at": setting.updated_at
    }


@router.get("/")
def get_all_settings(
    tenant_id: UUID,
    category: Optional[str] = None,
    db: Session = Depends(get_sync_db)
):
    """Get all settings, optionally filtered by category"""
    require_tenant_id(str(tenant_id))
    
    query = db.query(SystemSettings).filter(SystemSettings.tenant_id == tenant_id)
    
    if category:
        query = query.filter(SystemSettings.category == category)
    
    db_settings = query.all()
    
    # Build response with defaults
    result = {}
    
    # Add defaults first
    for key, default in DEFAULT_SETTINGS.items():
        if category and default["category"] != category:
            continue
        
        setting_type = default["type"]
        value = default["value"]
        
        if setting_type == "boolean":
            result[key] = parse_bool(value)
        else:
            result[key] = value
    
    # Override with database values
    for setting in db_settings:
        if setting.setting_type == "boolean":
            result[setting.setting_key] = parse_bool(setting.setting_value)
        elif setting.setting_type == "number":
            try:
                result[setting.setting_key] = float(setting.setting_value)
            except ValueError:
                result[setting.setting_key] = setting.setting_value
        elif setting.setting_type == "json":
            try:
                result[setting.setting_key] = json.loads(setting.setting_value)
            except json.JSONDecodeError:
                result[setting.setting_key] = setting.setting_value
        else:
            result[setting.setting_key] = setting.setting_value
    
    return result


@router.get("/timezones/available")
def get_available_timezones():
    """Get list of available timezone options"""
    return {
        "timezones": [
            {"code": code, "name": name, "label": f"{code} ({name})"}
            for code, name in TIMEZONE_CHOICES.items()
        ],
        "default": DEFAULT_TIMEZONE
    }


@router.get("/date-formats/available")
def get_available_date_formats():
    """Get list of available date format options"""
    return {
        "date_formats": [
            {"code": code, "format": fmt, "label": code, "example": datetime.now().strftime(fmt)}
            for code, fmt in DATE_FORMAT_CHOICES.items()
        ],
        "default": DEFAULT_DATE_FORMAT
    }


@router.get("/number-formats/available")
def get_available_number_formats():
    """Get list of available number/currency format options"""
    return {
        "number_formats": [
            {
                "code": code, 
                "decimal": info["decimal"], 
                "thousands": info["thousands"],
                "label": info["label"]
            }
            for code, info in NUMBER_FORMAT_CHOICES.items()
        ],
        "default": DEFAULT_NUMBER_FORMAT
    }


@router.get("/working-days/available")
def get_available_working_days():
    """Get list of available working days options"""
    return {
        "working_days": [
            {"code": code, "days": info["days"], "label": info["label"]}
            for code, info in WORKING_DAYS_CHOICES.items()
        ],
        "default": DEFAULT_WORKING_DAYS
    }


@router.get("/week-start/available")
def get_available_week_start():
    """Get list of available week start day options"""
    return {
        "week_start": [
            {"code": code, "day": info["day"], "label": info["label"]}
            for code, info in WEEK_START_CHOICES.items()
        ],
        "default": DEFAULT_WEEK_START
    }


@router.get("/session-timeout/available")
def get_available_session_timeouts():
    """Get list of available session timeout options"""
    return {
        "session_timeouts": [
            {"code": code, "minutes": info["minutes"], "label": info["label"]}
            for code, info in SESSION_TIMEOUT_CHOICES.items()
        ],
        "default": DEFAULT_SESSION_TIMEOUT
    }


@router.get("/options/all")
def get_all_settings_options():
    """Get all available setting options in a single call"""
    # Platform max session timeout (in minutes) - tenants can only set up to this value
    # TODO: In future, this should be fetched from platform settings table
    PLATFORM_MAX_SESSION_TIMEOUT = 480  # 8 hours - platform default
    
    return {
        "timezones": {
            "options": [
                {"code": code, "name": name, "label": f"{code} ({name})"}
                for code, name in TIMEZONE_CHOICES.items()
            ],
            "default": DEFAULT_TIMEZONE
        },
        "date_formats": {
            "options": [
                {"code": code, "format": fmt, "label": code, "example": datetime.now().strftime(fmt)}
                for code, fmt in DATE_FORMAT_CHOICES.items()
            ],
            "default": DEFAULT_DATE_FORMAT
        },
        "number_formats": {
            "options": [
                {
                    "code": code, 
                    "decimal": info["decimal"], 
                    "thousands": info["thousands"],
                    "label": info["label"]
                }
                for code, info in NUMBER_FORMAT_CHOICES.items()
            ],
            "default": DEFAULT_NUMBER_FORMAT
        },
        "working_days": {
            "options": [
                {"code": code, "days": info["days"], "label": info["label"]}
                for code, info in WORKING_DAYS_CHOICES.items()
            ],
            "default": DEFAULT_WORKING_DAYS
        },
        "week_start": {
            "options": [
                {"code": code, "day": info["day"], "label": info["label"]}
                for code, info in WEEK_START_CHOICES.items()
            ],
            "default": DEFAULT_WEEK_START
        },
        "session_timeouts": {
            "options": [
                {"code": code, "minutes": info["minutes"], "label": info["label"]}
                for code, info in SESSION_TIMEOUT_CHOICES.items()
                if info["minutes"] <= PLATFORM_MAX_SESSION_TIMEOUT  # Filter based on platform max
            ],
            "default": DEFAULT_SESSION_TIMEOUT,
            "platform_max_minutes": PLATFORM_MAX_SESSION_TIMEOUT
        }
    }


class TestEmailRequest(BaseModel):
    """Request model for sending test email"""
    to_email: str


class TestEmailResponse(BaseModel):
    """Response model for test email"""
    success: bool
    message: str


@router.post("/test-email", response_model=TestEmailResponse)
async def send_test_email(
    request: TestEmailRequest,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """
    Send a test email to verify SMTP configuration.
    
    This endpoint allows administrators to verify that email settings
    are configured correctly by sending a test email.
    """
    from services.email_service import EmailService
    
    try:
        email_service = EmailService()
        
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
                .success { color: #16a34a; font-size: 24px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Easy Qlaim - Test Email</h1>
                </div>
                <div class="content">
                    <p class="success">✅ Email Configuration Working!</p>
                    <p>This is a test email from Easy Qlaim to verify that your SMTP settings are configured correctly.</p>
                    <p>If you received this email, your email notifications are ready to use.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="color: #64748b; font-size: 12px;">
                        Sent from Easy Qlaim Platform<br>
                        This is an automated test email.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = """
        Easy Qlaim - Test Email
        
        ✅ Email Configuration Working!
        
        This is a test email from Easy Qlaim to verify that your SMTP settings are configured correctly.
        
        If you received this email, your email notifications are ready to use.
        """
        
        success = email_service.send_email(
            to_email=request.to_email,
            subject="Easy Qlaim - Test Email",
            html_content=html_content,
            text_content=text_content
        )
        
        if success:
            logger.info(f"Test email sent successfully to {request.to_email}")
            return TestEmailResponse(
                success=True,
                message=f"Test email sent successfully to {request.to_email}"
            )
        else:
            logger.error(f"Failed to send test email to {request.to_email}")
            return TestEmailResponse(
                success=False,
                message="Failed to send test email. Please check SMTP configuration."
            )
            
    except Exception as e:
        logger.error(f"Error sending test email: {str(e)}")
        return TestEmailResponse(
            success=False,
            message=f"Error: {str(e)}"
        )
