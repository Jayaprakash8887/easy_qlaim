"""
Auth, Employees, Projects, Approvals, Documents, and Dashboard API endpoints
"""
# This file creates stub routers that will be imported by main.py
from fastapi import APIRouter

# Create routers
auth_router = APIRouter()
employees_router = APIRouter()
projects_router = APIRouter()
approvals_router = APIRouter()
documents_router = APIRouter()
dashboard_router = APIRouter()


@auth_router.post("/login")
async def login():
    """Login endpoint - TODO: Implement JWT authentication"""
    return {"message": "Auth not yet implemented"}


@employees_router.get("/")
async def list_employees():
    """List employees - TODO: Implement"""
    return []


@projects_router.get("/")
async def list_projects():
    """List projects - TODO: Implement"""
    return []


@approvals_router.get("/queue")
async def approval_queue():
    """Get approval queue - TODO: Implement"""
    return []


@documents_router.post("/upload")
async def upload_document():
    """Upload document - TODO: Implement"""
    return {"message": "Upload not yet implemented"}


@dashboard_router.get("/stats")
async def get_dashboard_stats():
    """Get dashboard statistics - TODO: Implement"""
    return {"total_claims": 0}
