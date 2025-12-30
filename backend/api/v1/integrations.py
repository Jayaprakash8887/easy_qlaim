"""
Integrations API endpoints for managing third-party integrations
Supports: API Keys, Webhooks, SSO, HRMS, ERP, and Communication integrations
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, HttpUrl
from uuid import UUID
from datetime import datetime
import secrets
import hashlib
import logging

from database import get_sync_db
from models import (
    IntegrationApiKey, IntegrationWebhook, IntegrationSSOConfig,
    IntegrationHRMS, IntegrationERP, IntegrationCommunication,
    WebhookDeliveryLog
)
from api.v1.auth import require_tenant_id

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== PYDANTIC SCHEMAS ====================

# API Keys Schemas
class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: List[str] = ["read_claims"]
    rate_limit: int = Field(default=1000, ge=1, le=100000)
    expires_at: Optional[datetime] = None


class ApiKeyResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    key_prefix: str
    permissions: List[str]
    rate_limit: int
    is_active: bool
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    usage_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Response when creating a new API key - includes the full key (only shown once)"""
    api_key: str  # Full API key - only returned on creation


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    rate_limit: Optional[int] = Field(None, ge=1, le=100000)
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None


# Webhook Schemas
class WebhookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    url: str = Field(..., min_length=1, max_length=500)
    auth_type: str = Field(default="hmac", pattern="^(hmac|bearer|basic|none)$")
    auth_config: Optional[Dict[str, Any]] = {}
    events: List[str] = ["claim_submitted", "claim_approved"]
    retry_count: int = Field(default=3, ge=0, le=10)
    retry_delay_seconds: int = Field(default=60, ge=1, le=3600)


class WebhookResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    url: str
    auth_type: str
    events: List[str]
    retry_count: int
    retry_delay_seconds: int
    is_active: bool
    last_triggered_at: Optional[datetime]
    last_success_at: Optional[datetime]
    last_failure_at: Optional[datetime]
    failure_count: int
    success_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class WebhookCreatedResponse(WebhookResponse):
    """Response when creating a webhook - includes the secret (only shown once)"""
    secret: str


class WebhookUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    url: Optional[str] = Field(None, min_length=1, max_length=500)
    auth_type: Optional[str] = Field(None, pattern="^(hmac|bearer|basic|none)$")
    auth_config: Optional[Dict[str, Any]] = None
    events: Optional[List[str]] = None
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    retry_delay_seconds: Optional[int] = Field(None, ge=1, le=3600)
    is_active: Optional[bool] = None


# SSO Schemas
class SSOConfigCreate(BaseModel):
    provider: str = Field(..., pattern="^(azure_ad|okta|google|keycloak|saml)$")
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    issuer_url: Optional[str] = None
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    jwks_url: Optional[str] = None
    saml_metadata_url: Optional[str] = None
    saml_entity_id: Optional[str] = None
    saml_certificate: Optional[str] = None
    attribute_mapping: Optional[Dict[str, str]] = None
    auto_provision_users: bool = False
    sync_user_attributes: bool = True


class SSOConfigResponse(BaseModel):
    id: UUID
    provider: str
    client_id: Optional[str]
    issuer_url: Optional[str]
    authorization_url: Optional[str]
    token_url: Optional[str]
    userinfo_url: Optional[str]
    jwks_url: Optional[str]
    saml_metadata_url: Optional[str]
    saml_entity_id: Optional[str]
    attribute_mapping: Dict[str, str]
    auto_provision_users: bool
    sync_user_attributes: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SSOConfigUpdate(BaseModel):
    provider: Optional[str] = Field(None, pattern="^(azure_ad|okta|google|keycloak|saml)$")
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    issuer_url: Optional[str] = None
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    jwks_url: Optional[str] = None
    saml_metadata_url: Optional[str] = None
    saml_entity_id: Optional[str] = None
    saml_certificate: Optional[str] = None
    attribute_mapping: Optional[Dict[str, str]] = None
    auto_provision_users: Optional[bool] = None
    sync_user_attributes: Optional[bool] = None
    is_active: Optional[bool] = None


# HRMS Schemas
class HRMSConfigCreate(BaseModel):
    provider: str = Field(..., pattern="^(workday|bamboohr|sap_successfactors|oracle_hcm|zoho_people|darwinbox)$")
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_url: Optional[str] = None
    oauth_scope: Optional[str] = None
    sync_enabled: bool = False
    sync_frequency: str = Field(default="daily", pattern="^(hourly|daily|weekly|manual)$")
    field_mapping: Optional[Dict[str, str]] = None
    sync_employees: bool = True
    sync_departments: bool = True
    sync_managers: bool = True


