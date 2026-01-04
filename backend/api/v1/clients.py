"""
Client management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from typing import List, Optional
from uuid import UUID

from database import get_sync_db
from models import Client, Project
from schemas import ClientCreate, ClientUpdate, ClientResponse, ClientWithProjects
from api.v1.auth import require_tenant_id

router = APIRouter()


def _client_to_response(client: Client, project_count: int = 0) -> dict:
    """Convert Client model to response dict"""
    return {
        "id": client.id,
        "tenant_id": client.tenant_id,
        "client_code": client.client_code,
        "client_name": client.client_name,
        "description": client.description,
        "contact_person": client.contact_person,
        "contact_email": client.contact_email,
        "contact_phone": client.contact_phone,
        "address": client.address,
        "is_active": client.is_active,
        "created_at": client.created_at,
        "updated_at": client.updated_at,
        "project_count": project_count,
    }


@router.get("/", response_model=List[ClientResponse])
async def list_clients(
    tenant_id: UUID,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get list of clients for a tenant"""
    require_tenant_id(str(tenant_id))
    
    query = db.query(Client).filter(Client.tenant_id == tenant_id)
    
    # Filter by active status
    if is_active is not None:
        query = query.filter(Client.is_active == is_active)
    
    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Client.client_name.ilike(search_term)) |
            (Client.client_code.ilike(search_term)) |
            (Client.description.ilike(search_term)) |
            (Client.contact_person.ilike(search_term))
        )
    
    clients = query.order_by(Client.client_name).offset(skip).limit(limit).all()
    
    # Get project counts for each client
    client_ids = [c.id for c in clients]
    project_counts = dict(
        db.query(Project.client_id, func.count(Project.id))
        .filter(Project.client_id.in_(client_ids))
        .group_by(Project.client_id)
        .all()
    )
    
    return [_client_to_response(c, project_counts.get(c.id, 0)) for c in clients]


