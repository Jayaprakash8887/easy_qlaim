# Multi-Tenant Architecture

## Easy Qlaim - SaaS Multi-Tenancy Design

### 1. Overview

Easy Qlaim implements a **shared database, shared schema** multi-tenancy model with row-level isolation. This approach provides optimal cost efficiency while maintaining strict data isolation between tenants (organizations).

---

## 2. Multi-Tenancy Model Selection

### 2.1 Architecture Comparison

| Model | Isolation | Cost | Complexity | Easy Qlaim |
|-------|-----------|------|------------|------------|
| Separate Database per Tenant | Highest | Highest | High | ❌ |
| Separate Schema per Tenant | High | Medium | Medium | ❌ |
| **Shared Schema, Row Isolation** | Medium | **Lowest** | **Low** | ✅ |

### 2.2 Why Shared Schema?

**Benefits:**
- ✅ Single database connection pool
- ✅ Simplified deployment and migrations
- ✅ Lower infrastructure costs
- ✅ Efficient resource utilization
- ✅ Easier cross-tenant analytics (for platform admin)

**Mitigations for Isolation Concerns:**
- Mandatory `tenant_id` on all tables
- Enforced at ORM level (SQLAlchemy events)
- Query filters at middleware level
- Comprehensive audit logging

---

## 3. Data Model Design

### 3.1 Tenant Entity

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    name VARCHAR(255) NOT NULL,           -- "Acme Corporation"
    code VARCHAR(50) UNIQUE NOT NULL,     -- "ACME" (short identifier)
    domain VARCHAR(255),                   -- "acme.com" (email domain)
    
    -- Configuration
    settings JSONB DEFAULT '{}',          -- Tenant-specific settings
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenants_code ON tenants(code);
CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_active ON tenants(is_active);
```

### 3.2 Tenant-Scoped Tables

Every business table includes `tenant_id`:

```sql
-- Users (employees, managers, admins)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,  -- ◀ MANDATORY TENANT REFERENCE
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    -- ... other columns
    CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Claims
