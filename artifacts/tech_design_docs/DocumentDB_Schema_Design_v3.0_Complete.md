# DocumentDB.io Schema Design v3.0 - Complete
## Agentic AI Reimbursement System

**Version:** 3.0  
**Date:** December 2024  
**Database:** DocumentDB.io (PostgreSQL-based with MongoDB API)  
**Features:** Vector embeddings, Full-text search, ACID transactions, BSON support

---

## Overview

This schema leverages **DocumentDB.io's unique capabilities**:
- ✅ **PostgreSQL backbone** with pgvector, full-text search, ACID transactions
- ✅ **MongoDB-compatible API** for flexible document modeling
- ✅ **Vector embeddings** for semantic search (policy RAG, claim similarity)
- ✅ **Full-text search** for OCR text, documents, comments
- ✅ **Hybrid queries** using both SQL and MongoDB syntax
- ✅ **Provenance tracking** for data lineage (OCR → Manual → Edited)

---

## Table of Contents

1. [Extensions & Setup](#1-extensions--setup)
2. [Core Tables](#2-core-tables)
3. [Supporting Tables](#3-supporting-tables)
4. [Vector Embeddings Tables](#4-vector-embeddings-tables)
5. [Agent & Audit Tables](#5-agent--audit-tables)
6. [Indexes & Performance](#6-indexes--performance)
7. [Common Queries](#7-common-queries)
8. [MongoDB API Usage](#8-mongodb-api-usage)

---

## 1. Extensions & Setup

### 1.1 Required PostgreSQL Extensions

```sql
-- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Full-text search with trigram similarity
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Vector embeddings (1536-dim for OpenAI/Gemini)
CREATE EXTENSION IF NOT EXISTS "vector";

-- JSONB operators
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### 1.2 Database Configuration

```sql
-- Optimize for JSONB workloads
ALTER DATABASE reimbursement_db SET work_mem = '256MB';
ALTER DATABASE reimbursement_db SET maintenance_work_mem = '512MB';

-- Vector search optimization
ALTER DATABASE reimbursement_db SET shared_preload_libraries = 'vector';
```

---

## 2. Core Tables

### 2.1 Claims Table

**Purpose:** Main claim records with OCR tracking, HR corrections, return workflow, settlement

```sql
CREATE TABLE claims (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  claim_number TEXT UNIQUE NOT NULL,
  
  -- Employee & Claim Info
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT,
  claim_type TEXT NOT NULL, -- REIMBURSEMENT or ALLOWANCE
  category TEXT NOT NULL,    -- CERTIFICATION, TRAVEL, TEAM_LUNCH, ONCALL
  
  -- Financial
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  
  -- Status & Workflow
  status TEXT NOT NULL DEFAULT 'DRAFT',
  -- Status values: DRAFT, SUBMITTED, AI_PROCESSING, PENDING_MANAGER, 
  --   RETURNED_TO_EMPLOYEE, MANAGER_APPROVED, PENDING_HR, HR_APPROVED,
  --   PENDING_FINANCE, FINANCE_APPROVED, SETTLED, REJECTED
  
  -- Dates
  submission_date TIMESTAMPTZ,
  claim_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Description
  description TEXT,
  
  -- Complete claim payload (JSONB for flexibility)
  claim_payload JSONB NOT NULL DEFAULT '{}',
  -- Structure:
  -- {
  --   "fields": { see OCR Tracking structure below },
  --   "documents": [{ "doc_id": "uuid", "type": "invoice", "filename": "..." }],
  --   "validation": { see Validation structure below },
  --   "hr_corrections": { see HR Corrections below },
  --   "return_tracking": { see Return Tracking below },
  --   "settlement": { see Settlement below }
  -- }
  
  -- OCR extracted text (for full-text search)
  ocr_text TEXT,
  ocr_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(ocr_text, '') || ' ' || 
      coalesce(employee_name, '') || ' ' || 
      coalesce(description, '')
    )
  ) STORED,
  
  -- Denormalized fields for fast queries
  total_amount NUMERIC(12,2),
  
  -- Return workflow tracking
  returned_by UUID,
  returned_at TIMESTAMPTZ,
  return_reason TEXT,
  return_count INT DEFAULT 0,
  can_edit BOOLEAN DEFAULT false,
  
  -- Settlement tracking
  settled BOOLEAN DEFAULT false,
  settled_date TIMESTAMPTZ,
  settled_by UUID,
  payment_reference TEXT,
  payment_method TEXT, -- NEFT, RTGS, CHEQUE, CASH
  amount_paid NUMERIC(12,2),
  
  CONSTRAINT valid_status CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'AI_PROCESSING', 'PENDING_MANAGER',
    'RETURNED_TO_EMPLOYEE', 'MANAGER_APPROVED', 'PENDING_HR',
    'HR_APPROVED', 'PENDING_FINANCE', 'FINANCE_APPROVED',
    'SETTLED', 'REJECTED'
  )),
  CONSTRAINT valid_claim_type CHECK (claim_type IN ('REIMBURSEMENT', 'ALLOWANCE')),
  CONSTRAINT valid_payment_method CHECK (payment_method IS NULL OR payment_method IN 
    ('NEFT', 'RTGS', 'CHEQUE', 'CASH', 'UPI'))
);

-- Indexes
CREATE INDEX idx_claims_tenant ON claims (tenant_id);
CREATE INDEX idx_claims_employee ON claims (employee_id);
CREATE INDEX idx_claims_status ON claims (status);
CREATE INDEX idx_claims_status_employee ON claims (status, employee_id);
CREATE INDEX idx_claims_amount ON claims (amount);
CREATE INDEX idx_claims_submission_date ON claims (submission_date);
CREATE INDEX idx_claims_claim_number ON claims (claim_number);

-- JSONB indexes for fast querying
CREATE INDEX idx_claims_payload_gin ON claims USING gin (claim_payload jsonb_path_ops);

-- Full-text search index
CREATE INDEX idx_claims_ocr_tsv ON claims USING gin (ocr_tsv);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_updated_at
BEFORE UPDATE ON claims
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

#### JSONB Payload Structures

**OCR Tracking in claim_payload.fields:**
```json
{
  "fields": {
    "amount": {
      "value": 15000,
      "source": "OCR",
      "confidence": 0.97,
      "edited": false,
      "edit_history": [],
      "original_ocr_value": 15000,
      "ocr_timestamp": "2024-12-10T10:00:00Z"
    },
    "date": {
      "value": "2024-12-05",
      "source": "OCR_EDITED",
      "confidence": 0.89,
      "edited": true,
      "edit_history": [
        {"timestamp": "2024-12-10T10:30:00Z", "old_value": "2024-12-04", "new_value": "2024-12-05", "user_id": "emp_123"}
      ],
      "original_ocr_value": "2024-12-04"
    },
    "vendor": {
      "value": "Coursera",
      "source": "MANUAL",
      "confidence": 1.0,
      "edited": false,
      "edit_history": []
    }
  }
}
```

**Validation Results in claim_payload.validation:**
```json
{
  "validation": {
    "agent_name": "validation_agent",
    "executed_at": "2024-12-10T10:05:00Z",
    "confidence": 0.95,
    "recommendation": "AUTO_APPROVE",
    "reasoning": "All policy rules satisfied. Amount within limit, tenure verified, documents complete.",
    "rules_checked": [
      {"rule_id": "CERT_AMOUNT", "result": "pass", "evidence": "15000 <= 25000"},
      {"rule_id": "CERT_TENURE", "result": "pass", "evidence": "18 months >= 6 months"},
      {"rule_id": "CERT_DOCS", "result": "pass", "evidence": "certificate + invoice present"}
    ],
    "llm_used": false
  }
}
```

**HR Corrections in claim_payload.hr_corrections:**
```json
{
  "hr_corrections": {
    "claim_type_changed": true,
    "original_claim_type": "TRAVEL",
    "corrected_claim_type": "CERTIFICATION",
    "type_change_reason": "Employee uploaded certification docs but selected travel",
    "type_changed_by": "hr_user_456",
    "type_changed_at": "2024-12-10T14:00:00Z",
    
    "amount_adjusted": true,
    "original_amount": 26500,
    "approved_amount": 25000,
    "amount_adjustment_reason": "Policy maximum enforced",
    "amount_adjusted_by": "hr_user_456",
    "amount_adjusted_at": "2024-12-10T14:00:00Z"
  }
}
```

**Return Tracking in claim_payload.return_tracking:**
```json
{
  "return_tracking": {
    "return_history": [
      {
        "returned_by": "mgr_789",
        "returned_at": "2024-12-10T11:00:00Z",
        "return_reason": "Please verify attendee count - shows 12 but typical team size is 8",
        "resubmitted_at": "2024-12-10T15:00:00Z",
        "changes_made": "Updated attendee count from 12 to 10"
      }
    ]
  }
}
```

**Settlement in claim_payload.settlement:**
```json
{
  "settlement": {
    "settled": true,
    "settled_date": "2024-12-11T09:00:00Z",
    "settled_by": "fin_user_101",
    "payment_reference": "NEFT2024121100123456",
    "payment_method": "NEFT",
    "bank_transaction_id": "TXN789012",
    "settlement_notes": "Regular monthly disbursement batch",
    "amount_paid": 25000,
    "settlement_batch_id": "BATCH-2024-12-001"
  }
}
```

---

### 2.2 Comments Table

**Purpose:** Multi-role commenting system for complete audit trail

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  
  -- User info
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL, -- EMPLOYEE, MANAGER, HR, FINANCE, SYSTEM
  
  -- Comment
  comment_text TEXT NOT NULL,
  commented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Edit tracking
  edited BOOLEAN DEFAULT false,
  edit_history JSONB DEFAULT '[]',
  
  -- Visibility
  visible_to TEXT[] DEFAULT ARRAY['EMPLOYEE', 'MANAGER', 'HR', 'FINANCE'],
  
  -- Auto-generated flag
  auto_generated BOOLEAN DEFAULT false,
  source_action TEXT, -- return_to_employee, hr_correction, etc.
  
  CONSTRAINT valid_user_role CHECK (user_role IN (
    'EMPLOYEE', 'MANAGER', 'HR', 'FINANCE', 'SYSTEM'
  ))
);

CREATE INDEX idx_comments_claim ON comments (claim_id);
CREATE INDEX idx_comments_user ON comments (user_id);
CREATE INDEX idx_comments_date ON comments (commented_at DESC);
CREATE INDEX idx_comments_text_fts ON comments USING gin (to_tsvector('english', comment_text));
```

---

### 2.3 Employees Table

**Purpose:** Employee master data with HRMS sync capability

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Identity
  employee_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  
  -- Organization
  department TEXT,
  designation TEXT,
  grade TEXT,
  joining_date DATE NOT NULL,
  termination_date DATE,
  
  -- Hierarchy
  manager_id UUID REFERENCES employees(id),
  
  -- Bank details (encrypted at application level)
  bank_details JSONB DEFAULT '{}',
  -- {
  --   "account_number": "encrypted_value",
  --   "ifsc_code": "HDFC0001234",
  --   "bank_name": "HDFC Bank",
  --   "account_holder_name": "John Doe"
  -- }
  
  -- Integration
  synced_from_hrms BOOLEAN DEFAULT false,
  hrms_employee_id TEXT,
  last_hrms_sync TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employees_tenant ON employees (tenant_id);
CREATE INDEX idx_employees_email ON employees (email);
CREATE INDEX idx_employees_employee_id ON employees (employee_id);
CREATE INDEX idx_employees_manager ON employees (manager_id);
CREATE INDEX idx_employees_department ON employees (department);
CREATE INDEX idx_employees_active ON employees (is_active);

CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

### 2.4 Projects Table

**Purpose:** Project master with budget tracking

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Identity
  project_code TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  
  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Management
  manager_id UUID REFERENCES employees(id),
  
  -- Budget tracking
  budget_total NUMERIC(15,2),
  budget_used NUMERIC(15,2) DEFAULT 0,
  budget_remaining NUMERIC(15,2) GENERATED ALWAYS AS (budget_total - budget_used) STORED,
  
  -- Reimbursement-specific budget
  reimbursement_budget JSONB DEFAULT '{}',
  -- {
  --   "total": 500000,
  --   "used": 325000,
  --   "remaining": 175000,
  --   "by_category": {
  --     "certification": {"total": 100000, "used": 45000},
  --     "travel": {"total": 300000, "used": 200000}
  --   }
  -- }
  
  -- Policy flags
  allows_certification_reimbursement BOOLEAN DEFAULT true,
  allows_travel_reimbursement BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_tenant ON projects (tenant_id);
CREATE INDEX idx_projects_code ON projects (project_code);
CREATE INDEX idx_projects_manager ON projects (manager_id);
CREATE INDEX idx_projects_active ON projects (is_active);

CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

### 2.5 Timesheets Table

**Purpose:** Timesheet data for on-call allowance validation

```sql
CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Employee & Project
  employee_id UUID NOT NULL REFERENCES employees(id),
  project_code TEXT REFERENCES projects(project_code),
  
  -- Date info
  date DATE NOT NULL,
  is_weekend BOOLEAN,
  is_holiday BOOLEAN,
  
  -- Work details
  hours_worked NUMERIC(4,2),
  is_oncall BOOLEAN DEFAULT false,
  
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'MANUAL_ENTRY', -- MANUAL_ENTRY, KRONOS_SYNC
  entered_by UUID,
  entered_at TIMESTAMPTZ DEFAULT now(),
  
  -- Integration
  synced_from_kronos BOOLEAN DEFAULT false,
  kronos_entry_id TEXT,
  last_sync TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_source CHECK (source IN ('MANUAL_ENTRY', 'KRONOS_SYNC')),
  CONSTRAINT valid_hours CHECK (hours_worked >= 0 AND hours_worked <= 24),
  UNIQUE(employee_id, date, project_code)
);

CREATE INDEX idx_timesheets_employee ON timesheets (employee_id);
CREATE INDEX idx_timesheets_date ON timesheets (date);
CREATE INDEX idx_timesheets_employee_date ON timesheets (employee_id, date);
CREATE INDEX idx_timesheets_oncall ON timesheets (is_oncall) WHERE is_oncall = true;
```

---

### 2.6 Policies Table

**Purpose:** Company reimbursement policies

```sql
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Identity
  policy_id TEXT UNIQUE NOT NULL,
  policy_version TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  
  -- Category
  category TEXT NOT NULL, -- CERTIFICATION, TRAVEL, TEAM_LUNCH, ONCALL
  
  -- Effective dates
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Policy content
  policy_text TEXT NOT NULL, -- Full policy document text
  policy_rules JSONB NOT NULL, -- Machine-readable rules
  -- {
  --   "max_amount": 25000,
  --   "min_tenure_months": 6,
  --   "required_documents": ["certificate", "invoice"],
  --   "fiscal_year_limit": 25000,
  --   "requires_manager_approval": true,
  --   "special_conditions": { ... }
  -- }
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_category CHECK (category IN (
    'CERTIFICATION', 'TRAVEL_DOMESTIC', 'TRAVEL_INTERNATIONAL',
    'TEAM_LUNCH', 'ONCALL_ALLOWANCE', 'GENERAL'
  ))
);

CREATE INDEX idx_policies_tenant ON policies (tenant_id);
CREATE INDEX idx_policies_category ON policies (category);
CREATE INDEX idx_policies_active ON policies (is_active);
CREATE INDEX idx_policies_effective ON policies (effective_from, effective_to);
CREATE INDEX idx_policies_text_fts ON policies USING gin (to_tsvector('english', policy_text));

CREATE TRIGGER trg_policies_updated_at
BEFORE UPDATE ON policies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. Supporting Tables

### 3.1 Documents Table

**Purpose:** Document metadata and OCR text storage

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  
  -- Storage
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  
  -- Document info
  document_type TEXT NOT NULL, -- invoice, receipt, certificate, ticket, etc.
  page_count INT,
  
  -- OCR
  ocr_text TEXT,
  ocr_confidence NUMERIC(3,2),
  ocr_processed_at TIMESTAMPTZ,
  text_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(ocr_text, '') || ' ' || coalesce(file_name, ''))
  ) STORED,
  
  -- Fraud detection
  fraud_flags JSONB DEFAULT '[]',
  -- [
  --   {"type": "image_manipulation", "confidence": 0.23, "details": "..."},
  --   {"type": "suspicious_metadata", "confidence": 0.67, "details": "..."}
  -- ]
  
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID,
  
  CONSTRAINT valid_document_type CHECK (document_type IN (
    'invoice', 'receipt', 'certificate', 'ticket', 'hotel_receipt',
    'boarding_pass', 'photo', 'other'
  ))
);

