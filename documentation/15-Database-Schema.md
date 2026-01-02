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
│ id (PK)         │◄─────│ tenant_id (FK)  │      │ id (PK)         │
│ name            │      │ id (PK)         │      │ tenant_id (FK)  │
│ code            │      │ email           │      │ name            │
│ settings (JSON) │      │ full_name       │      │ level           │
│ is_active       │      │ designation_id  │      │ department      │
│ subscription    │      │ manager_id      │      │ is_active       │
│ created_at      │      │ is_active       │      │ created_at      │
│ updated_at      │      │ created_at      │      │ updated_at      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                        │                        │
         │                        ▼                        │
         │               ┌─────────────────┐               │
         │               │      Claim      │               │
         │               ├─────────────────┤               │
         └──────────────►│ tenant_id (FK)  │◄──────────────┘
                         │ id (PK)         │
                         │ claim_number    │
                         │ user_id (FK)    │
                         │ status          │
                         │ category        │
                         │ amount          │
                         │ currency        │
                         │ description     │
                         │ claim_payload   │
                         │ created_at      │
                         │ updated_at      │
                         └─────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Document     │      │    Approval     │      │    Comment      │
├─────────────────┤      ├─────────────────┤      ├─────────────────┤
│ id (PK)         │      │ id (PK)         │      │ id (PK)         │
│ tenant_id (FK)  │      │ tenant_id (FK)  │      │ tenant_id (FK)  │
│ claim_id (FK)   │      │ claim_id (FK)   │      │ claim_id (FK)   │
│ filename        │      │ approver_id     │      │ user_id (FK)    │
│ file_path       │      │ stage           │      │ content         │
│ file_type       │      │ status          │      │ visibility      │
│ ocr_data (JSON) │      │ notes           │      │ created_at      │
│ created_at      │      │ actioned_at     │      │ updated_at      │
└─────────────────┘      │ created_at      │      └─────────────────┘
                         └─────────────────┘
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
    settings JSONB DEFAULT '{}',
    subscription_type VARCHAR(50) DEFAULT 'standard',
    max_users INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tenants_code ON tenants(code);
```

**Settings JSONB Structure:**
```json
{
    "approval_workflow": {
        "levels": 2,
        "require_finance": true,
        "auto_approve_below": 1000
    },
    "policies": {
        "max_claim_amount": 100000,
        "allowed_categories": ["TRAVEL", "CERTIFICATION"]
    },
    "branding": {
        "logo_url": "...",
        "primary_color": "#1a73e8"
    }
}
```

### 3.2 Designation

Stores job titles/designations with role mappings.

```sql
CREATE TABLE designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_designations_tenant ON designations(tenant_id);
CREATE UNIQUE INDEX idx_designations_tenant_name 
    ON designations(tenant_id, name);
```

### 3.3 Designation Role Mapping

Maps designations to system roles.

```sql
CREATE TABLE designation_role_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    designation_id UUID NOT NULL REFERENCES designations(id),
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drm_tenant ON designation_role_mappings(tenant_id);
CREATE INDEX idx_drm_designation ON designation_role_mappings(designation_id);
CREATE UNIQUE INDEX idx_drm_unique 
    ON designation_role_mappings(tenant_id, designation_id, role);
```

**Role Values:**
- `EMPLOYEE` - Can submit claims
- `MANAGER` - Can approve team claims
- `FINANCE` - Finance approval
- `HR` - HR access
- `ADMIN` - Tenant admin

### 3.4 Department

Stores tenant-specific department information.

```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    head_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_departments_tenant ON departments(tenant_id);
CREATE UNIQUE INDEX idx_departments_tenant_code 
    ON departments(tenant_id, code);
CREATE UNIQUE INDEX idx_departments_tenant_name 
    ON departments(tenant_id, name);
```

**Note:** Departments are now tenant-specific and managed via the Departments API. The static department list has been removed from the frontend configuration.

### 3.5 User

Stores user account information.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(100),
    designation_id UUID REFERENCES designations(id),
    manager_id UUID REFERENCES users(id),
    phone VARCHAR(50),
    address TEXT,
    keycloak_user_id UUID,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_tenant_email 
    ON users(tenant_id, email);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_designation ON users(designation_id);
```

### 3.5 Claim

Core claims table.

