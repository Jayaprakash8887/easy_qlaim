"""
Main FastAPI application
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from config import settings
from database import init_db_async

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


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
    logger.info("Starting Reimbursement Validation System API")
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
    
    # Shutdown
    logger.info("Shutting down API")


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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "status_code": 500}
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


# API v1 routes
from api.v1 import claims, employees, projects, approvals, documents, dashboard, comments, settings as settings_api, policies, custom_claims, cache

app.include_router(claims.router, prefix="/api/v1/claims", tags=["Claims"])
app.include_router(employees.router, prefix="/api/v1/employees", tags=["Employees"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projects"])
app.include_router(approvals.router, prefix="/api/v1/approvals", tags=["Approvals"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(comments.router, prefix="/api/v1/comments", tags=["Comments"])
app.include_router(settings_api.router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(policies.router, prefix="/api/v1/policies", tags=["Policies"])
app.include_router(custom_claims.router, prefix="/api/v1/custom-claims", tags=["Custom Claims"])
app.include_router(cache.router, prefix="/api/v1/cache", tags=["Cache Management"])


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Reimbursement Validation System API",
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
