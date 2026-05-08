# Database Schema Reference

## Easy Qlaim - Database Design

### 1. Overview

Easy Qlaim uses PostgreSQL 15+ with multi-tenant row-level isolation. All core tables include a `tenant_id` column for data segregation.

---

## 2. Core Schema Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│     Tenant      │      │      User       │      │   Designation   │
├─────────────────┤      ├─────────────────┤      ├─────────────────┤
│ id (PK)         │◄─────│ tenant_id       │      │ id (PK)         │
│ name            │      │ id (PK)         │      │ tenant_id (FK)  │
│ code            │      │ username        │      │ name            │
│ domain          │      │ email           │      │ code            │
│ settings (JSON) │      │ employee_code   │      │ level           │
│ is_active       │      │ first_name      │      │ is_active       │
│ created_at      │      │ last_name       │      │ created_at      │
│ updated_at      │      │ roles ARRAY     │      │ updated_at      │
└─────────────────┘      │ region ARRAY    │      └─────────────────┘
         │               │ manager_id (FK) │               │
         │               │ designation     │               │
         │               └─────────────────┘               │
         │                        │                        │
         │                        ▼                        │
         │               ┌─────────────────┐               │
         │               │      Claim      │               │
         │               ├─────────────────┤               │
         └──────────────►│ tenant_id       │◄──────────────┘
                         │ id (PK)         │
                         │ claim_number    │
                         │ employee_id(FK) │
                         │ status          │
                         │ claim_type      │
                         │ category        │
                         │ amount          │
                         │ currency        │
                         │ claim_payload   │
                         │ return_count    │
                         │ settled         │
                         │ payment_method  │
                         └─────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Document     │      │    Approval     │      │    Comment      │
├─────────────────┤      ├─────────────────┤      ├─────────────────┤
│ id (PK)         │      │ id (PK)         │      │ id (PK)         │
│ tenant_id       │      │ tenant_id       │      │ tenant_id       │
│ claim_id (FK)   │      │ claim_id (FK)   │      │ claim_id (FK)   │
│ filename        │      │ approver_id     │      │ user_id (FK)    │
│ storage_path    │      │ approval_stage  │      │ comment_text    │
│ storage_type    │      │ status          │      │ comment_type    │
│ ocr_data (JSON) │      │ notes           │      │ visible_to_     │
│ ocr_processed   │      │ decision_date   │      │   employee      │
│ uploaded_at     │      │ created_at      │      │ created_at      │
└─────────────────┘      └─────────────────┘      └─────────────────┘

┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│       IBU       │      │     Project     │      │ EmployeeProject │
├─────────────────┤      ├─────────────────┤      │   Allocation    │
│ id (PK)         │      │ id (PK)         │      ├─────────────────┤
│ tenant_id       │      │ tenant_id       │      │ id (PK)         │
│ code            │◄─────│ ibu_id (FK)     │      │ employee_id(FK) │
│ name            │      │ project_code    │      │ project_id (FK) │
│ head_id (FK)    │      │ project_name    │      │ role            │
│ annual_budget   │      │ manager_id (FK) │      │ allocation_%    │
│ budget_spent    │      │ budget_allocated│      │ status          │
│ is_active       │      │ budget_spent    │      │ allocated_date  │
└─────────────────┘      │ status          │      │ deallocated_date│
                         └─────────────────┘      └─────────────────┘
```

---

## 3. Table Definitions

### 3.1 Tenant

Stores organization/company information.

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(255),                  -- Optional email domain for auto-association
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenants_code ON tenants(code);
CREATE INDEX idx_tenants_active ON tenants(is_active);
CREATE INDEX idx_tenants_domain ON tenants(domain);
```

**Settings JSONB Structure:**
```json
{
    "approval_workflow": {
        "levels": 2,
        "require_finance": true,
        "auto_approve_below": 1000
    },
    "branding": {
        "logo_url": "...",
        "primary_color": "#1a73e8"
    }
}
```

### 3.2 Designation

Stores tenant-specific job titles/designations with role mappings.