@router.get("/{client_id}", response_model=ClientWithProjects)
async def get_client(
    client_id: UUID,
    tenant_id: UUID,
    include_projects: bool = True,
    db: Session = Depends(get_sync_db)
):
    """Get client by ID with optional projects"""
    require_tenant_id(str(tenant_id))
    
    client = db.query(Client).filter(
        and_(Client.id == client_id, Client.tenant_id == tenant_id)
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Get projects if requested
    projects = []
    if include_projects:
        projects = db.query(Project).filter(Project.client_id == client_id).all()
    
    response = _client_to_response(client, len(projects))
    response["projects"] = [
        {
            "id": p.id,
            "project_code": p.project_code,
            "project_name": p.project_name,
            "description": p.description,
            "status": p.status,
            "budget_allocated": float(p.budget_allocated) if p.budget_allocated else None,
            "budget_spent": float(p.budget_spent) if p.budget_spent else 0,
            "budget_available": float(p.budget_available) if p.budget_available else None,
            "start_date": p.start_date,
            "end_date": p.end_date,
            "manager_id": p.manager_id,
            "ibu_id": p.ibu_id,
            "ibu_name": p.ibu.name if p.ibu else None,
            "ibu_code": p.ibu.code if p.ibu else None,
            "client_id": p.client_id,
            "client_name": client.client_name,
            "client_code": client.client_code,
            "created_at": p.created_at,
        }
        for p in projects
    ]
    
    return response


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Create a new client"""
    require_tenant_id(str(tenant_id))
    
    # Check for duplicate client_code within tenant
    existing = db.query(Client).filter(
        and_(
            Client.tenant_id == tenant_id,
            Client.client_code == client_data.client_code
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Client with code '{client_data.client_code}' already exists"
        )
    
    client = Client(
        tenant_id=tenant_id,
        client_code=client_data.client_code,
        client_name=client_data.client_name,
        description=client_data.description,
        contact_person=client_data.contact_person,
        contact_email=client_data.contact_email,
        contact_phone=client_data.contact_phone,
        address=client_data.address,
    )
    
    db.add(client)
    db.commit()
    db.refresh(client)
    
    return _client_to_response(client, 0)


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Update a client"""
    require_tenant_id(str(tenant_id))
    
    client = db.query(Client).filter(
        and_(Client.id == client_id, Client.tenant_id == tenant_id)
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Check for duplicate client_code if being updated
    if client_data.client_code and client_data.client_code != client.client_code:
        existing = db.query(Client).filter(
            and_(
                Client.tenant_id == tenant_id,
                Client.client_code == client_data.client_code,
                Client.id != client_id
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Client with code '{client_data.client_code}' already exists"
            )
    
    # Update fields
    update_data = client_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    
    db.commit()
    db.refresh(client)
    
    # Get project count
    project_count = db.query(func.count(Project.id)).filter(
        Project.client_id == client_id
    ).scalar()
    
    return _client_to_response(client, project_count)


@router.delete("/{client_id}")
async def delete_client(
    client_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Delete a client (soft delete by setting is_active=False)"""
    require_tenant_id(str(tenant_id))
    
    client = db.query(Client).filter(
        and_(Client.id == client_id, Client.tenant_id == tenant_id)
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Check if there are any projects linked to this client
    project_count = db.query(func.count(Project.id)).filter(
        Project.client_id == client_id
    ).scalar()
    
    if project_count > 0:
        # Soft delete - just deactivate
        client.is_active = False
        db.commit()
        return {"message": f"Client deactivated. {project_count} projects are still linked to this client."}
    else:
        # Hard delete if no projects linked
        db.delete(client)
        db.commit()
        return {"message": "Client deleted successfully"}


@router.post("/{client_id}/link-projects")
async def link_projects_to_client(
    client_id: UUID,
    project_ids: List[UUID],
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Link multiple projects to a client"""
    require_tenant_id(str(tenant_id))
    
    client = db.query(Client).filter(
        and_(Client.id == client_id, Client.tenant_id == tenant_id)
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Update projects
    updated_count = db.query(Project).filter(
        and_(
            Project.id.in_(project_ids),
            Project.tenant_id == tenant_id
        )
    ).update({"client_id": client_id}, synchronize_session=False)
    
    db.commit()
    
    return {
        "message": f"Successfully linked {updated_count} projects to client '{client.client_name}'",
        "linked_count": updated_count
    }


@router.post("/{client_id}/unlink-projects")
async def unlink_projects_from_client(
    client_id: UUID,
    project_ids: List[UUID],
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Unlink multiple projects from a client"""
    require_tenant_id(str(tenant_id))
    
    client = db.query(Client).filter(
        and_(Client.id == client_id, Client.tenant_id == tenant_id)
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Remove client_id from projects
    updated_count = db.query(Project).filter(
        and_(
            Project.id.in_(project_ids),
            Project.tenant_id == tenant_id,
            Project.client_id == client_id
        )
    ).update({"client_id": None}, synchronize_session=False)
    
    db.commit()
    
    return {
        "message": f"Successfully unlinked {updated_count} projects from client '{client.client_name}'",
        "unlinked_count": updated_count
    }


@router.get("/{client_id}/projects", response_model=List[dict])
async def get_client_projects(
    client_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get all projects linked to a client"""
    require_tenant_id(str(tenant_id))
    
    client = db.query(Client).filter(
        and_(Client.id == client_id, Client.tenant_id == tenant_id)
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    projects = db.query(Project).options(
        joinedload(Project.ibu)
    ).filter(
        Project.client_id == client_id
    ).all()
    
    return [
        {
            "id": p.id,
            "project_code": p.project_code,
            "project_name": p.project_name,
            "description": p.description,
            "status": p.status,
            "budget_allocated": float(p.budget_allocated) if p.budget_allocated else None,
            "start_date": p.start_date,
            "end_date": p.end_date,
            "ibu_name": p.ibu.name if p.ibu else None,
        }
        for p in projects
    ]