CREATE INDEX idx_documents_claim ON documents (claim_id);
CREATE INDEX idx_documents_type ON documents (document_type);
CREATE INDEX idx_documents_text_fts ON documents USING gin (text_tsv);
```

---

### 3.2 Approvals Table

**Purpose:** Approval history and routing

```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  
  -- Approver
  approver_id UUID NOT NULL,
  approver_name TEXT NOT NULL,
  approver_role TEXT NOT NULL, -- MANAGER, HR, FINANCE
  
  -- Action
  action TEXT NOT NULL, -- APPROVED, REJECTED, RETURNED, COMMENTED
  action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Details
  comments TEXT,
  previous_status TEXT,
  new_status TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT valid_action CHECK (action IN (
    'APPROVED', 'REJECTED', 'RETURNED', 'COMMENTED', 'SETTLED'
  ))
);

CREATE INDEX idx_approvals_claim ON approvals (claim_id);
CREATE INDEX idx_approvals_approver ON approvals (approver_id);
CREATE INDEX idx_approvals_date ON approvals (action_at DESC);
```

---

### 3.3 Settlements Table

**Purpose:** Payment settlement tracking (individual & bulk)

```sql
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Settlement info
  settlement_batch_id TEXT UNIQUE NOT NULL,
  settlement_type TEXT NOT NULL, -- SINGLE, BATCH
  
  -- Claims
  claim_ids UUID[] NOT NULL,
  
  -- Payment
  settled_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_by UUID NOT NULL,
  payment_reference TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  
  -- Bank transaction
  bank_transaction_details JSONB DEFAULT '{}',
  -- {
  --   "transaction_id": "TXN123456",
  --   "status": "SUCCESS",
  --   "bank_name": "HDFC",
  --   "processed_at": "2024-12-11T09:30:00Z"
  -- }
  
  -- Notes
  settlement_notes TEXT,
  
  CONSTRAINT valid_settlement_type CHECK (settlement_type IN ('SINGLE', 'BATCH')),
  CONSTRAINT valid_payment_method CHECK (payment_method IN (
    'NEFT', 'RTGS', 'CHEQUE', 'CASH', 'UPI', 'IMPS'
  ))
);

