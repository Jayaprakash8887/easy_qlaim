"""
Redis Cache Service - Centralized caching for rarely-updated, frequently-read data.

Cacheable entities identified:
1. Projects - rarely updated, frequently looked up by project_code
2. Employees/Users - profile data changes infrequently 
3. Policies - updated by admins occasionally, read by every claim
4. Policy Categories - read for every claim validation
5. System Settings - read frequently, rarely changed

Cache Key Patterns (Multi-Tenant):
- {tenant_id}:project:{project_code} - Individual project by code
- {tenant_id}:project:all - All active projects
- {tenant_id}:project:id:{project_id} - Project by ID
- {tenant_id}:employee:{employee_id} - Employee/User data
- {tenant_id}:employee:code:{employee_code} - Employee by code
- {tenant_id}:employee:email:{email} - Employee by email
- {tenant_id}:policy:active - All active policies
- {tenant_id}:policy:category:{category_code} - Category rules
- {tenant_id}:settings:{setting_key} - Individual settings
- {tenant_id}:settings:all - All system settings
- global:settings:{key} - Global settings (non-tenant specific)

TTL Strategy:
- Projects: 1 hour (infrequently updated)
- Employees: 30 minutes (may get updated)
- Policies: 1 hour (rarely updated)
- Categories: 1 hour (same as policies)
- Settings: 10 minutes (may need quick updates)
"""

import json
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from threading import Lock
import asyncio
import redis.asyncio as aioredis
import redis

from config import settings

logger = logging.getLogger(__name__)


