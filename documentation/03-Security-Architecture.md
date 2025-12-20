# Security Architecture

## Easy Qlaim - Data Security & Protection

### 1. Overview

Easy Qlaim implements a defense-in-depth security model with multiple layers of protection for data at rest, data in transit, and application-level security controls.

---

## 2. Security Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: NETWORK SECURITY                                               │    │
│  │  - TLS 1.3 for all connections                                          │    │
│  │  - HTTPS enforcement (HSTS)                                              │    │
│  │  - Network segmentation                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: APPLICATION SECURITY                                           │    │
│  │  - Security headers middleware                                           │    │
│  │  - Rate limiting                                                         │    │
│  │  - Input validation & sanitization                                       │    │
│  │  - SQL injection protection                                              │    │
│  │  - XSS protection                                                        │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: AUTHENTICATION & AUTHORIZATION                                 │    │
│  │  - JWT-based authentication                                              │    │
│  │  - Role-Based Access Control (RBAC)                                      │    │
│  │  - Multi-tenant isolation                                                │    │
│  │  - Optional Keycloak SSO integration                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 4: DATA PROTECTION                                                │    │
│  │  - Encryption at rest (database, storage)                                │    │
│  │  - Encryption in transit (TLS)                                           │    │
│  │  - Password hashing (bcrypt)                                             │    │
│  │  - Secure credential management                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 5: AUDIT & MONITORING                                             │    │
│  │  - Request logging with correlation IDs                                  │    │
│  │  - Security event audit trail                                            │    │
│  │  - Anomaly detection                                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data at Rest Encryption

### 3.1 Database Encryption

**PostgreSQL Encryption:**
- **Transparent Data Encryption (TDE):** Available in cloud-managed PostgreSQL services
- **Column-level encryption:** For highly sensitive fields
- **Connection encryption:** SSL/TLS for database connections

```python
# Database connection with SSL
DATABASE_URL = "postgresql+asyncpg://user:pass@host:5432/db?ssl=require"

# SQLAlchemy engine with SSL
engine = create_async_engine(
    DATABASE_URL,
    connect_args={
        "ssl": ssl.create_default_context(cafile="/path/to/ca-cert.pem")
    }
)
```

**Sensitive Data Storage:**
| Data Type | Storage | Protection |
|-----------|---------|------------|
| Passwords | Database | bcrypt hash (12 rounds) |
| JWT Secrets | Environment | Not in code/database |
| API Keys | Environment | Encrypted secrets manager |
| PII Fields | Database | Application-level encryption |

### 3.2 Password Hashing

```python
from passlib.context import CryptContext

# Password hashing configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Cost factor for bcrypt
)

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)
```

### 3.3 Document Storage Encryption

**Cloud Storage (GCS/Azure/S3):**
- Server-Side Encryption (SSE) enabled by default
- Customer-Managed Encryption Keys (CMEK) for compliance
- Bucket-level access controls

**Local Storage (Development):**
```python
# Signed URLs prevent direct file access
def generate_signed_url(blob_name: str, expiration: int = 3600) -> str:
    """Generate time-limited signed URL for document access."""
    blob = bucket.blob(blob_name)
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(seconds=expiration),
        method="GET"
    )
```

### 3.4 Redis Cache Encryption

```python
# Redis connection with TLS (production)
REDIS_URL = "rediss://user:password@redis-host:6380/0?ssl_cert_reqs=required"

# Sensitive data TTL (auto-expiration)
await redis.set(f"session:{user_id}", session_data, ex=3600)  # 1-hour expiry
```

---

## 4. Data in Transit Encryption

### 4.1 TLS Configuration

**Frontend → Backend:**
- TLS 1.3 (minimum TLS 1.2)
- Strong cipher suites only
- Certificate validation

**Backend → Database:**
- SSL/TLS connection required
- Certificate verification enabled

**Backend → External APIs:**
- HTTPS only
- Certificate pinning for known APIs

### 4.2 HTTPS Enforcement

