"""
Main FastAPI application
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from contextlib import asynccontextmanager
import logging
from config import settings
from database import init_db_async

# Import security middleware
from middleware.security import (
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
    RateLimitMiddleware,
    SQLInjectionProtectionMiddleware,
    RequestIdMiddleware,
)

# Configure logging with request ID support
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure audit logger
audit_logger = logging.getLogger('audit')
audit_handler = logging.FileHandler('audit.log')
audit_handler.setFormatter(logging.Formatter('%(asctime)s - AUDIT - %(message)s'))
audit_logger.addHandler(audit_handler)
audit_logger.setLevel(logging.INFO)


async def run_startup_cleanup():
    """Run local file cleanup on startup (for files older than retention period)"""
    import asyncio
    from pathlib import Path
    from datetime import datetime, timedelta
    import os
    
    try:
        retention_days = settings.LOCAL_FILE_RETENTION_DAYS
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        upload_dir = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
        
        if not upload_dir.exists():
            logger.info(f"Upload directory {upload_dir} does not exist, skipping cleanup")
            return
        
        deleted_count = 0
        
        # Import here to avoid circular imports
        from database import SyncSessionLocal
        from models import Document
        
        db = SyncSessionLocal()
        try:
            # Find documents with GCS storage that have local files older than retention period
            old_docs = db.query(Document).filter(
                Document.storage_type == "gcs",
                Document.gcs_uri.isnot(None),
                Document.uploaded_at < cutoff_date
            ).all()
            
            for doc in old_docs:
                if doc.storage_path:
                    local_path = upload_dir / Path(doc.storage_path).name
                    if local_path.exists():
                        try:
                            local_path.unlink()
                            logger.info(f"Startup cleanup: Deleted local file {local_path} (GCS: {doc.gcs_uri})")
                            deleted_count += 1
                        except Exception as e:
                            logger.error(f"Failed to delete {local_path}: {e}")
            
            # Clean up orphaned temp files
            for file_path in upload_dir.glob("temp_ocr_*"):
                try:
                    file_stat = file_path.stat()
                    file_age = datetime.utcnow() - datetime.fromtimestamp(file_stat.st_mtime)
                    if file_age.days > retention_days:
                        file_path.unlink()
                        logger.info(f"Startup cleanup: Deleted orphaned temp file {file_path}")
                        deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete temp file {file_path}: {e}")
        finally:
            db.close()
        
        logger.info(f"Startup cleanup completed: {deleted_count} files deleted")
        
    except Exception as e:
        logger.error(f"Startup cleanup failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for FastAPI app"""
    # Startup
    logger.info("Starting Easy Qlaim API")
    try:
        await init_db_async()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
    
    # Run local file cleanup on startup
    try:
        await run_startup_cleanup()
    except Exception as e:
        logger.error(f"Startup cleanup error: {e}")
    
    yield
    
    # Shutdown - Graceful resource cleanup
    logger.info("Shutting down API - cleaning up resources")
    
    # Close database connections
    try:
        from database import async_engine, sync_engine
        await async_engine.dispose()
        sync_engine.dispose()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database connections: {e}")
    
    # Close Redis connections
    try:
        from services.redis_cache import redis_cache
        if redis_cache._async_client:
            await redis_cache._async_client.close()
            logger.info("Redis connections closed")
    except Exception as e:
        logger.error(f"Error closing Redis connections: {e}")
    
    logger.info("Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Agentic AI Reimbursement & Allowance Processing System",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Proxy headers middleware - trust X-Forwarded-Proto from nginx
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security middleware stack (order matters - first added is last executed)
# 1. SQL Injection Protection (defense-in-depth, log-only mode)
app.add_middleware(SQLInjectionProtectionMiddleware, log_only=True)

# 2. Rate Limiting (endpoint-specific limits, default 60 per minute per IP)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=60,
    burst_limit=100,
    exclude_paths=["/health", "/metrics", "/api/docs", "/api/redoc", "/api/openapi.json"]
)

# 3. Request Logging (for security monitoring with request ID)
app.add_middleware(
    RequestLoggingMiddleware,
    exclude_paths=["/health", "/metrics", "/favicon.ico"]
)

# 4. Security Headers (HSTS, CSP, XSS Protection, etc.)
app.add_middleware(SecurityHeadersMiddleware)

