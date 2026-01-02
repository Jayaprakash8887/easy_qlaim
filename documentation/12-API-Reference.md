# API Reference Guide

## Easy Qlaim - REST API Documentation

### 1. Overview

Easy Qlaim provides a comprehensive REST API for all operations. The API follows RESTful conventions and uses JSON for request/response payloads.

**Base URL:** `http://localhost:8000/api/v1`  
**Production:** `https://api.easyqlaim.example.com/api/v1`

---

## 2. Authentication

### 2.1 Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "your-password"
}
```

**Response:**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 1800,
    "user": {
        "id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "roles": ["EMPLOYEE", "MANAGER"]
    }
}
```

### 2.2 Refresh Token

```http
POST /api/v1/auth/refresh
Authorization: Bearer {refresh_token}
```

### 2.3 Using Authentication

Include the access token in all subsequent requests:
```http
Authorization: Bearer {access_token}
```

---

## 3. Claims API

### 3.1 Create Claim

```http
POST /api/v1/claims
Authorization: Bearer {token}
Content-Type: application/json

{
    "claim_type": "REIMBURSEMENT",
    "category": "CERTIFICATION",
    "amount": 5000.00,
    "currency": "INR",
    "claim_date": "2024-12-01",
    "description": "AWS Solutions Architect exam fee",
    "details": {
        "exam_name": "AWS Solutions Architect Professional",
        "exam_date": "2024-12-01"
    }
}
```

**Response:**
```json
{
    "id": "uuid",
    "claim_number": "CLM-2024-0001",
    "status": "SUBMITTED",
    "claim_type": "REIMBURSEMENT",
    "category": "CERTIFICATION",
    "amount": 5000.00,
    "currency": "INR",
    "submission_date": "2024-12-15T10:30:00Z",
    "employee": {
        "id": "uuid",
        "full_name": "John Doe",
        "email": "john@example.com"
    }
}
```

### 3.2 List Claims

```http
GET /api/v1/claims?status=PENDING_MANAGER&category=CERTIFICATION&page=1&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| category | string | Filter by category |
| employee_id | uuid | Filter by employee (managers only) |
| start_date | date | Filter from date |
| end_date | date | Filter to date |
| page | int | Page number (default: 1) |
| limit | int | Items per page (default: 20) |
| sort | string | Sort field (default: created_at) |
| order | string | asc or desc (default: desc) |

**Response:**
```json
{
    "items": [
        {
            "id": "uuid",
            "claim_number": "CLM-2024-0001",
            "status": "PENDING_MANAGER",
            "amount": 5000.00,
            "category": "CERTIFICATION"
        }
    ],
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
}
```

### 3.3 Get Claim Detail

```http
GET /api/v1/claims/{claim_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
    "id": "uuid",
    "claim_number": "CLM-2024-0001",
    "status": "PENDING_MANAGER",
    "claim_type": "REIMBURSEMENT",
    "category": "CERTIFICATION",
    "amount": 5000.00,
    "currency": "INR",
    "description": "AWS exam fee",
    "claim_date": "2024-12-01",
    "submission_date": "2024-12-15T10:30:00Z",
    "employee": {
        "id": "uuid",
        "full_name": "John Doe"
    },
    "documents": [
        {
            "id": "uuid",
            "filename": "receipt.pdf",
            "file_type": "application/pdf",
            "ocr_processed": true,
            "ocr_confidence": 0.95
        }
    ],
    "approvals": [
        {
            "stage": "MANAGER",
            "status": "PENDING",
            "created_at": "2024-12-15T10:35:00Z"
        }
    ],
    "comments": [],
    "claim_payload": {
        "validation": {
            "confidence": 0.92,
            "recommendation": "APPROVE"
        }
    }
}
```

### 3.4 Upload Document

```http
POST /api/v1/claims/{claim_id}/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: <binary>
document_type: RECEIPT
```

**Response:**
```json
{
    "id": "uuid",
    "filename": "receipt.pdf",
    "file_type": "application/pdf",
    "file_size": 123456,
    "document_type": "RECEIPT",
    "storage_path": "claims/uuid/receipt.pdf",
    "uploaded_at": "2024-12-15T10:30:00Z"
}
```

### 3.5 Get Document (Signed URL)

```http
GET /api/v1/documents/{document_id}/download
Authorization: Bearer {token}
```

**Response:**
```json
{
    "url": "https://storage.googleapis.com/bucket/path?signed...",
    "expires_at": "2024-12-15T11:30:00Z"
}
```

---

## 4. Approvals API

### 4.1 List Pending Approvals

```http
GET /api/v1/approvals/pending
Authorization: Bearer {token}
```

**Response:**
```json
{
    "items": [
        {
            "id": "uuid",
            "claim": {
                "id": "uuid",
                "claim_number": "CLM-2024-0001",
                "amount": 5000.00,
                "category": "CERTIFICATION"
            },
            "approval_stage": "MANAGER",
            "created_at": "2024-12-15T10:30:00Z"
        }
    ],
    "total": 5
}
```

### 4.2 Approve Claim

```http
POST /api/v1/approvals/{claim_id}/approve
Authorization: Bearer {token}
Content-Type: application/json

