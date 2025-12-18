"""
Security Services Module
Provides XSS sanitization, input validation, MIME type verification, and audit logging.
"""
import re
import html
import hashlib
import magic
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
import json

logger = logging.getLogger(__name__)

# ==================== XSS SANITIZATION ====================

class XSSSanitizer:
    """
    XSS (Cross-Site Scripting) sanitization for user-generated content.
    Removes or escapes potentially dangerous HTML/JavaScript content.
    """
    
    # Dangerous patterns that should be removed
    DANGEROUS_PATTERNS = [
        # Script tags
        re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL),
        re.compile(r'<script[^>]*/?>', re.IGNORECASE),
        
        # Event handlers
        re.compile(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', re.IGNORECASE),
        re.compile(r'\s*on\w+\s*=\s*[^\s>]*', re.IGNORECASE),
        
        # JavaScript protocol
        re.compile(r'javascript\s*:', re.IGNORECASE),
        re.compile(r'vbscript\s*:', re.IGNORECASE),
        re.compile(r'data\s*:\s*text/html', re.IGNORECASE),
        
        # CSS expression
        re.compile(r'expression\s*\(', re.IGNORECASE),
        
        # iframe, embed, object
        re.compile(r'<iframe[^>]*>.*?</iframe>', re.IGNORECASE | re.DOTALL),
        re.compile(r'<iframe[^>]*/?>', re.IGNORECASE),
        re.compile(r'<embed[^>]*/?>', re.IGNORECASE),
        re.compile(r'<object[^>]*>.*?</object>', re.IGNORECASE | re.DOTALL),
        
        # Form injection
        re.compile(r'<form[^>]*>.*?</form>', re.IGNORECASE | re.DOTALL),
        re.compile(r'<input[^>]*/?>', re.IGNORECASE),
        
        # Style tags (can contain expressions)
        re.compile(r'<style[^>]*>.*?</style>', re.IGNORECASE | re.DOTALL),
        
        # Base tag manipulation
        re.compile(r'<base[^>]*/?>', re.IGNORECASE),
        
        # Meta refresh
        re.compile(r'<meta[^>]*http-equiv\s*=\s*["\']?refresh[^>]*>', re.IGNORECASE),
        
        # SVG with scripts
        re.compile(r'<svg[^>]*>.*?</svg>', re.IGNORECASE | re.DOTALL),
    ]
    
    # Characters to escape in HTML context
    HTML_ESCAPE_MAP = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
        '/': '&#x2F;',
    }
    
    @classmethod
    def sanitize(cls, content: str, allow_html: bool = False) -> str:
        """
        Sanitize user input to prevent XSS attacks.
        
        Args:
            content: The user-provided content to sanitize
            allow_html: If False, escape all HTML. If True, only remove dangerous content.
        
        Returns:
            Sanitized content safe for display
        """
        if not content:
            return content
        
        # Convert to string if needed
        content = str(content)
        
        # Remove null bytes
        content = content.replace('\x00', '')
        
        if allow_html:
            # Remove dangerous patterns but keep safe HTML
            for pattern in cls.DANGEROUS_PATTERNS:
                content = pattern.sub('', content)
        else:
            # Escape all HTML entities
            content = html.escape(content, quote=True)
        
        return content.strip()
    
    @classmethod
    def sanitize_dict(cls, data: Dict[str, Any], fields_to_sanitize: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Sanitize specific fields in a dictionary.
        
        Args:
            data: Dictionary containing user data
            fields_to_sanitize: List of field names to sanitize. If None, sanitize all string fields.
        
        Returns:
            Dictionary with sanitized values
        """
        if not data:
            return data
        
        sanitized = {}
        for key, value in data.items():
            if fields_to_sanitize is None or key in fields_to_sanitize:
                if isinstance(value, str):
                    sanitized[key] = cls.sanitize(value)
                elif isinstance(value, dict):
                    sanitized[key] = cls.sanitize_dict(value, fields_to_sanitize)
                elif isinstance(value, list):
                    sanitized[key] = [
                        cls.sanitize(item) if isinstance(item, str) else item
                        for item in value
                    ]
                else:
                    sanitized[key] = value
            else:
                sanitized[key] = value
        
        return sanitized


# ==================== FILE UPLOAD VALIDATION ====================

class FileValidator:
    """
    Validates uploaded files by checking MIME types, extensions, and content.
    Prevents malicious file uploads.
    """
    
    # MIME type to extension mapping for allowed file types
    ALLOWED_MIME_TYPES = {
        # Images
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/gif': ['gif'],
        'image/webp': ['webp'],
        'image/tiff': ['tiff', 'tif'],
        'image/bmp': ['bmp'],
        
        # Documents
        'application/pdf': ['pdf'],
        'application/msword': ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
        'application/vnd.ms-excel': ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
        'text/csv': ['csv'],
        'text/plain': ['txt'],
    }
    
    # Dangerous file signatures (magic bytes) to block
    DANGEROUS_SIGNATURES = [
        b'MZ',  # Windows executable
        b'\x7fELF',  # Linux executable
        b'#!/',  # Shell script
        b'<?php',  # PHP script
        b'<%',  # ASP/JSP
    ]
    
    # Maximum file size (default 50MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024
    
    @classmethod
    def validate_file(
        cls,
        file_content: bytes,
        filename: str,
        allowed_extensions: Optional[List[str]] = None,
        max_size: Optional[int] = None
    ) -> tuple[bool, str]:
        """
        Validate an uploaded file.
        
        Args:
            file_content: The file content as bytes
            filename: Original filename
            allowed_extensions: List of allowed extensions (e.g., ['pdf', 'jpg'])
            max_size: Maximum file size in bytes
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not file_content:
            return False, "Empty file"
        
        # Check file size
        max_size = max_size or cls.MAX_FILE_SIZE
        if len(file_content) > max_size:
            return False, f"File size exceeds maximum allowed ({max_size // (1024*1024)}MB)"
        
        # Get file extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        
        # Check extension against allowed list
        if allowed_extensions and ext not in [e.lower() for e in allowed_extensions]:
            return False, f"File extension '{ext}' not allowed. Allowed: {', '.join(allowed_extensions)}"
        
        # Detect MIME type from content (not from extension)
        try:
            detected_mime = magic.from_buffer(file_content, mime=True)
        except Exception as e:
            logger.warning(f"MIME detection failed: {e}")
            detected_mime = 'application/octet-stream'
        
        # Verify MIME type is allowed
        if detected_mime not in cls.ALLOWED_MIME_TYPES:
            return False, f"File type '{detected_mime}' not allowed"
        
        # Verify extension matches MIME type
        expected_extensions = cls.ALLOWED_MIME_TYPES.get(detected_mime, [])
        if ext and ext not in expected_extensions:
            return False, f"File extension '{ext}' doesn't match detected type '{detected_mime}'"
        
        # Check for dangerous file signatures
        for signature in cls.DANGEROUS_SIGNATURES:
            if file_content[:len(signature)] == signature:
                logger.warning(f"Blocked file with dangerous signature: {filename}")
                return False, "File contains potentially dangerous content"
        
        # Check for embedded scripts in images
        if detected_mime.startswith('image/'):
            content_str = file_content[:10000].decode('utf-8', errors='ignore').lower()
            if '<script' in content_str or 'javascript:' in content_str:
                return False, "Image contains embedded scripts"
        
        return True, "File is valid"
    
    @classmethod
    def get_safe_filename(cls, filename: str) -> str:
        """
        Sanitize filename to prevent path traversal and other attacks.
        
        Args:
            filename: Original filename
        
        Returns:
            Safe filename
        """
        # Remove path components
        filename = filename.replace('\\', '/').split('/')[-1]
        
        # Remove null bytes and control characters
        filename = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', filename)
        
        # Remove potentially dangerous characters
        filename = re.sub(r'[<>:"|?*]', '', filename)
        
        # Limit length
        if len(filename) > 255:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:250] + ('.' + ext if ext else '')
        
        return filename or 'unnamed_file'