# 5. Request ID Middleware (adds X-Request-ID for correlation across services)
app.add_middleware(RequestIdMiddleware)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    # Include request ID in error responses for debugging
    request_id = getattr(request.state, 'request_id', 'unknown')
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id
        },
        headers={"X-Request-ID": request_id}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    # Include request ID in error logs for debugging
    request_id = getattr(request.state, 'request_id', 'unknown')
    logger.error(f"Unhandled exception [request_id={request_id}]: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "status_code": 500,
            "request_id": request_id
        },
        headers={"X-Request-ID": request_id}
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV
    }


# System info endpoint for admin dashboard
@app.get("/api/v1/system/info")
async def system_info():
    """Get system information including database and cache status"""
    import re
    from urllib.parse import urlparse
    from sqlalchemy import text
    
    # Parse database URL
    db_url = settings.DATABASE_URL
    db_info = {
        "type": "Unknown",
        "host": "Unknown",
        "port": "Unknown",
        "name": "Unknown",
        "connected": False
    }
    
    try:
        # Handle different database URL formats
        if db_url.startswith("postgresql"):
            db_info["type"] = "PostgreSQL"
            # Parse URL: postgresql://user:pass@host:port/dbname
            parsed = urlparse(db_url)
            db_info["host"] = parsed.hostname or "localhost"
            db_info["port"] = str(parsed.port or 5432)
            db_info["name"] = parsed.path.lstrip("/") if parsed.path else "Unknown"
        
        # Check database connection
        from database import SyncSessionLocal
        db = SyncSessionLocal()
        try:
            db.execute(text("SELECT 1"))
            db_info["connected"] = True
            # Try to get PostgreSQL version
            result = db.execute(text("SELECT version()")).fetchone()
            if result:
                version_str = result[0]
                # Extract version number (e.g., "PostgreSQL 15.2" from full string)
                match = re.search(r'PostgreSQL (\d+(?:\.\d+)?)', version_str)
                if match:
                    db_info["type"] = f"PostgreSQL {match.group(1)}"
        except Exception:
            db_info["connected"] = False
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to get database info: {e}")
    
    # Parse Redis URL
    redis_url = settings.REDIS_URL
    redis_info = {
        "host": "Unknown",
        "port": "Unknown",
        "connected": False
    }
    
    try:
        parsed = urlparse(redis_url)
        redis_info["host"] = parsed.hostname or "localhost"
        redis_info["port"] = str(parsed.port or 6379)
        
        # Check Redis connection
        from services.redis_cache import redis_cache
        health = await redis_cache.health_check()
        redis_info["connected"] = health.get("status") == "healthy"
        redis_info["memory_used"] = health.get("memory", {}).get("used", "Unknown")
    except Exception as e:
        logger.error(f"Failed to get Redis info: {e}")
    
    return {
        "database": db_info,
        "cache": redis_info,
        "app": {
            "name": settings.APP_NAME,
            "environment": settings.APP_ENV,
            "version": "1.0.0"
        }
    }


# API v1 routes
from api.v1 import claims, employees, projects, approvals, documents, dashboard, comments, settings as settings_api, policies, custom_claims, cache, tenants, designations, auth, notifications, branding, regions, ibus, integrations, departments, approval_skip_rules

app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(claims.router, prefix="/api/v1/claims", tags=["Claims"])
app.include_router(employees.router, prefix="/api/v1/employees", tags=["Employees"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projects"])
app.include_router(ibus.router, prefix="/api/v1/ibus", tags=["IBUs (Business Units)"])
app.include_router(departments.router, prefix="/api/v1/departments", tags=["Departments"])
app.include_router(approvals.router, prefix="/api/v1/approvals", tags=["Approvals"])
app.include_router(approval_skip_rules.router, prefix="/api/v1/approval-skip-rules", tags=["Approval Skip Rules"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(comments.router, prefix="/api/v1/comments", tags=["Comments"])
app.include_router(settings_api.router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(policies.router, prefix="/api/v1/policies", tags=["Policies"])
app.include_router(regions.router, prefix="/api/v1/regions", tags=["Regions"])
app.include_router(custom_claims.router, prefix="/api/v1/custom-claims", tags=["Custom Claims"])
app.include_router(custom_claims.router, prefix="/api/v1/custom-claims", tags=["Custom Claims"])
app.include_router(cache.router, prefix="/api/v1/cache", tags=["Cache Management"])
# Multi-tenant SaaS routes
app.include_router(tenants.router, prefix="/api/v1/tenants", tags=["Tenants (System Admin)"])
app.include_router(designations.router, prefix="/api/v1/designations", tags=["Designations"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(branding.router, prefix="/api/v1/branding", tags=["Tenant Branding (System Admin)"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations (System Admin)"])


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Easy Qlaim API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