CREATE INDEX idx_settlements_batch_id ON settlements (settlement_batch_id);
CREATE INDEX idx_settlements_date ON settlements (settled_date DESC);
CREATE INDEX idx_settlements_settled_by ON settlements (settled_by);
CREATE INDEX idx_settlements_claim_ids ON settlements USING gin (claim_ids);
```

---

### 3.4 Notifications Table

**Purpose:** Notification queue for email/SMS

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient
  recipient_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_phone TEXT,
  
  -- Notification
  notification_type TEXT NOT NULL, -- EMAIL, SMS, PUSH
  template_id TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  
  -- Related entity
  entity_type TEXT, -- claim, comment, settlement
  entity_id UUID,
  
  -- Status
  status TEXT DEFAULT 'PENDING', -- PENDING, SENT, FAILED
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_notification_type CHECK (notification_type IN ('EMAIL', 'SMS', 'PUSH')),
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_id);
CREATE INDEX idx_notifications_status ON notifications (status);
CREATE INDEX idx_notifications_entity ON notifications (entity_type, entity_id);
```

---

## 4. Vector Embeddings Tables

### 4.1 Policy Embeddings Table

**Purpose:** Vector embeddings for policy RAG (Retrieval-Augmented Generation)

```sql
CREATE TABLE policy_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Policy reference
  policy_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  
  -- Content
  text TEXT NOT NULL,
  
  -- Embedding (1536-dim for OpenAI/Gemini)
  embedding vector(1536),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  -- {
  --   "category": "CERTIFICATION",
  --   "section_name": "Amount Limits",
  --   "version": "v2.5",
  --   "token_count": 450
  -- }
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(policy_id, section_id)
);

-- Vector similarity index (IVFFlat algorithm)
CREATE INDEX idx_policy_embedding_vec ON policy_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Full-text search index
CREATE INDEX idx_policy_text_fts ON policy_embeddings 
USING gin (to_tsvector('english', text));

-- Regular indexes
CREATE INDEX idx_policy_embeddings_policy ON policy_embeddings (policy_id);
```