{
    "notes": "Approved. Valid certification expense."
}
```

### 4.3 Reject Claim

```http
POST /api/v1/approvals/{claim_id}/reject
Authorization: Bearer {token}
Content-Type: application/json

{
    "reason": "Amount exceeds policy limit",
    "notes": "Please submit with manager pre-approval for amounts over ₹25,000"
}
```

### 4.4 Return Claim

```http
POST /api/v1/approvals/{claim_id}/return
Authorization: Bearer {token}
Content-Type: application/json

{
    "reason": "Missing receipt",
    "notes": "Please attach the original receipt and resubmit"
}
```

---

## 5. Comments API

### 5.1 Add Comment

```http
POST /api/v1/claims/{claim_id}/comments
Authorization: Bearer {token}
Content-Type: application/json

{
    "content": "Please clarify the exam date",
    "visibility": "EMPLOYEE",
    "mentions": ["user-uuid"]
}
```

### 5.2 List Comments

```http
GET /api/v1/claims/{claim_id}/comments
Authorization: Bearer {token}
```

---

## 6. Users API

### 6.1 Get Current User

```http
GET /api/v1/users/me
Authorization: Bearer {token}
```

### 6.2 Update Profile

```http
PUT /api/v1/users/me
Authorization: Bearer {token}
Content-Type: application/json

