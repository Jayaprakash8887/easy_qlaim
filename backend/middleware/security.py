"""
Security Middleware Module
Provides security headers, request logging, and rate limiting middleware for FastAPI.
"""
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging
from typing import Callable, Optional
from collections import defaultdict
from datetime import datetime, timedelta

from services.security import audit_logger, get_client_ip

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    Protects against common web vulnerabilities.
    """
    
    def __init__(self, app, csp_policy: Optional[str] = None):
        super().__init__(app)
        # Default Content Security Policy
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
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Enable XSS filter (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # HTTP Strict Transport Security (HSTS)
        # Enforces HTTPS for 1 year, includes subdomains
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = self.csp_policy
        
        # Referrer Policy - Don't leak referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy (formerly Feature Policy)
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(), "
            "usb=()"
        )
        
        # Prevent caching of sensitive responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all requests for security monitoring.
    Tracks access patterns and helps detect suspicious activity.
    """
    
    def __init__(self, app, exclude_paths: Optional[list] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/health", "/metrics", "/favicon.ico"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip logging for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Start timing
        start_time = time.time()
        
        # Get client info
        client_ip = get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Log the request
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "query": str(request.query_params) if request.query_params else None,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": client_ip,
            "user_agent": user_agent[:200] if user_agent else None,  # Truncate long user agents
        }
        
        # Log level based on status code
        if response.status_code >= 500:
            logger.error(f"Request: {log_data}")
        elif response.status_code >= 400:
            logger.warning(f"Request: {log_data}")
        else:
            logger.info(f"Request: {log_data}")
        
        # Add timing header for debugging
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiting middleware.
    For production, use Redis-based rate limiting.
    """
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_limit: int = 100,
        exclude_paths: Optional[list] = None
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_limit = burst_limit
        self.exclude_paths = exclude_paths or ["/health", "/metrics"]
        self.request_counts = defaultdict(list)
        self._cleanup_interval = 60  # seconds
        self._last_cleanup = time.time()
    
    def _cleanup_old_requests(self):
        """Remove old request timestamps."""
        current_time = time.time()
        if current_time - self._last_cleanup > self._cleanup_interval:
            cutoff_time = current_time - 60  # 1 minute ago
            for ip in list(self.request_counts.keys()):
                self.request_counts[ip] = [
                    ts for ts in self.request_counts[ip]
                    if ts > cutoff_time
                ]
                if not self.request_counts[ip]:
                    del self.request_counts[ip]
            self._last_cleanup = current_time
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Cleanup old entries periodically
        self._cleanup_old_requests()
        
        # Get client IP
        client_ip = get_client_ip(request)
        current_time = time.time()
        
        # Get request history for this IP
        request_times = self.request_counts[client_ip]
        
        # Remove requests older than 1 minute
        cutoff_time = current_time - 60
        request_times = [ts for ts in request_times if ts > cutoff_time]
        
        # Check rate limit
        if len(request_times) >= self.requests_per_minute:
            # Log rate limit violation
            audit_logger.log(
                event_type="SECURITY_ALERT",
                action="rate_limit_exceeded",
                ip_address=client_ip,
                details={
                    "requests_in_minute": len(request_times),
                    "limit": self.requests_per_minute,
                    "path": request.url.path
                },
                success=False
            )
            
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please slow down.",
                    "retry_after": 60
                },
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(current_time + 60))
                }
            )
        
        # Check burst limit
        recent_requests = [ts for ts in request_times if ts > current_time - 1]  # Last second
        if len(recent_requests) >= self.burst_limit // 60:  # Burst limit per second
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please wait.",
                    "retry_after": 1
                },
                headers={"Retry-After": "1"}
            )
        
        # Record this request
        request_times.append(current_time)
        self.request_counts[client_ip] = request_times
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = max(0, self.requests_per_minute - len(request_times))
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(current_time + 60))
        
        return response


class SQLInjectionProtectionMiddleware(BaseHTTPMiddleware):
    """
    Additional layer of SQL injection protection.
    SQLAlchemy ORM already provides protection, this is defense-in-depth.
    """
    
    # Common SQL injection patterns
    SQL_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)",
        r"(--|#|/\*|\*/)",  # SQL comments
        r"(\bOR\b\s+[\'\"]?\d+[\'\"]?\s*=\s*[\'\"]?\d+[\'\"]?)",  # OR 1=1 patterns
        r"(\bAND\b\s+[\'\"]?\d+[\'\"]?\s*=\s*[\'\"]?\d+[\'\"]?)",  # AND 1=1 patterns
        r"([\'\"];?\s*(SELECT|INSERT|UPDATE|DELETE))",  # Chained queries
        r"(CHAR\s*\(\s*\d+\s*\))",  # CHAR() function abuse
        r"(CONCAT\s*\()",  # CONCAT function abuse
        r"(0x[0-9a-fA-F]+)",  # Hex encoded strings
    ]
    
    def __init__(self, app, log_only: bool = True):
        """
        Args:
            app: FastAPI application
            log_only: If True, only log suspicious requests. If False, block them.
        """
        super().__init__(app)
        self.log_only = log_only
        import re
        self.patterns = [re.compile(p, re.IGNORECASE) for p in self.SQL_PATTERNS]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check query parameters
        suspicious = False
        suspicious_param = None
        
        for param, value in request.query_params.items():
            if self._is_suspicious(value):
                suspicious = True
                suspicious_param = f"{param}={value}"
                break
        
        if suspicious:
            client_ip = get_client_ip(request)
            audit_logger.log(
                event_type="SUSPICIOUS_ACTIVITY",
                action="potential_sql_injection",
                ip_address=client_ip,
                details={
                    "path": request.url.path,
                    "suspicious_param": suspicious_param[:200],  # Truncate
                    "user_agent": request.headers.get("user-agent", "")[:200]
                },
                success=False
            )
            
            if not self.log_only:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid request parameters"}
                )
        
        return await call_next(request)
    
    def _is_suspicious(self, value: str) -> bool:
        """Check if a value contains suspicious SQL patterns."""
        if not value:
            return False
        
        for pattern in self.patterns:
            if pattern.search(value):
                return True
        
        return False