class RedisCacheService:
    """
    Centralized Redis cache service for master data.
    
    Features:
    - Async Redis operations with connection pooling
    - Multi-tenant key isolation with {tenant_id}: prefix
    - Automatic serialization/deserialization
    - TTL management per entity type
    - Cache invalidation support (per-tenant and global)
    - Fallback to in-memory cache if Redis unavailable
    """
    
    _instance = None
    _lock = Lock()
    
    # TTL configurations (in seconds)
    TTL_PROJECT = 3600  # 1 hour
    TTL_EMPLOYEE = 1800  # 30 minutes
    TTL_POLICY = 3600  # 1 hour
    TTL_CATEGORY = 3600  # 1 hour
    TTL_SETTINGS = 600  # 10 minutes
    TTL_DEFAULT = 1800  # 30 minutes default
    
    # Cache key prefixes
    PREFIX_PROJECT = "project"
    PREFIX_EMPLOYEE = "employee"
    PREFIX_POLICY = "policy"
    PREFIX_CATEGORY = "category"
    PREFIX_SETTINGS = "settings"
    PREFIX_GLOBAL = "global"  # For non-tenant-specific data
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._redis_url = settings.REDIS_CACHE_URL or settings.REDIS_URL
        self._async_client: Optional[aioredis.Redis] = None
        self._sync_client: Optional[redis.Redis] = None
        self._in_memory_cache: Dict[str, Any] = {}
        self._cache_lock = Lock()
        self._initialized = True
        logger.info(f"RedisCacheService initialized with URL: {self._redis_url}")
    
    # ==================== KEY HELPERS ====================
    
    def _tenant_key(self, tenant_id: str, *parts: str) -> str:
        """Build a tenant-scoped cache key: {tenant_id}:part1:part2:..."""
        if not tenant_id:
            raise ValueError("tenant_id is required for cache operations")
        return f"{tenant_id}:{':'.join(parts)}"
    
    def _global_key(self, *parts: str) -> str:
        """Build a global cache key: global:part1:part2:..."""
        return f"{self.PREFIX_GLOBAL}:{':'.join(parts)}"
    
    async def _get_async_client(self) -> aioredis.Redis:
        """Get or create async Redis client"""
        if self._async_client is None:
            try:
                self._async_client = await aioredis.from_url(
                    self._redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_keepalive=True,
                    health_check_interval=30
                )
                logger.info("Async Redis client connected")
            except Exception as e:
                logger.warning(f"Failed to connect async Redis: {e}, using in-memory fallback")
                raise
        return self._async_client
    
    def _get_sync_client(self) -> redis.Redis:
        """Get or create sync Redis client for non-async contexts"""
        if self._sync_client is None:
            try:
                self._sync_client = redis.from_url(
                    self._redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=5
                )
                self._sync_client.ping()
                logger.info("Sync Redis client connected")
            except Exception as e:
                logger.warning(f"Failed to connect sync Redis: {e}, using in-memory fallback")
                raise
        return self._sync_client
    
    def _serialize(self, data: Any) -> str:
        """Serialize data for Redis storage"""
        if isinstance(data, datetime):
            return json.dumps(data.isoformat())
        return json.dumps(data, default=str)
    
    def _deserialize(self, data: str) -> Any:
        """Deserialize data from Redis"""
        if not data:
            return None
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return data
    
    # ==================== ASYNC METHODS ====================
    
    async def get_async(self, key: str) -> Optional[Any]:
        """Get value from cache (async)"""
        try:
            client = await self._get_async_client()
            data = await client.get(key)
            if data:
                logger.debug(f"Cache HIT: {key}")
                return self._deserialize(data)
            logger.debug(f"Cache MISS: {key}")
            return None
        except Exception as e:
            logger.warning(f"Redis get error for {key}: {e}")
            # Fallback to in-memory
            return self._in_memory_cache.get(key)
    
    async def set_async(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache (async)"""
        ttl = ttl or self.TTL_DEFAULT
        try:
            client = await self._get_async_client()
            serialized = self._serialize(value)
            await client.setex(key, ttl, serialized)
            logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.warning(f"Redis set error for {key}: {e}")
            # Fallback to in-memory
            with self._cache_lock:
                self._in_memory_cache[key] = value
            return False
    
    async def delete_async(self, key: str) -> bool:
        """Delete key from cache (async)"""
        try:
            client = await self._get_async_client()
            await client.delete(key)
            logger.debug(f"Cache DELETE: {key}")
            return True
        except Exception as e:
            logger.warning(f"Redis delete error for {key}: {e}")
            with self._cache_lock:
                self._in_memory_cache.pop(key, None)
            return False
    
    async def delete_pattern_async(self, pattern: str) -> int:
        """Delete all keys matching pattern (async)"""
        try:
            client = await self._get_async_client()
            keys = []
            async for key in client.scan_iter(match=pattern):
                keys.append(key)
            if keys:
                await client.delete(*keys)
                logger.info(f"Cache DELETE pattern '{pattern}': {len(keys)} keys")
            return len(keys)
        except Exception as e:
            logger.warning(f"Redis delete pattern error for {pattern}: {e}")
            return 0
    
    async def mget_async(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple values (async)"""
        if not keys:
            return {}
        try:
            client = await self._get_async_client()
            values = await client.mget(keys)
            result = {}
            for key, value in zip(keys, values):
                if value:
                    result[key] = self._deserialize(value)
            logger.debug(f"Cache MGET: {len(result)}/{len(keys)} hits")
            return result
        except Exception as e:
            logger.warning(f"Redis mget error: {e}")
            return {k: self._in_memory_cache.get(k) for k in keys if k in self._in_memory_cache}
    
    async def mset_async(self, data: Dict[str, Any], ttl: int = None) -> bool:
        """Set multiple values (async)"""
        if not data:
            return True
        ttl = ttl or self.TTL_DEFAULT
        try:
            client = await self._get_async_client()
            pipe = client.pipeline()
            for key, value in data.items():
                serialized = self._serialize(value)
                pipe.setex(key, ttl, serialized)
            await pipe.execute()
            logger.debug(f"Cache MSET: {len(data)} keys (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.warning(f"Redis mset error: {e}")
            with self._cache_lock:
                self._in_memory_cache.update(data)
            return False
    
    # ==================== SYNC METHODS ====================
    
    def get_sync(self, key: str) -> Optional[Any]:
        """Get value from cache (sync)"""
        try:
            client = self._get_sync_client()
            data = client.get(key)
            if data:
                logger.debug(f"Cache HIT (sync): {key}")
                return self._deserialize(data)
            logger.debug(f"Cache MISS (sync): {key}")
            return None
        except Exception as e:
            logger.warning(f"Redis sync get error for {key}: {e}")
            return self._in_memory_cache.get(key)
    
    def set_sync(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache (sync)"""
        ttl = ttl or self.TTL_DEFAULT
        try:
            client = self._get_sync_client()
            serialized = self._serialize(value)
            client.setex(key, ttl, serialized)
            logger.debug(f"Cache SET (sync): {key} (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.warning(f"Redis sync set error for {key}: {e}")
            with self._cache_lock:
                self._in_memory_cache[key] = value
            return False
    
    def delete_sync(self, key: str) -> bool:
        """Delete key from cache (sync)"""
        try:
            client = self._get_sync_client()
            client.delete(key)
            logger.debug(f"Cache DELETE (sync): {key}")
            return True
        except Exception as e:
            logger.warning(f"Redis sync delete error for {key}: {e}")
            with self._cache_lock:
                self._in_memory_cache.pop(key, None)
            return False
    
    # ==================== PROJECT CACHING ====================
    
    async def get_project_by_code(self, tenant_id: str, project_code: str) -> Optional[Dict]:
        """Get project by code from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_PROJECT, "code", project_code)
        return await self.get_async(key)
    
    async def set_project_by_code(self, tenant_id: str, project_code: str, project_data: Dict) -> bool:
        """Cache project by code"""
        key = self._tenant_key(tenant_id, self.PREFIX_PROJECT, "code", project_code)
        return await self.set_async(key, project_data, self.TTL_PROJECT)
    
    async def get_all_projects(self, tenant_id: str) -> Optional[List[Dict]]:
        """Get all active projects from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_PROJECT, "all", "active")
        return await self.get_async(key)
    
    async def set_all_projects(self, tenant_id: str, projects: List[Dict]) -> bool:
        """Cache all active projects"""
        key = self._tenant_key(tenant_id, self.PREFIX_PROJECT, "all", "active")
        return await self.set_async(key, projects, self.TTL_PROJECT)
    
    async def get_project_name_map(self, tenant_id: str) -> Optional[Dict[str, str]]:
        """Get project_code -> project_name mapping from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_PROJECT, "name_map")
        return await self.get_async(key)
    
    async def set_project_name_map(self, tenant_id: str, name_map: Dict[str, str]) -> bool:
        """Cache project_code -> project_name mapping"""
        key = self._tenant_key(tenant_id, self.PREFIX_PROJECT, "name_map")
        return await self.set_async(key, name_map, self.TTL_PROJECT)
    
    async def invalidate_projects(self, tenant_id: str) -> int:
        """Invalidate all project cache entries for a tenant"""
        pattern = f"{tenant_id}:{self.PREFIX_PROJECT}:*"
        return await self.delete_pattern_async(pattern)
    
    # ==================== EMPLOYEE/USER CACHING ====================
    
    async def get_employee_by_id(self, tenant_id: str, employee_id: str) -> Optional[Dict]:
        """Get employee by ID from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "id", employee_id)
        return await self.get_async(key)
    
    async def set_employee_by_id(self, tenant_id: str, employee_id: str, employee_data: Dict) -> bool:
        """Cache employee by ID"""
        key = self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "id", employee_id)
        return await self.set_async(key, employee_data, self.TTL_EMPLOYEE)
    
    async def get_employee_by_code(self, tenant_id: str, employee_code: str) -> Optional[Dict]:
        """Get employee by employee code from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "code", employee_code)
        return await self.get_async(key)
    
    async def set_employee_by_code(self, tenant_id: str, employee_code: str, employee_data: Dict) -> bool:
        """Cache employee by code"""
        key = self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "code", employee_code)
        return await self.set_async(key, employee_data, self.TTL_EMPLOYEE)
    
    async def get_employee_by_email(self, tenant_id: str, email: str) -> Optional[Dict]:
        """Get employee by email from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "email", email.lower())
        return await self.get_async(key)
    
    async def set_employee_by_email(self, tenant_id: str, email: str, employee_data: Dict) -> bool:
        """Cache employee by email"""
        key = self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "email", email.lower())
        return await self.set_async(key, employee_data, self.TTL_EMPLOYEE)
    
    async def invalidate_employee(self, tenant_id: str, employee_id: str = None, employee_code: str = None, email: str = None) -> int:
        """Invalidate specific employee cache entries"""
        deleted = 0
        if employee_id:
            await self.delete_async(self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "id", employee_id))
            deleted += 1
        if employee_code:
            await self.delete_async(self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "code", employee_code))
            deleted += 1
        if email:
            await self.delete_async(self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "email", email.lower()))
            deleted += 1
        return deleted
    
    async def invalidate_all_employees(self, tenant_id: str) -> int:
        """Invalidate all employee cache entries for a tenant"""
        pattern = f"{tenant_id}:{self.PREFIX_EMPLOYEE}:*"
        return await self.delete_pattern_async(pattern)
    
    # ==================== POLICY CACHING ====================
    
    async def get_active_policies(self, tenant_id: str, region: str = None) -> Optional[List[Dict]]:
        """Get active policies from cache"""
        region_key = region.upper() if region else "GLOBAL"
        key = self._tenant_key(tenant_id, self.PREFIX_POLICY, "active", region_key)
        return await self.get_async(key)
    
    async def set_active_policies(self, tenant_id: str, policies: List[Dict], region: str = None) -> bool:
        """Cache active policies"""
        region_key = region.upper() if region else "GLOBAL"
        key = self._tenant_key(tenant_id, self.PREFIX_POLICY, "active", region_key)
        return await self.set_async(key, policies, self.TTL_POLICY)
    
    async def get_policy_by_id(self, tenant_id: str, policy_id: str) -> Optional[Dict]:
        """Get policy by ID from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_POLICY, "id", policy_id)
        return await self.get_async(key)
    
    async def set_policy_by_id(self, tenant_id: str, policy_id: str, policy_data: Dict) -> bool:
        """Cache policy by ID"""
        key = self._tenant_key(tenant_id, self.PREFIX_POLICY, "id", policy_id)
        return await self.set_async(key, policy_data, self.TTL_POLICY)
    
    async def invalidate_policies(self, tenant_id: str, region: str = None) -> int:
        """Invalidate policy cache entries for a tenant"""
        if region:
            pattern = f"{tenant_id}:{self.PREFIX_POLICY}:*:{region.upper()}*"
        else:
            pattern = f"{tenant_id}:{self.PREFIX_POLICY}:*"
        return await self.delete_pattern_async(pattern)
    
    # ==================== CATEGORY CACHING ====================
    
    async def get_category_by_code(self, tenant_id: str, category_code: str, region: str = None) -> Optional[Dict]:
        """Get category by code from cache"""
        region_key = region.upper() if region else "GLOBAL"
        key = self._tenant_key(tenant_id, self.PREFIX_CATEGORY, "code", category_code, region_key)
        return await self.get_async(key)
    
    async def set_category_by_code(self, tenant_id: str, category_code: str, category_data: Dict, region: str = None) -> bool:
        """Cache category by code"""
        region_key = region.upper() if region else "GLOBAL"
        key = self._tenant_key(tenant_id, self.PREFIX_CATEGORY, "code", category_code, region_key)
        return await self.set_async(key, category_data, self.TTL_CATEGORY)
    
    async def get_all_categories(self, tenant_id: str, region: str = None, category_type: str = None) -> Optional[List[Dict]]:
        """Get all categories from cache"""
        region_key = region.upper() if region else "GLOBAL"
        type_key = category_type.upper() if category_type else "ALL"
        key = self._tenant_key(tenant_id, self.PREFIX_CATEGORY, "all", region_key, type_key)
        return await self.get_async(key)
    
    async def set_all_categories(self, tenant_id: str, categories: List[Dict], region: str = None, category_type: str = None) -> bool:
        """Cache all categories"""
        region_key = region.upper() if region else "GLOBAL"
        type_key = category_type.upper() if category_type else "ALL"
        key = self._tenant_key(tenant_id, self.PREFIX_CATEGORY, "all", region_key, type_key)
        return await self.set_async(key, categories, self.TTL_CATEGORY)
    
    async def get_category_name_map(self, tenant_id: str, region: str = None) -> Optional[Dict[str, str]]:
        """Get category_code -> category_name mapping from cache"""
        region_key = region.upper() if region else "GLOBAL"
        key = self._tenant_key(tenant_id, self.PREFIX_CATEGORY, "name_map", region_key)
        return await self.get_async(key)
    
    async def set_category_name_map(self, tenant_id: str, name_map: Dict[str, str], region: str = None) -> bool:
        """Cache category_code -> category_name mapping"""
        region_key = region.upper() if region else "GLOBAL"
        key = self._tenant_key(tenant_id, self.PREFIX_CATEGORY, "name_map", region_key)
        return await self.set_async(key, name_map, self.TTL_CATEGORY)
    
    async def invalidate_categories(self, tenant_id: str, region: str = None) -> int:
        """Invalidate category cache entries for a tenant"""
        if region:
            pattern = f"{tenant_id}:{self.PREFIX_CATEGORY}:*:{region.upper()}*"
        else:
            pattern = f"{tenant_id}:{self.PREFIX_CATEGORY}:*"
        return await self.delete_pattern_async(pattern)
    
    # ==================== SETTINGS CACHING ====================
    
    async def get_setting(self, tenant_id: str, setting_key: str) -> Optional[Any]:
        """Get tenant-specific setting from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_SETTINGS, setting_key)
        return await self.get_async(key)
    
    async def set_setting(self, tenant_id: str, setting_key: str, value: Any) -> bool:
        """Cache tenant-specific setting"""
        key = self._tenant_key(tenant_id, self.PREFIX_SETTINGS, setting_key)
        return await self.set_async(key, value, self.TTL_SETTINGS)
    
    async def get_all_settings(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get all tenant-specific settings from cache"""
        key = self._tenant_key(tenant_id, self.PREFIX_SETTINGS, "all")
        return await self.get_async(key)
    
    async def set_all_settings(self, tenant_id: str, settings_dict: Dict[str, Any]) -> bool:
        """Cache all tenant-specific settings"""
        key = self._tenant_key(tenant_id, self.PREFIX_SETTINGS, "all")
        return await self.set_async(key, settings_dict, self.TTL_SETTINGS)
    
    async def invalidate_settings(self, tenant_id: str, setting_key: str = None) -> int:
        """Invalidate tenant-specific settings cache"""
        if setting_key:
            await self.delete_async(self._tenant_key(tenant_id, self.PREFIX_SETTINGS, setting_key))
            await self.delete_async(self._tenant_key(tenant_id, self.PREFIX_SETTINGS, "all"))
            return 2
        pattern = f"{tenant_id}:{self.PREFIX_SETTINGS}:*"
        return await self.delete_pattern_async(pattern)
    
    # ==================== GLOBAL SETTINGS (Non-tenant specific) ====================
    
    async def get_global_setting(self, setting_key: str) -> Optional[Any]:
        """Get global setting from cache (non-tenant specific)"""
        key = self._global_key(self.PREFIX_SETTINGS, setting_key)
        return await self.get_async(key)
    
    async def set_global_setting(self, setting_key: str, value: Any) -> bool:
        """Cache global setting (non-tenant specific)"""
        key = self._global_key(self.PREFIX_SETTINGS, setting_key)
        return await self.set_async(key, value, self.TTL_SETTINGS)
    
    async def invalidate_global_settings(self) -> int:
        """Invalidate all global settings cache"""
        pattern = f"{self.PREFIX_GLOBAL}:{self.PREFIX_SETTINGS}:*"
        return await self.delete_pattern_async(pattern)
    
    # ==================== BATCH OPERATIONS ====================
    
    async def get_projects_by_codes(self, tenant_id: str, project_codes: List[str]) -> Dict[str, Dict]:
        """Get multiple projects by codes"""
        if not project_codes:
            return {}
        keys = [self._tenant_key(tenant_id, self.PREFIX_PROJECT, "code", code) for code in project_codes]
        cached = await self.mget_async(keys)
        return {code: cached.get(self._tenant_key(tenant_id, self.PREFIX_PROJECT, "code", code)) 
                for code in project_codes 
                if self._tenant_key(tenant_id, self.PREFIX_PROJECT, "code", code) in cached}
    
    async def set_projects_by_codes(self, tenant_id: str, projects: Dict[str, Dict]) -> bool:
        """Cache multiple projects by codes"""
        if not projects:
            return True
        data = {self._tenant_key(tenant_id, self.PREFIX_PROJECT, "code", code): proj for code, proj in projects.items()}
        return await self.mset_async(data, self.TTL_PROJECT)
    
    async def get_employees_by_ids(self, tenant_id: str, employee_ids: List[str]) -> Dict[str, Dict]:
        """Get multiple employees by IDs"""
        if not employee_ids:
            return {}
        keys = [self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "id", eid) for eid in employee_ids]
        cached = await self.mget_async(keys)
        return {eid: cached.get(self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "id", eid)) 
                for eid in employee_ids 
                if self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "id", eid) in cached}
    
    async def set_employees_by_ids(self, tenant_id: str, employees: Dict[str, Dict]) -> bool:
        """Cache multiple employees by IDs"""
        if not employees:
            return True
        data = {self._tenant_key(tenant_id, self.PREFIX_EMPLOYEE, "id", eid): emp for eid, emp in employees.items()}
        return await self.mset_async(data, self.TTL_EMPLOYEE)
    
    # ==================== HEALTH & STATS ====================
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Redis connection health"""
        try:
            client = await self._get_async_client()
            await client.ping()
            info = await client.info("memory")
            return {
                "status": "healthy",
                "connected": True,
                "memory_used": info.get("used_memory_human", "unknown"),
                "in_memory_fallback_size": len(self._in_memory_cache)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e),
                "in_memory_fallback_size": len(self._in_memory_cache)
            }
    
    async def clear_tenant_cache(self, tenant_id: str) -> int:
        """Clear all cached data for a specific tenant"""
        try:
            pattern = f"{tenant_id}:*"
            deleted = await self.delete_pattern_async(pattern)
            logger.warning(f"Cleared cache for tenant {tenant_id}: {deleted} keys deleted")
            return deleted
        except Exception as e:
            logger.error(f"Failed to clear tenant cache for {tenant_id}: {e}")
            return 0
    
    async def get_tenant_cache_stats(self, tenant_id: str) -> Dict[str, int]:
        """Get cache statistics for a specific tenant"""
        try:
            client = await self._get_async_client()
            stats = {
                "projects": 0,
                "employees": 0,
                "policies": 0,
                "categories": 0,
                "settings": 0,
                "total": 0
            }
            
            prefixes = [
                (self.PREFIX_PROJECT, "projects"),
                (self.PREFIX_EMPLOYEE, "employees"),
                (self.PREFIX_POLICY, "policies"),
                (self.PREFIX_CATEGORY, "categories"),
                (self.PREFIX_SETTINGS, "settings"),
            ]
            
            for prefix, stat_key in prefixes:
                pattern = f"{tenant_id}:{prefix}:*"
                count = 0
                async for _ in client.scan_iter(match=pattern):
                    count += 1
                stats[stat_key] = count
                stats["total"] += count
            
            return stats
        except Exception as e:
            logger.error(f"Failed to get tenant cache stats: {e}")
            return {"error": str(e)}
    
    async def clear_all(self) -> bool:
        """Clear all cached data (use with caution!)"""
        try:
            client = await self._get_async_client()
            await client.flushdb()
            with self._cache_lock:
                self._in_memory_cache.clear()
            logger.warning("All cache data cleared!")
            return True
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False


# Global singleton instance
redis_cache = RedisCacheService()
