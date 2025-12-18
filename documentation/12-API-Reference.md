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

## 7. Dashboard API

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

## 10. Error Responses

### 10.1 Error Format

```json
{
    "detail": "Error message",
    "error_code": "CLAIM_NOT_FOUND",
    "request_id": "uuid"
}
```

### 10.2 Common Error Codes

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

## 11. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 10 | 1 minute |
| `/documents/upload` | 20 | 1 minute |
| `/reports/*` | 10 | 1 minute |
| Default | 60 | 1 minute |

---

## 12. Webhooks (Optional)

### 12.1 Webhook Events

| Event | Description |
|-------|-------------|
| `claim.created` | New claim submitted |
| `claim.approved` | Claim approved |
| `claim.rejected` | Claim rejected |
| `claim.settled` | Payment processed |

### 12.2 Webhook Payload

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

*Document Version: 1.0 | Last Updated: December 2024*