```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers including HSTS."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # HTTP Strict Transport Security
        # Forces HTTPS for 1 year, includes subdomains
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        
        return response
```

### 4.3 Internal Service Communication

```
┌─────────────────────────────────────────────────────────────────┐
│              INTERNAL COMMUNICATION SECURITY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐                         ┌──────────┐              │
│  │ Backend  │──── TLS (Redis) ───────▶│  Redis   │              │
│  │  API     │                         │  Cache   │              │
│  └────┬─────┘                         └──────────┘              │
│       │                                                          │
│       │ SSL/TLS                                                  │
│       ▼                                                          │
│  ┌──────────┐                         ┌──────────┐              │
│  │PostgreSQL│◀──── TLS (Celery) ─────│  Celery  │              │
│  │ Database │                         │ Workers  │              │
│  └──────────┘                         └──────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Application Security

### 5.1 Security Headers

```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive security headers middleware.
    Protects against common web vulnerabilities.
    """
    
    def __init__(self, app, csp_policy: Optional[str] = None):
        super().__init__(app)
        self.csp_policy = csp_policy or (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'self'; "
            "form-action 'self'; "
            "base-uri 'self';"
        )
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Enable XSS filter
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # HSTS
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = self.csp_policy
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), "
            "gyroscope=(), magnetometer=(), microphone=(), "
            "payment=(), usb=()"
        )
        
        # Prevent caching of API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, private"
            response.headers["Pragma"] = "no-cache"
        
        return response
```

### 5.2 Rate Limiting

**Endpoint-Specific Limits:**
```python
class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting with endpoint-specific configurations.
    """
    
    # Requests per minute by endpoint pattern
    ENDPOINT_LIMITS = {
        "/api/v1/auth/login": 10,          # Prevent brute force
        "/api/v1/auth/register": 5,        # Prevent mass registration
        "/api/v1/auth/forgot-password": 5, # Prevent abuse
        "/api/v1/documents/upload": 20,    # File uploads
        "/api/v1/documents/bulk": 5,       # Bulk operations
        "/api/v1/reports": 10,             # Expensive operations
        "/api/v1/dashboard/summary": 30,   # Dashboard stats
    }
    
    DEFAULT_LIMIT = 60  # Default: 60 requests/minute
```

### 5.3 Input Validation

**SQL Injection Protection:**
```python
class SQLInjectionProtectionMiddleware(BaseHTTPMiddleware):
    """Detect and block SQL injection attempts."""
    
    SQL_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)",
        r"(--|#|/\*)",
        r"(\bOR\b\s+\d+\s*=\s*\d+)",
        r"(\bAND\b\s+\d+\s*=\s*\d+)",
        r"(;\s*(SELECT|INSERT|UPDATE|DELETE))",
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Check query parameters
        query_string = str(request.query_params)
        if self._contains_sql_pattern(query_string):
            audit_logger.warning(
                f"SQL injection attempt detected from {get_client_ip(request)}"
            )
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid request parameters"}
            )
        
        return await call_next(request)
```

**XSS Sanitization:**
```python
import bleach

def sanitize_html(content: str) -> str:
    """Remove potentially dangerous HTML tags and attributes."""
    allowed_tags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br']
    allowed_attrs = {}
    
    return bleach.clean(
        content,
        tags=allowed_tags,
        attributes=allowed_attrs,
        strip=True
    )

def sanitize_input(data: dict) -> dict:
    """Recursively sanitize all string values in input data."""
    sanitized = {}
    for key, value in data.items():
        if isinstance(value, str):
            sanitized[key] = sanitize_html(value)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_input(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_input(item) if isinstance(item, dict) 
                else sanitize_html(item) if isinstance(item, str)
                else item
                for item in value
            ]
        else:
            sanitized[key] = value
    return sanitized