---

### 4.2 Claim Embeddings Table

**Purpose:** Claim semantic search for similar claims detection

```sql
CREATE TABLE claim_embeddings (
  claim_id UUID PRIMARY KEY REFERENCES claims(id) ON DELETE CASCADE,
  
  -- Embedding generated from claim description + category + amount
  embedding vector(1536),
  
  -- Metadata
  embedding_model TEXT DEFAULT 'gemini-1.5-pro',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity index
CREATE INDEX idx_claim_embeddings_vec ON claim_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE TRIGGER trg_claim_embeddings_updated_at
BEFORE UPDATE ON claim_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Usage Example:**
```sql
-- Find similar claims to detect patterns or fraud
SELECT 
  c.id,
  c.claim_number,
  c.employee_name,
  c.amount,
  ce.embedding <-> :query_embedding AS similarity_distance
FROM claims c
JOIN claim_embeddings ce ON c.id = ce.claim_id
ORDER BY ce.embedding <-> :query_embedding
LIMIT 10;
```

---

## 5. Agent & Audit Tables

### 5.1 Agent Traces Table

**Purpose:** Detailed agent execution logs with provenance

```sql
CREATE TABLE agent_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Related claim
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  
  -- Agent info
  agent_name TEXT NOT NULL,
  agent_version TEXT,
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Execution
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ,
  duration_ms INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_ts - start_ts)) * 1000
  ) STORED,
  
  -- Steps (detailed execution trace)
  steps JSONB DEFAULT '[]',
  -- [
  --   {
  --     "step": 1,
  --     "tool": "ocr_service",
  --     "input_refs": ["doc:uuid"],
  --     "output": {"amount": 15000, "date": "2024-12-05"},
  --     "confidence": 0.92,
  --     "duration_ms": 1250
  --   },
  --   {
  --     "step": 2,
  --     "tool": "rules_engine",
  --     "input": {"amount": 15000, "tenure": 18},
  --     "output": {"rules_passed": 3, "rules_failed": 0},
  --     "confidence": 0.99,
  --     "duration_ms": 45
  --   }
  -- ]
  
  -- Verdict
  verdict JSONB DEFAULT '{}',
  -- {
  --   "recommendation": "AUTO_APPROVE",
  --   "confidence": 0.95,
  --   "reasoning": "All checks passed",
  --   "flags": []
  -- }
  
  -- Raw log (for debugging)
  raw_log TEXT,
  
  -- Status
  status TEXT DEFAULT 'SUCCESS', -- SUCCESS, FAILURE, TIMEOUT
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_agent_name CHECK (agent_name IN (
    'orchestrator', 'document', 'validation', 'integration', 
    'approval', 'learning'
  )),
  CONSTRAINT valid_status CHECK (status IN ('SUCCESS', 'FAILURE', 'TIMEOUT'))
);

