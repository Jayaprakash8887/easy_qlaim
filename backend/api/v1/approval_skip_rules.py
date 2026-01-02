"""
Approval Skip Rules API endpoints.
Allows admins to configure rules for skipping approval levels based on designation, email, or project.
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
import logging

from database import get_sync_db
from models import ApprovalSkipRule, User, Designation, Project
from schemas import (
    ApprovalSkipRuleCreate,
    ApprovalSkipRuleUpdate,
    ApprovalSkipRuleResponse,
    ApprovalSkipResult,
)
from api.v1.auth import require_tenant_id

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== HELPER FUNCTIONS ====================

def get_approval_skip_for_employee(
    db: Session,
    tenant_id: UUID,
    employee_email: str,
    employee_designation: Optional[str],
    claim_amount: float,
    category_code: Optional[str] = None,
    project_code: Optional[str] = None
) -> ApprovalSkipResult:
    """
    Check if any approval skip rules apply to the given employee.
    Returns which approval levels should be skipped.
    
    Priority Logic:
    - Rules are sorted by priority (lower number = higher priority, checked first)
    - If two rules have the same priority, they are sorted by rule_name alphabetically
    - The FIRST matching rule wins and is applied
    - If an employee matches multiple rules, only the highest priority rule is used
    
    Args:
        db: Database session
        tenant_id: Tenant UUID
        employee_email: Employee's email address
        employee_designation: Employee's designation code
        claim_amount: Amount of the claim
        category_code: Optional category code for the claim
        project_code: Optional project code for the claim
        
    Returns:
        ApprovalSkipResult with which levels to skip and reason
    """
    # Get all active rules for this tenant, ordered by priority (then by name for deterministic order)
    rules = db.query(ApprovalSkipRule).filter(
        and_(
            ApprovalSkipRule.tenant_id == tenant_id,
            ApprovalSkipRule.is_active == True
        )
    ).order_by(ApprovalSkipRule.priority, ApprovalSkipRule.rule_name).all()
    
    logger.debug(f"Evaluating {len(rules)} skip rules for employee '{employee_email}' (designation: {employee_designation}, amount: {claim_amount}, project: {project_code})")
    
    for rule in rules:
        # Check if rule applies to this employee
        matches = False
        match_reason = ""
        
        if rule.match_type == "email" and rule.emails:
            # Match by email
            if employee_email and employee_email.lower() in [e.lower() for e in rule.emails]:
                matches = True
                match_reason = f"Email '{employee_email}' matches rule"
                
        elif rule.match_type == "designation" and rule.designations:
            # Match by designation
            if employee_designation and employee_designation.upper() in [d.upper() for d in rule.designations]:
                matches = True
                match_reason = f"Designation '{employee_designation}' matches rule"
        
        elif rule.match_type == "project" and rule.project_codes:
            # Match by project code
            if project_code and project_code.upper() in [p.upper() for p in rule.project_codes]:
                matches = True
                match_reason = f"Project '{project_code}' matches rule"
        
        if not matches:
            continue
            
        # Check amount threshold
        if rule.max_amount_threshold is not None:
            if claim_amount > float(rule.max_amount_threshold):
                logger.debug(f"Rule '{rule.rule_name}' skipped: amount {claim_amount} exceeds threshold {rule.max_amount_threshold}")
                continue
        
        # Check category restriction
        if rule.category_codes and len(rule.category_codes) > 0:
            if category_code and category_code.upper() not in [c.upper() for c in rule.category_codes]:
                logger.debug(f"Rule '{rule.rule_name}' skipped: category {category_code} not in allowed categories")
                continue
        
        # Rule applies! Return the skip configuration
        logger.info(f"Approval skip rule '{rule.rule_name}' applied for employee '{employee_email}': {match_reason}")
        return ApprovalSkipResult(
            skip_manager=rule.skip_manager_approval,
            skip_hr=rule.skip_hr_approval,
            skip_finance=rule.skip_finance_approval,
            applied_rule_id=rule.id,
            applied_rule_name=rule.rule_name,
            reason=match_reason
        )
    
    # No rules matched - standard approval flow
    return ApprovalSkipResult(
        skip_manager=False,
        skip_hr=False,
        skip_finance=False,
        applied_rule_id=None,
        applied_rule_name=None,
        reason="No skip rules applied - standard approval flow"
    )


# ==================== CRUD ENDPOINTS ====================

@router.get("/", response_model=List[ApprovalSkipRuleResponse])
async def list_approval_skip_rules(
    tenant_id: str,
    include_inactive: bool = False,
    db: Session = Depends(get_sync_db)
):
    """List all approval skip rules for the tenant"""
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    query = db.query(ApprovalSkipRule).filter(
        ApprovalSkipRule.tenant_id == tenant_uuid
    )
    
    if not include_inactive:
        query = query.filter(ApprovalSkipRule.is_active == True)
    
    rules = query.order_by(ApprovalSkipRule.priority, ApprovalSkipRule.rule_name).all()
    return rules


@router.get("/designations", response_model=List[dict])
async def list_available_designations(
    tenant_id: str,
    db: Session = Depends(get_sync_db)
):
    """List all available designations for creating skip rules"""
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    designations = db.query(Designation).filter(
        and_(
            Designation.tenant_id == tenant_uuid,
            Designation.is_active == True
        )
    ).order_by(Designation.level.desc(), Designation.name).all()
    
    return [
        {
            "code": d.code,
            "name": d.name,
            "level": d.level
        }
        for d in designations
    ]


@router.get("/projects/list", response_model=List[dict])
async def list_available_projects(
    tenant_id: str,
    db: Session = Depends(get_sync_db)
):
    """List all available projects for creating skip rules"""
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    from sqlalchemy import func
    projects = db.query(Project).filter(
        and_(
            Project.tenant_id == tenant_uuid,
            func.upper(Project.status) == "ACTIVE"
        )
    ).order_by(Project.project_name).all()
    
    return [
        {
            "code": p.project_code,
            "name": p.project_name
        }
        for p in projects
    ]


@router.get("/{rule_id}", response_model=ApprovalSkipRuleResponse)
async def get_approval_skip_rule(
    rule_id: UUID,
    tenant_id: str,
    db: Session = Depends(get_sync_db)
):
    """Get a specific approval skip rule"""
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    rule = db.query(ApprovalSkipRule).filter(
        and_(
            ApprovalSkipRule.id == rule_id,
            ApprovalSkipRule.tenant_id == tenant_uuid
        )
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval skip rule not found"
        )
    
    return rule


@router.post("/", response_model=ApprovalSkipRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_skip_rule(
    rule_data: ApprovalSkipRuleCreate,
    tenant_id: str,
    created_by: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Create a new approval skip rule"""
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    # Validate match_type
    if rule_data.match_type not in ["designation", "email", "project"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="match_type must be 'designation', 'email', or 'project'"
        )
    
    # Validate that appropriate field is provided based on match_type
    if rule_data.match_type == "designation" and not rule_data.designations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one designation is required when match_type is 'designation'"
        )
    if rule_data.match_type == "email" and not rule_data.emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one email is required when match_type is 'email'"
        )
    if rule_data.match_type == "project" and not rule_data.project_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one project code is required when match_type is 'project'"
        )
    
    # Check for duplicate rule name
    existing = db.query(ApprovalSkipRule).filter(
        and_(
            ApprovalSkipRule.tenant_id == tenant_uuid,
            ApprovalSkipRule.rule_name == rule_data.rule_name
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A rule with name '{rule_data.rule_name}' already exists"
        )
    
    # Create the rule
    rule = ApprovalSkipRule(
        tenant_id=tenant_uuid,
        rule_name=rule_data.rule_name,
        description=rule_data.description,
        match_type=rule_data.match_type,
        designations=rule_data.designations or [],
        emails=[e.lower() for e in (rule_data.emails or [])],  # Normalize emails to lowercase
        project_codes=[p.upper() for p in (rule_data.project_codes or [])],  # Normalize project codes to uppercase
        skip_manager_approval=rule_data.skip_manager_approval,
        skip_hr_approval=rule_data.skip_hr_approval,
        skip_finance_approval=rule_data.skip_finance_approval,
        max_amount_threshold=Decimal(str(rule_data.max_amount_threshold)) if rule_data.max_amount_threshold else None,
        category_codes=rule_data.category_codes or [],
        priority=rule_data.priority,
        is_active=rule_data.is_active,
        created_by=created_by,
        updated_by=created_by,
    )
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    logger.info(f"Created approval skip rule: {rule.rule_name} (id={rule.id})")
    return rule


@router.put("/{rule_id}", response_model=ApprovalSkipRuleResponse)
async def update_approval_skip_rule(
    rule_id: UUID,
    rule_data: ApprovalSkipRuleUpdate,
    tenant_id: str,
    updated_by: Optional[UUID] = None,
    db: Session = Depends(get_sync_db)
):
    """Update an existing approval skip rule"""
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    rule = db.query(ApprovalSkipRule).filter(
        and_(
            ApprovalSkipRule.id == rule_id,
            ApprovalSkipRule.tenant_id == tenant_uuid
        )
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval skip rule not found"
        )
    
    # Validate match_type if provided
    if rule_data.match_type is not None and rule_data.match_type not in ["designation", "email", "project"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="match_type must be 'designation', 'email', or 'project'"
        )
    
    # Check for duplicate rule name if name is being changed
    if rule_data.rule_name and rule_data.rule_name != rule.rule_name:
        existing = db.query(ApprovalSkipRule).filter(
            and_(
                ApprovalSkipRule.tenant_id == tenant_uuid,
                ApprovalSkipRule.rule_name == rule_data.rule_name,
                ApprovalSkipRule.id != rule_id
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A rule with name '{rule_data.rule_name}' already exists"
            )
    
    # Update fields
    update_data = rule_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "emails" and value is not None:
            value = [e.lower() for e in value]  # Normalize emails
        if field == "project_codes" and value is not None:
            value = [p.upper() for p in value]  # Normalize project codes
        if field == "max_amount_threshold" and value is not None:
            value = Decimal(str(value))
        setattr(rule, field, value)
    
    rule.updated_by = updated_by
    
    db.commit()
    db.refresh(rule)
    
    logger.info(f"Updated approval skip rule: {rule.rule_name} (id={rule.id})")
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval_skip_rule(
    rule_id: UUID,
    tenant_id: str,
    db: Session = Depends(get_sync_db)
):
    """Delete an approval skip rule"""
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    rule = db.query(ApprovalSkipRule).filter(
        and_(
            ApprovalSkipRule.id == rule_id,
            ApprovalSkipRule.tenant_id == tenant_uuid
        )
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval skip rule not found"
        )
    
    rule_name = rule.rule_name
    db.delete(rule)
    db.commit()
    
    logger.info(f"Deleted approval skip rule: {rule_name} (id={rule_id})")
    return None


# ==================== UTILITY ENDPOINTS ====================

@router.post("/check", response_model=ApprovalSkipResult)
async def check_approval_skip(
    tenant_id: str,
    employee_email: str,
    claim_amount: float,
    employee_designation: Optional[str] = None,
    category_code: Optional[str] = None,
    project_code: Optional[str] = None,
    db: Session = Depends(get_sync_db)
):
    """
    Check which approval levels would be skipped for a given employee and claim.
    Useful for preview/testing before claim submission.
    """
    require_tenant_id(tenant_id)
    tenant_uuid = UUID(tenant_id)
    
    result = get_approval_skip_for_employee(
        db=db,
        tenant_id=tenant_uuid,
        employee_email=employee_email,
        employee_designation=employee_designation,
        claim_amount=claim_amount,
        category_code=category_code,
        project_code=project_code
    )
    
    return result