class HRMSConfigResponse(BaseModel):
    id: UUID
    provider: str
    api_url: Optional[str]
    oauth_client_id: Optional[str]
    oauth_token_url: Optional[str]
    oauth_scope: Optional[str]
    sync_enabled: bool
    sync_frequency: str
    last_sync_at: Optional[datetime]
    last_sync_status: Optional[str]
    last_sync_error: Optional[str]
    field_mapping: Dict[str, str]
    sync_employees: bool
    sync_departments: bool
    sync_managers: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class HRMSConfigUpdate(BaseModel):
    provider: Optional[str] = Field(None, pattern="^(workday|bamboohr|sap_successfactors|oracle_hcm|zoho_people|darwinbox)$")
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_url: Optional[str] = None
    oauth_scope: Optional[str] = None
    sync_enabled: Optional[bool] = None
    sync_frequency: Optional[str] = Field(None, pattern="^(hourly|daily|weekly|manual)$")
    field_mapping: Optional[Dict[str, str]] = None
    sync_employees: Optional[bool] = None
    sync_departments: Optional[bool] = None
    sync_managers: Optional[bool] = None
    is_active: Optional[bool] = None


# ERP Schemas
class ERPConfigCreate(BaseModel):
    provider: str = Field(..., pattern="^(sap|oracle_financials|dynamics365|netsuite|quickbooks|tally|zoho_books)$")
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_url: Optional[str] = None
    oauth_scope: Optional[str] = None
    company_code: Optional[str] = None
    cost_center: Optional[str] = None
    gl_account_mapping: Optional[Dict[str, str]] = {}
    export_enabled: bool = False
    export_frequency: str = Field(default="manual", pattern="^(realtime|daily|weekly|manual)$")
    export_format: str = Field(default="json", pattern="^(json|xml|csv)$")
    auto_export_on_settlement: bool = False


class ERPConfigResponse(BaseModel):
    id: UUID
    provider: str
    api_url: Optional[str]
    oauth_client_id: Optional[str]
    oauth_token_url: Optional[str]
    oauth_scope: Optional[str]
    company_code: Optional[str]
    cost_center: Optional[str]
    gl_account_mapping: Dict[str, str]
    export_enabled: bool
    export_frequency: str
    export_format: str
    auto_export_on_settlement: bool
    last_export_at: Optional[datetime]
    last_export_status: Optional[str]
    last_export_error: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ERPConfigUpdate(BaseModel):
    provider: Optional[str] = Field(None, pattern="^(sap|oracle_financials|dynamics365|netsuite|quickbooks|tally|zoho_books)$")
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_url: Optional[str] = None
    oauth_scope: Optional[str] = None
    company_code: Optional[str] = None
    cost_center: Optional[str] = None
    gl_account_mapping: Optional[Dict[str, str]] = None
    export_enabled: Optional[bool] = None
    export_frequency: Optional[str] = Field(None, pattern="^(realtime|daily|weekly|manual)$")
    export_format: Optional[str] = Field(None, pattern="^(json|xml|csv)$")
    auto_export_on_settlement: Optional[bool] = None
    is_active: Optional[bool] = None


# Communication Schemas
class CommunicationConfigCreate(BaseModel):
    provider: str = Field(..., pattern="^(slack|microsoft_teams|google_chat)$")
    slack_workspace_id: Optional[str] = None
    slack_bot_token: Optional[str] = None
    slack_channel_id: Optional[str] = None
    teams_tenant_id: Optional[str] = None
    teams_webhook_url: Optional[str] = None
    teams_channel_id: Optional[str] = None
    notify_on_claim_submitted: bool = True
    notify_on_claim_approved: bool = True
    notify_on_claim_rejected: bool = True
    notify_on_claim_settled: bool = True
    notify_managers: bool = True
    notify_finance: bool = True


