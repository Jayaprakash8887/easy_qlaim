"""
Employee management endpoints
Note: Employee is now an alias for User model (unified model)
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select, case
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import date
import hashlib
import secrets
import string
import logging

from database import get_sync_db
from models import User, EmployeeProjectAllocation, Project, Tenant
from services.role_service import get_user_roles
from services.email_service import get_email_service
from services.keycloak_service import get_keycloak_service
from config import get_settings
# Employee is now an alias for User in models.py
Employee = User
from schemas import (
    EmployeeCreate, EmployeeResponse, 
    EmployeeProjectAllocationCreate, EmployeeProjectAllocationUpdate,
    EmployeeProjectAllocationResponse, EmployeeProjectHistoryResponse,
    BulkEmployeeImport, BulkEmployeeImportResult, BulkEmployeeImportResponse
)

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    # Ensure at least one of each type
    password = (
        secrets.choice(string.ascii_uppercase) +
        secrets.choice(string.ascii_lowercase) +
        secrets.choice(string.digits) +
        secrets.choice("!@#$%&*") +
        password[4:]
    )
    return password


async def _invalidate_employee_cache(employee_id: UUID = None, employee_code: str = None, email: str = None):
    """Background task to invalidate employee cache"""
    try:
        from services.redis_cache import redis_cache
        if employee_id:
            await redis_cache.delete_async(f"employee:id:{str(employee_id)}")
            await redis_cache.delete_async(f"employee:with_projects:{str(employee_id)}")
        if employee_code:
            await redis_cache.delete_async(f"employee:code:{employee_code}")
        if email:
            await redis_cache.delete_async(f"employee:email:{email.lower()}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to invalidate employee cache: {e}")


def _user_to_employee_response(user: User, db: Session) -> dict:
    """
    Convert User model to EmployeeResponse format.
    Roles are dynamically resolved from designation-to-role mappings.
    """
    # Get roles dynamically from designation mappings
    roles = get_user_roles(user, db)
    
    return {
        "id": user.id,
        "tenant_id": user.tenant_id,
        "employee_id": user.employee_code,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.full_name or f"{user.first_name} {user.last_name}",
        "email": user.email,
        "phone": user.phone,
        "mobile": user.mobile,
        "address": user.address,
        "department": user.department,
        "designation": user.designation,
        "manager_id": user.manager_id,
        "date_of_joining": user.date_of_joining,
        "employment_status": user.employment_status or "ACTIVE",
        "region": user.region,
        "roles": roles,
        "avatar_url": user.avatar_url,
        "employee_data": user.user_data or {},
        "created_at": user.created_at,
    }


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(
    skip: int = 0,
    limit: int = 100,
    tenant_id: Optional[UUID] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_sync_db)
):
    """Get list of employees (users), optionally filtered by tenant and search query"""
    query = db.query(User)
    
    # Filter by tenant if provided
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term)) |
            (User.full_name.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (User.employee_code.ilike(search_term)) |
            (User.department.ilike(search_term)) |
            (User.designation.ilike(search_term))
        )
    
    users = query.offset(skip).limit(limit).all()
    return [_user_to_employee_response(u, db) for u in users]


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: UUID,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Get employee by ID"""
    query = db.query(User).filter(User.id == employee_id)
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    user = query.first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    return _user_to_employee_response(user, db)


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_sync_db)
):
    """Create a new employee (creates a User with employee data)"""
    # tenant_id is required - must be provided in the request
    if not employee_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tenant_id is required when creating an employee"
        )
    employee_tenant_id = employee_data.tenant_id
    
    # Check if employee_code already exists within the same tenant
    existing = db.query(User).filter(
        User.tenant_id == employee_tenant_id,
        User.employee_code == employee_data.employee_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with ID {employee_data.employee_id} already exists in this tenant"
        )
    
    # Check if email already exists (email is globally unique)
    existing_email = db.query(User).filter(
        User.email == employee_data.email
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with email {employee_data.email} already exists"
        )
    
    # Store project_ids in user_data JSONB field
    user_data = dict(employee_data.employee_data) if employee_data.employee_data else {}
    user_data['project_ids'] = employee_data.project_ids if employee_data.project_ids else []
    
    # Generate username from email
    username = employee_data.email.split('@')[0]
    
    # Generate a secure temporary password
    temp_password = generate_temporary_password()
    hashed_password = hashlib.sha256(temp_password.encode()).hexdigest()
    
    # Get tenant info for email branding
    tenant = db.query(Tenant).filter(Tenant.id == employee_tenant_id).first()
    tenant_name = tenant.name if tenant else "Easy Qlaim"
    
    user = User(
        id=uuid4(),
        tenant_id=employee_tenant_id,
        username=username,
        email=employee_data.email,
        hashed_password=hashed_password,
        employee_code=employee_data.employee_id,
        first_name=employee_data.first_name,
        last_name=employee_data.last_name,
        full_name=f"{employee_data.first_name} {employee_data.last_name}",
        phone=employee_data.phone,
        mobile=employee_data.mobile,
        address=employee_data.address,
        department=employee_data.department,
        designation=employee_data.designation,
        region=employee_data.region,  # Region/location for policy applicability
        manager_id=UUID(employee_data.manager_id) if employee_data.manager_id else None,
        date_of_joining=employee_data.date_of_joining,
        user_data=user_data,
        employment_status="ACTIVE",
        roles=["EMPLOYEE"],
        is_active=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create Keycloak user if KEYCLOAK_ENABLED
    keycloak_user_created = False
    if settings.KEYCLOAK_ENABLED:
        try:
            keycloak = get_keycloak_service()
            keycloak_user_id = await keycloak.create_user(
                email=employee_data.email,
                password=temp_password,
                first_name=employee_data.first_name,
                last_name=employee_data.last_name,
                enabled=True,
                email_verified=False,
                attributes={
                    "tenant_id": [str(employee_tenant_id)],
                    "employee_id": [str(user.id)],
                    "employee_code": [employee_data.employee_id]
                }
            )
            if keycloak_user_id:
                keycloak_user_created = True
                logger.info(f"Keycloak user created for employee {employee_data.email} with ID {keycloak_user_id}")
            else:
                logger.warning(f"Keycloak user creation returned no ID for employee {employee_data.email}")
        except Exception as e:
            logger.error(f"Failed to create Keycloak user for employee {employee_data.email}: {str(e)}")
            # Continue even if Keycloak fails - user can still be created locally
    
    # Send welcome email with credentials
    try:
        email_service = get_email_service()
        login_url = settings.FRONTEND_URL or "http://localhost:5173"
        
        background_tasks.add_task(
            email_service.send_employee_welcome_email,
            to_email=employee_data.email,
            employee_name=f"{employee_data.first_name} {employee_data.last_name}",
            tenant_name=tenant_name,
            temporary_password=temp_password,
            login_url=login_url
        )
        logger.info(f"Welcome email queued for employee {employee_data.email}")
    except Exception as e:
        logger.error(f"Failed to queue welcome email for employee {employee_data.email}: {str(e)}")
        # Don't fail the request if email fails
    
    return _user_to_employee_response(user, db)


@router.post("/bulk", status_code=status.HTTP_200_OK)
async def bulk_import_employees(
    import_data: BulkEmployeeImport,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_sync_db)
):
    """
    Bulk import employees from CSV/list.
    Creates multiple employees in a single transaction.
    Returns detailed results for each employee.
    Also creates Keycloak users and sends welcome emails.
    """
    
    if not import_data.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tenant_id is required"
        )
    
    # Get tenant info for email branding
    tenant = db.query(Tenant).filter(Tenant.id == import_data.tenant_id).first()
    tenant_name = tenant.name if tenant else "Easy Qlaim"
    
    results = []
    success_count = 0
    failed_count = 0
    created_users = []  # Track created users for Keycloak/email processing
    
    for emp_data in import_data.employees:
        try:
            # Check if employee_code already exists within the same tenant
            existing = db.query(User).filter(
                User.tenant_id == import_data.tenant_id,
                User.employee_code == emp_data.employee_id
            ).first()
            if existing:
                results.append(BulkEmployeeImportResult(
                    employee_id=emp_data.employee_id,
                    email=emp_data.email,
                    success=False,
                    error=f"Employee ID {emp_data.employee_id} already exists in this tenant"
                ))
                failed_count += 1
                continue
            
            # Check if email already exists (email is globally unique)
            existing_email = db.query(User).filter(
                User.email == emp_data.email
            ).first()
            if existing_email:
                results.append(BulkEmployeeImportResult(
                    employee_id=emp_data.employee_id,
                    email=emp_data.email,
                    success=False,
                    error=f"Email {emp_data.email} already exists"
                ))
                failed_count += 1
                continue
            
            # Store project_ids in user_data JSONB field
            user_data = dict(emp_data.employee_data) if emp_data.employee_data else {}
            user_data['project_ids'] = emp_data.project_ids if emp_data.project_ids else []
            
            # Generate username from email
            username = emp_data.email.split('@')[0]
            
            # Generate a secure temporary password
            temp_password = generate_temporary_password()
            hashed_password = hashlib.sha256(temp_password.encode()).hexdigest()
            
            user = User(
                id=uuid4(),
                tenant_id=import_data.tenant_id,
                username=username,
                email=emp_data.email,
                hashed_password=hashed_password,
                employee_code=emp_data.employee_id,
                first_name=emp_data.first_name,
                last_name=emp_data.last_name,
                full_name=f"{emp_data.first_name} {emp_data.last_name}",
                phone=emp_data.phone,
                mobile=emp_data.mobile,
                address=emp_data.address,
                department=emp_data.department,
                designation=emp_data.designation,
                region=emp_data.region,  # Region/location for policy applicability
                manager_id=UUID(emp_data.manager_id) if emp_data.manager_id else None,
                date_of_joining=emp_data.date_of_joining,
                user_data=user_data,
                employment_status="ACTIVE",
                roles=["EMPLOYEE"],
                is_active=True
            )
            
            db.add(user)
            
            # Store user info for post-commit processing
            created_users.append({
                'user': user,
                'temp_password': temp_password,
                'username': username,
                'emp_data': emp_data
            })
            
            results.append(BulkEmployeeImportResult(
                employee_id=emp_data.employee_id,
                email=emp_data.email,
                success=True
            ))
            success_count += 1
            
        except Exception as e:
            results.append(BulkEmployeeImportResult(
                employee_id=emp_data.employee_id,
                email=emp_data.email,
                success=False,
                error=str(e)
            ))
            failed_count += 1
    
    # Commit all successful inserts
    if success_count > 0:
        db.commit()
        
        # Process Keycloak users and welcome emails after commit
        keycloak = None
        if settings.KEYCLOAK_ENABLED:
            try:
                keycloak = get_keycloak_service()
            except Exception as e:
                logger.error(f"Failed to get Keycloak service for bulk import: {str(e)}")
        
        email_service = None
        try:
            email_service = get_email_service()
        except Exception as e:
            logger.error(f"Failed to get email service for bulk import: {str(e)}")
        
        login_url = settings.FRONTEND_URL or "http://localhost:5173"
        
        for user_info in created_users:
            user = user_info['user']
            temp_password = user_info['temp_password']
            username = user_info['username']
            emp_data = user_info['emp_data']
            
            # Create Keycloak user if enabled
            if keycloak:
                try:
                    keycloak_user_id = await keycloak.create_user(
                        email=emp_data.email,
                        password=temp_password,
                        first_name=emp_data.first_name,
                        last_name=emp_data.last_name,
                        enabled=True,
                        email_verified=False,
                        attributes={
                            "tenant_id": [str(import_data.tenant_id)],
                            "employee_id": [str(user.id)],
                            "employee_code": [emp_data.employee_id]
                        }
                    )
                    if keycloak_user_id:
                        logger.info(f"Keycloak user created for employee {emp_data.email} with ID {keycloak_user_id}")
                    else:
                        logger.warning(f"Keycloak user creation returned no ID for employee {emp_data.email}")
                except Exception as e:
                    logger.error(f"Failed to create Keycloak user for employee {emp_data.email}: {str(e)}")
            
            # Queue welcome email
            if email_service:
                try:
                    background_tasks.add_task(
                        email_service.send_employee_welcome_email,
                        to_email=emp_data.email,
                        employee_name=f"{emp_data.first_name} {emp_data.last_name}",
                        tenant_name=tenant_name,
                        temporary_password=temp_password,
                        login_url=login_url
                    )
                    logger.info(f"Welcome email queued for employee {emp_data.email}")
                except Exception as e:
                    logger.error(f"Failed to queue welcome email for employee {emp_data.email}: {str(e)}")
    
    return BulkEmployeeImportResponse(
        total=len(import_data.employees),
        success_count=success_count,
        failed_count=failed_count,
        results=results
    )


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: UUID,
    employee_data: EmployeeCreate,
    background_tasks: BackgroundTasks,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Update an employee"""
    query = db.query(User).filter(User.id == employee_id)
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    user = query.first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    old_employee_code = user.employee_code
    old_email = user.email
    
    # Check if new employee_code conflicts with another user in the same tenant
    if employee_data.employee_id != old_employee_code:
        existing = db.query(User).filter(
            User.tenant_id == user.tenant_id,
            User.employee_code == employee_data.employee_id,
            User.id != employee_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee with ID {employee_data.employee_id} already exists in this tenant"
            )
    
    # Update fields
    user.employee_code = employee_data.employee_id
    user.first_name = employee_data.first_name
    user.last_name = employee_data.last_name
    user.full_name = f"{employee_data.first_name} {employee_data.last_name}"
    user.phone = employee_data.phone
    user.mobile = employee_data.mobile
    user.address = employee_data.address
    user.department = employee_data.department
    user.designation = employee_data.designation
    
    # Update region/location for policy applicability
    if employee_data.region is not None:
        user.region = employee_data.region
    
    if employee_data.manager_id:
        user.manager_id = UUID(employee_data.manager_id)
    
    if employee_data.date_of_joining:
        user.date_of_joining = employee_data.date_of_joining
    
    # Store project_ids in user_data JSONB field
    user_data = dict(user.user_data) if user.user_data else {}
    # Always store project_ids, even if empty
    user_data['project_ids'] = employee_data.project_ids if employee_data.project_ids else []
    if employee_data.employee_data:
        user_data.update(employee_data.employee_data)
    user.user_data = user_data
    # Flag the JSONB field as modified so SQLAlchemy detects the change
    flag_modified(user, 'user_data')
    
    # Note: Roles are NOT updated here - they are derived from designation-to-role mappings
    
    db.commit()
    db.refresh(user)
    
    # Invalidate cache entries
    background_tasks.add_task(_invalidate_employee_cache, employee_id, old_employee_code, old_email)
    if user.employee_code != old_employee_code:
        background_tasks.add_task(_invalidate_employee_cache, employee_code=user.employee_code)
    if user.email != old_email:
        background_tasks.add_task(_invalidate_employee_cache, email=user.email)
    
    return _user_to_employee_response(user, db)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: UUID,
    background_tasks: BackgroundTasks,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Delete an employee (soft delete by setting status to INACTIVE)"""
    query = db.query(User).filter(User.id == employee_id)
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    user = query.first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    user.employment_status = "INACTIVE"
    user.is_active = False
    db.commit()
    
    # Invalidate cache
    background_tasks.add_task(_invalidate_employee_cache, employee_id, user.employee_code, user.email)
    db.commit()
    
    return None


