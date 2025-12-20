"""
IBU (Independent Business Unit) management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from uuid import UUID
import logging

from database import get_sync_db
from models import IBU, Project, User, Claim, Tenant
from schemas import IBUCreate, IBUUpdate, IBUResponse, IBUListResponse
from api.v1.auth import get_current_user, require_tenant_id

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=IBUListResponse)
async def list_ibus(
    tenant_id: UUID = Depends(require_tenant_id),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_sync_db)
):
    """
    List all IBUs for a tenant with optional filtering.
    Returns paginated results with project counts.
    """
    query = db.query(IBU).filter(IBU.tenant_id == tenant_id)
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (IBU.name.ilike(search_term)) |
            (IBU.code.ilike(search_term)) |
            (IBU.description.ilike(search_term))
        )
    
    if is_active is not None:
        query = query.filter(IBU.is_active == is_active)
    
    # Get total count
    total = query.count()
    
    # Paginate
    offset = (page - 1) * limit
    ibus = query.order_by(IBU.name).offset(offset).limit(limit).all()
    
    # Enrich with head names and project counts
    result_items = []
    for ibu in ibus:
        ibu_dict = {
            "id": ibu.id,
            "tenant_id": ibu.tenant_id,
            "code": ibu.code,
            "name": ibu.name,
            "description": ibu.description,
            "head_id": ibu.head_id,
            "annual_budget": float(ibu.annual_budget) if ibu.annual_budget else None,
            "budget_spent": float(ibu.budget_spent) if ibu.budget_spent else 0,
            "is_active": ibu.is_active,
            "created_at": ibu.created_at,
            "updated_at": ibu.updated_at,
            "head_name": None,
            "project_count": 0
        }
        
        # Get head name
        if ibu.head_id:
            head = db.query(User).filter(User.id == ibu.head_id).first()
            if head:
                ibu_dict["head_name"] = head.full_name
        
        # Get project count
        project_count = db.query(func.count(Project.id)).filter(
            Project.ibu_id == ibu.id
        ).scalar()
        ibu_dict["project_count"] = project_count or 0
        
        result_items.append(IBUResponse(**ibu_dict))
    
    return IBUListResponse(
        items=result_items,
        total=total,
        page=page,
        limit=limit
    )


@router.get("/{ibu_id}", response_model=IBUResponse)
async def get_ibu(
    ibu_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get a specific IBU by ID"""
    ibu = db.query(IBU).filter(
        IBU.id == ibu_id,
        IBU.tenant_id == tenant_id
    ).first()
    
    if not ibu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IBU not found"
        )
    
    # Get head name
    head_name = None
    if ibu.head_id:
        head = db.query(User).filter(User.id == ibu.head_id).first()
        if head:
            head_name = head.full_name
    
    # Get project count
    project_count = db.query(func.count(Project.id)).filter(
        Project.ibu_id == ibu.id
    ).scalar()
    
    return IBUResponse(
        id=ibu.id,
        tenant_id=ibu.tenant_id,
        code=ibu.code,
        name=ibu.name,
        description=ibu.description,
        head_id=ibu.head_id,
        annual_budget=float(ibu.annual_budget) if ibu.annual_budget else None,
        budget_spent=float(ibu.budget_spent) if ibu.budget_spent else 0,
        is_active=ibu.is_active,
        created_at=ibu.created_at,
        updated_at=ibu.updated_at,
        head_name=head_name,
        project_count=project_count or 0
    )


@router.post("/", response_model=IBUResponse, status_code=status.HTTP_201_CREATED)
async def create_ibu(
    ibu_data: IBUCreate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Create a new IBU"""
    # Validate tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tenant_id: Tenant not found. Please log out and log in again."
        )
    
    # Check for duplicate code within tenant
    existing = db.query(IBU).filter(
        IBU.tenant_id == tenant_id,
        IBU.code == ibu_data.code
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"IBU with code '{ibu_data.code}' already exists"
        )
    
    # Validate head_id if provided
    if ibu_data.head_id:
        head = db.query(User).filter(
            User.id == ibu_data.head_id,
            User.tenant_id == tenant_id
        ).first()
        if not head:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid head_id: User not found in this tenant"
            )
    
    # Create IBU
    ibu = IBU(
        tenant_id=tenant_id,
        code=ibu_data.code.upper(),
        name=ibu_data.name,
        description=ibu_data.description,
        head_id=ibu_data.head_id,
        annual_budget=ibu_data.annual_budget
    )
    
    db.add(ibu)
    db.commit()
    db.refresh(ibu)
    
    logger.info(f"Created IBU: {ibu.code} for tenant {tenant_id}")
    
    return IBUResponse(
        id=ibu.id,
        tenant_id=ibu.tenant_id,
        code=ibu.code,
        name=ibu.name,
        description=ibu.description,
        head_id=ibu.head_id,
        annual_budget=float(ibu.annual_budget) if ibu.annual_budget else None,
        budget_spent=0,
        is_active=ibu.is_active,
        created_at=ibu.created_at,
        updated_at=ibu.updated_at,
        head_name=None,
        project_count=0
    )


@router.put("/{ibu_id}", response_model=IBUResponse)
async def update_ibu(
    ibu_id: UUID,
    ibu_data: IBUUpdate,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Update an existing IBU"""
    ibu = db.query(IBU).filter(
        IBU.id == ibu_id,
        IBU.tenant_id == tenant_id
    ).first()
    
    if not ibu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IBU not found"
        )
    
    # Check for duplicate code if being changed
    if ibu_data.code and ibu_data.code.upper() != ibu.code:
        existing = db.query(IBU).filter(
            IBU.tenant_id == tenant_id,
            IBU.code == ibu_data.code.upper(),
            IBU.id != ibu_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"IBU with code '{ibu_data.code}' already exists"
            )
    
    # Validate head_id if being changed
    if ibu_data.head_id:
        head = db.query(User).filter(
            User.id == ibu_data.head_id,
            User.tenant_id == tenant_id
        ).first()
        if not head:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid head_id: User not found in this tenant"
            )
    
    # Update fields
    update_data = ibu_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "code" and value:
            value = value.upper()
        setattr(ibu, field, value)
    
    db.commit()
    db.refresh(ibu)
    
    # Get head name
    head_name = None
    if ibu.head_id:
        head = db.query(User).filter(User.id == ibu.head_id).first()
        if head:
            head_name = head.full_name
    
    # Get project count
    project_count = db.query(func.count(Project.id)).filter(
        Project.ibu_id == ibu.id
    ).scalar()
    
    logger.info(f"Updated IBU: {ibu.code}")
    
    return IBUResponse(
        id=ibu.id,
        tenant_id=ibu.tenant_id,
        code=ibu.code,
        name=ibu.name,
        description=ibu.description,
        head_id=ibu.head_id,
        annual_budget=float(ibu.annual_budget) if ibu.annual_budget else None,
        budget_spent=float(ibu.budget_spent) if ibu.budget_spent else 0,
        is_active=ibu.is_active,
        created_at=ibu.created_at,
        updated_at=ibu.updated_at,
        head_name=head_name,
        project_count=project_count or 0
    )


