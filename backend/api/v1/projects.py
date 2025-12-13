"""
Project management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID, uuid4

from database import get_sync_db
from models import Project
from schemas import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter()


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get list of all projects"""
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get project by ID"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return project


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_sync_db)
):
    """Create a new project"""
    # Check if project_code already exists
    existing = db.query(Project).filter(
        Project.project_code == project_data.project_code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with code {project_data.project_code} already exists"
        )
    
    # Create project with a default tenant_id
    project = Project(
        id=uuid4(),
        tenant_id=uuid4(),  # TODO: Get from authenticated user
        project_code=project_data.project_code,
        project_name=project_data.project_name,
        description=project_data.description,
        budget_allocated=project_data.budget_allocated,
        start_date=project_data.start_date,
        end_date=project_data.end_date,
        status="ACTIVE"
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    db: Session = Depends(get_sync_db)
):
    """Update a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Update fields
    for field, value in project_data.dict(exclude_unset=True).items():
        setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
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
    
    return None
