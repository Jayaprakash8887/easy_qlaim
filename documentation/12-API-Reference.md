# API Reference Guide

## Easy Qlaim - REST API Documentation

### 1. Overview

Easy Qlaim provides a comprehensive REST API for all operations. The API follows RESTful conventions and uses JSON for request/response payloads.

**Base URL:** `http://localhost:8000/api/v1`  
**Production:** `https://api.easyqlaim.example.com/api/v1`

---

## 2. Authentication (`/api/v1/auth`)

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
Content-Type: application/json

{
    "refresh_token": "{refresh_token}"
}
```

### 2.3 Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer {token}
```

### 2.4 Get Current User Info

```http
GET /api/v1/auth/user-info
Authorization: Bearer {token}
```

### 2.5 Verify Token

```http
GET /api/v1/auth/verify
Authorization: Bearer {token}
```

### 2.6 Using Authentication

Include the access token in all subsequent requests:
```http
Authorization: Bearer {access_token}
```

---

## 3. Claims API (`/api/v1/claims`)

### 3.1 Create Claim

```http
POST /api/v1/claims
Authorization: Bearer {token}
Content-Type: application/json

{
    "claim_type": "REIMBURSEMENT",
    "category": "CERTIFICATION",
    "amount": 5000.00,
    "claim_date": "2024-12-01",
    "description": "AWS Solutions Architect exam fee",
    "claim_payload": {
        "exam_name": "AWS Solutions Architect Professional"
    },
    "project_code": "PRJ-001"
}
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
    "submission_date": "2024-12-15T10:30:00Z",
    "employee_id": "uuid",
    "employee_name": "John Doe"
}
```

### 3.2 Batch Create Claims

```http
POST /api/v1/claims/batch
Authorization: Bearer {token}
Content-Type: application/json

{
    "employee_id": "uuid",
    "claim_type": "REIMBURSEMENT",
    "project_code": "PRJ-001",
    "claims": [
        {
            "category": "TRAVEL",
            "amount": 1500.00,
            "claim_date": "2024-12-01",
            "title": "Flight to Bangalore",
            "vendor": "IndiGo Airlines"
        },
        {
            "category": "TRAVEL",
            "amount": 800.00,
            "claim_date": "2024-12-01",
            "title": "Hotel stay",
            "vendor": "Taj Hotels"
        }
    ]
}
```

### 3.3 Batch Create with Document

```http
POST /api/v1/claims/batch-with-document
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

### 3.4 Submit Claim for Processing

```http
POST /api/v1/claims/{claim_id}/submit
Authorization: Bearer {token}
```

### 3.5 List Claims

```http
GET /api/v1/claims?status=PENDING_MANAGER&category=CERTIFICATION&skip=0&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by claim status |
| category | string | Filter by category |
| skip | int | Offset (default: 0) |
| limit | int | Items per page (default: 20) |

### 3.6 Get Claim Detail

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
    "employee_id": "uuid",
    "employee_name": "John Doe",
    "department": "Engineering",
    "documents": [...],
    "approvals": [...],
    "comments": [...],
    "claim_payload": {
        "validation": {
            "confidence": 0.92,
            "recommendation": "APPROVE"
        }
    },
    "return_count": 0,
    "can_edit": false,
    "settled": false,
    "project_name": "Project Alpha"
}
```

### 3.7 Update Claim

```http
PUT /api/v1/claims/{claim_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "amount": 4500.00,
    "description": "Updated description"
}
```

### 3.8 HR Edit Claim

```http
PUT /api/v1/claims/{claim_id}/hr-edit
Authorization: Bearer {token}
Content-Type: application/json

{
    "amount": 4000.00,
    "description": "Corrected amount per policy"
}
```

### 3.9 Delete Claim

```http
DELETE /api/v1/claims/{claim_id}
Authorization: Bearer {token}
```

### 3.10 Return Claim to Employee

```http
POST /api/v1/claims/{claim_id}/return
Authorization: Bearer {token}
Content-Type: application/json

{
    "return_reason": "Missing receipt. Please attach the original receipt and resubmit.",
    "approver_id": "uuid",
    "approver_name": "Manager Name",
    "approver_role": "MANAGER"
}
```

### 3.11 Approve Claim

```http
POST /api/v1/claims/{claim_id}/approve
Authorization: Bearer {token}
Content-Type: application/json