```sql
CREATE TABLE designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,           -- e.g., "Senior Project Manager"
    code VARCHAR(50) NOT NULL,            -- e.g., "SR_PM"
    description TEXT,
    level INTEGER DEFAULT 0,              -- For organizational hierarchy
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_designations_tenant ON designations(tenant_id);
CREATE INDEX idx_designations_name ON designations(name);
CREATE INDEX idx_designations_code ON designations(code);
CREATE INDEX idx_designations_active ON designations(is_active);
CREATE INDEX idx_designations_tenant_name ON designations(tenant_id, name);
```

### 3.3 Designation Role Mapping

Maps designations to application roles (tenant-specific).

```sql
CREATE TABLE designation_role_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    designation_id UUID NOT NULL REFERENCES designations(id),
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_designation_role
        CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HR', 'FINANCE', 'ADMIN'))
);

CREATE INDEX idx_designation_roles_tenant ON designation_role_mappings(tenant_id);
CREATE INDEX idx_designation_roles_designation ON designation_role_mappings(designation_id);
CREATE INDEX idx_designation_roles_role ON designation_role_mappings(role);
```

> **Note:** `SYSTEM_ADMIN` role is platform-level only and is excluded from designation mappings.

### 3.4 User

Unified User model combining authentication, authorization, and employee data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Authentication
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,

    -- Profile / Employee Info
    employee_code VARCHAR(50) UNIQUE,     -- e.g., EMP001
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),               -- Computed or manual
    phone VARCHAR(20),
    mobile VARCHAR(20),
    address TEXT,

    -- Employment
    department VARCHAR(100),
    designation VARCHAR(100),             -- Text field, not FK
    manager_id UUID REFERENCES users(id),
    date_of_joining DATE,
    employment_status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, ON_LEAVE

    -- Region/Location
    region VARCHAR[] DEFAULT NULL,        -- e.g., '{INDIA,SEZ_BANGALORE}'

    -- Roles & Permissions (ARRAY, not FK)
    roles VARCHAR[] DEFAULT '{EMPLOYEE}', -- EMPLOYEE, MANAGER, HR, FINANCE, ADMIN

    -- Additional data
    user_data JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_code ON users(employee_code);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_manager ON users(manager_id);
