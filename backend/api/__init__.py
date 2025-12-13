"""API v1 package - Import routers"""

from fastapi import APIRouter

# Import routers
router = APIRouter()

# Auth router
auth = APIRouter()

@auth.post("/login")
async def login():
    return {"message": "Auth not implemented yet"}

# Other routers with placeholder endpoints  
employees = APIRouter()
projects = APIRouter()
approvals = APIRouter()
documents = APIRouter()
dashboard = APIRouter()

@employees.get("/")
async def list_employees():
    return []

@projects.get("/")
async def list_projects():
    return []

@approvals.get("/queue")
async def approval_queue():
    return []

@documents.post("/upload")
async def upload_document():
    return {"message": "Upload not implemented"}

@dashboard.get("/stats")
async def get_stats():
    return {"total_claims": 0}
