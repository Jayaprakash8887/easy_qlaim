# System Architecture

## Easy Qlaim - AI-Powered Expense Reimbursement Platform

### 1. Overview

Easy Qlaim is a multi-tenant SaaS platform that automates expense reimbursement and allowance processing using a multi-agent AI architecture. The system combines rule-based validation with Large Language Model (LLM) reasoning to process claims intelligently while reducing manual intervention.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐    ┌─────────────────────────────────────────────┐ │
│  │   React SPA (Vite)      │    │         Mobile Web (PWA Ready)              │ │
│  │   - shadcn/ui           │    │         - Responsive Design                 │ │
│  │   - TanStack Query      │    │         - Offline Support                   │ │
│  │   - Tailwind CSS        │    │         - Push Notifications                │ │
│  └───────────┬─────────────┘    └─────────────────┬───────────────────────────┘ │
└──────────────┼────────────────────────────────────┼─────────────────────────────┘
               │                                    │
               ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  API GATEWAY                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           FastAPI Application                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │  Security    │  │  Rate        │  │  Request     │  │  CORS       │  │    │
│  │  │  Headers     │  │  Limiting    │  │  Logging     │  │  Handling   │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │    │
│  │  │              Request ID Correlation Middleware                    │   │    │
│  │  └──────────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  ┌────────────────────────────────┐   │
│  │         REST API Endpoints            │  │      Background Workers        │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐    │  │  ┌──────────────────────────┐  │   │
│  │  │ Claims │ │ Users  │ │Approval│    │  │  │    Celery Workers         │  │   │
│  │  │  API   │ │  API   │ │  API   │    │  │  │  - OCR Processing        │  │   │
│  │  └────────┘ └────────┘ └────────┘    │  │  │  - AI Validation         │  │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐    │  │  │  - Notification Dispatch │  │   │
│  │  │ Docs   │ │ Policy │ │Dashboard│   │  │  └──────────────────────────┘  │   │
│  │  │  API   │ │  API   │ │  API   │    │  └────────────────────────────────┘   │
│  │  └────────┘ └────────┘ └────────┘    │                                        │
│  └──────────────────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT ORCHESTRATION                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        ORCHESTRATOR AGENT                                │    │
│  │                   (Master Workflow Coordinator)                          │    │
│  └───────────────────────────────┬─────────────────────────────────────────┘    │
│                                  │                                               │
│    ┌─────────────────────────────┼─────────────────────────────────┐            │
│    │                             │                                 │            │
│    ▼                             ▼                                 ▼            │
│  ┌────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐       │
│  │ DOCUMENT AGENT │  │  VALIDATION AGENT   │  │    APPROVAL AGENT       │       │
│  │ - OCR Extract  │  │  - Rule Engine      │  │  - Intelligent Routing  │       │
│  │ - LLM Vision   │  │  - LLM Reasoning    │  │  - Auto-Approval Logic  │       │
│  │ - Data Parse   │  │  - Risk Scoring     │  │  - Workflow Management  │       │
│  └────────────────┘  └─────────────────────┘  └─────────────────────────┘       │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ Supporting Agents: Notification Agent | Duplicate Detection Agent        │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                DATA LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐  ┌─────────────────────────┐    │
│  │    PostgreSQL      │  │       Redis        │  │    Cloud Storage        │    │
│  │  - Multi-tenant    │  │  - Session Cache   │  │  - GCS/Azure/S3/Local   │    │
│  │  - JSONB Support   │  │  - Rate Limiting   │  │  - Document Storage     │    │
│  │  - Full-text GIN   │  │  - Task Queue      │  │  - Signed URLs          │    │
│  └────────────────────┘  └────────────────────┘  └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             EXTERNAL SERVICES                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │   LLM APIs     │  │   OCR Services │  │     SSO/IAM    │  │   HRMS APIs   │  │
│  │  - Gemini      │  │  - Tesseract   │  │   - Keycloak   │  │  - Kronos     │  │
│  │  - OpenAI      │  │  - Vision API  │  │   - JWT Auth   │  │  - Payroll    │  │
│  │  - Anthropic   │  │  - Textract    │  │                │  │               │  │
│  │  - Azure OAI   │  │                │  │                │  │               │  │
│  │  - Ollama      │  │                │  │                │  │               │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Backend
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | FastAPI | 0.104+ | High-performance async API |
| ORM | SQLAlchemy | 2.0+ | Database abstraction |
| Task Queue | Celery | 5.3+ | Async job processing |
| Cache/Queue | Redis | 7.2+ | Caching, rate limiting, task queue |
| Database | PostgreSQL | 15+ | Primary data store |
| Python | Python | 3.11+ | Runtime |