```

> **Note:** The `Employee` alias in code points to the `User` model. There is no separate employees table.

### 3.5 IBU (Independent Business Unit)

Organizational units for project grouping and budget reporting.

```sql
CREATE TABLE ibus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(50) NOT NULL,            -- e.g., "IBU-TECH"
    name VARCHAR(255) NOT NULL,
    description TEXT,
    head_id UUID REFERENCES users(id),
    annual_budget NUMERIC(14, 2),
    budget_spent NUMERIC(14, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_ibus_tenant ON ibus(tenant_id);
CREATE INDEX idx_ibus_code ON ibus(code);
CREATE INDEX idx_ibus_active ON ibus(is_active);
CREATE INDEX idx_ibus_head ON ibus(head_id);
```

### 3.6 Project

Project master for project-based claims.

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_code VARCHAR(50) UNIQUE NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES users(id),
    ibu_id UUID REFERENCES ibus(id),
    budget_allocated NUMERIC(12, 2),
    budget_spent NUMERIC(12, 2) DEFAULT 0,
    budget_available NUMERIC(12, 2),
    status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, COMPLETED, CLOSED
    start_date DATE,
    end_date DATE,
    project_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_code ON projects(project_code);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_ibu ON projects(ibu_id);
```

### 3.7 Employee Project Allocation

Tracks history of employee-project allocations.

```sql
CREATE TABLE employee_project_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    role VARCHAR(100),                     -- MEMBER, LEAD, MANAGER
    allocation_percentage INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'ACTIVE',   -- ACTIVE, COMPLETED, REMOVED
    allocated_date DATE NOT NULL,
    deallocated_date DATE,
    allocated_by UUID REFERENCES users(id),
    deallocated_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_allocation_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'REMOVED')),
    CONSTRAINT valid_allocation_percentage CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100)
);

CREATE INDEX idx_allocations_tenant ON employee_project_allocations(tenant_id);
CREATE INDEX idx_allocations_employee ON employee_project_allocations(employee_id);
CREATE INDEX idx_allocations_project ON employee_project_allocations(project_id);
CREATE INDEX idx_allocations_status ON employee_project_allocations(status);
CREATE INDEX idx_allocations_employee_status ON employee_project_allocations(employee_id, status);
CREATE INDEX idx_allocations_dates ON employee_project_allocations(allocated_date, deallocated_date);
```

### 3.8 Claim

Core claims table with OCR tracking, HR corrections, return workflow, and settlement.

```sql
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    claim_number VARCHAR(50) UNIQUE NOT NULL,

    -- Employee & Claim Info
    employee_id UUID NOT NULL REFERENCES users(id),
    employee_name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    claim_type VARCHAR(20) NOT NULL,       -- REIMBURSEMENT, ALLOWANCE
    category VARCHAR(50) NOT NULL,

    -- Financial
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    total_amount NUMERIC(12, 2),           -- Denormalized for fast queries

    -- Status & Workflow
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_MANAGER',

    -- Dates
    submission_date TIMESTAMP WITH TIME ZONE,
    claim_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Description & Payload
    description TEXT,
    claim_payload JSONB NOT NULL DEFAULT '{}',
    ocr_text TEXT,                         -- OCR extracted text for full-text search

    -- Return workflow
    returned_by UUID REFERENCES users(id),
    returned_at TIMESTAMP WITH TIME ZONE,
    return_reason TEXT,
    return_count INTEGER DEFAULT 0,
    can_edit BOOLEAN DEFAULT false,

    -- Settlement tracking
    settled BOOLEAN DEFAULT false,
    settled_date TIMESTAMP WITH TIME ZONE,
    settled_by UUID REFERENCES users(id),
    payment_reference VARCHAR(100),
    payment_method VARCHAR(20),            -- NEFT, RTGS, CHEQUE, CASH, UPI
    amount_paid NUMERIC(12, 2),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN (
        'AI_PROCESSING', 'PENDING_MANAGER', 'RETURNED_TO_EMPLOYEE',
        'MANAGER_APPROVED', 'PENDING_HR', 'HR_APPROVED',
        'PENDING_FINANCE', 'FINANCE_APPROVED', 'SETTLED', 'REJECTED'
    )),
    CONSTRAINT valid_claim_type CHECK (claim_type IN ('REIMBURSEMENT', 'ALLOWANCE')),
    CONSTRAINT valid_payment_method CHECK (
        payment_method IS NULL OR payment_method IN ('NEFT', 'RTGS', 'CHEQUE', 'CASH', 'UPI')
    )
);

CREATE INDEX idx_claims_tenant ON claims(tenant_id);
CREATE INDEX idx_claims_employee ON claims(employee_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_status_employee ON claims(status, employee_id);
CREATE INDEX idx_claims_amount ON claims(amount);
CREATE INDEX idx_claims_submission_date ON claims(submission_date);
CREATE INDEX idx_claims_claim_number ON claims(claim_number);
CREATE INDEX idx_claims_payload_gin ON claims USING gin(claim_payload);
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `AI_PROCESSING` | AI agents actively processing the claim |
| `PENDING_MANAGER` | Awaiting manager approval |
| `RETURNED_TO_EMPLOYEE` | Returned for correction |
| `MANAGER_APPROVED` | Manager has approved |
| `PENDING_HR` | Awaiting HR review (for policy exceptions) |
| `HR_APPROVED` | HR has approved |
| `PENDING_FINANCE` | Awaiting finance settlement |
| `FINANCE_APPROVED` | Ready for payment / auto-approved |
| `SETTLED` | Payment complete |
| `REJECTED` | Claim declined |

**Claim Payload JSONB Structure:**
```json
{
    "details": {
        "exam_name": "AWS Solutions Architect",
        "vendor": "Amazon"
    },
    "ocr": {
        "extracted_amount": 5000,
        "extracted_date": "2024-12-01",
        "confidence": 0.95
    },
    "validation": {
        "policy_compliant": true,
        "issues": [],
        "score": 0.92
    },
    "ai_analysis": {
        "recommendation": "APPROVE",
        "risk_level": "LOW",
        "reasoning": "..."
    }
}
```

### 3.9 Document

Uploaded documents with OCR results. Supports both local and GCS storage.

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    claim_id UUID NOT NULL REFERENCES claims(id),

    -- File info
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    storage_path VARCHAR(500) NOT NULL,    -- Local path or GCS blob name

    -- Cloud storage info
    gcs_uri VARCHAR(500),                  -- Full GCS URI (gs://bucket/path)
    gcs_blob_name VARCHAR(500),            -- Blob name for signed URL generation
    storage_type VARCHAR(20) DEFAULT 'local', -- 'local' or 'gcs'
    content_type VARCHAR(100),             -- MIME type

    -- Document type
    document_type VARCHAR(50),             -- INVOICE, RECEIPT, CERTIFICATE, TICKET

    -- OCR results
    ocr_text TEXT,
    ocr_data JSONB DEFAULT '{}',
    ocr_confidence FLOAT,
    ocr_processed BOOLEAN DEFAULT false,
    ocr_processed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_claim ON documents(claim_id);
CREATE INDEX idx_documents_type ON documents(document_type);
```

**OCR Data JSONB Structure:**
```json
{
    "raw_text": "...",
    "extracted_fields": {
        "merchant": "Amazon AWS",
        "amount": 5000,
        "date": "2024-12-01",
        "invoice_number": "INV-001"
    },
    "confidence_scores": {
        "amount": 0.98,
        "date": 0.95,
        "merchant": 0.87
    },
    "processing_method": "tesseract",
    "fallback_used": false
}
```

### 3.10 Comment

Multi-stakeholder comments with visibility control.

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    claim_id UUID NOT NULL REFERENCES claims(id),
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'GENERAL',  -- GENERAL, RETURN, APPROVAL, REJECTION, HR_CORRECTION
    user_id UUID NOT NULL REFERENCES users(id),
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    visible_to_employee BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_tenant ON comments(tenant_id);
CREATE INDEX idx_comments_claim ON comments(claim_id);
CREATE INDEX idx_comments_created ON comments(created_at);
```

### 3.11 Approval

Approval workflow tracking per stage.

```sql
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    claim_id UUID NOT NULL REFERENCES claims(id),
    approval_stage VARCHAR(50) NOT NULL,   -- MANAGER, HR, FINANCE
    approver_id UUID REFERENCES users(id),
    approver_name VARCHAR(255),
    status VARCHAR(50) NOT NULL,           -- PENDING, APPROVED, REJECTED, RETURNED
    decision_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_approvals_tenant ON approvals(tenant_id);
CREATE INDEX idx_approvals_claim ON approvals(claim_id);
CREATE INDEX idx_approvals_approver ON approvals(approver_id);
CREATE INDEX idx_approvals_status ON approvals(status);
```

### 3.12 Agent Execution

AI agent execution tracking and learning metrics.

```sql
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    claim_id UUID REFERENCES claims(id),
    agent_name VARCHAR(100) NOT NULL,
    agent_version VARCHAR(20),
    task_id VARCHAR(100),                  -- Celery task ID
    execution_time_ms INTEGER,
    status VARCHAR(20) NOT NULL,           -- SUCCESS, FAILURE, RETRY
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    confidence_score FLOAT,
    llm_tokens_used INTEGER,
    llm_cost NUMERIC(10, 6),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_agent_executions_tenant ON agent_executions(tenant_id);
CREATE INDEX idx_agent_executions_claim ON agent_executions(claim_id);
CREATE INDEX idx_agent_executions_agent ON agent_executions(agent_name);
CREATE INDEX idx_agent_executions_started ON agent_executions(started_at);
```

### 3.13 Notification

User notifications with read/clear status.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,                        -- NULL for system_admin platform notifications
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    related_entity_type VARCHAR(50),       -- claim, employee, tenant
    related_entity_id UUID,
    action_url VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    is_cleared BOOLEAN DEFAULT false,
    cleared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_notification_type CHECK (type IN (
        'claim_approved', 'claim_rejected', 'claim_returned',
        'pending_approval', 'claim_submitted', 'system', 'tenant'
    )),
    CONSTRAINT valid_notification_priority CHECK (priority IN ('high', 'medium', 'low'))
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_cleared ON notifications(is_cleared);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
```

### 3.14 System Settings

System-wide settings and configurations.

```sql
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) NOT NULL DEFAULT 'string',  -- string, boolean, number, json
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',              -- general, notifications, policies
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_settings_tenant ON system_settings(tenant_id);
CREATE INDEX idx_settings_key ON system_settings(setting_key);
CREATE INDEX idx_settings_category ON system_settings(category);
```

### 3.15 Region

Tenant-specific regions for policy and employee management.

```sql
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),                      -- e.g., IND, US-CA
    currency VARCHAR(10),                  -- e.g., INR, USD
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_regions_tenant ON regions(tenant_id);
CREATE INDEX idx_regions_active ON regions(is_active);
```

---

## 4. Policy Management Tables

### 4.1 Policy Upload

Policy documents uploaded by Admin. AI extracts categories and rules from the document.

```sql
CREATE TABLE policy_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_name VARCHAR(255) NOT NULL,
    policy_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated
    description TEXT,

    -- File details
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,        -- PDF, DOCX, JPG, PNG
    file_size INTEGER,
    storage_path VARCHAR(500),
    gcs_uri VARCHAR(500),
    gcs_blob_name VARCHAR(500),
    storage_type VARCHAR(20) DEFAULT 'local',
    content_type VARCHAR(100),

    -- Processing status
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    -- PENDING -> AI_PROCESSING -> EXTRACTED -> APPROVED -> ACTIVE / REJECTED

    -- AI Extraction
    extracted_text TEXT,
    extraction_error TEXT,
    extracted_at TIMESTAMP WITH TIME ZONE,
    extracted_data JSONB DEFAULT '{}',

    -- Versioning
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    replaces_policy_id UUID REFERENCES policy_uploads(id),
    effective_from DATE,
    effective_to DATE,

    -- Region applicability
    region VARCHAR[],                      -- NULL means applicable to all regions

    -- Audit
    uploaded_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_policy_status CHECK (status IN (
        'PENDING', 'AI_PROCESSING', 'EXTRACTED', 'APPROVED', 'ACTIVE', 'REJECTED', 'ARCHIVED'
    ))
);

CREATE INDEX idx_policy_uploads_tenant ON policy_uploads(tenant_id);
CREATE INDEX idx_policy_uploads_status ON policy_uploads(status);
CREATE INDEX idx_policy_uploads_active ON policy_uploads(is_active);
CREATE INDEX idx_policy_uploads_number ON policy_uploads(policy_number);
CREATE INDEX idx_policy_uploads_region ON policy_uploads(region);
```

### 4.2 Policy Category

Categories extracted from policy documents. Each becomes available for claim submission once approved.

```sql
CREATE TABLE policy_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_upload_id UUID NOT NULL REFERENCES policy_uploads(id),

    -- Category details (extracted by AI, editable by admin)
    category_name VARCHAR(100) NOT NULL,
    category_code VARCHAR(50) NOT NULL,    -- e.g., TRAVEL, CERTIFICATION
    category_type VARCHAR(20) NOT NULL,    -- REIMBURSEMENT or ALLOWANCE
    description TEXT,

    -- Limits
    max_amount NUMERIC(12, 2),
    min_amount NUMERIC(12, 2),
    currency VARCHAR(3) DEFAULT 'INR',

    -- Frequency
    frequency_limit VARCHAR(50),           -- ONCE, DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, UNLIMITED
    frequency_count INTEGER,

    -- Eligibility (JSON for flexibility)
    eligibility_criteria JSONB DEFAULT '{}',

    -- Documentation requirements
    requires_receipt BOOLEAN DEFAULT true,
    requires_approval_above NUMERIC(12, 2),
    allowed_document_types VARCHAR[] DEFAULT '{PDF,JPG,PNG}',
    submission_window_days INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- Source tracking
    source_text TEXT,                      -- Original text from policy for reference
    ai_confidence FLOAT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_policy_category_type CHECK (category_type IN ('REIMBURSEMENT', 'ALLOWANCE'))
);

CREATE INDEX idx_policy_categories_tenant ON policy_categories(tenant_id);
CREATE INDEX idx_policy_categories_policy ON policy_categories(policy_upload_id);
CREATE INDEX idx_policy_categories_type ON policy_categories(category_type);
CREATE INDEX idx_policy_categories_code ON policy_categories(category_code);
CREATE INDEX idx_policy_categories_active ON policy_categories(is_active);
```

### 4.3 Claim Validation

Records of claim validation results against policy rules.

```sql
CREATE TABLE claim_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    claim_id UUID NOT NULL REFERENCES claims(id),
    policy_category_id UUID REFERENCES policy_categories(id),
    validation_status VARCHAR(20) NOT NULL, -- PASS, WARNING, FAIL
    validation_results JSONB NOT NULL DEFAULT '[]',
    checks_total INTEGER DEFAULT 0,
    checks_passed INTEGER DEFAULT 0,
    checks_warned INTEGER DEFAULT 0,
    checks_failed INTEGER DEFAULT 0,
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_claim_validation_status CHECK (validation_status IN ('PASS', 'WARNING', 'FAIL'))
);

CREATE INDEX idx_claim_validations_tenant ON claim_validations(tenant_id);
CREATE INDEX idx_claim_validations_claim ON claim_validations(claim_id);
CREATE INDEX idx_claim_validations_status ON claim_validations(validation_status);
```

### 4.4 Policy Audit Log

Audit log for policy changes.

```sql
CREATE TABLE policy_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,      -- POLICY_UPLOAD, POLICY_CATEGORY
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,           -- CREATE, UPDATE, APPROVE, REJECT, ACTIVATE, DEACTIVATE
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    performed_by UUID NOT NULL REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_policy_audit_tenant ON policy_audit_logs(tenant_id);
CREATE INDEX idx_policy_audit_entity ON policy_audit_logs(entity_type, entity_id);
CREATE INDEX idx_policy_audit_action ON policy_audit_logs(action);
CREATE INDEX idx_policy_audit_date ON policy_audit_logs(performed_at);
```

### 4.5 Custom Claim

Custom claim definitions created by Admin, not linked to any policy document.

```sql
CREATE TABLE custom_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    claim_name VARCHAR(255) NOT NULL,
    claim_code VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated, e.g., CC-2024-0001
    description TEXT,
    category_type VARCHAR(20) NOT NULL,     -- REIMBURSEMENT or ALLOWANCE
    region VARCHAR[],                       -- NULL means all regions
    max_amount NUMERIC(12, 2),
    min_amount NUMERIC(12, 2),
    default_amount NUMERIC(12, 2),          -- Default amount for allowances
    currency VARCHAR(3) DEFAULT 'INR',
    frequency_limit VARCHAR(50),
    frequency_count INTEGER,
    custom_fields JSONB DEFAULT '[]',       -- Array of field definitions
    eligibility_criteria JSONB DEFAULT '{}',
    requires_receipt BOOLEAN DEFAULT true,
    requires_approval_above NUMERIC(12, 2),
    allowed_document_types VARCHAR[] DEFAULT '{PDF,JPG,PNG}',
    submission_window_days INTEGER,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_custom_claim_category_type CHECK (category_type IN ('REIMBURSEMENT', 'ALLOWANCE'))
);

CREATE INDEX idx_custom_claims_tenant ON custom_claims(tenant_id);
CREATE INDEX idx_custom_claims_type ON custom_claims(category_type);
CREATE INDEX idx_custom_claims_code ON custom_claims(claim_code);
CREATE INDEX idx_custom_claims_active ON custom_claims(is_active);
CREATE INDEX idx_custom_claims_region ON custom_claims(region);
```

---

## 5. Audit & Security Tables

### 5.1 Audit Log

Tamper-proof audit log with chain hashing for security and compliance.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),               -- Denormalized for historical accuracy
    tenant_id UUID,
    resource_type VARCHAR(100),            -- claim, employee, document, policy
    resource_id UUID,
    action VARCHAR(100),
    action_details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),                -- IPv4 or IPv6
    user_agent VARCHAR(500),
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    integrity_hash VARCHAR(64) NOT NULL,   -- SHA-256 hash of log entry
    previous_hash VARCHAR(64),             -- Chain hash for sequence verification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_audit_event_type CHECK (event_type IN (
        'AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_FAILED', 'AUTH_TOKEN_REFRESH',
        'AUTH_PASSWORD_CHANGE', 'AUTH_PASSWORD_RESET', 'AUTH_MFA_ENABLED', 'AUTH_MFA_DISABLED',
        'DATA_CREATE', 'DATA_READ', 'DATA_UPDATE', 'DATA_DELETE', 'DATA_EXPORT', 'DATA_BULK_ACCESS',
        'CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_RETURNED', 'CLAIM_SETTLED', 'CLAIM_EDITED',
        'ADMIN_ACTION', 'CONFIG_CHANGE', 'PERMISSION_CHANGE',
        'SECURITY_ALERT', 'SUSPICIOUS_ACTIVITY'
    ))
);

CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_timestamp ON audit_logs(event_timestamp);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_success ON audit_logs(success);
CREATE INDEX idx_audit_ip ON audit_logs(ip_address);
CREATE INDEX idx_audit_tenant_timestamp ON audit_logs(tenant_id, event_timestamp);
CREATE INDEX idx_audit_user_timestamp ON audit_logs(user_id, event_timestamp);
```

---

## 6. Integration Tables

### 6.1 Integration API Keys

API keys for external system integrations.

```sql
CREATE TABLE integration_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    key_prefix VARCHAR(10) NOT NULL,       -- First 8 chars for identification
    key_hash VARCHAR(128) NOT NULL,        -- SHA-256 hash of the full key
    permissions VARCHAR[] DEFAULT '{}',
    rate_limit INTEGER DEFAULT 1000,       -- Requests per hour
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant ON integration_api_keys(tenant_id);
CREATE INDEX idx_api_keys_prefix ON integration_api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON integration_api_keys(is_active);
```

### 6.2 Integration Webhooks

Webhook configurations for event notifications to external systems.

```sql
CREATE TABLE integration_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(128),                   -- Secret for HMAC signature verification
    auth_type VARCHAR(20) DEFAULT 'hmac',  -- hmac, bearer, basic, none
    auth_config JSONB DEFAULT '{}',
    events VARCHAR[] DEFAULT '{}',         -- claim_submitted, claim_approved, etc.
    retry_count INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant ON integration_webhooks(tenant_id);
