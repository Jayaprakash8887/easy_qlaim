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
}


@celery_app.task(bind=True)
def debug_task(self):
    """Debug task to test Celery"""
    print(f"Request: {self.request!r}")
    return "Celery is working!"


if __name__ == "__main__":
    celery_app.start()