{
    "notes": "Approved. Valid certification expense."
}
```

### 3.12 Reject Claim

```http
POST /api/v1/claims/{claim_id}/reject
Authorization: Bearer {token}
Content-Type: application/json

{
    "reason": "Amount exceeds policy limit"
}
```

### 3.13 Settle Claim

```http
POST /api/v1/claims/{claim_id}/settle
Authorization: Bearer {token}
Content-Type: application/json

{
    "claim_id": "uuid",
    "payment_reference": "NEFT-2024-12345",
    "payment_method": "NEFT",
    "amount_paid": 5000.00,
    "settlement_notes": "Processed via December payroll"
}
```

**Payment Methods:** `NEFT`, `RTGS`, `CHEQUE`, `CASH`, `UPI`

### 3.14 Check Duplicate

```http
POST /api/v1/claims/check-duplicate
Authorization: Bearer {token}
Content-Type: application/json

{
    "employee_id": "uuid",
    "amount": 5000.00,
    "category": "CERTIFICATION",
    "claim_date": "2024-12-01"
}
```

---

## 4. Documents API (`/api/v1/documents`)

### 4.1 Upload Document

```http
POST /api/v1/documents/upload/{claim_id}
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: <binary>
```

**Response:**
```json
{
    "id": "uuid",
    "filename": "receipt.pdf",
    "file_type": "application/pdf",
    "file_size": 123456,
    "storage_path": "claims/uuid/receipt.pdf",
    "ocr_processed": false,
    "uploaded_at": "2024-12-15T10:30:00Z"
}
```

### 4.2 List Documents

```http
GET /api/v1/documents?claim_id={claim_id}
Authorization: Bearer {token}
```

### 4.3 Get Document Details

```http
GET /api/v1/documents/{document_id}
Authorization: Bearer {token}
```

### 4.4 View/Download Document

```http
GET /api/v1/documents/{document_id}/view
Authorization: Bearer {token}
```

Returns file content directly for local storage, or signed URL for cloud storage.

### 4.5 Get Signed URL (GCS)

```http
GET /api/v1/documents/{document_id}/signed-url
Authorization: Bearer {token}
```

### 4.6 Download Document

```http
GET /api/v1/documents/{document_id}/download
Authorization: Bearer {token}
```

### 4.7 Delete Document

```http
DELETE /api/v1/documents/{document_id}
Authorization: Bearer {token}
```

### 4.8 Process OCR

```http
POST /api/v1/documents/ocr
Authorization: Bearer {token}
Content-Type: application/json

{
    "document_id": "uuid"
}
```

---

## 5. Approvals API (`/api/v1/approvals`)

### 5.1 List Approvals

```http
GET /api/v1/approvals?claim_id={claim_id}&status=PENDING
Authorization: Bearer {token}
```

### 5.2 Get Pending Approvals

```http
GET /api/v1/approvals/pending
Authorization: Bearer {token}
```

**Response:**
```json
[
    {
        "id": "uuid",
        "claim_id": "uuid",
        "approval_stage": "MANAGER",
        "status": "PENDING",
        "created_at": "2024-12-15T10:30:00Z"
    }
]
```

### 5.3 Get Approval Details

```http
GET /api/v1/approvals/{approval_id}
Authorization: Bearer {token}
```

### 5.4 Create Approval

```http
POST /api/v1/approvals
Authorization: Bearer {token}
Content-Type: application/json

{
    "claim_id": "uuid",
    "approval_stage": "MANAGER",
    "approver_id": "uuid"
}
```

### 5.5 Update Approval

```http
PUT /api/v1/approvals/{approval_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "status": "APPROVED",
    "notes": "Approved. Valid expense."
}
```

---

## 6. Comments API (`/api/v1/comments`)

### 6.1 List Comments

```http
GET /api/v1/comments?claim_id={claim_id}
Authorization: Bearer {token}
```

### 6.2 Get Comment

```http
GET /api/v1/comments/{comment_id}
Authorization: Bearer {token}
```

### 6.3 Add Comment

```http
POST /api/v1/comments
Authorization: Bearer {token}
Content-Type: application/json

