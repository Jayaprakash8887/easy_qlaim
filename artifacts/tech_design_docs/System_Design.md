# Reimbursement Validation & Disbursement Agent System
## Agentic AI System Design Document

**Project:** Agentic AI Reimbursement System  
**Date:** December 2025  

---

## Executive Summary

This system implements a **fully autonomous, multi-agent AI architecture** for reimbursement processing with:

### Core Capabilities
- **Auto-Approval** through intelligent AI validation
- **Processing Time Reduction** 
- **Complete Data Transparency** - OCR vs Manual vs Edited field tracking
- **Return to Employee** - Non-destructive rejection workflow
- **Multi-Stakeholder Comments** - Full audit trail with 4-role commenting
- **HR Correction Powers** - Claim type and amount editing


### Future-Ready Design
- **Integration Agent** ready for Kronos/HRMS connections


---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [System Architecture](#2-system-architecture)
3. [Multi-Agent System](#3-multi-agent-system)
4. [Agent Workflows](#4-agent-workflows)
5. [Database Schema](#5-database-schema)
6. [Integration Architecture](#6-integration-architecture)
7. [API Specifications](#7-api-specifications)
8. [User Workflows](#8-user-workflows)
9. [Security & Compliance](#9-security--compliance)
10. [Deployment Architecture](#10-deployment-architecture)

---

## 1. Technology Stack

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Agentic Framework** | Google ADK | Latest | Multi-agent orchestration, native Gemini integration |
| **LLM** | Google Gemini 2.0 | 2.0 | Advanced reasoning, multimodal support, cost-effective |
| **Database** | DocumentDB.io | Latest | PostgreSQL-based, MongoDB-compatible API, BSON support |
| **Backend** | Python + FastAPI | 3.11 / 0.104+ | Async performance, modern Python features |
| **Frontend** | React + TypeScript | 18 / 5.0+ | Component-based, type-safe, production-grade |
| **Task Queue** | Celery | 5.3+ | Distributed task processing, async agent execution |
| **Message Broker & Cache** | Redis | 7.2+ | Task queue broker, result backend, caching |
| **Task Monitoring** | Flower | 2.0+ | Real-time Celery task monitoring & management |
| **OCR/Vision** | PaddleOCR | 3.3+ | Open-source OCR, 95%+ accuracy, self-hosted |
| **Object Storage** | GCP  | Latest | Scalable document storage |
| **Authentication** |  Keycloak | Latest | SSO, RBAC, enterprise-ready |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      USER INTERFACES (React)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │Employee │  │ Manager │  │   HR    │  │ Finance │            │
│  │ Portal  │  │ Portal  │  │ Portal  │  │ Portal  │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
└───────┼───────────┼────────────┼────────────┼──────────────────┘
        │           │            │            │
        └───────────┴────────────┴────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────────┐
│                  FASTAPI BACKEND LAYER                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                        │  │
│  │  • /claims         • /comments       • /settlements        │  │
│  │  • /documents      • /hr-corrections • /employees          │  │
│  │  • /approvals      • /projects       • /timesheets         │  │
│  │  • Queues tasks to Celery via Redis                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌───▼────────┐
│Document │  │    Redis    │  │  Flower    │
│  DB.io  │  │(Broker+Cache)│ │ (Monitor)  │
│         │  │             │  │            │
│• Claims │  │• Task Queue │  │• Task UI   │
│• Users  │  │• Results    │  │• Stats     │
│• Docs   │  │• Cache      │  │• Workers   │
└────┬────┘  └──────┬──────┘  └────────────┘
     │              │
     │              ▼
     │      ┌────────────────────────────────────────────────┐
     │      │         CELERY WORKERS (3-5 instances)         │
     │      │  ┌──────────────────────────────────────────┐  │
     │      │  │    AGENTIC AI LAYER (Google ADK)         │  │
     │      │  │                                          │  │
     │      │  │  ┌────────────────────────────────────┐ │  │
     │      │  │  │  ORCHESTRATOR AGENT                │ │  │
     │      │  │  │  • Claim routing                   │ │  │
     │      │  │  │  • Workflow coordination           │ │  │
     │      │  │  │  • Task delegation                 │ │  │
     │      │  │  └────┬───────────┬───────────────────┘ │  │
     │      │  │       │           │                     │  │
     │      │  │  ┌────▼────┐  ┌───▼────┐  ┌──────────┐ │  │
     │      │  │  │DOCUMENT │  │VALIDTN │  │INTEGRATN │ │  │
     │      │  │  │ AGENT   │  │ AGENT  │  │  AGENT   │ │  │
     │      │  │  │• OCR    │  │• Policy│  │• Employee│ │  │
     │      │  │  │• Verify │  │• Rules │  │• Project │ │  │
     │      │  │  │• Track  │  │• AI    │  │• Timesheet│ │  │
     │      │  │  └─────────┘  └────────┘  └──────────┘ │  │
     │      │  │       │           │            │        │  │
     │      │  │  ┌────▼────┐  ┌───▼────┐               │  │
     │      │  │  │APPROVAL │  │LEARNING│               │  │
     │      │  │  │ AGENT   │  │ AGENT  │               │  │
     │      │  │  │• Route  │  │• Learn │               │  │
     │      │  │  │• Return │  │• Track │               │  │
     │      │  │  │• Settle │  │• Improve│              │  │
     │      │  │  └─────────┘  └────────┘               │  │
     │      │  │                                          │  │
     │      │  │  Agents run as Celery tasks              │  │
     │      │  └──────────────────────────────────────────┘  │
     │      └────────────────────┬───────────────────────────┘
     │                           │
     └───────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│  External Services & Storage                                     │
│  • PaddleOCR (Self-hosted OCR)                                   │
│  • GCP Storage (Documents)                                       │
│  • SMTP/SendGrid (Notifications)                                 │
│  • [Future] Kronos API (Timesheet)                               │
│  • [Future] HRMS API (Employee Master)                           │
│  • [Future] Payroll API (Disbursement)                           │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Employee → Upload Doc → FastAPI → Save to DB → Queue Celery Task
                                                       ↓
                                            Celery Worker picks up task
                                                       ↓
                                            Document Agent → OCR Extract
                                                       ↓
                                            Integration Agent → Get Employee/Project Data
                                                       ↓
                                            Validation Agent → Check Policies
                                                       ↓
                                            Approval Agent → Route to Approver
                                                       ↓
                                            Update DB with results
                                                       ↓
Manager/HR/Finance → Review → Approve/Return/Reject → Update Status
                                                       ↓
                     Finance → Settle → Payment → Mark SETTLED ✅
```

### 2.3 Async Task Processing Flow

```
User Action
    ↓
FastAPI receives request
    ↓
1. Save to DocumentDB (immediate)
2. Queue Celery task to Redis
3. Return 202 Accepted to user
    ↓
Celery Worker (background)
    ↓
Orchestrator Agent starts
    ↓
Delegates to specialized agents:
  • Document Agent (OCR)
  • Integration Agent (Data fetch)
  • Validation Agent (Policy check)
    ↓
Results stored in Redis
    ↓
Approval Agent processes
    ↓
Update DocumentDB
    ↓
Send notification to user
```

---

## 3. Multi-Agent System

### 3.1 Agent Overview

| Agent | Role | Responsibilities |
|-------|------|------------------|
| **Orchestrator** | Master Coordinator | Workflow routing, agent delegation, state management |
| **Validation** | Policy Enforcement | Rule validation, confidence scoring, AI reasoning |
| **Document** | OCR & Verification | Text extraction, field tracking, fraud detection |
| **Integration** | Data Fetching | Employee/project/timesheet data, future API integration |
| **Approval** | Routing & Status | Approval routing, return workflow, settlement tracking |
| **Learning** | Improvement | Pattern learning, accuracy tracking, system optimization |

### 3.2 Agent Details

#### **Orchestrator Agent**

**Purpose:** Central coordinator for all claim processing

**Key Responsibilities:**
- Receive claim submission from API
- Determine claim type (Reimbursement vs Allowance)
- Create appropriate workflow path
- Delegate tasks to specialized agents
- Handle exceptions and failures
- Update claim status in database
- Send notifications to stakeholders

**Decision Logic:**
- Allowance claims: Skip Document Agent (no docs)
- Reimbursement claims: Full workflow with OCR
- High confidence (≥95%): Auto-approve
- Medium confidence (80-95%): Manager review
- Policy exceptions: HR review
- Low confidence: Reject

**Tools Available:**
- `update_claim_status()` - Database updates
- `send_notification()` - Email/SMS alerts
- `delegate_to_agent()` - Agent communication
- `log_decision()` - Audit logging

---

#### **Document Agent**

**Purpose:** Extract and verify claim data from documents

**Key Responsibilities:**
- Perform OCR using PaddleOCR (self-hosted, 95%+ accuracy)
- Extract structured data (amount, date, vendor, category)
- Generate field-level confidence scores
- Track data source (OCR/Manual/Edited)
- Detect fraud and document tampering
- Manage edit history when employee modifies OCR data

**OCR Field Tracking:**

Each field extracted has metadata:
- **value**: The actual extracted value
- **source**: OCR, OCR_EDITED, or MANUAL
- **confidence**: 0.0 to 1.0 score
- **ocr_timestamp**: When extracted
- **edited**: Boolean flag
- **edit_history**: Array of changes
- **original_ocr_value**: Preserved original

**Fraud Detection Checks:**
1. Image quality analysis
2. Metadata consistency
3. Amount reasonableness patterns
4. Vendor legitimacy verification
5. Date validity checks

**Tools Available:**
- `paddleocr.extract_text()` - PaddleOCR (self-hosted, 95%+ accuracy)
- `gemini.structure_data()` - LLM parsing
- `detect_manipulation()` - Fraud detection
- `verify_vendor()` - External validation

---

#### **Integration Agent**

**Purpose:** Fetch employee, project, and external system data

**Current Capabilities:**

**1. Employee Data Management**
- Fetch from internal DocumentDB
- Validate tenure, department, eligibility
- Check claim history
- Support for future HRMS sync

**2. Project Data Management**
- Fetch from internal DocumentDB
- Validate project codes
- Check budget availability
- Track project-specific policies

**3. Timesheet Management**
- Manual entry support (current)
- Future: Kronos API integration
- Validate on-call claims
- Cross-verify attendance

**Future Integration Ready:**

**When Kronos/HRMS Enabled:**
- Primary source: External API
- Fallback: Local database
- Automatic sync to cache
- Configurable sync frequency

**Integration Decision Logic:**
```
If HRMS_ENABLED:
    Try fetch from HRMS API
    If fails and fallback_enabled:
        Fetch from local DB
    Else:
        Return error
Else:
    Fetch from local DB
```

**Configuration Structure:**
- Enable/disable flags per integration
- API endpoints and credentials
- Timeout and retry settings
- Fallback behavior
- Sync frequency

**Tools Available:**
- `fetch_employee_data()` - Employee info
- `fetch_project_data()` - Project details
- `fetch_timesheet_data()` - Work hours
- `validate_oncall_claim()` - On-call verification
- `sync_to_local()` - Cache external data

---

#### **Validation Agent**

**Purpose:** Intelligent policy validation using AI reasoning

**Key Responsibilities:**
- Load applicable policies for claim category
- Validate all policy rules
- Use Gemini for intelligent edge case handling
- Calculate confidence score (0-1)
- Generate human-readable reasoning
- Flag exceptions for human review

**Validation Checks:**

**Standard Checks:**
1. Amount within policy limits
2. Employee tenure requirements
3. Budget availability
4. Category eligibility
5. Date validity
6. Documentation completeness

**AI-Powered Checks:**
1. Reasonableness assessment
2. Fraud risk evaluation
3. Pattern matching against history
4. Context-aware exceptions

**Confidence Scoring:**
- 0.95+: High confidence → Auto-approve
- 0.80-0.95: Medium → Manager review
- <0.80: Low → HR review or reject

**Output:**
- Valid/Invalid boolean
- Confidence score
- Recommendation (APPROVE/REVIEW/REJECT)
- Detailed reasoning in natural language
- List of passed/failed checks
- Flags for exceptions

**Tools Available:**
- `load_policies()` - Policy database
- `gemini.reason_about()` - AI reasoning
- `check_amount_limit()` - Rule validation
- `check_tenure()` - Eligibility
- `check_budget()` - Financial validation

---

#### **Approval Agent**

**Purpose:** Route claims and manage approval lifecycle

**Key Responsibilities:**

**1. Routing Logic:**
- Auto-approve high-confidence claims
- Route to appropriate approver
- Handle escalations
- Manage approval chains

**2. Return to Employee:**
- Process return requests
- Update status to RETURNED_TO_EMPLOYEE
- Enable editing for employee
- Track return count
- Auto-generate comment
- Send notification

**3. Comments Management:**
- Add comments from any role
- Maintain comment history
- Notify stakeholders
- Visible to all relevant parties

**4. Settlement Tracking:**
- Mark individual claims as settled
- Bulk settlement processing
- Capture payment details
- Update final status
- Notify employees

**Status Workflow:**
```
DRAFT → SUBMITTED → AI_PROCESSING
    ↓
PENDING_MANAGER
    ↓ ↓ ↓
    ↓ RETURNED_TO_EMPLOYEE (editable, resubmit)
    ↓ MANAGER_APPROVED
    ↓ PENDING_HR (if exception)
    ↓ HR_APPROVED
    ↓ PENDING_FINANCE
    ↓ FINANCE_APPROVED
    ↓ SETTLED ✅ (final)
    ↓
REJECTED ❌
```

**Return vs Reject:**
- **Return**: Temporary, allows edits, can resubmit
- **Reject**: Permanent, no further edits allowed

**Tools Available:**
- `route_claim()` - Routing logic
- `return_to_employee()` - Return workflow
- `add_comment()` - Comment creation
- `mark_as_settled()` - Settlement
- `bulk_settle()` - Batch settlement
- `send_notification()` - Alerts

---

#### **Learning Agent**

**Purpose:** Continuous system improvement

**Key Responsibilities:**
- Track agent decision accuracy
- Identify policy gaps
- Learn approval patterns
- Suggest policy updates
- Improve OCR accuracy
- Detect emerging fraud patterns

**Learning Activities:**

**1. Accuracy Tracking:**
- Compare AI predictions vs actual outcomes
- Calculate precision/recall metrics
- Identify low-confidence patterns

**2. OCR Improvement:**
- Track fields frequently edited by employees
- Identify document types with low accuracy
- Suggest OCR model fine-tuning

**3. Policy Analysis:**
- Detect claims frequently returned
- Identify unclear policy areas
- Suggest policy clarifications

**4. Pattern Recognition:**
- Learn seasonal claim patterns
- Detect department-specific trends
- Identify high-risk behaviors

**Outputs:**
- Weekly learning reports
- Policy improvement suggestions
- OCR accuracy metrics
- Fraud pattern alerts

**Tools Available:**
- `analyze_outcome()` - Compare predictions
- `identify_patterns()` - Pattern detection
- `suggest_improvements()` - Recommendations
- `update_models()` - Model retraining

---

## 4. Agent Workflows

### 4.1 Complete Claim Processing Flow

```
STEP 1: Employee Submission
├─ Choose: Reimbursement or Allowance
├─ Upload documents (if reimbursement)
├─ Fill form (manual or OCR-extracted)
└─ Submit

STEP 2: Orchestrator Receives
├─ Create workflow based on type
├─ Initiate agent sequence
└─ Log submission

STEP 3: Document Agent (if docs)
├─ Perform OCR extraction
├─ Generate confidence scores
├─ Track field sources
└─ Detect fraud

STEP 4: Integration Agent
├─ Fetch employee data
├─ Fetch project data
├─ Fetch timesheet (if allowance)
└─ Validate availability

STEP 5: Validation Agent
├─ Load policies
├─ Run all checks
├─ Use AI reasoning
├─ Calculate confidence
└─ Generate recommendation

STEP 6: Approval Agent Routes
├─ High confidence (≥95%) → Auto-approve → Finance
├─ Medium (80-95%) → Manager review
├─ Policy exception → HR review
└─ Low confidence → Reject

STEP 7: Human Review
├─ Option A: APPROVE → Next stage
├─ Option B: RETURN → Employee edits → Resubmit
├─ Option C: REJECT → Final rejection
└─ Option D: COMMENT → Add feedback

STEP 8: HR Review (if exception)
├─ View complete transparency
├─ Edit claim type (if wrong)
├─ Adjust amount (if needed)
├─ Add comment explaining changes
└─ Approve/Return/Reject

STEP 9: Finance Review
├─ Verify budget
├─ Check payment details
├─ Review audit trail
└─ Approve for payment

STEP 10: Settlement
├─ Finance processes offline payment
├─ Capture payment reference
├─ Mark as SETTLED
├─ Notify employee
└─ Complete lifecycle ✅
```

### 4.2 Return to Employee Workflow

```
Manager/HR sees issue
    ↓
Click "Return to Employee"
    ↓
Enter reason (mandatory)
    ↓
Approval Agent processes:
    • Status: RETURNED_TO_EMPLOYEE
    • can_edit: true
    • return_count: +1
    • Auto-comment created
    ↓
Employee notified
    ↓
Employee views reason
    ↓
Employee edits claim
    ↓
Employee resubmits
    ↓
Status: RESUBMITTED → PENDING_MANAGER
    ↓
Goes back through AI workflow
    ↓
Returns to same approver
    ↓
Approver sees edit history
```

### 4.3 HR Correction Workflow

```
HR reviews claim
    ↓
Identifies correction needed
    ↓
Option A: Fix Claim Type
    • Original: Travel
    • Corrected: Certification
    • Reason: "Employee uploaded cert"
    • Auto-comment added
    ↓
Option B: Adjust Amount
    • Original: ₹26,500
    • Approved: ₹25,000
    • Reason: "Policy max enforced"
    • Auto-comment added
    ↓
HR approves with corrections
    ↓
Claim proceeds to Finance
    ↓
Finance sees corrected values
    ↓
Employee notified of changes
```

### 4.4 Settlement Workflow

```
Finance approves claim
    ↓
Status: FINANCE_APPROVED
    ↓
Finance processes offline payment
    • Bank transfer (NEFT/RTGS)
    • Get payment reference
    ↓
Finance marks as settled:
    
Individual:
    • Click "Mark as Settled"
    • Enter payment reference
    • Select method
    • Add notes
    
Bulk:
    • Select multiple claims
    • Enter batch details
    • Settle all at once
    ↓
Status: SETTLED ✅
    ↓
Employee notified:
    • "Payment processed: ₹15,000"
    • Payment reference included
```

---

## 5. Database Schema

### 5.1 DocumentDB.io Architecture

**Technology:** DocumentDB.io (PostgreSQL-based with MongoDB-compatible API)

**Key Capabilities:**
- ✅ PostgreSQL backbone with ACID transactions
- ✅ MongoDB-compatible API for flexible documents
- ✅ **Vector embeddings** (pgvector) for semantic search
- ✅ **Full-text search** (tsvector) for OCR and documents
- ✅ Hybrid queries using both SQL and MongoDB syntax
- ✅ JSONB for flexible document modeling

**Extensions Required:**
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Trigram similarity
CREATE EXTENSION IF NOT EXISTS "vector";       -- Vector embeddings
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- JSONB indexes
```

### 5.2 Collections/Tables Overview

```
reimbursement_db/
├── claims               (Main claim records with JSONB)
├── comments            (Multi-role comments)
├── employees           (Employee master)
├── projects            (Project master)
├── timesheets          (Timesheet entries)
├── policies            (Company policies)
├── documents           (File metadata)
├── approvals           (Approval history)
├── settlements         (Payment tracking)
├── notifications       (Notification queue)
├── policy_embeddings   (Vector search for RAG)
├── claim_embeddings    (Semantic claim similarity)
├── agent_traces        (Agent execution logs)
├── audit_logs          (Append-only audit trail)
└── learnings           (System improvements)
```

### 5.3 Claims Table (PostgreSQL + JSONB)

**Hybrid Structure:** PostgreSQL columns for indexed queries + JSONB for flexibility

```sql
CREATE TABLE claims (
  -- Identity & indexing
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  claim_number TEXT UNIQUE NOT NULL,
  
  -- Employee & Claim
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  claim_type TEXT NOT NULL,  -- REIMBURSEMENT or ALLOWANCE
  category TEXT NOT NULL,
  
  -- Financial
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  
  -- Status
  status TEXT NOT NULL,
  
  -- Dates
  submission_date TIMESTAMPTZ,
  claim_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Complete payload (JSONB for flexibility)
  claim_payload JSONB NOT NULL DEFAULT '{}',
  
  -- OCR full-text search
  ocr_text TEXT,
  ocr_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(ocr_text, '') || ' ' || 
      coalesce(employee_name, '') || ' ' || 
      coalesce(description, '')
    )
  ) STORED,
  
  -- Return workflow (v3.0)
  returned_by UUID,
  returned_at TIMESTAMPTZ,
  return_reason TEXT,
  return_count INT DEFAULT 0,
  can_edit BOOLEAN DEFAULT false,
  
  -- Settlement (v3.0)
  settled BOOLEAN DEFAULT false,
  settled_date TIMESTAMPTZ,
  settled_by UUID,
  payment_reference TEXT,
  payment_method TEXT,
  amount_paid NUMERIC(12,2)
);

-- Indexes
CREATE INDEX idx_claims_status_employee ON claims (status, employee_id);
CREATE INDEX idx_claims_payload_gin ON claims USING gin (claim_payload jsonb_path_ops);
CREATE INDEX idx_claims_ocr_tsv ON claims USING gin (ocr_tsv);  -- Full-text search
```

**JSONB Payload Structure:**

```json
{
  "fields": {
    "amount": {
      "value": 15000,
      "source": "OCR",
      "confidence": 0.97,
      "edited": false,
      "edit_history": [],
      "original_ocr_value": 15000
    },
    "date": {
      "value": "2024-12-05",
      "source": "OCR_EDITED",
      "confidence": 0.89,
      "edited": true,
      "edit_history": [
        {
          "timestamp": "2024-12-10T10:30:00Z",
          "old_value": "2024-12-04",
          "new_value": "2024-12-05",
          "user_id": "emp_123"
        }
      ],
      "original_ocr_value": "2024-12-04"
    }
  },
  "validation": {
    "agent_name": "validation_agent",
    "confidence": 0.95,
    "recommendation": "AUTO_APPROVE",
    "reasoning": "All policy rules satisfied",
    "rules_checked": [
      {"rule_id": "CERT_AMOUNT", "result": "pass"},
      {"rule_id": "CERT_TENURE", "result": "pass"}
    ],
    "llm_used": false
  },
  "hr_corrections": {
    "claim_type_changed": true,
    "original_claim_type": "TRAVEL",
    "corrected_claim_type": "CERTIFICATION",
    "type_change_reason": "Employee uploaded cert docs",
    "amount_adjusted": true,
    "original_amount": 26500,
    "approved_amount": 25000,
    "amount_adjustment_reason": "Policy maximum enforced"
  },
  "return_tracking": {
    "return_history": [
      {
        "returned_by": "mgr_789",
        "returned_at": "2024-12-10T11:00:00Z",
        "return_reason": "Please verify attendee count",
        "resubmitted_at": "2024-12-10T15:00:00Z",
        "changes_made": "Updated attendee count"
      }
    ]
  },
  "settlement": {
    "settled": true,
    "payment_reference": "NEFT2024121100123456",
    "bank_transaction_id": "TXN789012"
  }
}
```

### 5.4 Vector Embeddings for AI (NEW)

#### Policy Embeddings Table

**Purpose:** Semantic search for policy retrieval (RAG - Retrieval-Augmented Generation)

```sql
CREATE TABLE policy_embeddings (
  id UUID PRIMARY KEY,
  policy_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  text TEXT NOT NULL,
  
  -- 1536-dim vector for Gemini/OpenAI embeddings
  embedding vector(1536),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity index (IVFFlat algorithm)
CREATE INDEX idx_policy_embedding_vec ON policy_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search index
CREATE INDEX idx_policy_text_fts ON policy_embeddings 
USING gin (to_tsvector('english', text));
```

**Usage - Find Relevant Policy Sections:**
```sql
-- Vector similarity search (returns top 5 most relevant sections)
SELECT 
  policy_id,
  section_id,
  text,
  embedding <-> :query_embedding AS distance
FROM policy_embeddings
ORDER BY embedding <-> :query_embedding
LIMIT 5;
```

**How It Works:**
1. Policy document chunked into sections (500-word chunks)
2. Each section embedded using Gemini (1536-dim vector)
3. When validating claim, embed claim description
4. Vector similarity search finds relevant policy sections
5. Pass only relevant sections to LLM (reduces cost by 90%)

#### Claim Embeddings Table

**Purpose:** Detect similar claims for fraud detection and pattern analysis

```sql
CREATE TABLE claim_embeddings (
  claim_id UUID PRIMARY KEY REFERENCES claims(id),
  
  -- Embedding generated from claim description + category + amount
  embedding vector(1536),
  
  embedding_model TEXT DEFAULT 'gemini-1.5-pro',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity index
CREATE INDEX idx_claim_embeddings_vec ON claim_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Usage - Find Similar Claims:**
```sql
-- Detect potentially duplicate or fraudulent claims
SELECT 
  c.id,
  c.claim_number,
  c.employee_name,
  c.amount,
  ce.embedding <-> :current_claim_embedding AS similarity
FROM claims c
JOIN claim_embeddings ce ON c.id = ce.claim_id
WHERE c.id != :current_claim_id
ORDER BY similarity ASC
LIMIT 10;
```

### 5.5 Full-Text Search Capabilities

**OCR Text Search:**
```sql
-- Search across all OCR-extracted text
SELECT 
  id,
  claim_number,
  employee_name,
  ts_rank(ocr_tsv, plainto_tsquery('travel invoice')) AS rank
FROM claims
WHERE ocr_tsv @@ plainto_tsquery('travel invoice')
ORDER BY rank DESC;
```

**Document Text Search:**
```sql
-- Search within uploaded documents
SELECT 
  d.id,
  d.file_name,
  c.claim_number,
  ts_rank(d.text_tsv, plainto_tsquery('hotel receipt')) AS rank
FROM documents d
JOIN claims c ON d.claim_id = c.id
WHERE d.text_tsv @@ plainto_tsquery('hotel receipt')
ORDER BY rank DESC;
```

**Policy Text Search:**
```sql
-- Search policy documentation
SELECT 
  policy_id,
  section_id,
  text,
  ts_rank(to_tsvector('english', text), plainto_tsquery('certification limit')) AS rank
FROM policy_embeddings
WHERE to_tsvector('english', text) @@ plainto_tsquery('certification limit')
ORDER BY rank DESC;
```

### 5.6 Agent Traces Table

**Purpose:** Detailed agent execution logs with provenance

```sql
CREATE TABLE agent_traces (
  id UUID PRIMARY KEY,
  claim_id UUID REFERENCES claims(id),
  
  -- Agent info
  agent_name TEXT NOT NULL,
  run_id UUID NOT NULL,
  
  -- Execution
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ,
  duration_ms INT,
  
  -- Detailed steps (JSONB)
  steps JSONB DEFAULT '[]',
  
  -- Verdict
  verdict JSONB DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'SUCCESS',
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_traces_claim ON agent_traces (claim_id);
CREATE INDEX idx_agent_traces_agent ON agent_traces (agent_name);
```

**Steps JSONB Structure:**
```json
[
  {
    "step": 1,
    "tool": "ocr_service",
    "input_refs": ["doc:uuid"],
    "output": {"amount": 15000, "date": "2024-12-05"},
    "confidence": 0.92,
    "duration_ms": 1250
  },
  {
    "step": 2,
    "tool": "rules_engine",
    "input": {"amount": 15000, "tenure": 18},
    "output": {"rules_passed": 3, "rules_failed": 0},
    "confidence": 0.99,
    "duration_ms": 45
  },
  {
    "step": 3,
    "tool": "gemini_reasoning",
    "input": "edge_case_analysis",
    "output": {"recommendation": "AUTO_APPROVE"},
    "confidence": 0.95,
    "duration_ms": 850,
    "llm_used": true,
    "tokens_used": 500
  }
]
```

### 5.7 Other Collections (Summary)

**Comments, Employees, Projects, Timesheets, Policies, Documents, Approvals, Settlements, Notifications** - Same structure as documented in Section 5.1 overview.

**Audit Logs** - Append-only table with no-update/no-delete rules:
```sql
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

### 5.8 Query Examples

**Hybrid Query (SQL + JSONB):**
```sql
-- Find pending claims with AI confidence < 90%
SELECT 
  id,
  claim_number,
  employee_name,
  amount,
  claim_payload->'validation'->>'confidence' as ai_confidence
FROM claims
WHERE status = 'PENDING_MANAGER'
  AND (claim_payload->'validation'->>'confidence')::numeric < 0.90
ORDER BY submission_date ASC;
```

**MongoDB API Query (Same Data):**
```javascript
db.claims.find({
  status: "PENDING_MANAGER",
  "claim_payload.validation.confidence": { $lt: 0.90 }
}).sort({ submission_date: 1 });
```

### 5.9 Performance Optimizations

**Indexes Summary:**
- B-tree indexes: Fast lookups on status, employee_id, dates
- GIN indexes: JSONB path operations, full-text search
- IVFFlat indexes: Vector similarity search (sub-100ms)

**Caching Strategy:**
- Redis: Hot data, agent state, policy cache
- DocumentDB: Write-through cache for frequently accessed claims
- Vector embeddings: Cached after first computation

**Partitioning (Optional):**
```sql
-- Partition claims by month for high volume
CREATE TABLE claims_2024_12 PARTITION OF claims
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

### 5.10 Status Workflow

```
DRAFT → SUBMITTED → AI_PROCESSING
  ↓
PENDING_MANAGER
  ↓ ↓ ↓
  ↓ RETURNED_TO_EMPLOYEE → (edit) → RESUBMITTED
  ↓ MANAGER_APPROVED
  ↓ PENDING_HR
  ↓ HR_APPROVED
  ↓ PENDING_FINANCE
  ↓ FINANCE_APPROVED
  ↓ SETTLED ✅
  ↓
REJECTED ❌
```

---

**For complete SQL schema with all table definitions, indexes, and triggers, see:** `DocumentDB_Schema_Design_v3.0_Complete.md`

---

## 6. Integration Architecture

### 6.1 Current State (Self-Contained)

**Employee Management:**
- ✅ Manual add via admin UI
- ✅ CSV bulk import
- ✅ REST API creation
- ✅ Stored in DocumentDB

**Project Management:**
- ✅ Manual add via admin UI
- ✅ CSV bulk import
- ✅ REST API creation
- ✅ Stored in DocumentDB

**Timesheet Management:**
- ✅ Manual entry via web form
- ✅ REST API creation
- ✅ Stored in DocumentDB
- ✅ Validation against policy

### 6.2 Future State (Pluggable Integrations)

**Integration Configuration File:**

```yaml
integrations:
  
  kronos:
    enabled: false  # Set true when ready
    api_url: https://kronos.company.com/api/v1
    auth_type: oauth2
    client_id: ${KRONOS_CLIENT_ID}
    client_secret: ${KRONOS_CLIENT_SECRET}
    timeout_seconds: 10
    retry_attempts: 3
    fallback_to_local: true
    
  hrms:
    enabled: false  # Set true when ready
    api_url: https://hrms.company.com/api/v1
    auth_type: api_key
    api_key: ${HRMS_API_KEY}
    timeout_seconds: 10
    retry_attempts: 3
    fallback_to_local: true
    sync_frequency_hours: 24
    
  payroll:
    enabled: false  # Future
    api_url: https://payroll.company.com/api/v1
    auth_type: oauth2

data_sources:
  employee_data:
    primary: hrms      # When enabled
    fallback: local_db
  timesheet_data:
    primary: kronos    # When enabled
    fallback: local_db
  project_data:
    primary: local_db  # Always local
```

### 6.3 Integration Logic

**Integration Agent Decision Flow:**

```
Function: fetch_employee_data(employee_id)
    ↓
If HRMS_ENABLED:
    Try:
        data = fetch_from_hrms_api(employee_id)
        sync_to_local_cache(data)
        return data
    Catch Exception:
        If fallback_to_local:
            return fetch_from_local_db(employee_id)
        Else:
            raise error
Else:
    return fetch_from_local_db(employee_id)
```

**Benefits:**
- **Zero Code Changes** when integrations enabled
- **Graceful Fallback** if external API fails
- **Local Caching** for performance
- **Config-Driven** enable/disable

### 6.4 Admin Integration UI

**Settings Screen:**

```
┌─────────────────────────────────────────────────┐
│ System Integration Settings                      │
│                                                  │
│ Kronos Timesheet System                         │
│ Status: ❌ Disabled (using local DB)            │
│ ┌─────────────────────────────────────────────┐ │
│ │ [✓] Enable Kronos Integration               │ │
│ │ API URL: [___________________________]      │ │
│ │ Client ID: [___________________________]    │ │
│ │ Client Secret: [••••••••••••••••]          │ │
│ │ [Test Connection] [Save]                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ HRMS Employee System                             │
│ Status: ❌ Disabled (using local DB)            │
│ ┌─────────────────────────────────────────────┐ │
│ │ [✓] Enable HRMS Integration                 │ │
│ │ API URL: [___________________________]      │ │
│ │ API Key: [••••••••••••••••]                │ │
│ │ Sync Frequency: [24] hours                  │ │
│ │ [Test Connection] [Save]                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Apply All Changes]                             │
└─────────────────────────────────────────────────┘
```

---

## 7. API Specifications

### 7.1 Core Claim APIs

**Submit Claim:**
```
POST /api/v1/claims
Body: {claim details, documents}
Response: {claim_id, status}
```

**Get Claim:**
```
GET /api/v1/claims/{claim_id}
Response: {complete claim object}
```

**Update Claim:**
```
PATCH /api/v1/claims/{claim_id}
Body: {updated fields}
Response: {success, updated_claim}
```

### 7.2 Return to Employee API

**Return Claim:**
```
POST /api/v1/claims/{claim_id}/return
Authorization: Bearer <token>

Body:
{
  "returned_by": "user_id",
  "return_reason": "Please verify attendee count"
}

Response 200:
{
  "success": true,
  "claim_id": "claim_uuid",
  "status": "RETURNED_TO_EMPLOYEE",
  "notification_sent": true
}
```

### 7.3 Comments API

**Add Comment:**
```
POST /api/v1/claims/{claim_id}/comments
Authorization: Bearer <token>

Body:
{
  "user_id": "user_uuid",
  "user_role": "MANAGER",
  "comment_text": "Please clarify the discrepancy"
}

Response 201:
{
  "comment_id": "comment_uuid",
  "created_at": "2024-12-10T11:00:00Z"
}
```

**Get Comments:**
```
GET /api/v1/claims/{claim_id}/comments?sort=desc

Response 200:
{
  "claim_id": "claim_uuid",
  "comments": [array of comments],
  "total": 5
}
```

### 7.4 HR Corrections API

**Update Claim Type:**
```
PATCH /api/v1/claims/{claim_id}/hr-corrections/claim-type

Body:
{
  "corrected_by": "hr_user_id",
  "original_claim_type": "TRAVEL",
  "corrected_claim_type": "CERTIFICATION",
  "reason": "Employee uploaded cert but selected travel"
}

Response 200:
{
  "success": true,
  "claim_type_updated": true,
  "comment_added": true
}
```

**Adjust Amount:**
```
PATCH /api/v1/claims/{claim_id}/hr-corrections/amount

Body:
{
  "adjusted_by": "hr_user_id",
  "original_amount": 26500,
  "approved_amount": 25000,
  "reason": "Policy maximum enforced"
}

Response 200:
{
  "success": true,
  "amount_updated": true
}
```

### 7.5 Settlement API

**Mark as Settled (Individual):**
```
POST /api/v1/claims/{claim_id}/settle

Body:
{
  "settled_by": "finance_user_id",
  "settlement_details": {
    "settled_date": "2024-12-11",
    "payment_reference": "NEFT2024121100123456",
    "payment_method": "NEFT",
    "notes": "Regular disbursement"
  }
}

Response 200:
{
  "success": true,
  "status": "SETTLED",
  "settlement_id": "settlement_uuid"
}
```

**Bulk Settlement:**
```
POST /api/v1/claims/bulk-settle

Body:
{
  "settled_by": "finance_user_id",
  "claim_ids": ["claim_1", "claim_2", "claim_3"],
  "batch_details": {
    "batch_name": "December 2024 Batch 1",
    "settled_date": "2024-12-11",
    "batch_reference": "BATCH-2024-12-001",
    "payment_method": "NEFT"
  }
}

Response 200:
{
  "success": true,
  "total_claims": 3,
  "successful": ["claim_1", "claim_2"],
  "failed": [{"claim_id": "claim_3", "error": "..."}]
}
```

### 7.6 Employee/Project Management APIs

**Create Employee:**
```
POST /api/v1/employees
Authorization: Bearer <admin_token>

Body: {employee details}
Response: {employee_id, created: true}
```

**Bulk Import Employees:**
```
POST /api/v1/employees/import
Content-Type: multipart/form-data

file: employees.csv
Response: {imported: 48, failed: 2, errors: [...]}
```

**Create Project:**
```
POST /api/v1/projects
Authorization: Bearer <admin_token>

Body: {project details}
Response: {project_code, created: true}
```

**Add Timesheet:**
```
POST /api/v1/timesheets

Body:
{
  "employee_id": "EMP12345",
  "date": "2024-12-07",
  "hours_worked": 6.0,
  "is_oncall": true
}

Response: {timesheet_id, created: true}
```

---

## 8. User Workflows

### 8.1 Employee Portal

**Submit Reimbursement:**
1. Login → Dashboard
2. Click "Submit New Claim"
3. Select "Reimbursement"
4. Upload documents
5. Wait for OCR (5-10 sec)
6. Review extracted data
7. Edit if OCR incorrect
8. Submit

**Submit Allowance:**
1. Login → Dashboard
2. Click "Submit New Claim"
3. Select "Allowance"
4. Fill form manually
5. Submit

**View Status:**
- Track claim progress
- View comments from approvers
- See AI confidence score
- Check settlement status

**Handle Return:**
1. Notification: "Claim returned"
2. View return reason
3. Click "Edit Claim"
4. Make corrections
5. Resubmit

### 8.2 Manager Portal

**Approve Claims:**
1. Login → Approval Queue
2. See pending claims with:
   - Data source indicators
   - AI confidence
   - Priority
3. Click claim to review
4. Navigate: Previous | Back | Next
5. Review details:
   - OCR vs manual fields
   - Edit history
   - AI recommendation
   - Comments
6. Make decision:
   - **Approve** → Next stage
   - **Return** → Employee edits
   - **Reject** → Final
7. Add comment (optional)
8. Next claim

### 8.3 HR Portal

**Handle Exceptions:**
1. Login → Exception Queue
2. See claims requiring HR:
   - Policy exceptions
   - Data integrity flags
   - High-value claims
3. Review claim details
4. Navigate between claims
5. HR powers:
   - **Fix claim type** if wrong
   - **Adjust amount** if needed
   - Provide reasoning
6. Make decision
7. Add comment
8. Claim proceeds

### 8.4 Finance Portal

**Process Payments:**
1. Login → Payment Queue
2. See approved claims
3. Review claim:
   - Complete audit trail
   - All approvals
   - Bank details
4. Approve for payment
5. Process offline payment
6. Get payment reference
7. Mark as settled:
   - **Individual**: One claim
   - **Bulk**: Multiple claims
8. Enter payment details
9. Status: SETTLED ✅
10. Employee notified

---

## 9. Security & Compliance

### 9.1 Role-Based Access Control

**Roles:**
- EMPLOYEE
- MANAGER
- HR
- FINANCE
- ADMIN

**Permissions Matrix:**

| Action | Employee | Manager | HR | Finance | Admin |
|--------|----------|---------|----|---------| ------|
| Create claim | ✅ | ❌ | ❌ | ❌ | ✅ |
| Edit own claim | ✅* | ❌ | ❌ | ❌ | ✅ |
| View own claims | ✅ | ❌ | ❌ | ❌ | ✅ |
| View team claims | ❌ | ✅ | ❌ | ❌ | ✅ |
| View all claims | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve team | ❌ | ✅ | ❌ | ❌ | ✅ |
| Approve exception | ❌ | ❌ | ✅ | ❌ | ✅ |
| Approve payment | ❌ | ❌ | ❌ | ✅ | ✅ |
| Return claim | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit claim type | ❌ | ❌ | ✅ | ❌ | ✅ |
| Edit amount | ❌ | ❌ | ✅ | ❌ | ✅ |
| Settle payment | ❌ | ❌ | ❌ | ✅ | ✅ |
| Add comment | ✅ | ✅ | ✅ | ✅ | ✅ |

*Employee can only edit when status = RETURNED_TO_EMPLOYEE

### 9.2 Audit Logging

**All Actions Logged:**
- claim.created
- claim.submitted
- claim.approved
- claim.rejected
- claim.returned
- claim.settled
- comment.added
- hr.corrected_claim_type
- hr.adjusted_amount
- document.uploaded
- user.login

**Audit Log Structure:**
```
{
  event_type: "claim.returned",
  timestamp: "2024-12-10T11:00:00Z",
  actor_id: "MGR001",
  actor_role: "MANAGER",
  claim_id: "claim_uuid",
  action_details: {details},
  ip_address: "192.168.1.100"
}
```

### 9.3 Data Security

**Encryption:**
- At rest: AES-256
- In transit: TLS 1.3
- Database: Encrypted volumes

**Authentication:**
- SSO via Auth0/Keycloak
- MFA optional/required
- JWT tokens (15 min expiry)
- Refresh tokens (7 days)

**Compliance:**
- GDPR compliant
- SOC 2 ready
- Audit trails complete
- Data retention policies

---

## 10. Deployment Architecture

### 10.1 Production Setup

**Infrastructure:**

```
┌────────────────────────────────────────┐
│      Load Balancer (AWS ALB/Azure)     │
└────────────────┬───────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐   ┌───▼───┐   ┌───▼───┐
│React  │   │React  │   │React  │
│Pod 1  │   │Pod 2  │   │Pod 3  │
└───────┘   └───────┘   └───────┘
    │            │            │
    └────────────┼────────────┘
                 │
┌────────────────▼───────────────────────┐
│      API Gateway (Kong/AWS API GW)     │
└────────────────┬───────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼────┐  ┌───▼────┐  ┌───▼────┐
│FastAPI │  │FastAPI │  │FastAPI │
│Pod 1   │  │Pod 2   │  │Pod 3   │
└───┬────┘  └───┬────┘  └───┬────┘
    │           │           │
    └───────────┼───────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼────┐  ┌───▼────┐  ┌──▼─────┐
│Document│  │ Redis  │  │ Flower │
│DB.io   │  │Cluster │  │(Monitor)│
└────────┘  └────┬───┘  └────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼────┐  ┌───▼────┐  ┌───▼────┐
│Celery  │  │Celery  │  │Celery  │
│Worker 1│  │Worker 2│  │Worker 3│
│(Agents)│  │(Agents)│  │(Agents)│
└────────┘  └────────┘  └────────┘
```

**Scalability:**
- Frontend: 3-10 pods (auto-scale)
- Backend: 3-10 pods (auto-scale)
- Celery Workers: 3-10 instances (auto-scale based on queue depth)
- Database: Cluster with replicas
- Redis: Cluster mode (6 nodes: 3 master, 3 replica)
- Flower: 1 instance (monitoring UI)

**Monitoring:**
- Prometheus metrics
- Grafana dashboards
- Alert manager
- Flower UI (Celery task monitoring)
- Log aggregation (ELK)

### 10.2 Deployment Checklist

**Pre-Deployment:**
- [ ] Configure environment variables
- [ ] Set up DocumentDB cluster
- [ ] Set up Redis cluster
- [ ] Configure GCP storage
- [ ] Deploy PaddleOCR service
- [ ] Configure Keycloak authentication
- [ ] Set up SSL certificates

**Deployment Steps:**
1. Deploy DocumentDB cluster
2. Deploy Redis cluster (broker + result backend)
3. Deploy PaddleOCR service
4. Deploy FastAPI backend services
5. Deploy Celery workers (3-5 instances)
6. Deploy Flower monitoring UI
7. Deploy React frontend
8. Configure load balancer
9. Set up monitoring (Prometheus + Grafana)
10. Run health checks
11. Enable traffic

**Post-Deployment:**
- [ ] Verify all services healthy
- [ ] Test claim submission
- [ ] Test OCR extraction (PaddleOCR)
- [ ] Verify Celery tasks executing
- [ ] Monitor Flower UI for task status
- [ ] Test approval workflow
- [ ] Test settlement
- [ ] Verify notifications
- [ ] Check audit logs
- [ ] Monitor performance

---

## 11. Success Metrics

### 11.1 Performance KPIs

**Processing Speed:**
- Auto-approved claims: < 1 minute
- Manager review: < 2 hours
- HR review: < 4 hours
- Finance approval: < 1 hour
- Total cycle time: < 1 day (vs 3+ days manual)

**Accuracy:**
- OCR accuracy: > 95%
- AI validation accuracy: > 98%
- Auto-approval rate: > 88%
- Return rate: < 5%
- Rejection rate: < 7%

**User Satisfaction:**
- Employee NPS: > 70
- Manager satisfaction: > 85%
- HR satisfaction: > 90%
- System uptime: 99.9%

### 11.2 Business Impact

**Cost Savings:**
- 70% reduction in manual processing time
- 60% reduction in approval delays
- 50% reduction in data entry errors
- 40% reduction in fraud losses

**Process Improvements:**
- 88% claims auto-approved
- 95% data accuracy
- 100% audit trail
- Real-time status tracking

---

## 12. Future Roadmap

### Phase 1 (Current)
✅ Core reimbursement processing
✅ OCR data extraction
✅ Multi-agent AI system
✅ Return to employee workflow
✅ Comments system
✅ HR corrections
✅ Settlement tracking
✅ Self-contained data management

### Phase 2 (Q1)
- Kronos integration (timesheet)
- HRMS integration (employee master)
- Advanced analytics dashboard
- Mobile app (iOS/Android)

### Phase 3 (Q2)
- Payroll integration (auto-disbursement)
- Multi-currency support
- International tax handling
- Advanced fraud detection

### Phase 4 (Q3)
- AI policy recommendations
- Predictive budgeting
- Chatbot interface
- Voice claim submission

---

## Glossary

**ADK** - Agent Development Kit (Google's framework)
**Allowance** - Fixed amount claim without supporting documents
**BSON** - Binary JSON (MongoDB document format)
**DocumentDB.io** - PostgreSQL-based MongoDB-compatible database
**Gemini** - Google's advanced LLM
**OCR** - Optical Character Recognition
**Reimbursement** - Variable amount claim with supporting documents

---