### Frontend
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | 18.x | UI framework |
| Build Tool | Vite | 5.0+ | Fast development builds |
| Language | TypeScript | 5.x | Type safety |
| UI Library | shadcn/ui | Latest | Component library |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| State | TanStack Query | 5.x | Server state management |

### AI/ML
| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary LLM | Google Gemini 2.0 | Document understanding, validation reasoning |
| OCR Engine | Tesseract | Text extraction from documents |
| Vision Fallback | LLM Vision API | Low-confidence OCR enhancement |

### Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Containerization | Docker | Service containerization |
| Orchestration | Docker Compose | Local/simple deployments |
| Cloud Storage | GCS/Azure Blob/S3 | Document storage |
| Authentication | Keycloak (optional) | Enterprise SSO |

---

## 4. Data Flow Architecture

### 4.1 Claim Submission Flow

```
┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────┐
│ Employee │───▶│ Frontend │───▶│   API       │───▶│   Database   │
│ Submits  │    │  Form    │    │  Endpoint   │    │   (Claims)   │
└──────────┘    └──────────┘    └──────┬──────┘    └──────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Celery Task    │
                              │  Dispatched     │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Orchestrator   │
                              │    Agent        │
                              └────────┬────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Document Agent  │────────▶│ Validation Agent│────────▶│ Approval Agent  │
│ (OCR + Parse)   │         │ (Rules + AI)    │         │ (Route + Notify)│
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### 4.2 Approval Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APPROVAL STATE MACHINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SUBMITTED ──▶ AI_PROCESSING ──┬──▶ AUTO_APPROVED (High Confidence)        │
│                                │                                             │
│                                ├──▶ PENDING_MANAGER ──┬──▶ APPROVED         │
│                                │                      │                      │
│                                │                      ├──▶ REJECTED          │
│                                │                      │                      │
│                                │                      └──▶ RETURNED ──▶ (Re-submit)
│                                │                                             │
│                                ├──▶ PENDING_HR ──┬──▶ HR_APPROVED ──▶ FINANCE│
│                                │                 │                           │
│                                │                 └──▶ RETURNED               │
│                                │                                             │
│                                └──▶ PENDING_FINANCE ──▶ SETTLED              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component Descriptions

### 5.1 API Layer

**FastAPI Application**
- RESTful API design with OpenAPI documentation
- Async request handling for high throughput
- Comprehensive middleware stack for security
- Role-based access control (RBAC)

**Middleware Stack (in order):**
1. `RequestIdMiddleware` - UUID correlation for request tracing
2. `SecurityHeadersMiddleware` - OWASP security headers
3. `RateLimitMiddleware` - Endpoint-specific rate limiting
4. `RequestLoggingMiddleware` - Audit trail
5. `SQLInjectionProtectionMiddleware` - Input sanitization

### 5.2 Agent Layer

**Multi-Agent Architecture:**
- Agents operate as autonomous workers
- Celery manages task distribution
- Each agent has specific responsibilities
- Agents communicate through claim state

**Agent Hierarchy:**
```
Orchestrator Agent (Coordinator)
    │
    ├── Document Agent (OCR + Data Extraction)
    │
    ├── Validation Agent (Policy Compliance)
    │
    └── Approval Agent (Workflow Routing)
    
Supporting Agents:
    ├── Notification Agent (Alerts)
    └── Duplicate Detection Agent (Fraud Prevention)