{
    "claim_id": "uuid",
    "comment_text": "Please clarify the exam date",
    "comment_type": "GENERAL",
    "visible_to_employee": true
}
```

### 6.4 Update Comment

```http
PUT /api/v1/comments/{comment_id}
Authorization: Bearer {token}
```

### 6.5 Delete Comment

```http
DELETE /api/v1/comments/{comment_id}
Authorization: Bearer {token}
```

---

## 7. Employees API (`/api/v1/employees`)

### 7.1 List Employees

```http
GET /api/v1/employees?search=john&skip=0&limit=20
Authorization: Bearer {token}
```

### 7.2 Get Employee Details

```http
GET /api/v1/employees/{employee_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
    "id": "uuid",
    "employee_code": "EMP001",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "department": "Engineering",
    "designation": "Senior Engineer",
    "roles": ["EMPLOYEE"],
    "region": ["INDIA"],
    "date_of_joining": "2020-01-15"
}
```

### 7.3 Create Employee

```http
POST /api/v1/employees
Authorization: Bearer {token}
Content-Type: application/json

{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "department": "Engineering",
    "designation": "Engineer",
    "region": ["INDIA"],
    "date_of_joining": "2024-01-01",
    "manager_id": "uuid"
}
```

### 7.4 Update Employee

```http
PUT /api/v1/employees/{employee_id}
Authorization: Bearer {token}
```

### 7.5 Delete Employee

```http
DELETE /api/v1/employees/{employee_id}
Authorization: Bearer {token}
```

### 7.6 Employee Project History

```http
GET /api/v1/employees/{employee_id}/project-history
Authorization: Bearer {token}
```

### 7.7 Allocate Employee to Project

```http
POST /api/v1/employees/{employee_id}/allocate-project
Authorization: Bearer {token}
Content-Type: application/json

{
    "project_id": "uuid",
    "role": "Developer",
    "allocation_percentage": 100
}
```

### 7.8 Deallocate Employee from Project

```http
PUT /api/v1/employees/{employee_id}/deallocate-project/{project_id}
Authorization: Bearer {token}
```

### 7.9 Get Current Projects

```http
GET /api/v1/employees/{employee_id}/current-projects
Authorization: Bearer {token}
```

---

## 8. Projects API (`/api/v1/projects`)

### 8.1 Get All Project Members

```http
GET /api/v1/projects/members/all
Authorization: Bearer {token}
```

### 8.2 List Projects

```http
GET /api/v1/projects
Authorization: Bearer {token}
```

### 8.3 Get Project Details

```http
GET /api/v1/projects/{project_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
    "id": "uuid",
    "project_code": "PRJ-001",
    "project_name": "Project Alpha",
    "description": "Main product development",
    "budget_allocated": 500000.00,
    "budget_spent": 120000.00,
    "budget_available": 380000.00,
    "status": "ACTIVE",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "ibu_id": "uuid",
    "ibu_name": "Digital Services"
}
```

### 8.4 Create Project

```http
POST /api/v1/projects
Authorization: Bearer {token}
Content-Type: application/json

{
    "project_code": "PRJ-002",
    "project_name": "New Project",
    "budget_allocated": 200000.00,
    "manager_id": "uuid",
    "ibu_id": "uuid"
}
```

### 8.5 Update Project

```http
PUT /api/v1/projects/{project_id}
Authorization: Bearer {token}
```

### 8.6 Delete Project

```http
DELETE /api/v1/projects/{project_id}
Authorization: Bearer {token}
```

### 8.7 Get Project Members

```http
GET /api/v1/projects/{project_id}/members
Authorization: Bearer {token}
```

---

## 9. IBUs (Business Units) API (`/api/v1/ibus`)

### 9.1 List IBUs

```http
GET /api/v1/ibus
Authorization: Bearer {token}
```

### 9.2 Get IBU Details

```http
GET /api/v1/ibus/{ibu_id}
Authorization: Bearer {token}
```

### 9.3 Create IBU

```http
POST /api/v1/ibus
Authorization: Bearer {token}
Content-Type: application/json