```sql
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    claim_number VARCHAR(50) NOT NULL,
    
    -- Claim Details
    claim_type VARCHAR(50) DEFAULT 'REIMBURSEMENT',
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    claim_date DATE NOT NULL,
    description TEXT,
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'SUBMITTED',
    current_approval_stage VARCHAR(50),
    
    -- AI Processing
    claim_payload JSONB DEFAULT '{}',
    ocr_confidence DECIMAL(5, 4),
    validation_score DECIMAL(5, 4),
    ai_recommendation VARCHAR(50),
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Essential Indexes
CREATE INDEX idx_claims_tenant ON claims(tenant_id);
CREATE INDEX idx_claims_user ON claims(user_id);
CREATE INDEX idx_claims_status ON claims(tenant_id, status);
CREATE INDEX idx_claims_category ON claims(tenant_id, category);
CREATE INDEX idx_claims_date ON claims(claim_date DESC);
CREATE UNIQUE INDEX idx_claims_number ON claims(tenant_id, claim_number);

-- Full-text search index
CREATE INDEX idx_claims_fts ON claims 
    USING gin(to_tsvector('english', 
        coalesce(description, '') || ' ' || 
        coalesce(claim_number, '')
    ));

-- JSONB payload index
CREATE INDEX idx_claims_payload ON claims USING gin(claim_payload);
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `DRAFT` | Not yet submitted |
| `SUBMITTED` | Submitted for review |
| `PENDING_MANAGER` | Awaiting manager approval |
| `MANAGER_APPROVED` | Manager approved |
| `MANAGER_REJECTED` | Manager rejected |
| `PENDING_FINANCE` | Awaiting finance approval |
| `FINANCE_APPROVED` | Finance approved |
| `FINANCE_REJECTED` | Finance rejected |
| `PAYMENT_PROCESSING` | Payment being processed |
| `SETTLED` | Payment complete |
| `CANCELLED` | Cancelled by employee |
| `RETURNED` | Returned for correction |

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

### 3.6 Document

Stores uploaded documents/receipts.

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    claim_id UUID NOT NULL REFERENCES claims(id),
    
    -- File Information
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_type VARCHAR(100),
    file_size INTEGER,
    storage_path TEXT NOT NULL,
    
    -- Document Classification
    document_type VARCHAR(50) DEFAULT 'RECEIPT',
    
    -- OCR Processing
    ocr_processed BOOLEAN DEFAULT false,
    ocr_processing_status VARCHAR(50),
    ocr_data JSONB DEFAULT '{}',
    ocr_confidence DECIMAL(5, 4),
    ocr_text TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_claim ON documents(claim_id);
CREATE INDEX idx_documents_type ON documents(document_type);

-- Full-text search on OCR content
CREATE INDEX idx_documents_ocr_fts ON documents 
    USING gin(to_tsvector('english', coalesce(ocr_text, '')));
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

### 3.7 Approval

Tracks approval workflow.

```sql
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    claim_id UUID NOT NULL REFERENCES claims(id),
    approver_id UUID REFERENCES users(id),
    
    -- Approval Details
    approval_stage VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    
    -- Decision Details
    notes TEXT,
    rejection_reason VARCHAR(255),
    
    -- Timestamps
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actioned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_approvals_tenant ON approvals(tenant_id);
CREATE INDEX idx_approvals_claim ON approvals(claim_id);
CREATE INDEX idx_approvals_approver ON approvals(approver_id);
CREATE INDEX idx_approvals_pending ON approvals(tenant_id, status) 
    WHERE status = 'PENDING';
```

**Approval Stage Values:**
- `MANAGER` - Manager/supervisor approval
- `FINANCE` - Finance team approval
- `HR` - HR approval (if required)

### 3.8 Comment

Stores claim comments/discussions.

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    claim_id UUID NOT NULL REFERENCES claims(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    content TEXT NOT NULL,
    visibility VARCHAR(50) DEFAULT 'ALL',
    
    -- Reply Threading
    parent_id UUID REFERENCES comments(id),
    
    -- Mentions
    mentions UUID[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_tenant ON comments(tenant_id);
CREATE INDEX idx_comments_claim ON comments(claim_id);
CREATE INDEX idx_comments_user ON comments(user_id);
```

### 3.9 Notification

Stores user notifications.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Related Entity
    reference_type VARCHAR(50),
    reference_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) 
    WHERE is_read = false;
