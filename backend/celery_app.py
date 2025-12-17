"""
Celery configuration and task queue setup
"""
from celery import Celery
from config import settings
import logging

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "reimbursement_system",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "agents.orchestrator",
        "agents.document_agent",
        "agents.validation_agent",
        "agents.integration_agent",
        "agents.approval_agent",
        "agents.learning_agent",
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    result_expires=3600,  # Results expire after 1 hour
    broker_connection_retry_on_startup=True,
)

# Task routes
celery_app.conf.task_routes = {
    "agents.orchestrator.*": {"queue": "orchestrator"},
    "agents.document_agent.*": {"queue": "document"},
    "agents.validation_agent.*": {"queue": "validation"},
    "agents.integration_agent.*": {"queue": "integration"},
    "agents.approval_agent.*": {"queue": "approval"},
    "agents.learning_agent.*": {"queue": "learning"},
}

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "learning-agent-daily-analysis": {
        "task": "agents.learning_agent.daily_learning_analysis",
        "schedule": 86400.0,  # Run daily
    },
    "sync-external-data": {
        "task": "agents.integration_agent.sync_external_data",
        "schedule": 3600.0,  # Run hourly if enabled
    },
    "cleanup-old-local-files": {
        "task": "celery_app.cleanup_old_local_files",
        "schedule": 86400.0,  # Run daily
    },
}


@celery_app.task(bind=True)
def debug_task(self):
    """Debug task to test Celery"""
    logger.info(f"Debug task request: {self.request!r}")
    return "Celery is working!"


@celery_app.task(name="celery_app.cleanup_old_local_files")
def cleanup_old_local_files():
    """
    Periodic task to delete local files older than LOCAL_FILE_RETENTION_DAYS.
    Only deletes files that have been successfully uploaded to GCS.
    """
    import os
    import logging
    from pathlib import Path
    from datetime import datetime, timedelta
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    logger = logging.getLogger(__name__)
    
    try:
        retention_days = settings.LOCAL_FILE_RETENTION_DAYS
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        upload_dir = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
        
        if not upload_dir.exists():
            logger.info(f"Upload directory {upload_dir} does not exist, skipping cleanup")
            return {"deleted": 0, "errors": 0}
        
        # Create database session
        engine = create_engine(settings.DATABASE_URL)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        deleted_count = 0
        error_count = 0
        
        try:
            # Find documents with GCS storage that have local files older than retention period
            from models import Document
            
            old_docs = session.query(Document).filter(
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
                            logger.info(f"Deleted local file: {local_path} (GCS backup: {doc.gcs_uri})")
                            deleted_count += 1
                        except Exception as e:
                            logger.error(f"Failed to delete {local_path}: {e}")
                            error_count += 1
            
            # Also clean up orphaned temp files older than retention period
            for file_path in upload_dir.glob("temp_ocr_*"):
                try:
                    file_stat = file_path.stat()
                    file_age = datetime.utcnow() - datetime.fromtimestamp(file_stat.st_mtime)
                    if file_age.days > retention_days:
                        file_path.unlink()
                        logger.info(f"Deleted orphaned temp file: {file_path}")
                        deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete temp file {file_path}: {e}")
                    error_count += 1
                    
        finally:
            session.close()
        
        logger.info(f"Local file cleanup completed: {deleted_count} deleted, {error_count} errors")
        return {"deleted": deleted_count, "errors": error_count}
        
    except Exception as e:
        logger.error(f"Local file cleanup task failed: {e}")
        return {"deleted": 0, "errors": 1, "error": str(e)}


if __name__ == "__main__":
    celery_app.start()