{
    "code": "IBU-DS",
    "name": "Digital Services",
    "description": "Digital transformation unit",
    "head_id": "uuid",
    "annual_budget": 5000000.00
}
```

### 9.4 Update IBU

```http
PUT /api/v1/ibus/{ibu_id}
Authorization: Bearer {token}
```

### 9.5 Delete IBU

```http
DELETE /api/v1/ibus/{ibu_id}
Authorization: Bearer {token}
```

### 9.6 Get IBU Projects

```http
GET /api/v1/ibus/{ibu_id}/projects
Authorization: Bearer {token}
```

### 9.7 Get IBU Summary

```http
GET /api/v1/ibus/{ibu_id}/summary
Authorization: Bearer {token}
```

---

## 10. Dashboard API (`/api/v1/dashboard`)

### 10.1 Dashboard Summary

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
    }
}
```

### 10.2 Available Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /dashboard/summary` | Overall dashboard summary |
| `GET /dashboard/claims-by-status` | Claims grouped by status |
| `GET /dashboard/claims-by-category` | Claims grouped by category |
| `GET /dashboard/recent-activity` | Recent claim activities |
| `GET /dashboard/ai-metrics` | AI agent performance metrics |
| `GET /dashboard/pending-approvals` | Pending approvals summary |
| `GET /dashboard/hr-metrics` | HR analytics |
| `GET /dashboard/finance-metrics` | Finance analytics |
| `GET /dashboard/admin-stats` | Admin statistics |
| `GET /dashboard/allowance-summary` | Allowance claims summary |
| `GET /dashboard/claims-by-project` | Claims grouped by project |
| `GET /dashboard/settlement-analytics` | Settlement analytics |
| `GET /dashboard/pending-settlements` | Pending settlement claims |
| `GET /dashboard/claims-trend` | Claims trend over time |
| `GET /dashboard/expense-breakdown` | Expense category breakdown |
| `GET /dashboard/top-claimants` | Top claiming employees |

---

## 11. Policies API (`/api/v1/policies`)

### 11.1 Upload Policy Document

```http
POST /api/v1/policies/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: <binary>
policy_name: "Travel Policy 2025"
region: ["INDIA"]
```

### 11.2 List Policies

```http
GET /api/v1/policies
Authorization: Bearer {token}
```

### 11.3 Get Policy Details

```http
GET /api/v1/policies/{policy_id}
Authorization: Bearer {token}
```

### 11.4 Get Extracted Claims

```http
GET /api/v1/policies/extracted-claims
Authorization: Bearer {token}
```

### 11.5 Re-extract Policy

```http
POST /api/v1/policies/{policy_id}/reextract
Authorization: Bearer {token}
```

### 11.6 Create New Policy Version

```http
POST /api/v1/policies/{policy_id}/new-version
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: <binary>
```

### 11.7 Get Policy Categories

```http
GET /api/v1/policies/{policy_id}/categories
Authorization: Bearer {token}
```

### 11.8 Update Policy Category

```http
PUT /api/v1/policies/categories/{category_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "max_amount": 30000.00,
    "frequency_limit": "YEARLY",
    "requires_receipt": true
}
```

### 11.9 Approve Policy

```http
POST /api/v1/policies/{policy_id}/approve
Authorization: Bearer {token}
```

### 11.10 Reject Policy

```http
POST /api/v1/policies/{policy_id}/reject
Authorization: Bearer {token}
Content-Type: application/json

{
    "review_notes": "Categories need revision"
}
```

### 11.11 Get Active Categories

```http
GET /api/v1/policies/categories/active?region=INDIA&category_type=REIMBURSEMENT
Authorization: Bearer {token}
```

### 11.12 Validate Claim Against Policies

```http
POST /api/v1/policies/validate-claim
Authorization: Bearer {token}
```

### 11.13 Policy Audit Logs

```http
GET /api/v1/policies/audit-logs
Authorization: Bearer {token}
```

### 11.14 Embedding Management

```http
POST /api/v1/policies/embeddings/refresh/{region}
GET /api/v1/policies/embeddings/stats
POST /api/v1/policies/embeddings/invalidate
POST /api/v1/policies/embeddings/match
```

---

## 12. Notifications API (`/api/v1/notifications`)

### 12.1 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications` | List notifications |
| `GET` | `/notifications/summary` | Get count summary |
| `POST` | `/notifications/{id}/read` | Mark as read |
| `POST` | `/notifications/{id}/unread` | Mark as unread |
| `POST` | `/notifications/mark-all-read` | Mark all as read |
| `POST` | `/notifications/mark-bulk-read` | Mark multiple as read |
| `DELETE` | `/notifications/{id}` | Delete notification |
| `POST` | `/notifications/clear-all` | Clear all notifications |
| `POST` | `/notifications/clear-bulk` | Clear multiple |
| `POST` | `/notifications` | Create notification |
| `POST` | `/notifications/generate-from-claim/{claim_id}` | Generate for claim |
| `POST` | `/notifications/notify-approvers/{claim_id}` | Notify approvers |