@router.delete("/{ibu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ibu(
    ibu_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """
    Delete an IBU. Will fail if there are projects associated with it.
    """
    ibu = db.query(IBU).filter(
        IBU.id == ibu_id,
        IBU.tenant_id == tenant_id
    ).first()
    
    if not ibu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IBU not found"
        )
    
    # Check for associated projects
    project_count = db.query(func.count(Project.id)).filter(
        Project.ibu_id == ibu_id
    ).scalar()
    
    if project_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete IBU: {project_count} project(s) are associated with it. Please reassign or remove projects first."
        )
    
    db.delete(ibu)
    db.commit()
    
    logger.info(f"Deleted IBU: {ibu.code}")
    return None


@router.get("/{ibu_id}/projects", response_model=List[dict])
async def get_ibu_projects(
    ibu_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """Get all projects associated with an IBU"""
    # Verify IBU exists
    ibu = db.query(IBU).filter(
        IBU.id == ibu_id,
        IBU.tenant_id == tenant_id
    ).first()
    
    if not ibu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IBU not found"
        )
    
    projects = db.query(Project).filter(Project.ibu_id == ibu_id).all()
    
    return [
        {
            "id": str(p.id),
            "project_code": p.project_code,
            "project_name": p.project_name,
            "status": p.status,
            "budget_allocated": float(p.budget_allocated) if p.budget_allocated else None,
            "budget_spent": float(p.budget_spent) if p.budget_spent else 0
        }
        for p in projects
    ]


@router.get("/{ibu_id}/summary", response_model=dict)
async def get_ibu_summary(
    ibu_id: UUID,
    tenant_id: UUID = Depends(require_tenant_id),
    db: Session = Depends(get_sync_db)
):
    """
    Get IBU summary with aggregated claim statistics.
    Used for IBU-level reporting.
    """
    # Verify IBU exists
    ibu = db.query(IBU).filter(
        IBU.id == ibu_id,
        IBU.tenant_id == tenant_id
    ).first()
    
    if not ibu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IBU not found"
        )
    
    # Get all projects for this IBU with their codes
    projects = db.query(Project).filter(Project.ibu_id == ibu_id).all()
    project_ids = [p.id for p in projects]
    project_codes = [p.project_code for p in projects]
    
    # Initialize summary
    summary = {
        "ibu_id": str(ibu_id),
        "ibu_code": ibu.code,
        "ibu_name": ibu.name,
        "project_count": len(project_ids),
        "total_budget": float(ibu.annual_budget) if ibu.annual_budget else 0,
        "total_spent": 0,
        "claims": {
            "total_count": 0,
            "total_amount": 0,
            "by_status": {},
            "by_category": {}
        }
    }
    
    if not project_codes:
        return summary
    
    # Get claims for projects in this IBU
    # Claims have project_code in claim_payload
    claims = db.query(Claim).filter(
        Claim.tenant_id == tenant_id
    ).all()
    
    for claim in claims:
        # Check if claim belongs to a project in this IBU by project_code
        claim_project_code = claim.claim_payload.get("project_code") if claim.claim_payload else None
        if claim_project_code and claim_project_code in project_codes:
            # Count this claim
            summary["claims"]["total_count"] += 1
            claim_amount = float(claim.amount) if claim.amount else 0
            summary["claims"]["total_amount"] += claim_amount
            
            # By status
            if claim.status not in summary["claims"]["by_status"]:
                summary["claims"]["by_status"][claim.status] = {"count": 0, "amount": 0}
            summary["claims"]["by_status"][claim.status]["count"] += 1
            summary["claims"]["by_status"][claim.status]["amount"] += claim_amount
            
            # By category
            if claim.category not in summary["claims"]["by_category"]:
                summary["claims"]["by_category"][claim.category] = {"count": 0, "amount": 0}
            summary["claims"]["by_category"][claim.category]["count"] += 1
            summary["claims"]["by_category"][claim.category]["amount"] += claim_amount
            
            # Add to total spent if settled
            if claim.status == "SETTLED":
                summary["total_spent"] += claim_amount
    
    return summary