CREATE INDEX idx_agent_traces_claim ON agent_traces (claim_id);
CREATE INDEX idx_agent_traces_agent ON agent_traces (agent_name);
CREATE INDEX idx_agent_traces_run ON agent_traces (run_id);
CREATE INDEX idx_agent_traces_date ON agent_traces (start_ts DESC);
CREATE INDEX idx_agent_traces_steps_gin ON agent_traces USING gin (steps jsonb_path_ops);
```

---

### 5.2 Audit Logs Table

**Purpose:** Append-only audit trail for compliance

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity
  entity_type TEXT NOT NULL, -- claim, comment, employee, project, policy
  entity_id UUID,
  
  -- Actor
  actor_type TEXT NOT NULL, -- USER, AGENT, SYSTEM
  actor_id TEXT,
  actor_name TEXT,
  
  -- Action
  action TEXT NOT NULL, -- created, updated, deleted, approved, rejected, etc.
  
  -- Changes (JSON diff)
  payload JSONB DEFAULT '{}',
  -- {
  --   "changes": {
  --     "status": {"old": "PENDING_MANAGER", "new": "MANAGER_APPROVED"},
  --     "amount": {"old": 26500, "new": 25000}
  --   },
  --   "metadata": {"ip_address": "192.168.1.100", "user_agent": "..."}
  -- }
  
  -- PII redaction flag
  pii_redacted BOOLEAN DEFAULT false,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_entity_type CHECK (entity_type IN (
    'claim', 'comment', 'employee', 'project', 'policy',
    'document', 'approval', 'settlement', 'timesheet'
  )),
  CONSTRAINT valid_actor_type CHECK (actor_type IN ('USER', 'AGENT', 'SYSTEM'))
);

-- No updates or deletes allowed on audit_logs (append-only)
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs (actor_type, actor_id);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_date ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_payload_gin ON audit_logs USING gin (payload jsonb_path_ops);
```