CREATE INDEX idx_webhooks_active ON integration_webhooks(is_active);
```

### 6.3 Integration SSO Config

Single Sign-On configuration for tenant authentication.

```sql
CREATE TABLE integration_sso_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    provider VARCHAR(50) NOT NULL,         -- azure_ad, okta, google, keycloak, saml
    client_id VARCHAR(255),
    client_secret VARCHAR(500),
    issuer_url VARCHAR(500),
    authorization_url VARCHAR(500),
    token_url VARCHAR(500),
    userinfo_url VARCHAR(500),
    jwks_url VARCHAR(500),
    saml_metadata_url VARCHAR(500),
    saml_entity_id VARCHAR(255),
    saml_certificate TEXT,
    attribute_mapping JSONB DEFAULT '{}',
    auto_provision_users BOOLEAN DEFAULT false,
    sync_user_attributes BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sso_tenant ON integration_sso_configs(tenant_id);
CREATE INDEX idx_sso_provider ON integration_sso_configs(provider);
CREATE INDEX idx_sso_active ON integration_sso_configs(is_active);
```

### 6.4 Integration HRMS

HRMS integration configuration for syncing employee data.

```sql
CREATE TABLE integration_hrms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    provider VARCHAR(50) NOT NULL,         -- workday, bamboohr, sap_successfactors, etc.
    api_url VARCHAR(500),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    oauth_client_id VARCHAR(255),
    oauth_client_secret VARCHAR(500),
    oauth_token_url VARCHAR(500),
    oauth_scope VARCHAR(255),
    sync_enabled BOOLEAN DEFAULT false,
    sync_frequency VARCHAR(20) DEFAULT 'daily',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20),
    last_sync_error TEXT,
    field_mapping JSONB DEFAULT '{}',
    sync_employees BOOLEAN DEFAULT true,
    sync_departments BOOLEAN DEFAULT true,
    sync_managers BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hrms_tenant ON integration_hrms(tenant_id);