{
    "phone": "+91-9876543210",
    "address": "123 Main St"
}
```

### 6.3 List Users (Admin)

```http
GET /api/v1/users?department=Engineering&page=1&limit=20
Authorization: Bearer {token}
```

---

## 7. Departments API

Departments are tenant-specific and managed dynamically via API.

### 7.1 List Departments

```http
GET /api/v1/departments?tenant_id={tenant_id}&include_inactive=false&include_employee_counts=true
Authorization: Bearer {token}
```

**Response:**
```json
[
    {
        "id": "uuid",
        "tenant_id": "uuid",
        "code": "ENG",
        "name": "Engineering",
        "description": "Software engineering team",
        "head_id": "uuid",
        "head_name": "John Doe",
        "is_active": true,
        "display_order": 1,
        "employee_count": 25,
        "created_at": "2024-12-01T10:00:00Z",
        "updated_at": "2024-12-15T10:00:00Z"
    }
]
```

### 7.2 Get Department

```http
GET /api/v1/departments/{department_id}?tenant_id={tenant_id}
Authorization: Bearer {token}
```

### 7.3 Create Department

```http
POST /api/v1/departments?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "code": "DS",
    "name": "Data Science",
    "description": "Data science and analytics team",
    "head_id": "uuid",
    "is_active": true,
    "display_order": 10
}
```

### 7.4 Update Department

```http
PUT /api/v1/departments/{department_id}?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "name": "Data Science & Analytics",
    "description": "Updated description"
}
```

### 7.5 Delete Department

Soft-deletes a department (sets `is_active=false`). Returns error if employees are assigned.

```http
DELETE /api/v1/departments/{department_id}?tenant_id={tenant_id}
Authorization: Bearer {token}
```

---

## 8. Dashboard API

### 7.1 Employee Dashboard

```http
GET /api/v1/dashboard/summary
Authorization: Bearer {token}
```

**Response:**
```json
{
    "claims_summary": {
        "total": 25,
        "pending": 3,
        "approved": 20,
        "rejected": 2
    },
    "amount_summary": {
        "total_claimed": 150000.00,
        "total_approved": 120000.00,
        "pending_amount": 30000.00
    },
    "recent_claims": [
        {
            "id": "uuid",
            "claim_number": "CLM-2024-0001",
            "status": "PENDING_MANAGER",
            "amount": 5000.00
        }
    ]
}
```

### 7.2 Manager Dashboard

```http
GET /api/v1/dashboard/manager
Authorization: Bearer {token}
```

### 7.3 Finance Dashboard

```http
GET /api/v1/dashboard/finance
Authorization: Bearer {token}
```

---

## 8. Reports API

### 8.1 Claims Report

```http
GET /api/v1/reports/claims?start_date=2024-01-01&end_date=2024-12-31&format=csv
Authorization: Bearer {token}
```

### 8.2 Financial Report

```http
GET /api/v1/reports/financial?start_date=2024-01-01&end_date=2024-12-31
Authorization: Bearer {token}
```

---

## 9. Notifications API

### 9.1 List Notifications

```http
GET /api/v1/notifications?unread_only=true
Authorization: Bearer {token}
```

### 9.2 Mark as Read

```http
PUT /api/v1/notifications/{notification_id}/read
Authorization: Bearer {token}
```

---

## 10. Settings API

### 10.1 Get General Settings

```http
GET /api/v1/settings/general?tenant_id={tenant_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
    "ai_processing": true,
    "auto_approval": true,
    "enable_auto_approval": true,
    "auto_skip_after_manager": true,
    "auto_approval_threshold": 95,
    "max_auto_approval_amount": 5000,
    "policy_compliance_threshold": 80,
    "default_currency": "inr",
    "fiscal_year_start": "apr",
    "email_notifications": true,
    "notification_email": "",
    "timezone": "IST",
    "date_format": "DD/MM/YYYY",
    "number_format": "en-IN",
    "working_days": "mon-fri",
    "week_start": "monday",
    "session_timeout": "480"
}
```

**Setting Descriptions:**
| Field | Type | Description |
|-------|------|-------------|
| `enable_auto_approval` | boolean | Master switch to enable/disable auto-approval feature |
| `auto_skip_after_manager` | boolean | Auto-skip HR/Finance after manager approval if thresholds met |
| `auto_approval_threshold` | integer | AI confidence threshold (50-100%) for auto-approval |
| `policy_compliance_threshold` | integer | AI confidence threshold (50-100%) for policy compliance |

### 10.2 Update General Settings

```http
PUT /api/v1/settings/general?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "timezone": "UTC",
    "date_format": "YYYY-MM-DD",
    "number_format": "en-US",
    "enable_auto_approval": true,
    "auto_skip_after_manager": true,
    "auto_approval_threshold": 90,
    "max_auto_approval_amount": 10000
}
```

### 10.3 Get All Setting Options

```http
GET /api/v1/settings/options/all
Authorization: Bearer {token}
```

**Response:**
```json
{
    "timezones": {
        "options": [
            {"code": "IST", "name": "Asia/Kolkata", "label": "IST (Asia/Kolkata)"},
            {"code": "UTC", "name": "UTC", "label": "UTC (UTC)"}
        ],
        "default": "IST"
    },
    "date_formats": {
        "options": [
            {"code": "DD/MM/YYYY", "format": "%d/%m/%Y", "label": "DD/MM/YYYY", "example": "19/12/2025"},
            {"code": "MM/DD/YYYY", "format": "%m/%d/%Y", "label": "MM/DD/YYYY", "example": "12/19/2025"},
            {"code": "YYYY-MM-DD", "format": "%Y-%m-%d", "label": "YYYY-MM-DD", "example": "2025-12-19"}
        ],
        "default": "DD/MM/YYYY"
    },
    "number_formats": {
        "options": [
            {"code": "en-IN", "decimal": ".", "thousands": ",", "label": "Indian (1,00,000.00)"},
            {"code": "en-US", "decimal": ".", "thousands": ",", "label": "US/UK (100,000.00)"},
            {"code": "de-DE", "decimal": ",", "thousands": ".", "label": "German (100.000,00)"}
        ],
        "default": "en-IN"
    },
    "working_days": {
        "options": [
            {"code": "mon-fri", "days": [0,1,2,3,4], "label": "Monday - Friday"},
            {"code": "mon-sat", "days": [0,1,2,3,4,5], "label": "Monday - Saturday"},
            {"code": "sun-thu", "days": [6,0,1,2,3], "label": "Sunday - Thursday"}
        ],
        "default": "mon-fri"
    },
    "week_start": {
        "options": [
            {"code": "sunday", "day": 6, "label": "Sunday"},
            {"code": "monday", "day": 0, "label": "Monday"}
        ],
        "default": "monday"
    },
    "session_timeouts": {
        "options": [
            {"code": "30", "minutes": 30, "label": "30 minutes"},
            {"code": "60", "minutes": 60, "label": "1 hour"},
            {"code": "480", "minutes": 480, "label": "8 hours"}
        ],
        "default": "480"
    }
}
```

### 10.4 Individual Setting Endpoints

```http
GET /api/v1/settings/timezones/available
GET /api/v1/settings/date-formats/available
GET /api/v1/settings/number-formats/available
GET /api/v1/settings/working-days/available
GET /api/v1/settings/week-start/available
GET /api/v1/settings/session-timeout/available
```

---

## 10.5 Approval Skip Rules API

Configure rules to skip approval levels for designated employees (CXOs, executives).

### 10.5.1 List Approval Skip Rules

```http
GET /api/v1/approval-skip-rules/
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `is_active` | boolean | Filter by active status (optional) |
| `match_type` | string | Filter by match type: `designation`, `email`, or `project` (optional) |