---

### 5.3 Learnings Table

**Purpose:** ML model improvements and pattern detection

```sql
CREATE TABLE learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Learning type
  learning_type TEXT NOT NULL, -- ocr_improvement, policy_gap, fraud_pattern, accuracy_metric
  
  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Data
  learning_data JSONB NOT NULL,
  -- Examples:
  -- OCR improvement: {"field": "amount", "document_type": "invoice", "error_rate": 0.15}
  -- Policy gap: {"category": "TRAVEL", "ambiguous_scenario": "...", "frequency": 12}
  -- Fraud pattern: {"pattern": "duplicate_invoice", "detection_count": 5}
  
  -- Impact
  impact_score NUMERIC(3,2), -- 0.0 to 1.0
  priority TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
  
  -- Status
  status TEXT DEFAULT 'NEW', -- NEW, REVIEWED, IMPLEMENTED, DISMISSED
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_learning_type CHECK (learning_type IN (
    'ocr_improvement', 'policy_gap', 'fraud_pattern', 
    'accuracy_metric', 'process_optimization'
  )),
  CONSTRAINT valid_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  CONSTRAINT valid_status CHECK (status IN ('NEW', 'REVIEWED', 'IMPLEMENTED', 'DISMISSED'))
);

CREATE INDEX idx_learnings_type ON learnings (learning_type);
CREATE INDEX idx_learnings_priority ON learnings (priority);
CREATE INDEX idx_learnings_status ON learnings (status);
CREATE INDEX idx_learnings_date ON learnings (created_at DESC);
```

---

## 6. Indexes & Performance

### 6.1 Summary of Indexes

**Claims Table:**
- B-tree indexes on: tenant_id, employee_id, status, amount, dates
- GIN index on: claim_payload (JSONB)
- GIN index on: ocr_tsv (full-text search)
- Composite indexes for common queries

**Vector Indexes:**
- IVFFlat indexes on policy_embeddings.embedding
- IVFFlat indexes on claim_embeddings.embedding

**Full-Text Search Indexes:**
- GIN indexes on all text columns with tsvector

### 6.2 Performance Tuning

```sql
-- Analyze tables periodically
ANALYZE claims;
ANALYZE policy_embeddings;
ANALYZE claim_embeddings;

-- Vacuum to reclaim space
VACUUM ANALYZE claims;

-- Update vector index statistics
SELECT ivfflat_build_statistics('idx_policy_embedding_vec');
```

### 6.3 Partitioning Strategy (Optional)

For high-volume deployments, partition large tables:

```sql
-- Partition claims by submission month
CREATE TABLE claims_2024_12 PARTITION OF claims
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Partition audit_logs by month
CREATE TABLE audit_logs_2024_12 PARTITION OF audit_logs
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

---

## 7. Common Queries

### 7.1 Get Pending Claims for Manager

```sql
SELECT 
  id,
  claim_number,
  employee_name,
  category,
  amount,
  submission_date,
  claim_payload->'validation'->>'confidence' as ai_confidence
FROM claims
WHERE status = 'PENDING_MANAGER'
  AND claim_payload @> '{"validation": {"recommendation": "MANAGER_REVIEW"}}'
ORDER BY submission_date ASC;
```

### 7.2 Full-Text Search on OCR Text

```sql
SELECT 
  c.id,
  c.claim_number,
  c.employee_name,
  c.amount,
  ts_rank(c.ocr_tsv, plainto_tsquery('english', 'travel invoice')) AS rank