CREATE INDEX idx_hrms_provider ON integration_hrms(provider);
CREATE INDEX idx_hrms_active ON integration_hrms(is_active);
```

### 6.5 Integration ERP

ERP/Finance system integration for exporting financial data.

```sql
CREATE TABLE integration_erp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    provider VARCHAR(50) NOT NULL,         -- sap, oracle_financials, dynamics365, tally, etc.
    api_url VARCHAR(500),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    oauth_client_id VARCHAR(255),
    oauth_client_secret VARCHAR(500),
    oauth_token_url VARCHAR(500),
    oauth_scope VARCHAR(255),
    company_code VARCHAR(50),
    cost_center VARCHAR(50),
    gl_account_mapping JSONB DEFAULT '{}',
    export_enabled BOOLEAN DEFAULT false,
    export_frequency VARCHAR(20) DEFAULT 'manual',
    export_format VARCHAR(20) DEFAULT 'json',
    auto_export_on_settlement BOOLEAN DEFAULT false,
    last_export_at TIMESTAMP WITH TIME ZONE,
    last_export_status VARCHAR(20),
    last_export_error TEXT,
    is_active BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_erp_tenant ON integration_erp(tenant_id);
CREATE INDEX idx_erp_provider ON integration_erp(provider);
CREATE INDEX idx_erp_active ON integration_erp(is_active);
```

### 6.6 Integration Communication

Slack/Teams notification configuration.

```sql
CREATE TABLE integration_communication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    provider VARCHAR(50) NOT NULL,         -- slack, microsoft_teams, google_chat
    slack_workspace_id VARCHAR(50),
    slack_bot_token VARCHAR(255),
    slack_channel_id VARCHAR(50),
    teams_tenant_id VARCHAR(100),
    teams_webhook_url VARCHAR(500),
    teams_channel_id VARCHAR(100),
    notify_on_claim_submitted BOOLEAN DEFAULT true,
    notify_on_claim_approved BOOLEAN DEFAULT true,
    notify_on_claim_rejected BOOLEAN DEFAULT true,
    notify_on_claim_settled BOOLEAN DEFAULT true,
    notify_managers BOOLEAN DEFAULT true,
    notify_finance BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, provider)
);

