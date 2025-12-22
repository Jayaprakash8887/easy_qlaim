"""
Department management endpoints
Tenant-specific department CRUD operations
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from typing import List, Optional
from uuid import UUID

from database import get_sync_db
from models import Department, User
from schemas import DepartmentCreate, DepartmentUpdate, DepartmentResponse

router = APIRouter()


def _department_to_response(dept: Department, db: Session, include_counts: bool = False) -> dict:
    """Convert Department model to response format"""
    response = {
        "id": dept.id,
        "tenant_id": dept.tenant_id,
        "code": dept.code,
        "name": dept.name,
        "description": dept.description,
        "head_id": dept.head_id,
        "is_active": dept.is_active,
        "display_order": dept.display_order,
        "created_at": dept.created_at,
        "updated_at": dept.updated_at,
        "head_name": None,
        "employee_count": None,
    }
    
    # Get head name if head_id exists
    if dept.head_id:
        head = db.query(User).filter(User.id == dept.head_id).first()
        if head:
            response["head_name"] = head.display_name
    
    # Get employee count if requested
    if include_counts:
        count = db.query(sql_func.count(User.id)).filter(
            User.tenant_id == dept.tenant_id,
            User.department == dept.name
        ).scalar()
        response["employee_count"] = count or 0
    
    return response


@router.get("/", response_model=List[DepartmentResponse])
async def list_departments(
    tenant_id: UUID,
    include_inactive: bool = False,
    include_counts: bool = False,
    db: Session = Depends(get_sync_db)
):
    """Get list of departments for a tenant"""
    query = db.query(Department).filter(Department.tenant_id == tenant_id)
    
    if not include_inactive:
        query = query.filter(Department.is_active == True)
    
    departments = query.order_by(Department.display_order, Department.name).all()
    
    return [_department_to_response(d, db, include_counts) for d in departments]


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get department by ID"""
    query = db.query(Department).filter(Department.id == department_id)
    if tenant_id:
        query = query.filter(Department.tenant_id == tenant_id)
    
    dept = query.first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    return _department_to_response(dept, db, include_counts=True)


@router.post("/", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    department_data: DepartmentCreate,
    tenant_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Create a new department"""
    # Check if code already exists for this tenant
    existing = db.query(Department).filter(
        Department.tenant_id == tenant_id,
        Department.code == department_data.code
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with code '{department_data.code}' already exists"
        )
    
    dept = Department(
        tenant_id=tenant_id,
        code=department_data.code,
        name=department_data.name,
        description=department_data.description,
        head_id=department_data.head_id,
        display_order=department_data.display_order,
        is_active=True,
    )
    
    db.add(dept)
    db.commit()
    db.refresh(dept)
    
    return _department_to_response(dept, db)


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: UUID,
    department_data: DepartmentUpdate,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Update a department"""
    query = db.query(Department).filter(Department.id == department_id)
    if tenant_id:
        query = query.filter(Department.tenant_id == tenant_id)
    
    dept = query.first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    # Check for duplicate code if code is being changed
    if department_data.code and department_data.code != dept.code:
        existing = db.query(Department).filter(
            Department.tenant_id == dept.tenant_id,
            Department.code == department_data.code,
            Department.id != department_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with code '{department_data.code}' already exists"
            )
    
    # Update fields
    if department_data.code is not None:
        dept.code = department_data.code
    if department_data.name is not None:
        dept.name = department_data.name
    if department_data.description is not None:
        dept.description = department_data.description
    if department_data.head_id is not None:
        dept.head_id = department_data.head_id
    if department_data.display_order is not None:
        dept.display_order = department_data.display_order
    if department_data.is_active is not None:
        dept.is_active = department_data.is_active
    
    db.commit()
    db.refresh(dept)
    
    return _department_to_response(dept, db, include_counts=True)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Soft delete a department (set is_active=False)"""
    query = db.query(Department).filter(Department.id == department_id)
    if tenant_id:
        query = query.filter(Department.tenant_id == tenant_id)
    
    dept = query.first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    # Check if department has employees
    employee_count = db.query(sql_func.count(User.id)).filter(
        User.tenant_id == dept.tenant_id,
        User.department == dept.name
    ).scalar()
    
    if employee_count and employee_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department with {employee_count} employees. Reassign employees first or deactivate the department."
        )
    
    dept.is_active = False
    db.commit()
    
    return None