```

### 5.3 Data Layer

**PostgreSQL Database:**
- Multi-tenant data isolation via `tenant_id`
- JSONB columns for flexible claim payloads
- Full-text search with pg_trgm GIN indexes
- Composite indexes for query optimization

**Redis Cache:**
- Tenant-isolated cache namespaces
- Session management
- Rate limit counters
- Celery task broker and result backend

### 5.4 Storage Layer

**Multi-Provider Support:**
| Provider | Use Case |
|----------|----------|
| GCS | Production (GCP deployments) |
| Azure Blob | Production (Azure deployments) |
| AWS S3 | Production (AWS deployments) |
| Local | Development and testing |

**Features:**
- Signed URLs for secure document access
- Automatic cleanup of local files after cloud sync
- Content-type validation
- Virus scanning integration ready

---

## 6. Integration Architecture

### 6.1 External System Integration

```
┌─────────────────┐     ┌─────────────────────────────────────────┐
│   Easy Qlaim    │     │           EXTERNAL SYSTEMS              │
├─────────────────┤     ├─────────────────────────────────────────┤
│                 │     │                                         │
│  Integration    │────▶│  HRMS API (Employee Data Sync)          │
│  Agent          │     │  - Employee profiles                    │
│                 │     │  - Department hierarchy                 │
│                 │     │  - Manager relationships                │
│                 │     │                                         │
│                 │────▶│  Kronos (Attendance/Timesheet)          │
│                 │     │  - On-call verification                 │
│                 │     │  - Travel date verification             │
│                 │     │                                         │
│                 │────▶│  Payroll System                         │
│                 │     │  - Settlement processing                │
│                 │     │  - Payment reference numbers            │
│                 │     │                                         │
└─────────────────┘     └─────────────────────────────────────────┘
```

### 6.2 Authentication Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │ Client  │───▶│   API       │───▶│  Auth Decision Point    │  │
│  │         │    │   Gateway   │    │                         │  │
│  └─────────┘    └─────────────┘    └───────────┬─────────────┘  │
│                                                 │                │
│                       ┌─────────────────────────┼───────────┐   │
│                       ▼                         ▼           │   │
│              ┌─────────────────┐     ┌─────────────────┐    │   │
│              │   Keycloak SSO  │     │  Built-in JWT   │    │   │
│              │   (Enterprise)  │     │  (Standalone)   │    │   │
│              └─────────────────┘     └─────────────────┘    │   │
│                                                              │   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Deployment Architecture

### 7.1 Container Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      DOCKER COMPOSE STACK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Frontend   │  │   Backend   │  │   Celery Workers        │  │
│  │  (nginx)    │  │  (uvicorn)  │  │   (Multi-process)       │  │
│  │  Port: 80   │  │  Port: 8000 │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ PostgreSQL  │  │    Redis    │  │    Keycloak (Optional)  │  │
│  │  Port: 5432 │  │  Port: 6379 │  │    Port: 8180           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Scaling Strategy

| Component | Scaling Method | Notes |
|-----------|----------------|-------|
| Frontend | Horizontal | CDN + multiple instances |
| Backend API | Horizontal | Load balanced, stateless |
| Celery Workers | Horizontal | Auto-scale based on queue depth |
| PostgreSQL | Vertical + Read Replicas | Connection pooling |
| Redis | Cluster mode | Sentinel for HA |

---

## 8. Performance Characteristics

### 8.1 Response Time Targets

| Operation | Target | 95th Percentile |
|-----------|--------|-----------------|
| API Response | < 200ms | < 500ms |
| OCR Processing | < 5s | < 10s |
| AI Validation | < 3s | < 5s |
| Dashboard Load | < 1s | < 2s |

### 8.2 Throughput Targets

| Metric | Target |
|--------|--------|
| Concurrent Users | 1000+ |
| Claims/Hour | 500+ |
| Documents/Hour | 1000+ |
| API Requests/Second | 100+ |

---

## 9. Monitoring & Observability

### 9.1 Logging Strategy

```
Application Logs ─────▶ Structured JSON
                       - Request ID correlation
                       - Tenant context
                       - User context

Audit Logs ───────────▶ Separate audit.log
                       - Security events
                       - Access patterns
                       - Approval decisions

Agent Execution ──────▶ Database records
                       - Timing metrics
                       - Success/failure
                       - AI confidence scores
```

### 9.2 Metrics Collection

- Request latency histograms
- Cache hit/miss rates
- Queue depths
- Error rates by endpoint
- Agent execution times
- AI confidence distributions

---

## 10. Disaster Recovery

### 10.1 Backup Strategy

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| PostgreSQL | Daily full, hourly incremental | 30 days |
| Redis | Hourly RDB snapshots | 7 days |
| Documents | Real-time cloud sync | Indefinite |

### 10.2 Recovery Objectives

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | < 1 hour |
| RTO (Recovery Time Objective) | < 4 hours |

---

*Document Version: 1.0 | Last Updated: December 2024*