CREATE INDEX idx_comm_tenant ON integration_communication(tenant_id);
CREATE INDEX idx_comm_provider ON integration_communication(provider);
CREATE INDEX idx_comm_active ON integration_communication(is_active);
```

### 6.7 Webhook Delivery Logs

Tracks webhook delivery attempts for debugging and monitoring.

```sql
CREATE TABLE webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES integration_webhooks(id),
    event_type VARCHAR(50) NOT NULL,
    event_payload JSONB DEFAULT '{}',
    attempt_number INTEGER DEFAULT 1,
    request_url VARCHAR(500),
    request_headers JSONB DEFAULT '{}',
    request_body TEXT,
    response_status_code INTEGER,
    response_headers JSONB DEFAULT '{}',
    response_body TEXT,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_log_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_log_event ON webhook_delivery_logs(event_type);
CREATE INDEX idx_webhook_log_success ON webhook_delivery_logs(success);
CREATE INDEX idx_webhook_log_created ON webhook_delivery_logs(created_at);
```

---

## 7. Table Summary

| Table | Description |
|-------|-------------|
| `tenants` | Organization/company entities |
| `designations` | Tenant-specific job titles |
| `designation_role_mappings` | Maps designations to roles |
| `users` | Unified user/employee accounts |
| `ibus` | Independent business units |
| `projects` | Project master data |
| `employee_project_allocations` | Employee-project allocation history |
| `claims` | Core claims data |
| `documents` | Uploaded documents with OCR |
| `comments` | Claim comments/discussions |
| `approvals` | Approval workflow tracking |
| `agent_executions` | AI agent execution logs |
| `notifications` | User notifications |
| `system_settings` | System configuration |
| `regions` | Tenant regions |
| `policy_uploads` | Policy documents |
| `policy_categories` | Extracted policy categories |
| `claim_validations` | Claim validation results |
| `policy_audit_logs` | Policy change audit trail |
| `custom_claims` | Custom claim definitions |
| `audit_logs` | Security audit log |
| `integration_api_keys` | API keys for integrations |
| `integration_webhooks` | Webhook configurations |
| `integration_sso_configs` | SSO configuration |
| `integration_hrms` | HRMS integration config |
| `integration_erp` | ERP integration config |
| `integration_communication` | Slack/Teams integration |
| `webhook_delivery_logs` | Webhook delivery tracking |

---

*Document Version: 2.0 | Last Updated: May 2026*