```

### 5.4 File Upload Security

```python
class FileValidator:
    """Comprehensive file upload validation."""
    
    ALLOWED_EXTENSIONS = {
        '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx'
    }
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    
    # Magic bytes for file type verification
    MAGIC_BYTES = {
        b'%PDF': '.pdf',
        b'\xff\xd8\xff': '.jpg',
        b'\x89PNG': '.png',
        b'GIF87a': '.gif',
        b'GIF89a': '.gif',
        b'PK\x03\x04': '.docx',  # ZIP-based formats
    }
    
    @classmethod
    def validate_file(cls, file: UploadFile) -> tuple[bool, str]:
        """
        Validate uploaded file for security.
        Returns (is_valid, error_message).
        """
        # 1. Check extension
        ext = Path(file.filename).suffix.lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            return False, f"File type {ext} not allowed"
        
        # 2. Check file size
        file.file.seek(0, 2)  # Seek to end
        size = file.file.tell()
        file.file.seek(0)  # Reset
        
        if size > cls.MAX_FILE_SIZE:
            return False, f"File size {size} exceeds limit"
        
        # 3. Verify magic bytes match extension
        header = file.file.read(16)
        file.file.seek(0)
        
        detected_type = None
        for magic, file_type in cls.MAGIC_BYTES.items():
            if header.startswith(magic):
                detected_type = file_type
                break
        
        if detected_type and detected_type != ext:
            return False, "File extension does not match content type"
        
        # 4. Sanitize filename
        safe_filename = cls.sanitize_filename(file.filename)
        if not safe_filename:
            return False, "Invalid filename"
        
        return True, ""
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Remove dangerous characters from filename."""
        # Keep only alphanumeric, dash, underscore, dot
        safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
        # Prevent directory traversal
        safe = safe.replace('..', '_')
        return safe[:255]  # Limit length
```

---

## 6. Authentication & Authorization

### 6.1 JWT Token Security

```python
class JWTConfig:
    """JWT configuration and token management."""
    
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    
    @staticmethod
    def create_access_token(data: dict) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(
            minutes=JWTConfig.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        
        return jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=JWTConfig.ALGORITHM
        )
    
    @staticmethod
    def verify_token(token: str) -> dict:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[JWTConfig.ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(401, "Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(401, "Invalid token")
```

**Token Payload:**
```json
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "email": "user@example.com",
  "roles": ["EMPLOYEE", "MANAGER"],
  "exp": 1703123456,
  "iat": 1703121656,
  "type": "access"
}
```

### 6.2 Role-Based Access Control

```python
def require_roles(*required_roles):
    """
    Dependency to verify user has required roles.
    """
    async def verify_roles(
        current_user: User = Depends(get_current_user)
    ):
        user_roles = set(current_user.roles or [])
        required = set(required_roles)
        
        if not required.intersection(user_roles):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )
        
        return current_user
    
    return verify_roles

# Usage examples
@router.get("/claims/all", dependencies=[Depends(require_roles("HR", "FINANCE", "ADMIN"))])
async def get_all_claims():
    """Only HR, Finance, or Admin can view all claims."""
    pass

@router.post("/settlements", dependencies=[Depends(require_roles("FINANCE"))])
async def create_settlement():
    """Only Finance can create settlements."""
    pass
```

### 6.3 Resource-Level Access Control

Beyond role-based access, certain resources require tenant-scoped authorization where users can only access resources belonging to their own tenant.

**Tenant-Scoped Authorization Pattern:**
```python
def check_resource_access(current_user: User, resource_tenant_id: UUID):
    """
    Verify user has access to a tenant-scoped resource.
    - System Admin: Can access any tenant's resources
    - Admin: Can only access their own tenant's resources
    - Other roles: Can only access their own tenant's resources
    """
    if "system_admin" in (current_user.roles or []):
        return  # System Admin has full access
    
    if str(current_user.tenant_id) != str(resource_tenant_id):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to access this tenant's resources"
        )
```

**Example: Branding Settings Authorization:**
```python
def check_branding_access(current_user: User, tenant_id: str):
    """
    Verify user can modify branding for specified tenant.
    - System Admin: Can modify any tenant's branding
    - Admin: Can only modify their own tenant's branding
    """
    user_roles = current_user.roles or []
    
    if "system_admin" in user_roles:
        return  # System Admin can modify any tenant
    
    if "admin" in user_roles:
        if str(current_user.tenant_id) != str(tenant_id):
            raise HTTPException(
                status_code=403,
                detail="You can only modify branding for your own tenant"
            )
        return
    
    # Other roles don't have branding access
    raise HTTPException(status_code=403, detail="Insufficient permissions")

# Applied to branding endpoints
@router.post("/tenants/{tenant_id}/branding/upload")
async def upload_branding_file(
    tenant_id: str,
    file: UploadFile,
    current_user: User = Depends(get_current_user)
):
    check_branding_access(current_user, tenant_id)
    # ... upload logic
```

### 6.4 Keycloak SSO Integration

```python
class KeycloakAuth:
    """Keycloak SSO authentication integration."""
    
    def __init__(self):
        self.server_url = settings.KEYCLOAK_SERVER_URL
        self.realm = settings.KEYCLOAK_REALM
        self.client_id = settings.KEYCLOAK_CLIENT_ID
        self.client_secret = settings.KEYCLOAK_CLIENT_SECRET
    
    async def verify_token(self, token: str) -> dict:
        """Verify Keycloak access token."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/userinfo",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(401, "Invalid Keycloak token")
            
            return response.json()
    
    def get_login_url(self, redirect_uri: str) -> str:
        """Get Keycloak login URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid profile email"
        }
        return f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/auth?{urlencode(params)}"
```

---

## 7. Audit & Monitoring

### 7.1 Request ID Correlation

```python
class RequestIdMiddleware(BaseHTTPMiddleware):
    """Add request ID for distributed tracing."""
    
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Store in context for logging
        request.state.request_id = request_id
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response
```

### 7.2 Audit Logging

```python
# Separate audit logger
audit_logger = logging.getLogger('audit')
audit_handler = logging.FileHandler('audit.log')
audit_handler.setFormatter(
    logging.Formatter('%(asctime)s - AUDIT - %(message)s')
)
audit_logger.addHandler(audit_handler)
audit_logger.setLevel(logging.INFO)

# Audit events
def audit_log(event_type: str, user_id: str, tenant_id: str, details: dict):
    """Log security-relevant events."""
    audit_logger.info(json.dumps({
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "ip_address": details.get("ip_address"),
        "user_agent": details.get("user_agent"),
        "resource": details.get("resource"),
        "action": details.get("action"),
        "outcome": details.get("outcome"),
        "request_id": details.get("request_id")
    }))

# Usage
audit_log(
    event_type="CLAIM_APPROVED",
    user_id=str(current_user.id),
    tenant_id=str(current_user.tenant_id),
    details={
        "resource": f"claim:{claim_id}",
        "action": "approve",
        "outcome": "success",
        "request_id": request.state.request_id
    }
)
```

**Audited Events:**
| Event Type | Description |
|------------|-------------|
| `LOGIN_SUCCESS` | Successful user login |
| `LOGIN_FAILED` | Failed login attempt |
| `TOKEN_REFRESH` | JWT token refresh |
| `CLAIM_SUBMITTED` | New claim created |
| `CLAIM_APPROVED` | Claim approved |
| `CLAIM_REJECTED` | Claim rejected |
| `USER_CREATED` | New user account |
| `ROLE_CHANGED` | User role modification |
| `DOCUMENT_ACCESSED` | Document download/view |
| `SETTINGS_CHANGED` | Configuration changes |

### 7.3 Request Logging

```python
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests for security monitoring."""
    
    EXCLUDE_PATHS = ["/health", "/metrics", "/favicon.ico"]
    
    async def dispatch(self, request: Request, call_next):
        if any(request.url.path.startswith(p) for p in self.EXCLUDE_PATHS):
            return await call_next(request)
        
        start_time = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": getattr(request.state, 'request_id', 'unknown'),
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": get_client_ip(request),
            "user_agent": request.headers.get("user-agent", "unknown")[:200]
        }
        
        if response.status_code >= 500:
            logger.error(f"Request: {log_data}")
        elif response.status_code >= 400:
            logger.warning(f"Request: {log_data}")
        else:
            logger.info(f"Request: {log_data}")
        
        return response
