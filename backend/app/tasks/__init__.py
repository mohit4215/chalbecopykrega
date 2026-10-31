# Celery Background Task Package
from app.tasks.celery_worker import celery_app, process_plagiarism_document

__all__ = ["celery_app", "process_plagiarism_document"]