class CommunicationConfigResponse(BaseModel):
    id: UUID
    provider: str
    slack_workspace_id: Optional[str]
    slack_channel_id: Optional[str]
    teams_tenant_id: Optional[str]
    teams_webhook_url: Optional[str]
    teams_channel_id: Optional[str]
    notify_on_claim_submitted: bool
    notify_on_claim_approved: bool
    notify_on_claim_rejected: bool
    notify_on_claim_settled: bool
    notify_managers: bool
    notify_finance: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CommunicationConfigUpdate(BaseModel):
    slack_workspace_id: Optional[str] = None
    slack_bot_token: Optional[str] = None
    slack_channel_id: Optional[str] = None
    teams_tenant_id: Optional[str] = None
    teams_webhook_url: Optional[str] = None
    teams_channel_id: Optional[str] = None
    notify_on_claim_submitted: Optional[bool] = None
    notify_on_claim_approved: Optional[bool] = None
    notify_on_claim_rejected: Optional[bool] = None
    notify_on_claim_settled: Optional[bool] = None
    notify_managers: Optional[bool] = None
    notify_finance: Optional[bool] = None
    is_active: Optional[bool] = None


# Webhook Delivery Log Schema
class WebhookDeliveryLogResponse(BaseModel):
    id: UUID
    webhook_id: UUID
    event_type: str
    attempt_number: int
    response_status_code: Optional[int]
    success: bool
    error_message: Optional[str]
    duration_ms: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== API KEY ENDPOINTS ====================