```

---

## 8. Security Compliance Checklist

### 8.1 OWASP Top 10 Coverage

| Risk | Status | Implementation |
|------|--------|----------------|
| A01: Broken Access Control | ✅ | RBAC, tenant isolation |
| A02: Cryptographic Failures | ✅ | TLS, bcrypt, encryption |
| A03: Injection | ✅ | Parameterized queries, input validation |
| A04: Insecure Design | ✅ | Defense-in-depth |
| A05: Security Misconfiguration | ✅ | Security headers, secure defaults |
| A06: Vulnerable Components | 🔄 | Dependency scanning (recommended) |
| A07: Auth Failures | ✅ | JWT, rate limiting, audit logs |
| A08: Data Integrity Failures | ✅ | Input validation, signed URLs |
| A09: Logging Failures | ✅ | Comprehensive audit logging |
| A10: SSRF | ✅ | URL validation, allowlists |

### 8.2 Data Protection Compliance

| Requirement | Implementation |
|-------------|----------------|
| Data at Rest Encryption | Database TDE, cloud storage SSE |
| Data in Transit Encryption | TLS 1.3, HSTS |
| Password Security | bcrypt (12 rounds) |
| Access Logging | Full audit trail |
| Data Retention | Configurable per tenant |
| Right to Export | Data export API |
| Right to Delete | Soft delete with retention |

---

## 9. Security Operations

### 9.1 Incident Response

**Automated Responses:**
1. **Rate limit exceeded:** Temporary IP block
2. **Multiple failed logins:** Account lockout
3. **SQL injection detected:** Request blocked, alert triggered
4. **Invalid file upload:** Request rejected, logged

**Manual Response Procedures:**
1. Security incident detected
2. Incident logged with severity
3. Affected accounts isolated
4. Investigation initiated
5. Remediation applied
6. Post-incident review

### 9.2 Security Monitoring Alerts

```python
# Alert thresholds
ALERT_THRESHOLDS = {
    "failed_logins_per_hour": 100,
    "rate_limit_violations_per_minute": 50,
    "sql_injection_attempts_per_hour": 10,
    "unauthorized_access_attempts": 20
}

