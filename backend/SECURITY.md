# Security Implementation Guide

This document describes the security features implemented for the Easy Qlaim SaaS application to ensure data security at rest and in transit.

## Table of Contents

1. [Security Headers Middleware](#security-headers-middleware)
2. [SQL Injection Protection](#sql-injection-protection)
3. [XSS Sanitization](#xss-sanitization)
4. [File Upload Validation](#file-upload-validation)
5. [Authentication Event Logging](#authentication-event-logging)
6. [Data Access Pattern Logging](#data-access-pattern-logging)
7. [Tamper-Proof Audit Trails](#tamper-proof-audit-trails)
8. [Rate Limiting](#rate-limiting)

---

## 1. Security Headers Middleware

### Location
- `/backend/middleware/security.py` - `SecurityHeadersMiddleware`

### Features
All HTTP responses include the following security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `X-XSS-Protection` | `1; mode=block` | Enables browser XSS filter (legacy) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS |
| `Content-Security-Policy` | Comprehensive policy | Prevents XSS and data injection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | Restrictive policy | Disables unnecessary browser features |

### Configuration
The CSP policy can be customized when initializing the middleware:

```python
app.add_middleware(SecurityHeadersMiddleware, csp_policy="custom-policy")
```

---

## 2. SQL Injection Protection

### Primary Protection (SQLAlchemy ORM)
SQLAlchemy ORM provides parameterized queries by default, which prevents SQL injection:

```python
# Safe - parameterized query
user = db.query(User).filter(User.email == email).first()
```

### Defense-in-Depth (`SQLInjectionProtectionMiddleware`)

### Location
- `/backend/middleware/security.py` - `SQLInjectionProtectionMiddleware`

### Features
- Detects suspicious SQL patterns in query parameters
- Logs potential SQL injection attempts
- Can be configured to block or log-only mode

### Configuration
```python
# Log-only mode (default) - logs suspicious requests but doesn't block
app.add_middleware(SQLInjectionProtectionMiddleware, log_only=True)

# Block mode - blocks suspicious requests
app.add_middleware(SQLInjectionProtectionMiddleware, log_only=False)
```

---

## 3. XSS Sanitization

### Location
- `/backend/services/security.py` - `XSSSanitizer`

### Features
- Removes dangerous HTML/JavaScript patterns
- Escapes HTML entities
- Handles nested data structures

### Usage

```python
from services.security import xss_sanitizer, sanitize_input, sanitize_dict_input

# Single string sanitization
clean_input = sanitize_input(user_input)

# Dictionary sanitization
clean_data = sanitize_dict_input(user_data, fields_to_sanitize=['title', 'description'])

# Allow safe HTML (removes only dangerous patterns)
clean_html = xss_sanitizer.sanitize(content, allow_html=True)
```

### Dangerous Patterns Removed
- `<script>` tags
- Event handlers (`onclick`, `onerror`, etc.)
- `javascript:` and `vbscript:` protocols
- `<iframe>`, `<embed>`, `<object>` tags
- CSS expressions
- Form elements

---

## 4. File Upload Validation

### Location
- `/backend/services/security.py` - `FileValidator`

### Features
- **MIME Type Detection**: Uses `python-magic` to detect actual file type from content
- **Extension Validation**: Verifies file extension matches detected MIME type
- **Size Limits**: Configurable maximum file size (default 50MB)
- **Dangerous Signature Detection**: Blocks executables and scripts
- **Path Traversal Prevention**: Sanitizes filenames

### Usage

```python
from services.security import file_validator, validate_upload

# Validate uploaded file
is_valid, error_message = validate_upload(
    file_content=file_bytes,
    filename="document.pdf",
    allowed_extensions=['pdf', 'jpg', 'png']
)

# Get safe filename
safe_name = file_validator.get_safe_filename(user_filename)
```

### Supported MIME Types
- Images: `jpeg`, `png`, `gif`, `webp`, `tiff`, `bmp`
- Documents: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `txt`

### Blocked Signatures
- Windows executables (`MZ`)
- Linux executables (`ELF`)
- Shell scripts (`#!/`)
- PHP scripts (`<?php`)
- ASP/JSP scripts (`<%`)

---

## 5. Authentication Event Logging

### Location
- `/backend/services/security.py` - `AuditLogger`
- `/backend/api/v1/auth.py` - Login, logout, refresh endpoints

### Events Logged

| Event Type | Description |
|------------|-------------|
| `AUTH_LOGIN` | Successful login |
| `AUTH_LOGOUT` | User logout |
| `AUTH_FAILED` | Failed login attempt |
| `AUTH_TOKEN_REFRESH` | Token refresh |
| `AUTH_PASSWORD_CHANGE` | Password change |
| `AUTH_PASSWORD_RESET` | Password reset |

### Log Data Captured
- Timestamp
- User email
- IP address
- User agent
- Success/failure status
- Error message (if failed)
- Tenant ID and user roles (if successful)

### Usage

```python
from services.security import audit_logger

# Log authentication event
audit_logger.log_auth_event(
    event_type=audit_logger.AUTH_LOGIN,
    user_email=user.email,
    success=True,
    ip_address=client_ip,
    user_agent=user_agent,
    details={"user_id": str(user.id), "roles": roles}
)
```

---

## 6. Data Access Pattern Logging

### Location
- `/backend/services/security.py` - `AuditLogger.log_data_access()`
- `/backend/api/v1/claims.py` - Claim action endpoints

### Events Logged

| Event Type | Description |
|------------|-------------|
| `DATA_CREATE` | Record creation |
| `DATA_READ` | Record retrieval |
| `DATA_UPDATE` | Record modification |
| `DATA_DELETE` | Record deletion |
| `DATA_EXPORT` | Data export operation |
| `DATA_BULK_ACCESS` | Bulk data retrieval |

### Claim-Specific Events

| Event Type | Description |
|------------|-------------|
| `CLAIM_SUBMITTED` | New claim submission |
| `CLAIM_APPROVED` | Claim approval |
| `CLAIM_REJECTED` | Claim rejection |
| `CLAIM_RETURNED` | Claim returned to employee |
| `CLAIM_SETTLED` | Claim settlement |
| `CLAIM_EDITED` | HR claim edit |

### Usage

```python
from services.security import audit_logger

# Log data access
audit_logger.log_data_access(
    user_id=str(user.id),
    tenant_id=str(tenant_id),
    resource_type="claim",
    resource_id=str(claim_id),
    action="read",
    record_count=1,
    ip_address=client_ip
)

# Log claim action
audit_logger.log_claim_action(
    user_id=str(user.id),
    tenant_id=str(tenant_id),
    claim_id=str(claim_id),
    action="approve",
    details={"previous_status": "PENDING_HR", "new_status": "HR_APPROVED"},
    ip_address=client_ip
)
```

---

## 7. Tamper-Proof Audit Trails

### Location
- `/backend/services/security.py` - `AuditLogger`
- `/backend/models.py` - `AuditLog` model
- `/backend/migrations/001_create_audit_logs_table.sql`

### Features
- **Integrity Hash**: SHA-256 hash of each log entry for tamper detection
- **Chain Hash**: Optional previous_hash for sequence verification
- **Immutable Storage**: Audit logs are append-only
- **Comprehensive Metadata**: Captures user, resource, action, and context

### Database Schema

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    user_id UUID,
    user_email VARCHAR(255),
    tenant_id UUID,
    resource_type VARCHAR(100),
    resource_id UUID,
    action VARCHAR(100),
    action_details JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    success BOOLEAN,
    error_message TEXT,
    integrity_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### Verification

```python
import hashlib
import json

def verify_integrity(audit_entry: dict) -> bool:
    """Verify that an audit entry has not been tampered with."""
    stored_hash = audit_entry.pop('integrity_hash')
    content = json.dumps(audit_entry, sort_keys=True, default=str)
    computed_hash = hashlib.sha256(content.encode()).hexdigest()
    return computed_hash == stored_hash
```

---

## 8. Rate Limiting

### Location
- `/backend/middleware/security.py` - `RateLimitMiddleware`

### Features
- Per-IP rate limiting
- Configurable requests per minute
- Burst protection
- Automatic cleanup of old entries
- Rate limit headers in responses

### Configuration

```python
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=60,  # Max requests per minute
    burst_limit=100,         # Burst protection
    exclude_paths=["/health", "/metrics"]  # Paths to exclude
)
```

### Response Headers
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets

---

## Installation Requirements

Add to `requirements.txt`:
```
python-magic==0.4.27  # MIME type detection for file uploads
```

### Linux Dependencies
```bash
# Ubuntu/Debian
sudo apt-get install libmagic1

# CentOS/RHEL
sudo yum install file-libs
```

---

## Database Migration

Run the migration script to create the audit_logs table:

```bash
psql -h localhost -U postgres -d easyqlaim -f backend/migrations/001_create_audit_logs_table.sql
```

---

## Middleware Order

The middleware stack is configured in order of execution (last added = first executed):

```python
# 1. SQL Injection Protection (defense-in-depth)
app.add_middleware(SQLInjectionProtectionMiddleware, log_only=True)

# 2. Rate Limiting
app.add_middleware(RateLimitMiddleware, ...)

# 3. Request Logging
app.add_middleware(RequestLoggingMiddleware, ...)

# 4. Security Headers
app.add_middleware(SecurityHeadersMiddleware)
```

---

## Environment Configuration

```bash
# Security settings
LOG_LEVEL=INFO
ALLOWED_EXTENSIONS=pdf,jpg,jpeg,png,xlsx,xls

# For production
APP_ENV=production
DEBUG=false
```

---

## Best Practices

1. **Always use parameterized queries** - SQLAlchemy ORM handles this automatically
2. **Sanitize all user input** - Use `sanitize_input()` for display content
3. **Validate file uploads** - Check MIME type, not just extension
4. **Log security events** - Audit all authentication and sensitive operations
5. **Review audit logs regularly** - Look for patterns of suspicious activity
6. **Keep dependencies updated** - Security patches are critical
7. **Use HTTPS in production** - HSTS header enforces this
8. **Implement proper CORS** - Already configured in main.py

---

## Monitoring and Alerting

Security events are logged with different severity levels:

- **INFO**: Normal operations (login, data access)
- **WARNING**: Failed authentication, rate limit violations
- **ERROR**: Suspicious activity, potential attacks

Configure your logging infrastructure to alert on WARNING and ERROR level audit events.