**Response:**
```json
{
    "items": [
        {
            "id": "uuid",
            "tenant_id": "uuid",
            "rule_name": "CEO Fast Track",
            "description": "Skip all approvals for CEO",
            "match_type": "designation",
            "designations": ["CEO"],
            "emails": [],
            "project_codes": [],
            "skip_manager_approval": true,
            "skip_hr_approval": true,
            "skip_finance_approval": true,
            "max_amount_threshold": null,
            "category_codes": [],
            "priority": 1,
            "is_active": true,
            "created_at": "2024-12-20T10:30:00Z",
            "updated_at": "2024-12-20T10:30:00Z"
        }
    ],
    "total": 1
}
```

### 10.5.1a List Available Designations

```http
GET /api/v1/approval-skip-rules/designations
Authorization: Bearer {token}
```

**Response:**
```json
[
    {"code": "CEO", "name": "Chief Executive Officer", "level": 10},
    {"code": "CTO", "name": "Chief Technology Officer", "level": 9},
    {"code": "VP", "name": "Vice President", "level": 7}
]
```

### 10.5.1b List Available Projects

```http
GET /api/v1/approval-skip-rules/projects/list
Authorization: Bearer {token}
```

**Response:**
```json
[
    {"code": "PROJ-001", "name": "Project Alpha"},
    {"code": "PROJ-002", "name": "Project Beta"}
]
```

### 10.5.2 Create Approval Skip Rule