async def check_security_alerts():
    """Periodic security threshold check."""
    metrics = await get_security_metrics()
    
    for metric, threshold in ALERT_THRESHOLDS.items():
        if metrics.get(metric, 0) > threshold:
            await send_security_alert(
                severity="HIGH",
                metric=metric,
                value=metrics[metric],
                threshold=threshold
            )
```

---

## 10. Security Configuration Reference

### 10.1 Environment Variables

```bash
# Authentication
JWT_SECRET_KEY=<random-256-bit-key>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Keycloak (optional)
KEYCLOAK_ENABLED=true
KEYCLOAK_SERVER_URL=https://keycloak.example.com
KEYCLOAK_REALM=easyqlaim
KEYCLOAK_CLIENT_ID=easyqlaim-app
KEYCLOAK_CLIENT_SECRET=<client-secret>

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db?ssl=require

# Redis
REDIS_URL=rediss://user:pass@redis-host:6380/0?ssl_cert_reqs=required

# Storage
GCP_BUCKET_NAME=easyqlaim-documents
GCP_CREDENTIALS_PATH=/secrets/gcp-credentials.json
```

### 10.2 Security Headers Configuration

```python
# Production-recommended CSP
PRODUCTION_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https://storage.googleapis.com; "
    "font-src 'self'; "
    "connect-src 'self' https://api.example.com; "
    "frame-ancestors 'none'; "
    "form-action 'self'; "
    "base-uri 'self'; "
    "upgrade-insecure-requests;"
)
```

---

*Document Version: 1.0 | Last Updated: December 2025*
