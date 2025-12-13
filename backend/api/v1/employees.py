"""
Employee management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from uuid import UUID, uuid4

from database import get_sync_db
from models import Employee
from schemas import EmployeeCreate, EmployeeResponse

router = APIRouter()


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db)
):
    """Get list of all employees"""
    employees = db.query(Employee).offset(skip).limit(limit).all()
    return employees


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Get employee by ID"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    return employee


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: Session = Depends(get_sync_db)
):
    """Create a new employee"""
    # Check if employee_id already exists
    existing = db.query(Employee).filter(
        Employee.employee_id == employee_data.employee_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with ID {employee_data.employee_id} already exists"
        )
    
    # Check if email already exists
    existing_email = db.query(Employee).filter(
        Employee.email == employee_data.email
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with email {employee_data.email} already exists"
        )
    
    # Create employee with a default tenant_id for now
    # In production, this should come from authenticated user's tenant
    employee = Employee(
        id=uuid4(),
        tenant_id=uuid4(),  # TODO: Get from authenticated user
        employee_id=employee_data.employee_id,
        first_name=employee_data.first_name,
        last_name=employee_data.last_name,
        email=employee_data.email,
        phone=employee_data.phone,
        department=employee_data.department,
        designation=employee_data.designation,
        date_of_joining=employee_data.date_of_joining,
        employee_data=employee_data.employee_data,
        employment_status="ACTIVE"
    )
    
    db.add(employee)
    db.commit()
    db.refresh(employee)
    
    return employee


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: UUID,
    employee_data: EmployeeCreate,
    db: Session = Depends(get_sync_db)
):
    """Update an employee"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Update fields
    for field, value in employee_data.dict(exclude_unset=True).items():
        setattr(employee, field, value)
    
    db.commit()
    db.refresh(employee)
    
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """Delete an employee (soft delete by setting status to INACTIVE)"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    employee.employment_status = "INACTIVE"
    db.commit()
    
    return None