---

## 13. Settings API (`/api/v1/settings`)

### 13.1 Get General Settings

```http
GET /api/v1/settings/general?tenant_id={tenant_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
    "ai_processing": true,
    "enable_auto_approval": true,
    "auto_skip_after_manager": true,
    "auto_approval_threshold": 95,
    "max_auto_approval_amount": 5000,
    "policy_compliance_threshold": 80,
    "default_currency": "inr",
    "fiscal_year_start": "apr",
    "timezone": "IST",
    "date_format": "DD/MM/YYYY",
    "number_format": "en-IN",
    "working_days": "mon-fri",
    "week_start": "monday",
    "session_timeout": "480"
}
```

### 13.2 Update General Settings

```http
PUT /api/v1/settings/general?tenant_id={tenant_id}
Authorization: Bearer {token}
Content-Type: application/json

{
    "timezone": "UTC",
    "enable_auto_approval": true,
    "auto_approval_threshold": 90
}
```

### 13.3 Other Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/settings/{key}` | Get specific setting |
| `PUT` | `/settings/{key}` | Update specific setting |
| `GET` | `/settings` | Get all settings |
| `GET` | `/settings/timezones/available` | Available timezones |
| `GET` | `/settings/date-formats/available` | Available date formats |
| `GET` | `/settings/number-formats/available` | Available number formats |
| `GET` | `/settings/working-days/available` | Available working days |
| `GET` | `/settings/week-start/available` | Available week start options |
| `GET` | `/settings/session-timeout/available` | Available timeouts |
| `GET` | `/settings/options/all` | All setting options |

---

## 14. Regions API (`/api/v1/regions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/regions` | List regions |
| `POST` | `/regions` | Create region |
| `PUT` | `/regions/{region_id}` | Update region |
| `DELETE` | `/regions/{region_id}` | Delete region |

---

## 15. Custom Claims API (`/api/v1/custom-claims`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/custom-claims` | Create custom claim template |
| `GET` | `/custom-claims` | List custom claims |
| `GET` | `/custom-claims/{id}` | Get details |
| `PUT` | `/custom-claims/{id}` | Update |
| `DELETE` | `/custom-claims/{id}` | Delete |
| `POST` | `/custom-claims/{id}/toggle-status` | Toggle active status |

---

## 16. Designations API (`/api/v1/designations`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/designations/available-roles` | Get available roles |
| `GET` | `/designations` | List designations |
| `POST` | `/designations` | Create designation |
| `GET` | `/designations/{id}` | Get details |
| `PUT` | `/designations/{id}` | Update |
| `DELETE` | `/designations/{id}` | Delete |
| `GET` | `/designations/{id}/roles` | Get role mappings |
| `POST` | `/designations/{id}/roles` | Add role |
| `DELETE` | `/designations/{id}/roles/{role}` | Remove role |
| `PUT` | `/designations/{id}/roles` | Update roles |

---

## 17. Tenants API — System Admin (`/api/v1/tenants`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tenants` | List tenants |
| `POST` | `/tenants` | Create tenant |
| `GET` | `/tenants/{id}` | Get details |
| `PUT` | `/tenants/{id}` | Update |
| `DELETE` | `/tenants/{id}` | Delete |

---

## 18. Branding API — System Admin (`/api/v1/branding`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/branding/specs` | Get branding specifications |
| `GET` | `/branding/{tenant_id}` | Get tenant branding |
| `POST` | `/branding/{tenant_id}/upload/{file_type}` | Upload branding file (logo, favicon, login-background) |
| `DELETE` | `/branding/{tenant_id}/files/{file_type}` | Delete branding file |
| `PUT` | `/branding/{tenant_id}/colors` | Update brand colors |
| `PUT` | `/branding/{tenant_id}/settings` | Update branding settings |
| `GET` | `/branding/{tenant_id}/preview` | Get branding preview |
| `GET` | `/branding/files/{tenant_id}/{filename}` | Get branding file |