# ==================== AUDIT LOGGING ====================

class AuditLogger:
    """
    Tamper-proof audit logging for security events.
    Logs authentication, data access, and sensitive operations.
    """
    
    # Event types
    AUTH_LOGIN = "AUTH_LOGIN"
    AUTH_LOGOUT = "AUTH_LOGOUT"
    AUTH_FAILED = "AUTH_FAILED"
    AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH"
    AUTH_PASSWORD_CHANGE = "AUTH_PASSWORD_CHANGE"
    AUTH_PASSWORD_RESET = "AUTH_PASSWORD_RESET"
    AUTH_MFA_ENABLED = "AUTH_MFA_ENABLED"
    AUTH_MFA_DISABLED = "AUTH_MFA_DISABLED"
    
    DATA_CREATE = "DATA_CREATE"
    DATA_READ = "DATA_READ"
    DATA_UPDATE = "DATA_UPDATE"
    DATA_DELETE = "DATA_DELETE"
    DATA_EXPORT = "DATA_EXPORT"
    DATA_BULK_ACCESS = "DATA_BULK_ACCESS"
    
    CLAIM_SUBMITTED = "CLAIM_SUBMITTED"
    CLAIM_APPROVED = "CLAIM_APPROVED"
    CLAIM_REJECTED = "CLAIM_REJECTED"
    CLAIM_RETURNED = "CLAIM_RETURNED"
    CLAIM_SETTLED = "CLAIM_SETTLED"
    CLAIM_EDITED = "CLAIM_EDITED"
    
    ADMIN_ACTION = "ADMIN_ACTION"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    PERMISSION_CHANGE = "PERMISSION_CHANGE"
    
    SECURITY_ALERT = "SECURITY_ALERT"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"
    
    def __init__(self):
        self.audit_logger = logging.getLogger('audit')
        # Configure audit logger with specific format
        if not self.audit_logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                '%(asctime)s - AUDIT - %(message)s'
            ))
            self.audit_logger.addHandler(handler)
            self.audit_logger.setLevel(logging.INFO)
    
    def _compute_hash(self, data: Dict[str, Any]) -> str:
        """Compute SHA-256 hash of audit entry for tamper detection."""
        content = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()
    
    def log(
        self,
        event_type: str,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """
        Log an audit event.
        
        Args:
            event_type: Type of event (use class constants)
            user_id: ID of user performing action
            user_email: Email of user
            tenant_id: Tenant ID for multi-tenant context
            resource_type: Type of resource being accessed (e.g., 'claim', 'employee')
            resource_id: ID of the resource
            action: Specific action taken
            details: Additional details about the event
            ip_address: Client IP address
            user_agent: Client user agent
            success: Whether the action was successful
            error_message: Error message if action failed
        """
        timestamp = datetime.utcnow().isoformat()
        
        audit_entry = {
            "timestamp": timestamp,
            "event_type": event_type,
            "user_id": str(user_id) if user_id else None,
            "user_email": user_email,
            "tenant_id": str(tenant_id) if tenant_id else None,
            "resource_type": resource_type,
            "resource_id": str(resource_id) if resource_id else None,
            "action": action,
            "details": details or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "success": success,
            "error_message": error_message,
        }
        
        # Add integrity hash for tamper detection
        audit_entry["integrity_hash"] = self._compute_hash(audit_entry)
        
        # Log the entry
        log_message = json.dumps(audit_entry, default=str)
        
        if event_type.startswith("AUTH_FAILED") or event_type == self.SECURITY_ALERT:
            self.audit_logger.warning(log_message)
        elif event_type == self.SUSPICIOUS_ACTIVITY:
            self.audit_logger.error(log_message)
        else:
            self.audit_logger.info(log_message)
        
        # Also store in database if needed (async operation)
        return audit_entry
    
    def log_auth_event(
        self,
        event_type: str,
        user_email: str,
        success: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ):
        """Log an authentication event."""
        return self.log(
            event_type=event_type,
            user_email=user_email,
            action="authentication",
            success=success,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
            error_message=error_message
        )
    
    def log_data_access(
        self,
        user_id: str,
        tenant_id: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        action: str = "read",
        record_count: int = 1,
        ip_address: Optional[str] = None
    ):
        """Log data access for compliance tracking."""
        event_type = {
            "create": self.DATA_CREATE,
            "read": self.DATA_READ,
            "update": self.DATA_UPDATE,
            "delete": self.DATA_DELETE,
            "export": self.DATA_EXPORT,
            "bulk": self.DATA_BULK_ACCESS,
        }.get(action, self.DATA_READ)
        
        return self.log(
            event_type=event_type,
            user_id=user_id,
            tenant_id=tenant_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            details={"record_count": record_count},
            ip_address=ip_address,
            success=True
        )
    
    def log_claim_action(
        self,
        user_id: str,
        tenant_id: str,
        claim_id: str,
        action: str,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ):
        """Log claim-related actions."""
        event_type = {
            "submit": self.CLAIM_SUBMITTED,
            "approve": self.CLAIM_APPROVED,
            "reject": self.CLAIM_REJECTED,
            "return": self.CLAIM_RETURNED,
            "settle": self.CLAIM_SETTLED,
            "edit": self.CLAIM_EDITED,
        }.get(action, self.DATA_UPDATE)
        
        return self.log(
            event_type=event_type,
            user_id=user_id,
            tenant_id=tenant_id,
            resource_type="claim",
            resource_id=claim_id,
            action=action,
            details=details,
            ip_address=ip_address,
            success=True
        )


# Singleton instances
xss_sanitizer = XSSSanitizer()
file_validator = FileValidator()
audit_logger = AuditLogger()


# ==================== UTILITY FUNCTIONS ====================

def sanitize_input(content: str) -> str:
    """Convenience function for XSS sanitization."""
    return xss_sanitizer.sanitize(content)


def sanitize_dict_input(data: Dict[str, Any], fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """Convenience function for sanitizing dictionary input."""
    return xss_sanitizer.sanitize_dict(data, fields)


def validate_upload(
    file_content: bytes,
    filename: str,
    allowed_extensions: Optional[List[str]] = None
) -> tuple[bool, str]:
    """Convenience function for file validation."""
    return file_validator.validate_file(file_content, filename, allowed_extensions)


def get_client_ip(request) -> str:
    """Extract client IP from request, handling proxies."""
    # Check X-Forwarded-For header (for reverse proxy setups)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP in the chain (original client)
        return forwarded.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to direct connection IP
    return request.client.host if request.client else "unknown"