@router.get("/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """List all API keys for a tenant"""
    keys = db.query(IntegrationApiKey).filter(
        IntegrationApiKey.tenant_id == tenant_id
    ).order_by(IntegrationApiKey.created_at.desc()).all()
    return keys


@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: ApiKeyCreate,
    tenant_id: UUID = Depends(require_tenant_id),
    user_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Create a new API key"""
    # Generate a secure random API key
    raw_key = secrets.token_urlsafe(32)
    key_prefix = raw_key[:8]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    api_key = IntegrationApiKey(
        tenant_id=tenant_id,
        name=data.name,
        description=data.description,
        key_prefix=key_prefix,
        key_hash=key_hash,
        permissions=data.permissions,
        rate_limit=data.rate_limit,
        expires_at=data.expires_at,
        created_by=user_id
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    # Return the full key only on creation
    response = ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        permissions=api_key.permissions or [],
        rate_limit=api_key.rate_limit,
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        usage_count=api_key.usage_count,
        created_at=api_key.created_at,
        api_key=raw_key  # Only returned on creation!
    )
    
    logger.info(f"Created API key {api_key.id} for tenant {tenant_id}")
    return response


@router.get("/api-keys/{key_id}", response_model=ApiKeyResponse)
async def get_api_key(
    key_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get a specific API key"""
    api_key = db.query(IntegrationApiKey).filter(
        and_(
            IntegrationApiKey.id == key_id,
            IntegrationApiKey.tenant_id == tenant_id
        )
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return api_key


@router.put("/api-keys/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    key_id: UUID,
    data: ApiKeyUpdate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Update an API key"""
    api_key = db.query(IntegrationApiKey).filter(
        and_(
            IntegrationApiKey.id == key_id,
            IntegrationApiKey.tenant_id == tenant_id
        )
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(api_key, field, value)
    
    db.commit()
    db.refresh(api_key)
    
    logger.info(f"Updated API key {key_id}")
    return api_key


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Delete an API key"""
    api_key = db.query(IntegrationApiKey).filter(
        and_(
            IntegrationApiKey.id == key_id,
            IntegrationApiKey.tenant_id == tenant_id
        )
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    db.delete(api_key)
    db.commit()
    
    logger.info(f"Deleted API key {key_id}")
    return None


@router.post("/api-keys/{key_id}/regenerate", response_model=ApiKeyCreatedResponse)
async def regenerate_api_key(
    key_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Regenerate an API key (creates new key, keeps settings)"""
    api_key = db.query(IntegrationApiKey).filter(
        and_(
            IntegrationApiKey.id == key_id,
            IntegrationApiKey.tenant_id == tenant_id
        )
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Generate new key
    raw_key = secrets.token_urlsafe(32)
    api_key.key_prefix = raw_key[:8]
    api_key.key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key.usage_count = 0
    api_key.last_used_at = None
    
    db.commit()
    db.refresh(api_key)
    
    response = ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        permissions=api_key.permissions or [],
        rate_limit=api_key.rate_limit,
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        usage_count=api_key.usage_count,
        created_at=api_key.created_at,
        api_key=raw_key
    )
    
    logger.info(f"Regenerated API key {key_id}")
    return response


# ==================== WEBHOOK ENDPOINTS ====================

@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """List all webhooks for a tenant"""
    webhooks = db.query(IntegrationWebhook).filter(
        IntegrationWebhook.tenant_id == tenant_id
    ).order_by(IntegrationWebhook.created_at.desc()).all()
    return webhooks


@router.post("/webhooks", response_model=WebhookCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    data: WebhookCreate,
    tenant_id: UUID = Depends(require_tenant_id),
    user_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Create a new webhook"""
    # Generate webhook secret
    secret = secrets.token_urlsafe(32)
    
    webhook = IntegrationWebhook(
        tenant_id=tenant_id,
        name=data.name,
        description=data.description,
        url=data.url,
        secret=secret,
        auth_type=data.auth_type,
        auth_config=data.auth_config or {},
        events=data.events,
        retry_count=data.retry_count,
        retry_delay_seconds=data.retry_delay_seconds,
        created_by=user_id
    )
    
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    
    response = WebhookCreatedResponse(
        id=webhook.id,
        name=webhook.name,
        description=webhook.description,
        url=webhook.url,
        auth_type=webhook.auth_type,
        events=webhook.events or [],
        retry_count=webhook.retry_count,
        retry_delay_seconds=webhook.retry_delay_seconds,
        is_active=webhook.is_active,
        last_triggered_at=webhook.last_triggered_at,
        last_success_at=webhook.last_success_at,
        last_failure_at=webhook.last_failure_at,
        failure_count=webhook.failure_count,
        success_count=webhook.success_count,
        created_at=webhook.created_at,
        secret=secret  # Only returned on creation!
    )
    
    logger.info(f"Created webhook {webhook.id} for tenant {tenant_id}")
    return response


@router.get("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get a specific webhook"""
    webhook = db.query(IntegrationWebhook).filter(
        and_(
            IntegrationWebhook.id == webhook_id,
            IntegrationWebhook.tenant_id == tenant_id
        )
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return webhook


@router.put("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    data: WebhookUpdate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Update a webhook"""
    webhook = db.query(IntegrationWebhook).filter(
        and_(
            IntegrationWebhook.id == webhook_id,
            IntegrationWebhook.tenant_id == tenant_id
        )
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(webhook, field, value)
    
    db.commit()
    db.refresh(webhook)
    
    logger.info(f"Updated webhook {webhook_id}")
    return webhook


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Delete a webhook"""
    webhook = db.query(IntegrationWebhook).filter(
        and_(
            IntegrationWebhook.id == webhook_id,
            IntegrationWebhook.tenant_id == tenant_id
        )
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    db.delete(webhook)
    db.commit()
    
    logger.info(f"Deleted webhook {webhook_id}")
    return None


@router.get("/webhooks/{webhook_id}/logs", response_model=List[WebhookDeliveryLogResponse])
async def get_webhook_logs(
    webhook_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    limit: int = 50,
    db: Session = Depends(get_sync_db)
):
    """Get delivery logs for a webhook"""
    # Verify webhook belongs to tenant
    webhook = db.query(IntegrationWebhook).filter(
        and_(
            IntegrationWebhook.id == webhook_id,
            IntegrationWebhook.tenant_id == tenant_id
        )
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    logs = db.query(WebhookDeliveryLog).filter(
        WebhookDeliveryLog.webhook_id == webhook_id
    ).order_by(WebhookDeliveryLog.created_at.desc()).limit(limit).all()
    
    return logs


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Send a test event to a webhook"""
    import httpx
    import hmac
    import json
    from datetime import datetime
    
    webhook = db.query(IntegrationWebhook).filter(
        and_(
            IntegrationWebhook.id == webhook_id,
            IntegrationWebhook.tenant_id == tenant_id
        )
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    # Create test payload
    test_payload = {
        "event": "test",
        "timestamp": datetime.utcnow().isoformat(),
        "data": {
            "message": "This is a test webhook event",
            "webhook_id": str(webhook_id),
            "tenant_id": str(tenant_id)
        }
    }
    
    payload_str = json.dumps(test_payload)
    headers = {"Content-Type": "application/json"}
    
    # Add HMAC signature if configured
    if webhook.auth_type == "hmac" and webhook.secret:
        signature = hmac.new(
            webhook.secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()
        headers["X-Webhook-Signature"] = f"sha256={signature}"
    
    start_time = datetime.utcnow()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook.url,
                content=payload_str,
                headers=headers
            )
        
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        success = 200 <= response.status_code < 300
        
        # Log the delivery
        log = WebhookDeliveryLog(
            webhook_id=webhook_id,
            event_type="test",
            event_payload=test_payload,
            attempt_number=1,
            request_url=webhook.url,
            request_headers=headers,
            request_body=payload_str,
            response_status_code=response.status_code,
            response_body=response.text[:1000],  # Limit response body size
            success=success,
            duration_ms=duration_ms
        )
        db.add(log)
        
        # Update webhook stats
        webhook.last_triggered_at = datetime.utcnow()
        if success:
            webhook.last_success_at = datetime.utcnow()
            webhook.success_count += 1
        else:
            webhook.last_failure_at = datetime.utcnow()
            webhook.failure_count += 1
        
        db.commit()
        
        return {
            "success": success,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "response_preview": response.text[:200]
        }
        
    except Exception as e:
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # Log the failure
        log = WebhookDeliveryLog(
            webhook_id=webhook_id,
            event_type="test",
            event_payload=test_payload,
            attempt_number=1,
            request_url=webhook.url,
            request_headers=headers,
            request_body=payload_str,
            success=False,
            error_message=str(e),
            duration_ms=duration_ms
        )
        db.add(log)
        
        webhook.last_triggered_at = datetime.utcnow()
        webhook.last_failure_at = datetime.utcnow()
        webhook.failure_count += 1
        
        db.commit()
        
        return {
            "success": False,
            "error": str(e),
            "duration_ms": duration_ms
        }


# ==================== SSO ENDPOINTS ====================

@router.get("/sso", response_model=Optional[SSOConfigResponse])
async def get_sso_config(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get SSO configuration for a tenant"""
    config = db.query(IntegrationSSOConfig).filter(
        IntegrationSSOConfig.tenant_id == tenant_id
    ).first()
    return config


@router.post("/sso", response_model=SSOConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_sso_config(
    data: SSOConfigCreate,
    tenant_id: UUID = Depends(require_tenant_id),
    user_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Create SSO configuration for a tenant"""
    # Check if config already exists
    existing = db.query(IntegrationSSOConfig).filter(
        IntegrationSSOConfig.tenant_id == tenant_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="SSO configuration already exists. Use PUT to update.")
    
    config = IntegrationSSOConfig(
        tenant_id=tenant_id,
        provider=data.provider,
        client_id=data.client_id,
        client_secret=data.client_secret,
        issuer_url=data.issuer_url,
        authorization_url=data.authorization_url,
        token_url=data.token_url,
        userinfo_url=data.userinfo_url,
        jwks_url=data.jwks_url,
        saml_metadata_url=data.saml_metadata_url,
        saml_entity_id=data.saml_entity_id,
        saml_certificate=data.saml_certificate,
        attribute_mapping=data.attribute_mapping or {"email": "email", "name": "name"},
        auto_provision_users=data.auto_provision_users,
        sync_user_attributes=data.sync_user_attributes,
        created_by=user_id
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    logger.info(f"Created SSO config for tenant {tenant_id}")
    return config


@router.put("/sso", response_model=SSOConfigResponse)
async def update_sso_config(
    data: SSOConfigUpdate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Update SSO configuration for a tenant"""
    config = db.query(IntegrationSSOConfig).filter(
        IntegrationSSOConfig.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="SSO configuration not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    logger.info(f"Updated SSO config for tenant {tenant_id}")
    return config


@router.delete("/sso", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sso_config(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Delete SSO configuration for a tenant"""
    config = db.query(IntegrationSSOConfig).filter(
        IntegrationSSOConfig.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="SSO configuration not found")
    
    db.delete(config)
    db.commit()
    
    logger.info(f"Deleted SSO config for tenant {tenant_id}")
    return None


# ==================== HRMS ENDPOINTS ====================

@router.get("/hrms", response_model=Optional[HRMSConfigResponse])
async def get_hrms_config(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get HRMS configuration for a tenant"""
    config = db.query(IntegrationHRMS).filter(
        IntegrationHRMS.tenant_id == tenant_id
    ).first()
    return config


@router.post("/hrms", response_model=HRMSConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_hrms_config(
    data: HRMSConfigCreate,
    tenant_id: UUID = Depends(require_tenant_id),
    user_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Create HRMS configuration for a tenant"""
    existing = db.query(IntegrationHRMS).filter(
        IntegrationHRMS.tenant_id == tenant_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="HRMS configuration already exists. Use PUT to update.")
    
    config = IntegrationHRMS(
        tenant_id=tenant_id,
        provider=data.provider,
        api_url=data.api_url,
        api_key=data.api_key,
        api_secret=data.api_secret,
        oauth_client_id=data.oauth_client_id,
        oauth_client_secret=data.oauth_client_secret,
        oauth_token_url=data.oauth_token_url,
        oauth_scope=data.oauth_scope,
        sync_enabled=data.sync_enabled,
        sync_frequency=data.sync_frequency,
        field_mapping=data.field_mapping or {},
        sync_employees=data.sync_employees,
        sync_departments=data.sync_departments,
        sync_managers=data.sync_managers,
        created_by=user_id
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    logger.info(f"Created HRMS config for tenant {tenant_id}")
    return config


@router.put("/hrms", response_model=HRMSConfigResponse)
async def update_hrms_config(
    data: HRMSConfigUpdate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Update HRMS configuration for a tenant"""
    config = db.query(IntegrationHRMS).filter(
        IntegrationHRMS.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="HRMS configuration not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    logger.info(f"Updated HRMS config for tenant {tenant_id}")
    return config


@router.delete("/hrms", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hrms_config(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Delete HRMS configuration for a tenant"""
    config = db.query(IntegrationHRMS).filter(
        IntegrationHRMS.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="HRMS configuration not found")
    
    db.delete(config)
    db.commit()
    
    logger.info(f"Deleted HRMS config for tenant {tenant_id}")
    return None


@router.post("/hrms/sync")
async def trigger_hrms_sync(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Trigger a manual HRMS sync"""
    config = db.query(IntegrationHRMS).filter(
        IntegrationHRMS.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="HRMS configuration not found")
    
    if not config.is_active:
        raise HTTPException(status_code=400, detail="HRMS integration is not active")
    
    # TODO: Implement actual sync logic here
    # For now, just return a placeholder response
    config.last_sync_at = datetime.utcnow()
    config.last_sync_status = "in_progress"
    db.commit()
    
    return {
        "message": "HRMS sync triggered",
        "status": "in_progress",
        "note": "Sync will run in the background"
    }


# ==================== ERP ENDPOINTS ====================

@router.get("/erp", response_model=Optional[ERPConfigResponse])
async def get_erp_config(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get ERP configuration for a tenant"""
    config = db.query(IntegrationERP).filter(
        IntegrationERP.tenant_id == tenant_id
    ).first()
    return config


@router.post("/erp", response_model=ERPConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_erp_config(
    data: ERPConfigCreate,
    tenant_id: UUID = Depends(require_tenant_id),
    user_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Create ERP configuration for a tenant"""
    existing = db.query(IntegrationERP).filter(
        IntegrationERP.tenant_id == tenant_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="ERP configuration already exists. Use PUT to update.")
    
    config = IntegrationERP(
        tenant_id=tenant_id,
        provider=data.provider,
        api_url=data.api_url,
        api_key=data.api_key,
        api_secret=data.api_secret,
        oauth_client_id=data.oauth_client_id,
        oauth_client_secret=data.oauth_client_secret,
        oauth_token_url=data.oauth_token_url,
        oauth_scope=data.oauth_scope,
        company_code=data.company_code,
        cost_center=data.cost_center,
        gl_account_mapping=data.gl_account_mapping or {},
        export_enabled=data.export_enabled,
        export_frequency=data.export_frequency,
        export_format=data.export_format,
        auto_export_on_settlement=data.auto_export_on_settlement,
        created_by=user_id
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    logger.info(f"Created ERP config for tenant {tenant_id}")
    return config


@router.put("/erp", response_model=ERPConfigResponse)
async def update_erp_config(
    data: ERPConfigUpdate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Update ERP configuration for a tenant"""
    config = db.query(IntegrationERP).filter(
        IntegrationERP.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="ERP configuration not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    logger.info(f"Updated ERP config for tenant {tenant_id}")
    return config


@router.delete("/erp", status_code=status.HTTP_204_NO_CONTENT)
async def delete_erp_config(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Delete ERP configuration for a tenant"""
    config = db.query(IntegrationERP).filter(
        IntegrationERP.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="ERP configuration not found")
    
    db.delete(config)
    db.commit()
    
    logger.info(f"Deleted ERP config for tenant {tenant_id}")
    return None


@router.post("/erp/export")
async def trigger_erp_export(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Trigger a manual ERP export"""
    config = db.query(IntegrationERP).filter(
        IntegrationERP.tenant_id == tenant_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="ERP configuration not found")
    
    if not config.is_active:
        raise HTTPException(status_code=400, detail="ERP integration is not active")
    
    # TODO: Implement actual export logic here
    config.last_export_at = datetime.utcnow()
    config.last_export_status = "in_progress"
    db.commit()
    
    return {
        "message": "ERP export triggered",
        "status": "in_progress",
        "note": "Export will run in the background"
    }


# ==================== COMMUNICATION ENDPOINTS ====================

@router.get("/communication", response_model=List[CommunicationConfigResponse])
async def list_communication_configs(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """List all communication integrations for a tenant"""
    configs = db.query(IntegrationCommunication).filter(
        IntegrationCommunication.tenant_id == tenant_id
    ).order_by(IntegrationCommunication.created_at.desc()).all()
    return configs


@router.get("/communication/{provider}", response_model=Optional[CommunicationConfigResponse])
async def get_communication_config(
    provider: str,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get communication configuration for a specific provider"""
    config = db.query(IntegrationCommunication).filter(
        and_(
            IntegrationCommunication.tenant_id == tenant_id,
            IntegrationCommunication.provider == provider
        )
    ).first()
    return config


@router.post("/communication", response_model=CommunicationConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_communication_config(
    data: CommunicationConfigCreate,
    tenant_id: UUID = Depends(require_tenant_id),
    user_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Create communication configuration"""
    existing = db.query(IntegrationCommunication).filter(
        and_(
            IntegrationCommunication.tenant_id == tenant_id,
            IntegrationCommunication.provider == data.provider
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Configuration for {data.provider} already exists. Use PUT to update.")
    
    config = IntegrationCommunication(
        tenant_id=tenant_id,
        provider=data.provider,
        slack_workspace_id=data.slack_workspace_id,
        slack_bot_token=data.slack_bot_token,
        slack_channel_id=data.slack_channel_id,
        teams_tenant_id=data.teams_tenant_id,
        teams_webhook_url=data.teams_webhook_url,
        teams_channel_id=data.teams_channel_id,
        notify_on_claim_submitted=data.notify_on_claim_submitted,
        notify_on_claim_approved=data.notify_on_claim_approved,
        notify_on_claim_rejected=data.notify_on_claim_rejected,
        notify_on_claim_settled=data.notify_on_claim_settled,
        notify_managers=data.notify_managers,
        notify_finance=data.notify_finance,
        created_by=user_id
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    logger.info(f"Created {data.provider} config for tenant {tenant_id}")
    return config


@router.put("/communication/{provider}", response_model=CommunicationConfigResponse)
async def update_communication_config(
    provider: str,
    data: CommunicationConfigUpdate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Update communication configuration for a provider"""
    config = db.query(IntegrationCommunication).filter(
        and_(
            IntegrationCommunication.tenant_id == tenant_id,
            IntegrationCommunication.provider == provider
        )
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Configuration for {provider} not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    logger.info(f"Updated {provider} config for tenant {tenant_id}")
    return config


@router.delete("/communication/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_communication_config(
    provider: str,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Delete communication configuration for a provider"""
    config = db.query(IntegrationCommunication).filter(
        and_(
            IntegrationCommunication.tenant_id == tenant_id,
            IntegrationCommunication.provider == provider
        )
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Configuration for {provider} not found")
    
    db.delete(config)
    db.commit()
    
    logger.info(f"Deleted {provider} config for tenant {tenant_id}")
    return None


@router.post("/communication/{provider}/test")
async def test_communication(
    provider: str,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Send a test message to the communication channel"""
    import httpx
    
    config = db.query(IntegrationCommunication).filter(
        and_(
            IntegrationCommunication.tenant_id == tenant_id,
            IntegrationCommunication.provider == provider
        )
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Configuration for {provider} not found")
    
    if not config.is_active:
        raise HTTPException(status_code=400, detail=f"{provider} integration is not active")
    
    test_message = "🧪 Test notification from Claims Management System. Your integration is working correctly!"
    
    try:
        if provider == "slack":
            if not config.slack_bot_token or not config.slack_channel_id:
                raise HTTPException(status_code=400, detail="Slack bot token and channel ID are required")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={"Authorization": f"Bearer {config.slack_bot_token}"},
                    json={
                        "channel": config.slack_channel_id,
                        "text": test_message
                    }
                )
                result = response.json()
                if not result.get("ok"):
                    return {"success": False, "error": result.get("error", "Unknown error")}
                return {"success": True, "message": "Test message sent to Slack"}
        
        elif provider == "microsoft_teams":
            if not config.teams_webhook_url:
                raise HTTPException(status_code=400, detail="Teams webhook URL is required")
            
            webhook_url = config.teams_webhook_url
            
            # Detect if it's a Power Automate URL vs standard Teams webhook
            is_power_automate = "powerautomate" in webhook_url.lower() or "flow.microsoft" in webhook_url.lower()
            
            if is_power_automate:
                # Power Automate expects Adaptive Card format
                payload = {
                    "type": "message",
                    "attachments": [
                        {
                            "contentType": "application/vnd.microsoft.card.adaptive",
                            "content": {
                                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                                "type": "AdaptiveCard",
                                "version": "1.4",
                                "body": [
                                    {
                                        "type": "TextBlock",
                                        "size": "Medium",
                                        "weight": "Bolder",
                                        "text": "🧪 Easy Qlaim - Test Notification",
                                        "wrap": True
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": test_message,
                                        "wrap": True
                                    },
                                    {
                                        "type": "FactSet",
                                        "facts": [
                                            {"title": "Status", "value": "✅ Integration Working"},
                                            {"title": "System", "value": "Claims Management System"},
                                            {"title": "Time", "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")}
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            else:
                # Standard Teams Incoming Webhook uses MessageCard format
                payload = {
                    "@type": "MessageCard",
                    "@context": "http://schema.org/extensions",
                    "summary": "Test Message",
                    "themeColor": "0076D7",
                    "title": "Easy Qlaim - Test Notification",
                    "sections": [
                        {
                            "activityTitle": "🧪 Integration Test",
                            "facts": [
                                {"name": "Status", "value": "✅ Working"},
                                {"name": "Message", "value": test_message}
                            ],
                            "markdown": True
                        }
                    ]
                }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=payload)
                
                logger.info(f"Teams webhook response: {response.status_code} - {response.text[:200] if response.text else 'No body'}")
                
                # Teams webhooks return 200 or 202 (Accepted) on success
                if response.status_code in (200, 202):
                    return {"success": True, "message": "Test message sent to Teams"}
                return {"success": False, "error": f"HTTP {response.status_code}: {response.text}"}
        
        else:
            return {"success": False, "error": f"Provider {provider} does not support test messages"}
    
    except Exception as e:
        return {"success": False, "error": str(e)}


# ==================== OVERVIEW ENDPOINT ====================

@router.get("/overview")
async def get_integrations_overview(
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get an overview of all integrations for a tenant"""
    api_keys_count = db.query(IntegrationApiKey).filter(
        and_(
            IntegrationApiKey.tenant_id == tenant_id,
            IntegrationApiKey.is_active == True
        )
    ).count()
    
    webhooks_count = db.query(IntegrationWebhook).filter(
        and_(
            IntegrationWebhook.tenant_id == tenant_id,
            IntegrationWebhook.is_active == True
        )
    ).count()
    
    sso_config = db.query(IntegrationSSOConfig).filter(
        IntegrationSSOConfig.tenant_id == tenant_id
    ).first()
    
    hrms_config = db.query(IntegrationHRMS).filter(
        IntegrationHRMS.tenant_id == tenant_id
    ).first()
    
    erp_config = db.query(IntegrationERP).filter(
        IntegrationERP.tenant_id == tenant_id
    ).first()
    
    communication_configs = db.query(IntegrationCommunication).filter(
        and_(
            IntegrationCommunication.tenant_id == tenant_id,
            IntegrationCommunication.is_active == True
        )
    ).all()
    
    return {
        "api_keys": {
            "active_count": api_keys_count,
            "configured": api_keys_count > 0
        },
        "webhooks": {
            "active_count": webhooks_count,
            "configured": webhooks_count > 0
        },
        "sso": {
            "configured": sso_config is not None,
            "provider": sso_config.provider if sso_config else None,
            "is_active": sso_config.is_active if sso_config else False
        },
        "hrms": {
            "configured": hrms_config is not None,
            "provider": hrms_config.provider if hrms_config else None,
            "is_active": hrms_config.is_active if hrms_config else False,
            "last_sync": hrms_config.last_sync_at.isoformat() if hrms_config and hrms_config.last_sync_at else None
        },
        "erp": {
            "configured": erp_config is not None,
            "provider": erp_config.provider if erp_config else None,
            "is_active": erp_config.is_active if erp_config else False,
            "last_export": erp_config.last_export_at.isoformat() if erp_config and erp_config.last_export_at else None
        },
        "communication": {
            "configured_providers": [c.provider for c in communication_configs],
            "active_count": len(communication_configs)
        }
    }