FROM claims c
WHERE c.ocr_tsv @@ plainto_tsquery('english', 'travel invoice')
ORDER BY rank DESC
LIMIT 20;
```

### 7.3 Vector Similarity - Find Relevant Policy Sections

```sql
-- Find top 5 most relevant policy sections for a claim
SELECT 
  pe.id,
  pe.policy_id,
  pe.section_id,
  pe.text,
  pe.embedding <-> :query_embedding AS distance,
  pe.metadata->>'category' as category
FROM policy_embeddings pe
ORDER BY pe.embedding <-> :query_embedding
LIMIT 5;
```

### 7.4 Detect Similar Claims (Fraud Detection)

```sql
-- Find claims similar to current claim
SELECT 
  c.id,
  c.claim_number,
  c.employee_name,
  c.amount,
  c.status,
  ce.embedding <=> :current_claim_embedding AS similarity
FROM claims c
JOIN claim_embeddings ce ON c.id = ce.claim_id
WHERE c.id != :current_claim_id
  AND c.status != 'REJECTED'
ORDER BY similarity ASC
LIMIT 10;
```

### 7.5 Claims with Returns (Multiple Iterations)

```sql
SELECT 
  id,
  claim_number,
  employee_name,
  return_count,
  claim_payload->'return_tracking'->'return_history' as return_history
FROM claims
WHERE return_count > 0
ORDER BY return_count DESC;
```

### 7.6 Agent Performance Analytics

```sql
-- Average execution time by agent
SELECT 
  agent_name,
  COUNT(*) as total_runs,
  AVG(duration_ms) as avg_duration_ms,
  MIN(duration_ms) as min_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
FROM agent_traces
WHERE start_ts > now() - interval '7 days'
GROUP BY agent_name
ORDER BY avg_duration_ms DESC;
```

### 7.7 Settlement Summary

```sql
-- Monthly settlement summary
SELECT 
  DATE_TRUNC('month', settled_date) as month,
  COUNT(*) as total_settlements,
  SUM(total_amount) as total_amount_paid,
  payment_method,
  settlement_type
FROM settlements
GROUP BY month, payment_method, settlement_type
ORDER BY month DESC;
```

---

## 8. MongoDB API Usage

DocumentDB.io supports MongoDB-compatible API alongside SQL. Here are examples:

### 8.1 Insert Claim (MongoDB Syntax)

```javascript
db.claims.insertOne({
  tenant_id: UUID("..."),
  claim_number: "CLM-2024-050",
  employee_id: UUID("..."),
  employee_name: "John Doe",
  claim_type: "REIMBURSEMENT",
  category: "CERTIFICATION",
  amount: 15000,
  currency: "INR",
  status: "SUBMITTED",
  claim_payload: {
    fields: {
      amount: {
        value: 15000,
        source: "OCR",
        confidence: 0.97
      }
    },
    documents: [
      {doc_id: UUID("..."), type: "certificate"}
    ]
  }
});
```

### 8.2 Query Claims (MongoDB Syntax)

```javascript
// Find pending manager claims
db.claims.find({
  status: "PENDING_MANAGER",
  "claim_payload.validation.recommendation": "MANAGER_REVIEW"
}).sort({submission_date: 1});

// Full-text search on OCR text
db.claims.find({
  $text: {$search: "travel invoice"}
}).sort({score: {$meta: "textScore"}});
```

### 8.3 Update Claim (MongoDB Syntax)

```javascript
// Manager approves claim
db.claims.updateOne(
  {_id: UUID("...")},
  {
    $set: {
      status: "MANAGER_APPROVED",
      updated_at: new Date()
    },
    $push: {
      "claim_payload.approvals": {
        approver_id: UUID("..."),
        action: "APPROVED",
        timestamp: new Date()
      }
    }
  }
);
```

### 8.4 Vector Search (MongoDB Syntax with $near)

```javascript
// Find similar policy sections
db.policy_embeddings.aggregate([
  {
    $search: {
      index: "policy_vector_index",
      knnBeta: {
        vector: [...query_embedding],
        path: "embedding",
        k: 5
      }
    }
  },
  {
    $project: {
      policy_id: 1,
      text: 1,
      score: {$meta: "searchScore"}
    }
  }
]);
```

---

## 9. Security Best Practices

### 9.1 Data Encryption

```sql
-- Enable encryption at rest (DocumentDB config)
ALTER DATABASE reimbursement_db SET encrypt_data_at_rest = true;

-- TLS for connections
ALTER DATABASE reimbursement_db SET ssl = on;
```

### 9.2 Row-Level Security (RLS)

```sql
-- Enable RLS on claims table
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only see their own claims
CREATE POLICY employee_claims_policy ON claims
FOR SELECT
TO employee_role
USING (employee_id = current_setting('app.current_user_id')::UUID);