```http
POST /api/v1/approval-skip-rules/
Authorization: Bearer {token}
Content-Type: application/json

{
    "rule_name": "VP Manager Skip",
    "description": "Skip manager approval for VPs",
    "match_type": "designation",
    "designations": ["VP", "SVP", "EVP"],
    "skip_manager_approval": true,
    "skip_hr_approval": false,
    "skip_finance_approval": false,
    "max_amount_threshold": 50000,
    "category_codes": [],
    "priority": 10,
    "is_active": true
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rule_name` | string | Yes | Unique name for the rule (per tenant) |
| `description` | string | No | Human-readable description |
| `match_type` | string | Yes | `designation`, `email`, or `project` |
| `designations` | array | No* | List of designation codes to match |
| `emails` | array | No* | List of email addresses to match |
| `project_codes` | array | No* | List of project codes to match |
| `skip_manager_approval` | boolean | No | Skip manager level (default: false) |
| `skip_hr_approval` | boolean | No | Skip HR level (default: false) |
| `skip_finance_approval` | boolean | No | Skip finance level (default: false) |
| `max_amount_threshold` | number | No | Max claim amount for rule to apply (null = no limit) |
| `category_codes` | array | No | Claim categories this applies to (empty = all) |
| `priority` | integer | No | Lower = higher priority (default: 100) |
| `is_active` | boolean | No | Enable/disable rule (default: true) |

*Required based on match_type: designations required if match_type is "designation", emails required if match_type is "email", project_codes required if match_type is "project"

**Response:** `201 Created`
```json
{
    "id": "uuid",
    "rule_name": "VP Manager Skip",
    "match_type": "designation",
    "designations": ["VP", "SVP", "EVP"],
    "skip_manager_approval": true,
    "skip_hr_approval": false,
    "skip_finance_approval": false,
    "max_amount_threshold": 50000,
    "priority": 10,
    "is_active": true,
    "created_at": "2024-12-20T10:30:00Z"
}
```

### 10.5.3 Get Approval Skip Rule

```http
GET /api/v1/approval-skip-rules/{rule_id}
Authorization: Bearer {token}
```

**Response:** `200 OK` - Same structure as create response

### 10.5.4 Update Approval Skip Rule

```http
PUT /api/v1/approval-skip-rules/{rule_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "rule_name": "VP Manager Skip Updated",
    "max_amount_threshold": 75000,
    "priority": 5
}
```

**Response:** `200 OK` - Updated rule object

### 10.5.5 Delete Approval Skip Rule

```http
DELETE /api/v1/approval-skip-rules/{rule_id}
Authorization: Bearer {token}
```

**Response:** `204 No Content`

### 10.5.6 Check Applicable Rules for User

Check which approval skip rules apply to a specific user.

```http
GET /api/v1/approval-skip-rules/check/{user_id}
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `amount` | number | Claim amount to check against thresholds (optional) |
| `category` | string | Claim category code (optional) |

**Response:**
```json
{
    "user_id": "uuid",
    "user_email": "ceo@company.com",
    "user_designation": "CEO",
    "applicable_rules": [
        {
            "rule_id": "uuid",
            "rule_name": "CEO Fast Track",
            "skip_manager_approval": true,
            "skip_hr_approval": true,
            "skip_finance_approval": true,
            "priority": 1
        }
    ],
    "effective_skips": {
        "skip_manager": true,
        "skip_hr": true,
        "skip_finance": true
    }
}
```

### 10.5.7 Bulk Update Rule Status

Enable or disable multiple rules at once.

```http
PATCH /api/v1/approval-skip-rules/bulk-status
Authorization: Bearer {token}
Content-Type: application/json