CREATE TABLE claims (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,  -- ◀ MANDATORY TENANT REFERENCE
    claim_number VARCHAR(50) UNIQUE,
    employee_id UUID REFERENCES users(id),
    -- ... other columns
    CONSTRAINT fk_claim_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Documents, Comments, Approvals, etc. follow same pattern
```

### 3.3 Entity Relationship with Tenancy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT DATA MODEL                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │   TENANTS    │◀─────────────────────────────────────────────────────┐    │
│  │              │                                                      │    │
│  │  id (PK)     │                                                      │    │
│  │  name        │                                                      │    │
│  │  code        │                                                      │    │
│  │  settings    │                                                      │    │
│  └──────┬───────┘                                                      │    │
│         │                                                              │    │
│         │ 1:N                                                          │    │
│         │                                                              │    │
│         ▼                                                              │    │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │    │
│  │    USERS     │ 1:N     │    CLAIMS    │ 1:N     │  DOCUMENTS   │   │    │
│  │              │────────▶│              │────────▶│              │   │    │
│  │  id (PK)     │         │  id (PK)     │         │  id (PK)     │   │    │
│  │  tenant_id ──┼─────────│  tenant_id ──┼─────────│  tenant_id ──┼───┘    │
│  │  email       │         │  claim_number│         │  filename    │        │
│  │  roles[]     │         │  amount      │         │  ocr_text    │        │
│  └──────────────┘         │  status      │         └──────────────┘        │
│                           └──────────────┘                                  │
│                                  │                                          │
│                                  │ 1:N                                      │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │  APPROVALS   │                                  │
│                           │              │                                  │
│                           │  id (PK)     │                                  │
│                           │  tenant_id ──┼──────────────────────────────┐   │
│                           │  claim_id    │                              │   │
│                           │  status      │                              │   │
│                           └──────────────┘                              │   │
│                                                                         │   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tenant Isolation Implementation

### 4.1 Application-Level Enforcement

**User Context Middleware:**
```python
# Every authenticated request extracts tenant_id from JWT
@app.middleware("http")
async def tenant_context_middleware(request: Request, call_next):
    # Extract tenant from JWT token
    if hasattr(request.state, "user"):
        request.state.tenant_id = request.state.user.tenant_id
    return await call_next(request)
```

**SQLAlchemy Query Filter:**
```python
# Automatic tenant filtering on all queries
class TenantMixin:
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    @classmethod
    def for_tenant(cls, tenant_id: UUID):
        return cls.query.filter(cls.tenant_id == tenant_id)
```

**Service Layer Enforcement:**
```python
# Example: Claims Service
class ClaimsService:
    def get_claim(self, claim_id: UUID, tenant_id: UUID):
        claim = db.query(Claim).filter(
            Claim.id == claim_id,
            Claim.tenant_id == tenant_id  # ◀ ALWAYS FILTER BY TENANT
        ).first()
        
        if not claim:
            raise HTTPException(404, "Claim not found")
        return claim
```

### 4.2 Database-Level Safeguards

**Composite Indexes for Performance:**
```sql
-- Optimize tenant-scoped queries
CREATE INDEX idx_claims_tenant_status ON claims(tenant_id, status);
CREATE INDEX idx_claims_tenant_employee ON claims(tenant_id, employee_id);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_approvals_tenant_status ON approvals(tenant_id, status);
```

**Row-Level Security (Optional Additional Layer):**
```sql
-- PostgreSQL RLS for defense-in-depth
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON claims
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 5. Role-Based Access Control (RBAC)

### 5.1 Tenant-Scoped Roles

**Application Roles (within tenant):**
| Role | Scope | Permissions |
|------|-------|-------------|
| `EMPLOYEE` | Self | Submit claims, view own claims |
| `MANAGER` | Team | Approve team claims, view team reports |
| `HR` | Tenant | Policy exceptions, employee corrections |
| `FINANCE` | Tenant | Settlements, financial reports |
| `ADMIN` | Tenant | Tenant configuration, user management |

**Platform Roles (cross-tenant):**
| Role | Scope | Permissions |
|------|-------|-------------|
| `SYSTEM_ADMIN` | Platform | Create tenants, platform configuration |

### 5.2 Designation-to-Role Mapping

Each tenant can define their own designations that map to application roles:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DESIGNATION ROLE MAPPING                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TENANT: Acme Corporation                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Designation (HRMS)        │ Application Role(s)                     │    │
│  ├───────────────────────────┼─────────────────────────────────────────┤    │
│  │ Junior Engineer           │ EMPLOYEE                                │    │
│  │ Senior Engineer           │ EMPLOYEE                                │    │
│  │ Tech Lead                 │ EMPLOYEE, MANAGER                       │    │
│  │ Engineering Manager       │ EMPLOYEE, MANAGER                       │    │
│  │ HR Executive              │ EMPLOYEE, HR                            │    │
│  │ HR Manager                │ EMPLOYEE, HR                            │    │
│  │ Finance Analyst           │ EMPLOYEE, FINANCE                       │    │
│  │ Finance Director          │ EMPLOYEE, FINANCE, ADMIN                │    │
│  │ CEO                       │ EMPLOYEE, MANAGER, ADMIN                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  TENANT: Beta Industries                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Designation (HRMS)        │ Application Role(s)                     │    │
│  ├───────────────────────────┼─────────────────────────────────────────┤    │
│  │ Associate                 │ EMPLOYEE                                │    │
│  │ Senior Associate          │ EMPLOYEE                                │    │
│  │ Team Manager              │ EMPLOYEE, MANAGER                       │    │
│  │ HR Business Partner       │ EMPLOYEE, HR                            │    │
│  │ Accounts Payable Lead     │ EMPLOYEE, FINANCE                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Tenant Configuration

### 6.1 Tenant Settings Schema

```json
{
  "tenant_settings": {
    // General Settings
    "general": {
      "company_name": "Acme Corporation",
      "timezone": "IST",  // Tenant-specific timezone (IST, UTC, EST, PST, GMT, CET, JST, AEST, SGT, GST)
      "date_format": "DD/MM/YYYY"
    },
    
    // Branding
    "branding": {
      "logo_url": "https://storage.example.com/acme/logo.png",
      "primary_color": "#1a73e8",
      "company_name": "Acme Corporation"
    },
    
    // Approval Workflow
    "approval": {
      "auto_approval_enabled": true,
      "auto_approval_threshold": 0.95,
      "max_auto_approval_amount": 5000,
      "require_hr_for_exceptions": true
    },
    
    // Policy Defaults
    "policies": {
      "default_currency": "INR",
      "fiscal_year_start": "04-01",
      "claim_submission_deadline_days": 30
    },
    
    // Integrations
    "integrations": {
      "hrms_enabled": true,
      "hrms_sync_frequency": "daily",
      "payroll_export_format": "CSV"
    },
    
    // Notifications
    "notifications": {
      "email_enabled": true,
      "slack_webhook_url": null,
      "reminder_frequency_days": 3
    }
  }
}
```

### 6.2 Accessing Tenant Settings

```python
# In application code
def get_tenant_setting(tenant_id: UUID, key: str, default=None):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or not tenant.settings:
        return default
    
    # Navigate nested keys like "approval.auto_approval_threshold"
    keys = key.split('.')
    value = tenant.settings
    for k in keys:
        if isinstance(value, dict):
            value = value.get(k, default)
        else:
            return default
    return value

# Usage
auto_approve_threshold = get_tenant_setting(
    tenant_id, 
    "approval.auto_approval_threshold", 
    default=0.95
)
```

---

## 7. Cache Isolation

### 7.1 Redis Key Namespacing

All cache keys are prefixed with tenant identifier:

```python
class TenantAwareCache:
    """Redis cache with tenant isolation."""
    
    def _build_key(self, tenant_id: str, key: str) -> str:
        """Build tenant-namespaced cache key."""
        return f"tenant:{tenant_id}:{key}"
    
    async def get(self, tenant_id: str, key: str) -> Any:
        full_key = self._build_key(tenant_id, key)
        return await self.redis.get(full_key)
    
    async def set(self, tenant_id: str, key: str, value: Any, ttl: int = 300):
        full_key = self._build_key(tenant_id, key)
        await self.redis.set(full_key, value, ex=ttl)
```

**Cache Key Examples:**
```
tenant:acme-corp-uuid:dashboard:summary
tenant:acme-corp-uuid:user:john.doe@acme.com
tenant:acme-corp-uuid:claims:pending_count

tenant:beta-ind-uuid:dashboard:summary
tenant:beta-ind-uuid:user:jane.smith@beta.com
tenant:beta-ind-uuid:claims:pending_count
```

### 7.2 Rate Limiting per Tenant

```python
RATE_LIMIT_KEY = "rate:{tenant_id}:{client_ip}:{endpoint}"

async def check_rate_limit(tenant_id: str, client_ip: str, endpoint: str):
    key = RATE_LIMIT_KEY.format(
        tenant_id=tenant_id,
        client_ip=client_ip,
        endpoint=endpoint
    )
    
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, 60)  # 1-minute window
    
    limit = get_endpoint_limit(endpoint)
    return current <= limit
```

---

## 8. Data Operations

### 8.1 Tenant Onboarding

```python
async def onboard_tenant(
    name: str,
    code: str,
    admin_email: str,
    admin_password: str,
    settings: dict = None
) -> Tenant:
    """
    Create new tenant with initial admin user.
    """
    async with db.transaction():
        # 1. Create tenant
        tenant = Tenant(
            name=name,
            code=code.upper(),
            settings=settings or {},
            is_active=True
        )
        db.add(tenant)
        await db.flush()
        
        # 2. Create admin user
        admin_user = User(
            tenant_id=tenant.id,
            username=f"admin@{code.lower()}",
            email=admin_email,
            hashed_password=hash_password(admin_password),
            roles=['EMPLOYEE', 'ADMIN'],
            is_active=True
        )
        db.add(admin_user)
        
        # 3. Create default designations
        default_designations = [
            ("Employee", "EMP", ['EMPLOYEE']),
            ("Manager", "MGR", ['EMPLOYEE', 'MANAGER']),
            ("HR Admin", "HR", ['EMPLOYEE', 'HR']),
            ("Finance Admin", "FIN", ['EMPLOYEE', 'FINANCE']),
        ]
        
        for name, code, roles in default_designations:
            designation = Designation(
                tenant_id=tenant.id,
                name=name,
                code=code
            )
            db.add(designation)
            await db.flush()
            
            for role in roles:
                mapping = DesignationRoleMapping(
                    tenant_id=tenant.id,
                    designation_id=designation.id,
                    role=role
                )
                db.add(mapping)
        
        # 4. Create default policy categories
        default_categories = [
            ("CERTIFICATION", "Professional Certifications"),
            ("TRAVEL", "Business Travel"),
            ("TEAM_LUNCH", "Team Meals"),
            ("ONCALL", "On-Call Allowance"),
        ]
        
        for code, name in default_categories:
            category = PolicyCategory(
                tenant_id=tenant.id,
                code=code,
                name=name,
                is_active=True
            )
            db.add(category)
        
        await db.commit()
        
        logger.info(f"Tenant onboarded: {tenant.name} ({tenant.code})")
        return tenant
```

### 8.2 Tenant Data Export

```python
async def export_tenant_data(tenant_id: UUID) -> dict:
    """
    Export all tenant data for compliance/migration.
    """
    export = {
        "tenant": None,
        "users": [],
        "claims": [],
        "documents": [],
        "approvals": [],
        "exported_at": datetime.utcnow().isoformat()
    }
    
    # Tenant info
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    export["tenant"] = tenant.to_dict()
    
    # Users (without passwords)
    users = db.query(User).filter(User.tenant_id == tenant_id).all()
    export["users"] = [u.to_dict(exclude=['hashed_password']) for u in users]
    
    # Claims
    claims = db.query(Claim).filter(Claim.tenant_id == tenant_id).all()
    export["claims"] = [c.to_dict() for c in claims]
    
    # ... continue for other entities
    
    return export
```

### 8.3 Tenant Deactivation

When a tenant is deactivated:
1. **Tenant record** is marked as `is_active = False`
2. **Login is blocked** for all users of that tenant
3. **Data is preserved** (soft-delete approach)
4. **Access can be restored** by reactivating the tenant

**Login Enforcement:**
```python
# During authentication - check tenant status
async def login(credentials: LoginRequest, db: Session):
    user = db.query(User).filter(User.username == credentials.username).first()
    
    if not user:
        raise HTTPException(401, "Invalid credentials")
    
    # Check if tenant is active
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant or not tenant.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your organization's access has been suspended. Please contact support."
        )
    
    # Continue with authentication...
```

**Deactivation Process:**
```python
async def deactivate_tenant(tenant_id: UUID, reason: str):
    """
    Soft-delete tenant (preserve data, disable access).
    """
    async with db.transaction():
        # 1. Deactivate tenant
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        tenant.is_active = False
        tenant.settings['deactivation_reason'] = reason
        tenant.settings['deactivated_at'] = datetime.utcnow().isoformat()
        
        # 2. Optionally deactivate all users
        db.query(User).filter(User.tenant_id == tenant_id).update(
            {"is_active": False}
        )
        
        # 3. Clear cache
        await redis_cache.delete_pattern(f"tenant:{tenant_id}:*")
        
        # 4. Audit log
        audit_logger.info(
            f"Tenant deactivated: {tenant.name} ({tenant.code}). "
            f"Reason: {reason}"
        )
        
        await db.commit()
```

> **Note:** Login blocking via tenant `is_active` status provides immediate access control without requiring individual user deactivation. Users see a clear message explaining their organization's access has been suspended.

---

## 9. Cross-Tenant Operations (Platform Admin)

### 9.1 Platform Dashboard

```python
@router.get("/platform/dashboard", dependencies=[Depends(require_system_admin)])
async def get_platform_dashboard():
    """
    Platform-wide metrics (SYSTEM_ADMIN only).
    """
    return {
        "total_tenants": db.query(Tenant).count(),
        "active_tenants": db.query(Tenant).filter(Tenant.is_active == True).count(),
        "total_users": db.query(User).count(),
        "total_claims": db.query(Claim).count(),
        "claims_today": db.query(Claim).filter(
            Claim.created_at >= datetime.utcnow().date()
        ).count(),
        "claims_by_tenant": db.query(
            Tenant.name,
            func.count(Claim.id)
        ).join(Claim, Claim.tenant_id == Tenant.id).group_by(Tenant.name).all()
    }
```

### 9.2 Cross-Tenant Reporting

```python
@router.get("/platform/reports/claims-volume", dependencies=[Depends(require_system_admin)])
async def get_claims_volume_report(
    start_date: date,
    end_date: date
):
    """
    Claims volume report across all tenants.
    """
    return db.query(
        Tenant.name,
        Tenant.code,
        func.count(Claim.id).label("claim_count"),
        func.sum(Claim.amount).label("total_amount")
    ).join(
        Claim, Claim.tenant_id == Tenant.id
    ).filter(
        Claim.created_at.between(start_date, end_date)
    ).group_by(
        Tenant.id
    ).all()
```

---

## 10. Security Considerations

### 10.1 Tenant Data Isolation Checklist

| Layer | Control | Status |
|-------|---------|--------|
| API | JWT contains tenant_id | ✅ |
| API | Middleware validates tenant context | ✅ |
| Service | All queries filter by tenant_id | ✅ |
| Database | Foreign key constraints | ✅ |
| Database | Indexes on tenant_id | ✅ |
| Database | Optional: Row-Level Security | 🔄 |
| Cache | Key namespacing | ✅ |
| Storage | Tenant-prefixed blob paths | ✅ |
| Logs | Tenant context in all logs | ✅ |

### 10.2 Common Vulnerabilities & Mitigations

| Vulnerability | Risk | Mitigation |
|---------------|------|------------|
| IDOR (Insecure Direct Object Reference) | High | Always verify tenant_id matches resource |
| Cache Poisoning | Medium | Tenant-prefixed keys, no shared cache |
| SQL Injection | High | ORM parameterized queries, input validation |
| Horizontal Privilege Escalation | High | Check tenant_id on all resource access |
| API Enumeration | Medium | Rate limiting, no sequential IDs |

---

## 11. Performance Optimization

### 11.1 Query Optimization

**Composite Indexes:**
```sql
-- Most common query patterns
CREATE INDEX idx_claims_tenant_status ON claims(tenant_id, status);
CREATE INDEX idx_claims_tenant_date ON claims(tenant_id, created_at DESC);
CREATE INDEX idx_users_tenant_department ON users(tenant_id, department);
```

**Query Analysis:**
```sql
-- Explain plan should show index scan with tenant filter
EXPLAIN ANALYZE
SELECT * FROM claims 
WHERE tenant_id = 'uuid-here' AND status = 'PENDING_MANAGER';
```

### 11.2 Connection Pooling

```python
# database.py
engine = create_engine(
    DATABASE_URL,
    pool_size=20,           # Base connections
    max_overflow=10,        # Additional connections under load
    pool_recycle=1800,      # Recycle connections every 30 min
    pool_timeout=30,        # Wait max 30s for connection
)
```

---

*Document Version: 1.0 | Last Updated: December 2024*