-- Policy: Managers can see their team's claims
CREATE POLICY manager_claims_policy ON claims
FOR SELECT
TO manager_role
USING (
  employee_id IN (
    SELECT id FROM employees WHERE manager_id = current_setting('app.current_user_id')::UUID
  )
);

-- Policy: HR and Finance can see all claims
CREATE POLICY hr_finance_claims_policy ON claims
FOR SELECT
TO hr_role, finance_role
USING (true);
```

### 9.3 PII Redaction

```sql
-- Function to redact PII from audit logs
CREATE OR REPLACE FUNCTION redact_pii(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Redact email addresses
  input_text := regexp_replace(input_text, '\w+@\w+\.\w+', '[REDACTED_EMAIL]', 'g');
  -- Redact phone numbers
  input_text := regexp_replace(input_text, '\d{10}', '[REDACTED_PHONE]', 'g');
  -- Redact account numbers
  input_text := regexp_replace(input_text, '\d{10,16}', '[REDACTED_ACCOUNT]', 'g');
  RETURN input_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 10. Backup & Recovery

### 10.1 Backup Strategy

```bash
# Full database backup
pg_dump -h documentdb-host -U admin reimbursement_db > backup_$(date +%Y%m%d).sql

# Backup specific tables
pg_dump -h documentdb-host -U admin -t claims -t comments reimbursement_db > claims_backup.sql

# Incremental backup using WAL archiving
# Configure in postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /backup/wal/%f'
```

### 10.2 Point-in-Time Recovery

```bash
# Restore from backup
psql -h documentdb-host -U admin reimbursement_db < backup_20241211.sql

# Point-in-time recovery
pg_restore --dbname=reimbursement_db --create --verbose backup.dump
```

---

## 11. Monitoring & Observability

### 11.1 Key Metrics to Track

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'reimbursement_db';

-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- queries taking > 1 second
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

## 12. Migration Scripts

### 12.1 Initial Setup Script

```sql
-- Run this script to create all tables
\i extensions.sql
\i claims_table.sql
\i comments_table.sql
\i employees_table.sql
\i projects_table.sql
\i timesheets_table.sql
\i policies_table.sql
\i documents_table.sql
\i approvals_table.sql
\i settlements_table.sql
\i notifications_table.sql
\i policy_embeddings_table.sql
\i claim_embeddings_table.sql
\i agent_traces_table.sql
\i audit_logs_table.sql
\i learnings_table.sql
\i indexes.sql
\i triggers.sql
```

### 12.2 Sample Data Script

```sql
-- Insert sample tenant
INSERT INTO tenants (id, name) VALUES 
  (gen_random_uuid(), 'Acme Corporation');

-- Insert sample employees
INSERT INTO employees (tenant_id, employee_id, name, email, department, joining_date)
VALUES 
  (:tenant_id, 'EMP001', 'John Doe', 'john@acme.com', 'Engineering', '2022-01-15'),
  (:tenant_id, 'EMP002', 'Jane Smith', 'jane@acme.com', 'Marketing', '2021-06-10');

-- Insert sample policy
INSERT INTO policies (tenant_id, policy_id, policy_version, policy_name, category, effective_from, policy_text, policy_rules)
VALUES (
  :tenant_id,
  'CERT_POLICY_V2',
  'v2.5',
  'Certification Reimbursement Policy',
  'CERTIFICATION',
  '2024-01-01',
  'Employees can claim up to ₹25,000 per fiscal year for professional certifications...',
  '{"max_amount": 25000, "min_tenure_months": 6, "required_documents": ["certificate", "invoice"]}'::jsonb
);
```

---

## Appendix A: Data Types Reference

| Field Type | PostgreSQL Type | MongoDB BSON Type |
|------------|----------------|-------------------|
| ID | UUID | ObjectId |
| Text | TEXT, VARCHAR | String |
| Number | NUMERIC, INT | Number, Decimal128 |
| Date | DATE, TIMESTAMPTZ | Date, ISODate |
| Boolean | BOOLEAN | Boolean |
| JSON | JSONB | Object, Array |
| Vector | vector(1536) | Array of Float |
| Array | TEXT[], UUID[] | Array |

---

## Appendix B: Glossary

- **IVFFlat**: Inverted File Flat index for vector similarity search
- **tsvector**: PostgreSQL full-text search data type
- **JSONB**: Binary JSON format with indexing support
- **pgvector**: PostgreSQL extension for vector embeddings
- **RAG**: Retrieval-Augmented Generation
- **Provenance**: Data lineage tracking

---

## Document End

**Version:** 3.0  
**Last Updated:** December 11, 2024  
**Next Review:** January 2025

This schema is production-ready for DocumentDB.io deployment supporting the complete Agentic AI Reimbursement System v3.0.

---

© 2024 Agentic AI Reimbursement System. All rights reserved.