{
    "rule_ids": ["uuid1", "uuid2"],
    "is_active": false
}
```

**Response:** `200 OK`
```json
{
    "updated_count": 2,
    "rules": [...]
}
```

---

## 11. Error Responses

### 11.1 Error Format

```json
{
    "detail": "Error message",
    "error_code": "CLAIM_NOT_FOUND",
    "request_id": "uuid"
}
```

### 11.2 Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate or conflict |
| 422 | Unprocessable | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |

---

## 12. System Administration API

### 12.1 Get System Info

Returns system status including database and cache connection information. Available to System Admin only.

```http
GET /api/v1/system/info
Authorization: Bearer {token}
```

**Response:**
```json
{
    "database": {
        "type": "PostgreSQL 15.13",
        "host": "localhost",
        "port": "5432",
        "name": "reimbursement_db",
        "connected": true
    },
    "cache": {
        "host": "localhost",
        "port": "6379",
        "connected": true,
        "memory_used": "1.2MB"
    },
    "app": {
        "name": "Easy Qlaim",
        "environment": "development",
        "version": "1.0.0"
    }
}
```

---

## 13. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 10 | 1 minute |
| `/documents/upload` | 20 | 1 minute |
| `/reports/*` | 10 | 1 minute |
| Default | 60 | 1 minute |

---

## 14. Webhooks (Optional)

### 14.1 Webhook Events

| Event | Description |
|-------|-------------|
| `claim.created` | New claim submitted |
| `claim.approved` | Claim approved |
| `claim.rejected` | Claim rejected |
| `claim.settled` | Payment processed |

### 14.2 Webhook Payload

```json
{
    "event": "claim.approved",
    "timestamp": "2024-12-15T10:30:00Z",
    "data": {
        "claim_id": "uuid",
        "claim_number": "CLM-2024-0001",
        "status": "MANAGER_APPROVED"
    }
}
```

---

## 15. Integrations API

The Integrations API provides endpoints for managing third-party integrations including API keys, webhooks, SSO, HRMS, ERP, and communication platforms.

### 15.1 Integrations Overview

Get a summary of all configured integrations for a tenant.

```http
GET /api/v1/integrations/overview?tenant_id={tenant_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
    "api_keys": {
        "active_count": 2,
        "configured": true
    },
    "webhooks": {
        "active_count": 1,
        "configured": true
    },
    "sso": {
        "configured": true,
        "provider": "azure_ad",
        "is_active": true
    },
    "hrms": {
        "configured": true,
        "provider": "workday",
        "is_active": true,
        "last_sync": "2025-12-20T10:00:00Z"
    },
    "erp": {
        "configured": false,
        "provider": null,
        "is_active": false,
        "last_export": null
    },
    "communication": {
        "configured_providers": ["slack"],
        "active_count": 1
    }
}
```

### 15.2 API Keys

#### List API Keys

```http
GET /api/v1/integrations/api-keys?tenant_id={tenant_id}
Authorization: Bearer {token}
```

#### Create API Key

```http
POST /api/v1/integrations/api-keys?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "name": "External System Integration",
    "description": "API key for external HR system",
    "permissions": ["read", "write"],
    "rate_limit": 1000,
    "expires_at": "2026-12-31T23:59:59Z"
}
```

**Response:**
```json
{
    "id": "uuid",
    "name": "External System Integration",
    "description": "API key for external HR system",
    "key_prefix": "AzGBtWwW",
    "permissions": ["read", "write"],
    "rate_limit": 1000,
    "is_active": true,
    "expires_at": "2026-12-31T23:59:59Z",
    "created_at": "2025-12-20T15:40:10Z",
    "api_key": "AzGBtWwW2iaoFN47jcnGyMUu0nzNycz-QUeoi7zRlbo"
}
```

> **Note:** The full `api_key` is only returned at creation time. Store it securely.

#### Regenerate API Key

```http
POST /api/v1/integrations/api-keys/{key_id}/regenerate?tenant_id={tenant_id}
Authorization: Bearer {token}
```

#### Delete API Key

```http
DELETE /api/v1/integrations/api-keys/{key_id}?tenant_id={tenant_id}
Authorization: Bearer {token}
```

### 15.3 Webhooks

#### List Webhooks

```http
GET /api/v1/integrations/webhooks?tenant_id={tenant_id}
Authorization: Bearer {token}
```

#### Create Webhook

```http
POST /api/v1/integrations/webhooks?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "name": "Claim Notification Webhook",
    "url": "https://external-system.com/webhook",
    "events": ["claim.created", "claim.approved", "claim.rejected", "claim.settled"],
    "auth_type": "bearer",
    "auth_config": {
        "token": "secret-token"
    },
    "retry_count": 3,
    "retry_delay_seconds": 60
}
```

#### Test Webhook

```http
POST /api/v1/integrations/webhooks/{webhook_id}/test?tenant_id={tenant_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
    "success": true,
    "status_code": 200,
    "duration_ms": 245
}
```

### 15.4 SSO Configuration

#### Get SSO Config

```http
GET /api/v1/integrations/sso?tenant_id={tenant_id}
Authorization: Bearer {token}
```

#### Create/Update SSO Config

```http
POST /api/v1/integrations/sso?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "provider": "azure_ad",
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "issuer_url": "https://login.microsoftonline.com/{tenant}/v2.0",
    "auto_provision_users": true,
    "sync_user_attributes": true,
    "is_active": true
}
```

### 15.5 HRMS Integration

#### Get HRMS Config

```http
GET /api/v1/integrations/hrms?tenant_id={tenant_id}
Authorization: Bearer {token}
```

#### Create HRMS Config

```http
POST /api/v1/integrations/hrms?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "provider": "workday",
    "api_url": "https://wd3-services.workday.com/api/v1",
    "api_key": "your-api-key",
    "sync_enabled": true,
    "sync_frequency": "daily",
    "sync_employees": true,
    "sync_departments": true,
    "sync_managers": true,
    "is_active": true
}
```

#### Trigger HRMS Sync

```http
POST /api/v1/integrations/hrms/sync?tenant_id={tenant_id}
Authorization: Bearer {token}
```

### 15.6 ERP Integration

#### Get ERP Config

```http
GET /api/v1/integrations/erp?tenant_id={tenant_id}
Authorization: Bearer {token}
```

#### Create ERP Config

```http
POST /api/v1/integrations/erp?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "provider": "sap",
    "api_url": "https://sap-server.example.com/api",
    "api_key": "your-api-key",
    "company_code": "1000",
    "cost_center": "CC001",
    "export_enabled": true,
    "export_frequency": "daily",
    "export_format": "json",
    "auto_export_on_settlement": true,
    "is_active": true
}
```

#### Trigger ERP Export

```http
POST /api/v1/integrations/erp/export?tenant_id={tenant_id}
Authorization: Bearer {token}
```

### 15.7 Communication Integration (Slack/Teams)

#### List Communication Configs

```http
GET /api/v1/integrations/communication?tenant_id={tenant_id}
Authorization: Bearer {token}
```

#### Create Slack Config

```http
POST /api/v1/integrations/communication?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "provider": "slack",
    "slack_workspace_id": "T0123456789",
    "slack_bot_token": "xoxb-your-bot-token",
    "slack_channel_id": "C0123456789",
    "notify_on_claim_submitted": true,
    "notify_on_claim_approved": true,
    "notify_on_claim_rejected": true,
    "notify_on_claim_settled": true,
    "notify_managers": true,
    "notify_finance": true,
    "is_active": true
}
```

#### Create Teams Config

```http
POST /api/v1/integrations/communication?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "provider": "microsoft_teams",
    "teams_tenant_id": "your-teams-tenant-id",
    "teams_webhook_url": "https://outlook.office.com/webhook/...",
    "teams_channel_id": "19:abc123@thread.tacv2",
    "notify_on_claim_submitted": true,
    "notify_on_claim_approved": true,
    "notify_on_claim_rejected": true,
    "is_active": true
}
```

#### Test Communication

```http
POST /api/v1/integrations/communication/{provider}/test?tenant_id={tenant_id}
Authorization: Bearer {token}
```

---

*Document Version: 1.3 | Last Updated: December 2025*