# ==================== Project Allocation Endpoints ====================

@router.get("/{employee_id}/project-history", response_model=List[EmployeeProjectHistoryResponse])
async def get_employee_project_history(
    employee_id: UUID,
    include_inactive: bool = True,
    tenant_id: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Get all projects an employee is/was allocated to.
    This includes both current and past project allocations.
    
    Args:
        employee_id: UUID of the employee (user)
        include_inactive: If True, include deallocated/completed projects
        tenant_id: Optional tenant filter
    
    Returns:
        List of project allocations with project details
    """
    query = db.query(User).filter(User.id == employee_id)
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    user = query.first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Query project allocations with project details
    query = db.query(
        EmployeeProjectAllocation,
        Project
    ).join(
        Project, EmployeeProjectAllocation.project_id == Project.id
    ).filter(
        EmployeeProjectAllocation.employee_id == employee_id
    )
    
    if not include_inactive:
        query = query.filter(EmployeeProjectAllocation.status == "ACTIVE")
    
    # Order by status (ACTIVE first, then COMPLETED, then REMOVED) and then by allocated_date desc
    status_order = case(
        (EmployeeProjectAllocation.status == "ACTIVE", 1),
        (EmployeeProjectAllocation.status == "COMPLETED", 2),
        (EmployeeProjectAllocation.status == "REMOVED", 3),
        else_=4
    )
    query = query.order_by(
        status_order,
        EmployeeProjectAllocation.allocated_date.desc()
    )
    
    results = query.all()
    
    # Build response with project details
    response = []
    for allocation, project in results:
        response.append(EmployeeProjectHistoryResponse(
            id=allocation.id,
            employee_id=allocation.employee_id,
            project_id=allocation.project_id,
            project_code=project.project_code,
            project_name=project.project_name,
            project_status=project.status,
            role=allocation.role,
            allocation_percentage=allocation.allocation_percentage,
            status=allocation.status,
            allocated_date=allocation.allocated_date,
            deallocated_date=allocation.deallocated_date
        ))
    
    return response


@router.post("/{employee_id}/allocate-project", response_model=EmployeeProjectAllocationResponse, status_code=status.HTTP_201_CREATED)
async def allocate_employee_to_project(
    employee_id: UUID,
    allocation_data: EmployeeProjectAllocationCreate,
    db: Session = Depends(get_sync_db)
):
    """
    Allocate an employee to a project.
    Creates a new allocation record to track history.
    """
    # Verify employee exists
    user = db.query(User).filter(User.id == employee_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Verify project exists
    project = db.query(Project).filter(Project.id == allocation_data.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check if active allocation already exists
    existing = db.query(EmployeeProjectAllocation).filter(
        EmployeeProjectAllocation.employee_id == employee_id,
        EmployeeProjectAllocation.project_id == allocation_data.project_id,
        EmployeeProjectAllocation.status == "ACTIVE"
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee is already allocated to this project"
        )
    
    # Create allocation
    allocation = EmployeeProjectAllocation(
        id=uuid4(),
        tenant_id=user.tenant_id,
        employee_id=employee_id,
        project_id=allocation_data.project_id,
        role=allocation_data.role,
        allocation_percentage=allocation_data.allocation_percentage or 100,
        allocated_date=allocation_data.allocated_date or date.today(),
        notes=allocation_data.notes,
        status="ACTIVE"
    )
    
    db.add(allocation)
    
    # Also update user_data.project_ids for quick access
    user_data = user.user_data or {}
    project_ids = user_data.get('project_ids', [])
    if str(allocation_data.project_id) not in project_ids:
        project_ids.append(str(allocation_data.project_id))
        user_data['project_ids'] = project_ids
        user.user_data = user_data
    
    db.commit()
    db.refresh(allocation)
    
    return allocation


@router.put("/{employee_id}/deallocate-project/{project_id}", response_model=EmployeeProjectAllocationResponse)
async def deallocate_employee_from_project(
    employee_id: UUID,
    project_id: UUID,
    update_data: EmployeeProjectAllocationUpdate,
    db: Session = Depends(get_sync_db)
):
    """
    Deallocate an employee from a project.
    Sets the deallocated_date and updates status.
    """
    # Find the active allocation
    allocation = db.query(EmployeeProjectAllocation).filter(
        EmployeeProjectAllocation.employee_id == employee_id,
        EmployeeProjectAllocation.project_id == project_id,
        EmployeeProjectAllocation.status == "ACTIVE"
    ).first()
    
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active allocation not found for this employee and project"
        )
    
    # Update allocation
    allocation.deallocated_date = update_data.deallocated_date or date.today()
    allocation.status = update_data.status or "COMPLETED"
    if update_data.notes:
        allocation.notes = update_data.notes
    
    # Update user_data.project_ids for quick access
    user = db.query(User).filter(User.id == employee_id).first()
    if user:
        user_data = user.user_data or {}
        project_ids = user_data.get('project_ids', [])
        if str(project_id) in project_ids:
            project_ids.remove(str(project_id))
            user_data['project_ids'] = project_ids
            user.user_data = user_data
    
    db.commit()
    db.refresh(allocation)
    
    return allocation


@router.get("/{employee_id}/current-projects", response_model=List[EmployeeProjectHistoryResponse])
async def get_employee_current_projects(
    employee_id: UUID,
    db: Session = Depends(get_sync_db)
):
    """
    Get only currently active project allocations for an employee.
    Convenience endpoint that filters to only ACTIVE status.
    """
    return await get_employee_project_history(employee_id, include_inactive=False, db=db)

