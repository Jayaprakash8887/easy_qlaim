"""
Cached Data Access Layer - Provides cached access to frequently-read master data.

This module wraps database queries with Redis caching to reduce database load.
Data that changes infrequently (projects, employees, policies, categories) 
is cached with appropriate TTLs.

Usage:
    from services.cached_data import cached_data
    
    # Get project by code (cached)
    project = await cached_data.get_project_by_code(db, "PRJ-001")
    
    # Get employee by ID (cached)
    employee = await cached_data.get_employee_by_id(db, employee_id)
    
    # Get all active projects (cached)
    projects = await cached_data.get_all_active_projects(db)
"""

import logging
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from models import Project, User, Policy, PolicyUpload, PolicyCategory, SystemSettings, EmployeeProjectAllocation
from services.redis_cache import redis_cache

logger = logging.getLogger(__name__)


class CachedDataService:
    """
    Service providing cached access to master data.
    
    Pattern: Cache-Aside
    1. Try to get from cache
    2. If miss, query database
    3. Store in cache for future requests
    """
    
    # ==================== PROJECT DATA ====================
    
    async def get_project_by_code(self, db: AsyncSession, project_code: str) -> Optional[Dict]:
        """
        Get project by code with caching.
        
        Args:
            db: Database session
            project_code: Project code to lookup
            
        Returns:
            Project data dict or None
        """
        if not project_code:
            return None
        
        # Try cache first
        cached = await redis_cache.get_project_by_code(project_code)
        if cached:
            return cached
        
        # Query database
        result = await db.execute(
            select(Project).where(Project.project_code == project_code)
        )
        project = result.scalar_one_or_none()
        
        if project:
            project_data = self._project_to_dict(project)
            # Store in cache
            await redis_cache.set_project_by_code(project_code, project_data)
            return project_data
        
        return None
    
    async def get_project_by_id(self, db: AsyncSession, project_id: UUID) -> Optional[Dict]:
        """Get project by ID with caching"""
        str_id = str(project_id)
        
        # Try cache first
        cached = await redis_cache.get_async(f"project:id:{str_id}")
        if cached:
            return cached
        
        # Query database
        result = await db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        
        if project:
            project_data = self._project_to_dict(project)
            # Store in cache (by both ID and code)
            await redis_cache.set_async(f"project:id:{str_id}", project_data, redis_cache.TTL_PROJECT)
            await redis_cache.set_project_by_code(project.project_code, project_data)
            return project_data
        
        return None
    
    async def get_all_active_projects(self, db: AsyncSession) -> List[Dict]:
        """Get all active projects with caching"""
        # Try cache first
        cached = await redis_cache.get_all_projects()
        if cached:
            return cached
        
        # Query database
        result = await db.execute(
            select(Project).where(Project.status == "ACTIVE").order_by(Project.project_name)
        )
        projects = result.scalars().all()
        
        project_list = [self._project_to_dict(p) for p in projects]
        
        # Store in cache
        await redis_cache.set_all_projects(project_list)
        
        # Also build and cache the name map
        name_map = {p["project_code"]: p["project_name"] for p in project_list}
        await redis_cache.set_project_name_map(name_map)
        
        return project_list
    
    async def get_project_name_map(self, db: AsyncSession) -> Dict[str, str]:
        """Get project_code -> project_name mapping with caching"""
        # Try cache first
        cached = await redis_cache.get_project_name_map()
        if cached:
            return cached
        
        # Query database (lightweight query)
        result = await db.execute(
            select(Project.project_code, Project.project_name)
            .where(Project.status == "ACTIVE")
        )
        rows = result.all()
        
        name_map = {row.project_code: row.project_name for row in rows}
        
        # Store in cache
        await redis_cache.set_project_name_map(name_map)
        
        return name_map
    
    async def get_project_names_for_codes(self, db: AsyncSession, project_codes: List[str]) -> Dict[str, str]:
        """
        Get project names for multiple codes efficiently.
        Uses cached name map or batch query.
        
        Args:
            db: Database session
            project_codes: List of project codes
            
        Returns:
            Dict mapping project_code -> project_name
        """
        if not project_codes:
            return {}
        
        # Try to get from cached name map first
        name_map = await redis_cache.get_project_name_map()
        if name_map:
            return {code: name_map.get(code, '') for code in project_codes}
        
        # Fallback to database query
        result = await db.execute(
            select(Project.project_code, Project.project_name)
            .where(Project.project_code.in_(project_codes))
        )
        rows = result.all()
        
        return {row.project_code: row.project_name for row in rows}
    
    def _project_to_dict(self, project: Project) -> Dict:
        """Convert Project model to dict"""
        return {
            "id": str(project.id),
            "tenant_id": str(project.tenant_id) if project.tenant_id else None,
            "project_code": project.project_code,
            "project_name": project.project_name,
            "description": project.description,
            "manager_id": str(project.manager_id) if project.manager_id else None,
            "budget_allocated": float(project.budget_allocated) if project.budget_allocated else None,
            "budget_spent": float(project.budget_spent) if project.budget_spent else 0,
            "budget_available": float(project.budget_available) if project.budget_available else None,
            "status": project.status,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "end_date": project.end_date.isoformat() if project.end_date else None,
            "project_data": project.project_data or {},
        }
    
    # ==================== EMPLOYEE/USER DATA ====================
    
    async def get_employee_by_id(self, db: AsyncSession, employee_id: UUID) -> Optional[Dict]:
        """Get employee by ID with caching"""
        str_id = str(employee_id)
        
        # Try cache first
        cached = await redis_cache.get_employee_by_id(str_id)
        if cached:
            return cached
        
        # Query database
        result = await db.execute(
            select(User).where(User.id == employee_id)
        )
        user = result.scalar_one_or_none()
        
        if user:
            user_data = self._user_to_dict(user)
            # Store in cache (by ID, code, and email)
            await redis_cache.set_employee_by_id(str_id, user_data)
            if user.employee_code:
                await redis_cache.set_employee_by_code(user.employee_code, user_data)
            if user.email:
                await redis_cache.set_employee_by_email(user.email, user_data)
            return user_data
        
        return None
    
    async def get_employee_by_code(self, db: AsyncSession, employee_code: str) -> Optional[Dict]:
        """Get employee by employee code with caching"""
        if not employee_code:
            return None
        
        # Try cache first
        cached = await redis_cache.get_employee_by_code(employee_code)
        if cached:
            return cached
        
        # Query database
        result = await db.execute(
            select(User).where(User.employee_code == employee_code)
        )
        user = result.scalar_one_or_none()
        
        if user:
            user_data = self._user_to_dict(user)
            # Store in cache
            await redis_cache.set_employee_by_code(employee_code, user_data)
            await redis_cache.set_employee_by_id(str(user.id), user_data)
            return user_data
        
        return None
    
    async def get_employee_by_email(self, db: AsyncSession, email: str) -> Optional[Dict]:
        """Get employee by email with caching"""
        if not email:
            return None
        
        # Try cache first
        cached = await redis_cache.get_employee_by_email(email)
        if cached:
            return cached
        
        # Query database
        result = await db.execute(
            select(User).where(User.email == email.lower())
        )
        user = result.scalar_one_or_none()
        
        if user:
            user_data = self._user_to_dict(user)
            # Store in cache
            await redis_cache.set_employee_by_email(email, user_data)
            await redis_cache.set_employee_by_id(str(user.id), user_data)
            return user_data
        
        return None
    
    async def get_employees_by_ids(self, db: AsyncSession, employee_ids: List[UUID]) -> Dict[str, Dict]:
        """Get multiple employees by IDs with caching"""
        if not employee_ids:
            return {}
        
        str_ids = [str(eid) for eid in employee_ids]
        
        # Try cache first
        cached = await redis_cache.get_employees_by_ids(str_ids)
        
        # Find missing IDs
        missing_ids = [eid for eid in employee_ids if str(eid) not in cached]
        
        if missing_ids:
            # Query missing from database
            result = await db.execute(
                select(User).where(User.id.in_(missing_ids))
            )
            users = result.scalars().all()
            
            # Add to result and cache
            new_data = {}
            for user in users:
                user_data = self._user_to_dict(user)
                cached[str(user.id)] = user_data
                new_data[str(user.id)] = user_data
            
            if new_data:
                await redis_cache.set_employees_by_ids(new_data)
        
        return cached
    
    async def get_employee_with_projects(self, db: AsyncSession, employee_id: UUID) -> Optional[Dict]:
        """Get employee with their active project allocations"""
        str_id = str(employee_id)
        cache_key = f"employee:with_projects:{str_id}"
        
        # Try cache first
        cached = await redis_cache.get_async(cache_key)
        if cached:
            return cached
        
        # Query employee with project allocations
        result = await db.execute(
            select(User).where(User.id == employee_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        # Get active project allocations
        alloc_result = await db.execute(
            select(EmployeeProjectAllocation, Project)
            .join(Project, EmployeeProjectAllocation.project_id == Project.id)
            .where(
                and_(
                    EmployeeProjectAllocation.employee_id == employee_id,
                    EmployeeProjectAllocation.status == "ACTIVE"
                )
            )
        )
        allocations = alloc_result.all()
        
        user_data = self._user_to_dict(user)
        user_data["projects"] = [
            {
                "project_id": str(proj.id),
                "project_code": proj.project_code,
                "project_name": proj.project_name,
                "role": alloc.role,
                "allocation_percentage": alloc.allocation_percentage
            }
            for alloc, proj in allocations
        ]
        
        # Cache with shorter TTL since it includes allocation data
        await redis_cache.set_async(cache_key, user_data, redis_cache.TTL_EMPLOYEE)
        
        return user_data
    
    def _user_to_dict(self, user: User) -> Dict:
        """Convert User model to dict"""
        return {
            "id": str(user.id),
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "username": user.username,
            "email": user.email,
            "employee_code": user.employee_code,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.full_name or user.display_name,
            "phone": user.phone,
            "mobile": user.mobile,
            "department": user.department,
            "designation": user.designation,
            "manager_id": str(user.manager_id) if user.manager_id else None,
            "region": user.region,
            "roles": user.roles or [],
            "is_active": user.is_active,
            "employment_status": user.employment_status,
        }
    
    # ==================== POLICY DATA ====================
    
    async def get_active_policies(self, db: AsyncSession, region: str = None) -> List[Dict]:
        """Get active policies with caching"""
        # Try cache first
        cached = await redis_cache.get_active_policies(region)
        if cached:
            return cached
        
        # Build query
        query = select(PolicyUpload).where(
            and_(
                PolicyUpload.status == "ACTIVE",
                PolicyUpload.is_active == True
            )
        )
        
        if region:
            # Get policies for specific region or global (NULL region)
            query = query.where(
                (PolicyUpload.region == region.upper()) | (PolicyUpload.region.is_(None))
            )
        
        result = await db.execute(query.order_by(PolicyUpload.policy_name))
        policies = result.scalars().all()
        
        policy_list = [self._policy_to_dict(p) for p in policies]
        
        # Store in cache
        await redis_cache.set_active_policies(policy_list, region)
        
        return policy_list
    
    async def get_policy_by_id(self, db: AsyncSession, policy_id: UUID) -> Optional[Dict]:
        """Get policy by ID with caching"""
        str_id = str(policy_id)
        
        # Try cache first
        cached = await redis_cache.get_policy_by_id(str_id)
        if cached:
            return cached
        
        # Query database
        result = await db.execute(
            select(PolicyUpload)
            .options(selectinload(PolicyUpload.categories))
            .where(PolicyUpload.id == policy_id)
        )
        policy = result.scalar_one_or_none()
        
        if policy:
            policy_data = self._policy_to_dict(policy, include_categories=True)
            await redis_cache.set_policy_by_id(str_id, policy_data)
            return policy_data
        
        return None
    
    def _policy_to_dict(self, policy: PolicyUpload, include_categories: bool = False) -> Dict:
        """Convert PolicyUpload model to dict"""
        data = {
            "id": str(policy.id),
            "tenant_id": str(policy.tenant_id) if policy.tenant_id else None,
            "policy_name": policy.policy_name,
            "policy_number": policy.policy_number,
            "description": policy.description,
            "status": policy.status,
            "is_active": policy.is_active,
            "version": policy.version,
            "region": policy.region,
            "effective_from": policy.effective_from.isoformat() if policy.effective_from else None,
            "effective_to": policy.effective_to.isoformat() if policy.effective_to else None,
            "extracted_data": policy.extracted_data or {},
        }
        
        if include_categories and hasattr(policy, 'categories'):
            data["categories"] = [
                self._category_to_dict(cat) for cat in policy.categories
            ]
        
        return data
    
    # ==================== CATEGORY DATA ====================
    
    async def get_all_categories(
        self, 
        db: AsyncSession, 
        region: str = None, 
        category_type: str = None
    ) -> List[Dict]:
        """Get all policy categories with caching"""
        # Try cache first
        cached = await redis_cache.get_all_categories(region, category_type)
        if cached:
            return cached
        
        # Build query - get categories from active policies
        query = (
            select(PolicyCategory)
            .join(PolicyUpload)
            .where(
                and_(
                    PolicyUpload.status == "ACTIVE",
                    PolicyUpload.is_active == True
                )
            )
        )
        
        if region:
            query = query.where(
                (PolicyUpload.region == region.upper()) | (PolicyUpload.region.is_(None))
            )
        
        if category_type:
            query = query.where(PolicyCategory.category_type == category_type.upper())
        
        result = await db.execute(query.order_by(PolicyCategory.category_name))
        categories = result.scalars().all()
        
        category_list = [self._category_to_dict(c) for c in categories]
        
        # Store in cache
        await redis_cache.set_all_categories(category_list, region, category_type)
        
        # Also build and cache the name map
        name_map = {c["category_code"]: c["category_name"] for c in category_list}
        await redis_cache.set_category_name_map(name_map, region)
        
        return category_list
    
    async def get_category_by_code(
        self, 
        db: AsyncSession, 
        category_code: str, 
        region: str = None
    ) -> Optional[Dict]:
        """Get category by code with caching"""
        if not category_code:
            return None
        
        # Try cache first
        cached = await redis_cache.get_category_by_code(category_code, region)
        if cached:
            return cached
        
        # Query database
        query = (
            select(PolicyCategory)
            .join(PolicyUpload)
            .where(
                and_(
                    PolicyCategory.category_code == category_code,
                    PolicyUpload.status == "ACTIVE",
                    PolicyUpload.is_active == True
                )
            )
        )
        
        if region:
            query = query.where(
                (PolicyUpload.region == region.upper()) | (PolicyUpload.region.is_(None))
            )
        
        result = await db.execute(query)
        category = result.scalar_one_or_none()
        
        if category:
            category_data = self._category_to_dict(category)
            await redis_cache.set_category_by_code(category_code, category_data, region)
            return category_data
        
        return None
    
    async def get_category_name_map(self, db: AsyncSession, region: str = None) -> Dict[str, str]:
        """Get category_code -> category_name mapping with caching"""
        # Try cache first
        cached = await redis_cache.get_category_name_map(region)
        if cached:
            return cached
        
        # Query database
        query = (
            select(PolicyCategory.category_code, PolicyCategory.category_name)
            .join(PolicyUpload)
            .where(
                and_(
                    PolicyUpload.status == "ACTIVE",
                    PolicyUpload.is_active == True
                )
            )
        )
        
        if region:
            query = query.where(
                (PolicyUpload.region == region.upper()) | (PolicyUpload.region.is_(None))
            )
        
        result = await db.execute(query)
        rows = result.all()
        
        name_map = {row.category_code: row.category_name for row in rows}
        
        # Store in cache
        await redis_cache.set_category_name_map(name_map, region)
        
        return name_map
    
    def _category_to_dict(self, category: PolicyCategory) -> Dict:
        """Convert PolicyCategory model to dict"""
        return {
            "id": str(category.id),
            "tenant_id": str(category.tenant_id) if category.tenant_id else None,
            "policy_upload_id": str(category.policy_upload_id) if category.policy_upload_id else None,
            "category_name": category.category_name,
            "category_code": category.category_code,
            "category_type": category.category_type,
            "description": category.description,
            "max_amount": float(category.max_amount) if category.max_amount else None,
            "min_amount": float(category.min_amount) if category.min_amount else None,
            "currency": category.currency,
            "frequency_limit": category.frequency_limit,
            "frequency_count": category.frequency_count,
            "requires_receipt": category.requires_receipt,
            "requires_approval_above": float(category.requires_approval_above) if category.requires_approval_above else None,
            "eligibility_criteria": category.eligibility_criteria or {},
        }
    
    # ==================== SYSTEM SETTINGS ====================
    
    async def get_setting(self, db: AsyncSession, setting_key: str) -> Optional[Any]:
        """Get system setting with caching"""
        # Try cache first
        cached = await redis_cache.get_setting(setting_key)
        if cached is not None:
            return cached
        
        # Query database
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.setting_key == setting_key)
        )
        setting = result.scalar_one_or_none()
        
        if setting:
            # Parse value based on type
            value = self._parse_setting_value(setting.setting_value, setting.setting_type)
            await redis_cache.set_setting(setting_key, value)
            return value
        
        return None
    
    async def get_all_settings(self, db: AsyncSession) -> Dict[str, Any]:
        """Get all system settings with caching"""
        # Try cache first
        cached = await redis_cache.get_all_settings()
        if cached:
            return cached
        
        # Query database
        result = await db.execute(select(SystemSettings))
        settings = result.scalars().all()
        
        settings_dict = {
            s.setting_key: self._parse_setting_value(s.setting_value, s.setting_type)
            for s in settings
        }
        
        await redis_cache.set_all_settings(settings_dict)
        return settings_dict
    
    def _parse_setting_value(self, value: str, value_type: str) -> Any:
        """Parse setting value based on its type"""
        if value_type == "boolean":
            return value.lower() in ("true", "1", "yes")
        elif value_type == "number":
            try:
                return float(value) if "." in value else int(value)
            except ValueError:
                return value
        elif value_type == "json":
            import json
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return value
    
    # ==================== CACHE INVALIDATION ====================
    
    async def invalidate_project(self, project_code: str = None, project_id: UUID = None):
        """Invalidate project cache after update"""
        if project_code:
            await redis_cache.delete_async(f"project:code:{project_code}")
        if project_id:
            await redis_cache.delete_async(f"project:id:{str(project_id)}")
        # Also invalidate the all-projects cache and name map
        await redis_cache.delete_async("project:all:active")
        await redis_cache.delete_async("project:name_map")
    
    async def invalidate_employee(self, employee_id: UUID = None, employee_code: str = None, email: str = None):
        """Invalidate employee cache after update"""
        await redis_cache.invalidate_employee(
            employee_id=str(employee_id) if employee_id else None,
            employee_code=employee_code,
            email=email
        )
        if employee_id:
            await redis_cache.delete_async(f"employee:with_projects:{str(employee_id)}")
    
    async def invalidate_policy(self, policy_id: UUID = None, region: str = None):
        """Invalidate policy cache after update"""
        if policy_id:
            await redis_cache.delete_async(f"policy:id:{str(policy_id)}")
        await redis_cache.invalidate_policies(region)
        # Also invalidate categories since they're linked to policies
        await redis_cache.invalidate_categories(region)
    
    async def invalidate_setting(self, setting_key: str):
        """Invalidate setting cache after update"""
        await redis_cache.invalidate_settings(setting_key)


# Global singleton instance
cached_data = CachedDataService()