```

### 3.10 Audit Log

Stores audit trail for compliance.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Actor
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    
    -- Action
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    
    -- Details
    changes JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

### 3.10 Integration API Keys

Stores API keys for external system integrations.

```sql
CREATE TABLE integration_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    key_prefix VARCHAR(20) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    
    permissions VARCHAR[] DEFAULT ARRAY['read'],
    rate_limit INTEGER DEFAULT 1000,
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
CREATE INDEX idx_api_keys_active ON integration_api_keys(tenant_id) WHERE is_active = true;
```

### 3.11 Integration Webhooks

Stores webhook configurations for external notifications.

```sql
CREATE TABLE integration_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(2048) NOT NULL,
    secret VARCHAR(255),
    
    auth_type VARCHAR(50) DEFAULT 'none',
    auth_config JSONB DEFAULT '{}',
    events VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
    
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
CREATE INDEX idx_webhooks_active ON integration_webhooks(tenant_id) WHERE is_active = true;
```

### 3.12 Integration SSO Config

Stores SSO/SAML configuration for single sign-on.

```sql
CREATE TABLE integration_sso_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    provider VARCHAR(50) NOT NULL,
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    
    issuer_url VARCHAR(2048),
    authorization_url VARCHAR(2048),
    token_url VARCHAR(2048),
    userinfo_url VARCHAR(2048),
    jwks_url VARCHAR(2048),
    
    saml_metadata_url VARCHAR(2048),
    saml_entity_id VARCHAR(255),
    saml_certificate TEXT,
    
    attribute_mapping JSONB DEFAULT '{}',
    auto_provision_users BOOLEAN DEFAULT false,
    sync_user_attributes BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);
```

### 3.13 Integration HRMS

Stores HRMS system integration configuration.

```sql
CREATE TABLE integration_hrms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    provider VARCHAR(50) NOT NULL,
    api_url VARCHAR(2048),
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    
    oauth_client_id VARCHAR(255),
    oauth_client_secret VARCHAR(255),
    oauth_token_url VARCHAR(2048),
    oauth_scope VARCHAR(255),
    
    sync_enabled BOOLEAN DEFAULT false,
    sync_frequency VARCHAR(50) DEFAULT 'daily',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,
    
    field_mapping JSONB DEFAULT '{}',
    sync_employees BOOLEAN DEFAULT true,
    sync_departments BOOLEAN DEFAULT true,
    sync_managers BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);
```

### 3.14 Integration ERP

Stores ERP system integration configuration.

```sql
CREATE TABLE integration_erp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    provider VARCHAR(50) NOT NULL,
    api_url VARCHAR(2048),
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    
    oauth_client_id VARCHAR(255),
    oauth_client_secret VARCHAR(255),
    oauth_token_url VARCHAR(2048),
    oauth_scope VARCHAR(255),
    
    company_code VARCHAR(50),
    cost_center VARCHAR(50),
    gl_account_mapping JSONB DEFAULT '{}',
    
    export_enabled BOOLEAN DEFAULT false,
    export_frequency VARCHAR(50) DEFAULT 'daily',
    export_format VARCHAR(50) DEFAULT 'json',
    auto_export_on_settlement BOOLEAN DEFAULT false,
    
    last_export_at TIMESTAMP WITH TIME ZONE,
    last_export_status VARCHAR(50),
    last_export_error TEXT,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);
```

### 3.15 Integration Communication

Stores Slack/Teams notification configuration.

```sql
CREATE TABLE integration_communication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    provider VARCHAR(50) NOT NULL,
    
    -- Slack
    slack_workspace_id VARCHAR(255),
    slack_bot_token VARCHAR(255),
    slack_channel_id VARCHAR(255),
    
    -- Microsoft Teams
    teams_tenant_id VARCHAR(255),
    teams_webhook_url VARCHAR(2048),
    teams_channel_id VARCHAR(255),
    
    -- Notification Settings
    notify_on_claim_submitted BOOLEAN DEFAULT true,
    notify_on_claim_approved BOOLEAN DEFAULT true,
    notify_on_claim_rejected BOOLEAN DEFAULT true,
    notify_on_claim_settled BOOLEAN DEFAULT true,
    notify_managers BOOLEAN DEFAULT false,
    notify_finance BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, provider)
);