---

## 19. Integrations API — System Admin (`/api/v1/integrations`)

### 19.1 Overview

```http
GET /api/v1/integrations/overview?tenant_id={tenant_id}
Authorization: Bearer {token}
```

### 19.2 API Keys

| Method | Endpoint |
|--------|----------|
| `GET` | `/integrations/api-keys` |
| `POST` | `/integrations/api-keys` |
| `GET` | `/integrations/api-keys/{key_id}` |
| `PUT` | `/integrations/api-keys/{key_id}` |
| `DELETE` | `/integrations/api-keys/{key_id}` |
| `POST` | `/integrations/api-keys/{key_id}/regenerate` |

### 19.3 Webhooks

| Method | Endpoint |
|--------|----------|
| `GET` | `/integrations/webhooks` |
| `POST` | `/integrations/webhooks` |
| `GET` | `/integrations/webhooks/{webhook_id}` |
| `PUT` | `/integrations/webhooks/{webhook_id}` |
| `DELETE` | `/integrations/webhooks/{webhook_id}` |
| `GET` | `/integrations/webhooks/{webhook_id}/logs` |
| `POST` | `/integrations/webhooks/{webhook_id}/test` |

### 19.4 SSO Configuration

| Method | Endpoint |
|--------|----------|
| `GET` | `/integrations/sso` |
| `POST` | `/integrations/sso` |
| `PUT` | `/integrations/sso` |
| `DELETE` | `/integrations/sso` |

### 19.5 HRMS Integration

| Method | Endpoint |
|--------|----------|
| `GET` | `/integrations/hrms` |
| `POST` | `/integrations/hrms` |
| `PUT` | `/integrations/hrms` |
| `DELETE` | `/integrations/hrms` |
| `POST` | `/integrations/hrms/sync` |

### 19.6 ERP Integration

| Method | Endpoint |
|--------|----------|
| `GET` | `/integrations/erp` |
| `POST` | `/integrations/erp` |
| `PUT` | `/integrations/erp` |
| `DELETE` | `/integrations/erp` |
| `POST` | `/integrations/erp/export` |

### 19.7 Communication (Slack/Teams)

| Method | Endpoint |
|--------|----------|
| `GET` | `/integrations/communication` |
| `GET` | `/integrations/communication/{provider}` |
| `POST` | `/integrations/communication` |
| `PUT` | `/integrations/communication/{provider}` |
| `DELETE` | `/integrations/communication/{provider}` |
| `POST` | `/integrations/communication/{provider}/test` |

---

## 20. Cache Management API (`/api/v1/cache`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/cache/health` | Cache health check |
| `GET` | `/cache/stats` | Cache statistics |
| `POST` | `/cache/invalidate/projects` | Invalidate project cache |
| `POST` | `/cache/invalidate/employees` | Invalidate employee cache |

---

## 21. System Endpoints

### 21.1 Health Check

```http
GET /health
```

### 21.2 System Info

```http
GET /api/v1/system/info
Authorization: Bearer {token}
```

---

## 22. Claim Status Values

| Status | Description |
|--------|-------------|
| `AI_PROCESSING` | AI agents actively processing |
| `PENDING_MANAGER` | Awaiting manager approval |
| `RETURNED_TO_EMPLOYEE` | Returned for correction |
| `MANAGER_APPROVED` | Manager has approved |
| `PENDING_HR` | Awaiting HR review (policy exceptions) |
| `HR_APPROVED` | HR has approved |
| `PENDING_FINANCE` | Awaiting finance settlement |
| `FINANCE_APPROVED` | Ready for payment / auto-approved |
| `SETTLED` | Payment complete |
| `REJECTED` | Claim declined |

---

## 23. Error Responses

### Error Format

```json
{
    "detail": "Error message",
    "error_code": "CLAIM_NOT_FOUND",
    "request_id": "uuid"
}
```

### Common Error Codes

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

## 24. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 60 | 1 minute |
| `/auth/register` | 30 | 1 minute |
| `/documents/upload` | 100 | 1 minute |
| `/reports/*` | 60 | 1 minute |
| Default | 60 | 1 minute |

> **Note:** Rate limiting is disabled in development mode.

---

*Document Version: 2.0 | Last Updated: May 2026*
