"""
Project management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from database import get_sync_db
from models import Project, EmployeeProjectAllocation, User, IBU, Claim

# Employee is now an alias for User (tables merged)
Employee = User
from schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from api.v1.auth import get_current_user, require_tenant_id

router = APIRouter()


def _calculate_project_spent(project: Project, db: Session) -> float:
    """Calculate budget spent based on settled claims for this project"""
    # Get all settled claims that belong to this project
    # Claims store project_code in claim_payload['project_code']
    settled_claims = db.query(Claim).filter(
        Claim.tenant_id == project.tenant_id,
        Claim.status == "SETTLED"
    ).all()
    
    total_spent = 0.0
    for claim in settled_claims:
        if claim.claim_payload:
            claim_project_code = claim.claim_payload.get("project_code")
            if claim_project_code == project.project_code:
                total_spent += float(claim.amount) if claim.amount else 0.0
    
    return total_spent


def _project_to_response(project: Project, db: Session = None) -> dict:
    """Convert Project model to response dict with IBU details"""
    # Calculate budget_spent dynamically if db session is provided
    budget_spent = _calculate_project_spent(project, db) if db else (float(project.budget_spent) if project.budget_spent else 0)
    
    response = {
        "id": project.id,
        "project_code": project.project_code,
        "project_name": project.project_name,
        "description": project.description,
        "budget_allocated": float(project.budget_allocated) if project.budget_allocated else None,
        "budget_spent": budget_spent,
        "budget_available": float(project.budget_available) if project.budget_available else None,
        "status": project.status,
        "start_date": project.start_date,
        "end_date": project.end_date,
        "manager_id": project.manager_id,
        "ibu_id": project.ibu_id,
        "ibu_name": project.ibu.name if project.ibu else None,
        "ibu_code": project.ibu.code if project.ibu else None,
        "created_at": project.created_at,
    }
    return response


async def _invalidate_project_cache(project_code: str = None, project_id: UUID = None):
    """Background task to invalidate project cache"""
    try:
        from services.redis_cache import redis_cache
        if project_code:
            await redis_cache.delete_async(f"project:code:{project_code}")
        if project_id:
            await redis_cache.delete_async(f"project:id:{str(project_id)}")
        # Invalidate all-projects cache and name map
        await redis_cache.delete_async("project:all:active")
        await redis_cache.delete_async("project:name_map")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to invalidate project cache: {e}")


@router.get("/members/all", response_model=Dict[str, List[str]])
async def get_all_project_members(
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get all members for all projects of a tenant"""
    # Filter allocations by projects belonging to this tenant
    query = db.query(EmployeeProjectAllocation).join(
        Project, EmployeeProjectAllocation.project_id == Project.id
    ).filter(
        Project.tenant_id == tenant_id,
        EmployeeProjectAllocation.status == "ACTIVE"
    )
    
    allocations = query.all()
    
    # Group by project_id
    project_members = {}
    for allocation in allocations:
        pid = str(allocation.project_id)
        if pid not in project_members:
            project_members[pid] = []
        project_members[pid].append(str(allocation.employee_id))
    
    return project_members


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    tenant_id: UUID,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get list of projects, optionally filtered by tenant and search query"""
    query = db.query(Project).options(joinedload(Project.ibu))
    
    # Filter by tenant if provided
    if tenant_id:
        query = query.filter(Project.tenant_id == tenant_id)
    
    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Project.project_name.ilike(search_term)) |
            (Project.project_code.ilike(search_term)) |
            (Project.description.ilike(search_term))
        )
    
    projects = query.offset(skip).limit(limit).all()
    return [_project_to_response(p, db) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get project by ID"""
    query = db.query(Project).options(joinedload(Project.ibu)).filter(Project.id == project_id)
    if tenant_id:
        query = query.filter(Project.tenant_id == tenant_id)
    project = query.first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return _project_to_response(project, db)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_sync_db)
):
    """Create a new project"""
    # Check if project_code already exists within the same tenant
    existing = db.query(Project).filter(
        Project.tenant_id == current_user.tenant_id,
        Project.project_code == project_data.project_code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with code {project_data.project_code} already exists in this tenant"
        )
    
    # Create project with user's tenant_id
    project = Project(
        id=uuid4(),
        tenant_id=current_user.tenant_id,
        project_code=project_data.project_code,
        project_name=project_data.project_name,
        description=project_data.description,
        budget_allocated=project_data.budget_allocated,
        start_date=project_data.start_date,
        end_date=project_data.end_date,
        ibu_id=project_data.ibu_id,
        status="ACTIVE"
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Reload with IBU relationship
    project = db.query(Project).options(joinedload(Project.ibu)).filter(Project.id == project.id).first()
    
    # Invalidate cache in background
    background_tasks.add_task(_invalidate_project_cache, project.project_code, project.id)
    
    return _project_to_response(project, db)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_sync_db)
):
    """Update a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    old_project_code = project.project_code
    
    # Check if project code is being changed and if new code already exists in this tenant
    if project_data.project_code and project_data.project_code != old_project_code:
        existing_project = db.query(Project).filter(
            Project.tenant_id == project.tenant_id,
            Project.project_code == project_data.project_code,
            Project.id != project_id
        ).first()
        if existing_project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project with code {project_data.project_code} already exists in this tenant"
            )
    
    # Update fields
    for field, value in project_data.dict(exclude_unset=True).items():
        setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    
    # Reload with IBU relationship
    project = db.query(Project).options(joinedload(Project.ibu)).filter(Project.id == project.id).first()
    
    # Invalidate cache (both old and new code if changed)
    background_tasks.add_task(_invalidate_project_cache, old_project_code, project_id)
    if project.project_code != old_project_code:
        background_tasks.add_task(_invalidate_project_cache, project.project_code)
    
    return _project_to_response(project, db)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_sync_db)
):
    """Delete a project (soft delete by setting status to CLOSED)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    project.status = "CLOSED"
    db.commit()
    
    # Invalidate cache
    background_tasks.add_task(_invalidate_project_cache, project.project_code, project_id)
    
    return None


@router.get("/{project_id}/members")
async def get_project_members(
    project_id: UUID,
    include_inactive: bool = False,
    db: Session = Depends(get_sync_db)
):
    """Get all members allocated to a project"""
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Query allocations with employee details
    query = db.query(
        EmployeeProjectAllocation,
        Employee
    ).join(
        Employee, EmployeeProjectAllocation.employee_id == Employee.id
    ).filter(
        EmployeeProjectAllocation.project_id == project_id
    )
    
    if not include_inactive:
        query = query.filter(EmployeeProjectAllocation.status == "ACTIVE")
    
    results = query.all()
    
    return [
        {
            "allocation_id": allocation.id,
            "employee_id": str(employee.id),
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "role": allocation.role,
            "allocation_percentage": allocation.allocation_percentage,
            "status": allocation.status,
            "allocated_date": allocation.allocated_date.isoformat() if allocation.allocated_date else None,
        }
        for allocation, employee in results
    ]