CREATE INDEX idx_communication_tenant ON integration_communication(tenant_id);
CREATE INDEX idx_communication_active ON integration_communication(tenant_id) WHERE is_active = true;
```

### 3.16 Webhook Delivery Logs

Tracks webhook delivery attempts and status.

```sql
CREATE TABLE webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
    
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    
    status VARCHAR(50) NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    
    attempt_number INTEGER DEFAULT 1,
    duration_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created ON webhook_delivery_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_status ON webhook_delivery_logs(status);
```

### 3.17 Approval Skip Rules

Stores configurable rules for skipping approval levels based on employee designation, email, or project (for CXOs, executives, specific projects, etc.).

```sql
CREATE TABLE approval_skip_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Rule identification
    rule_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Match criteria: 'designation', 'email', or 'project'
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('designation', 'email', 'project')),
    
    -- Designations to match (e.g., ['CEO', 'CTO', 'CFO'])
    designations TEXT[] DEFAULT '{}',
    
    -- Emails to match (e.g., ['ceo@company.com'])
    emails TEXT[] DEFAULT '{}',
    
    -- Project codes to match (e.g., ['PROJ-001', 'PROJ-002'])
    project_codes TEXT[] DEFAULT '{}',
    
    -- Which approval levels to skip
    skip_manager_approval BOOLEAN DEFAULT FALSE,
    skip_hr_approval BOOLEAN DEFAULT FALSE,
    skip_finance_approval BOOLEAN DEFAULT FALSE,
    
    -- Optional constraints
    max_amount_threshold DECIMAL(15, 2),  -- NULL means no limit
    category_codes TEXT[] DEFAULT '{}',   -- Empty array means all categories
    
    -- Rule priority (lower = higher priority, checked first)
    priority INTEGER DEFAULT 100,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_rule_name_per_tenant UNIQUE (tenant_id, rule_name)
);

CREATE INDEX idx_approval_skip_rules_tenant ON approval_skip_rules(tenant_id);
CREATE INDEX idx_approval_skip_rules_active ON approval_skip_rules(tenant_id, is_active);
CREATE INDEX idx_approval_skip_rules_priority ON approval_skip_rules(tenant_id, priority);
CREATE INDEX idx_approval_skip_rules_match_type ON approval_skip_rules(match_type);
```

**Usage Examples:**

```sql
-- Create CEO skip rule
INSERT INTO approval_skip_rules (
    tenant_id, rule_name, description, match_type,
    designations, skip_manager_approval, skip_hr_approval, skip_finance_approval, priority
) VALUES (
    '269102b7-21a1-4353-972b-98e98f446083',
    'CEO Fast Track',
    'Skip all approvals for CEO',
    'designation',
    ARRAY['CEO'],
    true, true, true,
    1
);

-- Create VP skip rule with amount limit
INSERT INTO approval_skip_rules (
    tenant_id, rule_name, description, match_type,
    designations, skip_manager_approval, max_amount_threshold, priority
) VALUES (
    '269102b7-21a1-4353-972b-98e98f446083',
    'VP Manager Skip',
    'Skip manager approval for VPs (claims under 50000)',
    'designation',
    ARRAY['VP', 'SVP', 'EVP'],
    true,
    50000,
    10
);
```

---

## 4. Performance Indexes

### 4.1 Composite Indexes

```sql
-- Common query patterns
CREATE INDEX idx_claims_tenant_status_date 
    ON claims(tenant_id, status, created_at DESC);

CREATE INDEX idx_claims_tenant_user_status 
    ON claims(tenant_id, user_id, status);

CREATE INDEX idx_approvals_pending_stage 
    ON approvals(tenant_id, approver_id, status) 
    WHERE status = 'PENDING';
```

### 4.2 Partial Indexes

```sql
-- Active claims only
CREATE INDEX idx_claims_active 
    ON claims(tenant_id, status, created_at) 
    WHERE status NOT IN ('SETTLED', 'CANCELLED');

-- Pending approvals
CREATE INDEX idx_approvals_waiting 
    ON approvals(approver_id, created_at) 
    WHERE status = 'PENDING';
```

---

## 5. Migration Example

```python
# Alembic migration example
"""Add full-text search indexes

Revision ID: abc123
"""

from alembic import op

def upgrade():
    # Full-text search on claims
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_claims_fts ON claims 
        USING gin(to_tsvector('english', 
            coalesce(description, '') || ' ' || 
            coalesce(claim_number, '')
        ));
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_claims_fts;")
```

---

*Document Version: 1.0 | Last Updated: December 2025*
