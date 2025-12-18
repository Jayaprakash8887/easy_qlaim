"""
Role Resolution Service

Provides dynamic role resolution based on designation-to-role mappings.
SYSTEM_ADMIN is the only role stored directly on users (platform-level).
All other roles are resolved from tenant-specific designation mappings.
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from models import User, Designation, DesignationRoleMapping


def get_user_roles(user: User, db: Session) -> List[str]:
    """
    Get application roles for a user based on their designation.
    
    - SYSTEM_ADMIN role is checked directly on user.roles (platform-level)
    - Other roles come from designation-to-role mappings
    - EMPLOYEE is always included as base role
    
    Args:
        user: User object
        db: Database session
        
    Returns:
        List of role strings (e.g., ['EMPLOYEE', 'MANAGER'])
    """
    roles = set()
    
    # Check for System Admin (platform-level, stored directly on user)
    if user.roles and 'SYSTEM_ADMIN' in user.roles:
        roles.add('SYSTEM_ADMIN')
    
    # Get roles from designation mapping
    if user.designation and user.tenant_id:
        # Find the designation record matching user's designation name
        designation = db.query(Designation).filter(
            Designation.tenant_id == user.tenant_id,
            Designation.name.ilike(user.designation),  # Case-insensitive match
            Designation.is_active == True
        ).first()
        
        if designation:
            # Get all role mappings for this designation
            mappings = db.query(DesignationRoleMapping).filter(
                DesignationRoleMapping.designation_id == designation.id
            ).all()
            
            for mapping in mappings:
                roles.add(mapping.role)
    
    # Always include EMPLOYEE as base role for all non-SYSTEM_ADMIN users
    # SYSTEM_ADMIN is a platform-level role and doesn't need EMPLOYEE
    if 'SYSTEM_ADMIN' not in roles:
        roles.add('EMPLOYEE')
    
    return list(roles)


def has_role(user: User, role: str, db: Session) -> bool:
    """
    Check if a user has a specific role.
    
    Args:
        user: User object
        role: Role to check (e.g., 'MANAGER', 'HR')
        db: Database session
        
    Returns:
        True if user has the role, False otherwise
    """
    user_roles = get_user_roles(user, db)
    return role in user_roles


def has_any_role(user: User, roles: List[str], db: Session) -> bool:
    """
    Check if a user has any of the specified roles.
    
    Args:
        user: User object
        roles: List of roles to check
        db: Database session
        
    Returns:
        True if user has any of the roles, False otherwise
    """
    user_roles = get_user_roles(user, db)
    return any(role in user_roles for role in roles)


def has_all_roles(user: User, roles: List[str], db: Session) -> bool:
    """
    Check if a user has all of the specified roles.
    
    Args:
        user: User object
        roles: List of roles to check
        db: Database session
        
    Returns:
        True if user has all the roles, False otherwise
    """
    user_roles = get_user_roles(user, db)
    return all(role in user_roles for role in roles)


def is_system_admin(user: User) -> bool:
    """
    Check if a user is a System Admin (platform-level).
    This check doesn't require database lookup as SYSTEM_ADMIN
    is stored directly on the user record.
    
    Args:
        user: User object
        
    Returns:
        True if user is a System Admin
    """
    return user.roles and 'SYSTEM_ADMIN' in user.roles


def get_designation_roles(designation_id: UUID, db: Session) -> List[str]:
    """
    Get all roles mapped to a specific designation.
    
    Args:
        designation_id: UUID of the designation
        db: Database session
        
    Returns:
        List of role strings
    """
    mappings = db.query(DesignationRoleMapping).filter(
        DesignationRoleMapping.designation_id == designation_id
    ).all()
    
    return [m.role for m in mappings]


def get_available_roles() -> List[str]:
    """
    Get list of all available application roles.
    
    Returns:
        List of role strings
    """
    return ['EMPLOYEE', 'MANAGER', 'HR', 'FINANCE', 'ADMIN']


def get_all_roles_including_system() -> List[str]:
    """
    Get list of all roles including SYSTEM_ADMIN.
    
    Returns:
        List of role strings
    """
    return ['SYSTEM_ADMIN', 'EMPLOYEE', 'MANAGER', 'HR', 'FINANCE', 'ADMIN']


def ensure_employee_role(roles: List[str]) -> List[str]:
    """
    Ensure EMPLOYEE role is present in the roles list for tenant users.
    SYSTEM_ADMIN users are excluded as they are platform-level only.
    
    Args:
        roles: List of current roles
        
    Returns:
        List of roles with EMPLOYEE included (if not SYSTEM_ADMIN only)
    """
    if not roles:
        return ['EMPLOYEE']
    
    roles_set = set(roles)
    
    # If user is SYSTEM_ADMIN only, don't add EMPLOYEE
    if roles_set == {'SYSTEM_ADMIN'}:
        return list(roles_set)
    
    # For all other cases, ensure EMPLOYEE is present
    roles_set.add('EMPLOYEE')
    return list(roles_set)


def normalize_user_roles(roles: List[str], is_tenant_user: bool = True) -> List[str]:
    """
    Normalize user roles to ensure consistency.
    - All tenant users get EMPLOYEE role by default
    - SYSTEM_ADMIN is only for platform-level users
    
    Args:
        roles: List of roles to normalize
        is_tenant_user: Whether this is a tenant user (default True)
        
    Returns:
        Normalized list of roles
    """
    if not roles:
        return ['EMPLOYEE'] if is_tenant_user else []
    
    roles_upper = [r.upper() for r in roles]
    roles_set = set(roles_upper)
    
    # If SYSTEM_ADMIN only, don't add EMPLOYEE
    if roles_set == {'SYSTEM_ADMIN'}:
        return ['SYSTEM_ADMIN']
    
    # Remove SYSTEM_ADMIN from tenant users (shouldn't happen but safety check)
    if is_tenant_user and 'SYSTEM_ADMIN' in roles_set:
        roles_set.discard('SYSTEM_ADMIN')
    
    # Ensure EMPLOYEE is present for tenant users
    if is_tenant_user:
        roles_set.add('EMPLOYEE')
    
    # Order roles consistently
    role_order = ['EMPLOYEE', 'MANAGER', 'HR', 'FINANCE', 'ADMIN', 'SYSTEM_ADMIN']
    return [r for r in role_order if r in roles_set]
