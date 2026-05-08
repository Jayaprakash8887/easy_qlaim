"""
Cache Management API endpoints.
Provides health checks and cache management operations.

Multi-Tenant Support:
All cache operations are scoped by tenant_id for proper data isolation.
Cache keys follow the pattern: {tenant_id}:{entity}:{identifier}
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional, List, Union
from uuid import UUID
import logging

from services.redis_cache import redis_cache
from services.category_cache import category_cache
from api.v1.auth import get_current_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter()


def normalize_region(region: Union[str, List[str]]) -> List[str]:
    """
    Normalize region parameter to handle various input formats.
    
    The user's region in the database is stored as an array (e.g., ['IND']),
    but the API receives it as a string. This function handles:
    - List input: ["IND", "USA"] -> ["IND", "USA"] (pass through)
    - Comma-separated strings: "IND,USA" -> ["IND", "USA"]
    - Array-like strings: "['IND']" -> ["IND"]
    - Simple strings: "IND" -> ["IND"]
    - Empty/None: -> ["IND"] (default)
    
    Returns a list of normalized region codes.
    """
    # If already a list, normalize each element and return
    if isinstance(region, list):
        normalized = [r.strip().upper() for r in region if r and r.strip()]
        return normalized if normalized else ["IND"]
    
    if not region or not region.strip():
        return ["IND"]
    
    region = region.strip()
    
    # Handle array-like strings: "['IND']" or '["IND"]' or "{IND}"
    if region.startswith(('[', '{')) and region.endswith((']', '}')):
        # Remove brackets and quotes
        cleaned = region.strip('[]{}').replace('"', '').replace("'", "")
        # Split by comma and clean each element
        regions = [r.strip().upper() for r in cleaned.split(',') if r.strip()]
        return regions if regions else ["IND"]
    
    # Handle comma-separated: "IND,USA"
    if ',' in region:
        regions = [r.strip().upper() for r in region.split(',') if r.strip()]
        return regions if regions else ["IND"]
    
    return [region.upper()] if region else ["IND"]


@router.get("/health")
async def cache_health_check() -> Dict[str, Any]:
    """
    Check Redis cache health and return statistics.
    
    Returns:
        Cache health status and memory usage
    """
    return await redis_cache.health_check()


@router.get("/stats")
async def cache_stats(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get cache statistics including hit/miss rates.
    Scoped to the current tenant.
    
    Returns:
        Cache statistics and key counts
    """
    try:
        tenant_id = str(current_user.tenant_id)
        client = await redis_cache._get_async_client()
        
        # Get key counts by prefix (scoped to tenant)
        stats = {
            "projects": 0,
            "employees": 0,
            "policies": 0,
            "categories": 0,
            "settings": 0,
        }
        
        for prefix in ["project", "employee", "policy", "category", "settings"]:
            count = 0
            async for _ in client.scan_iter(match=f"{tenant_id}:{prefix}:*"):
                count += 1
            stats[f"{prefix}s" if not prefix.endswith("s") else prefix] = count
        
        # Get memory info
        info = await client.info("memory")
        
        return {
            "status": "healthy",
            "tenant_id": tenant_id,
            "key_counts": stats,
            "memory": {
                "used": info.get("used_memory_human", "unknown"),
                "peak": info.get("used_memory_peak_human", "unknown"),
                "fragmentation_ratio": info.get("mem_fragmentation_ratio", 0),
            },
            "category_cache": {
                "regions_cached": len(category_cache._cache),
            }
        }
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        return {
            "status": "error",
            "error": str(e),
            "category_cache": {
                "regions_cached": len(category_cache._cache),
            }
        }


@router.post("/invalidate/projects")
async def invalidate_project_cache(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Invalidate all project cache entries for current tenant"""
    tenant_id = str(current_user.tenant_id)
    count = await redis_cache.invalidate_projects(tenant_id)
    return {"status": "success", "tenant_id": tenant_id, "keys_deleted": count}


@router.post("/invalidate/employees")
async def invalidate_employee_cache(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Invalidate all employee cache entries for current tenant"""
    tenant_id = str(current_user.tenant_id)
    count = await redis_cache.delete_pattern_async(f"{tenant_id}:employee:*")
    return {"status": "success", "tenant_id": tenant_id, "keys_deleted": count}


@router.post("/invalidate/policies")
async def invalidate_policy_cache(
    region: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Invalidate policy and category cache entries for current tenant"""
    tenant_id = str(current_user.tenant_id)
    policy_count = await redis_cache.invalidate_policies(tenant_id, region)
    category_count = await redis_cache.invalidate_categories(tenant_id, region)
    category_cache.clear_cache(region)
    return {
        "status": "success",
        "tenant_id": tenant_id,
        "policy_keys_deleted": policy_count,
        "category_keys_deleted": category_count,
        "in_memory_cache_cleared": True
    }


@router.post("/invalidate/categories")
async def invalidate_category_cache(
    region: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Invalidate category cache entries for current tenant"""
    tenant_id = str(current_user.tenant_id)
    count = await redis_cache.invalidate_categories(tenant_id, region)
    category_cache.clear_cache(region)
    return {
        "status": "success",
        "tenant_id": tenant_id,
        "redis_keys_deleted": count,
        "in_memory_cache_cleared": True
    }


@router.post("/invalidate/settings")
async def invalidate_settings_cache(
    setting_key: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Invalidate settings cache entries for current tenant"""
    tenant_id = str(current_user.tenant_id)
    count = await redis_cache.invalidate_settings(tenant_id, setting_key)
    return {"status": "success", "tenant_id": tenant_id, "keys_deleted": count}


@router.post("/invalidate/all")
async def invalidate_all_cache(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Invalidate ALL cache entries for current tenant.
    Use with caution - this will cause a spike in database queries.
    """
    tenant_id = str(current_user.tenant_id)
    success = await redis_cache.clear_tenant_cache(tenant_id)
    category_cache.clear_cache()
    return {
        "status": "success" if success else "partial",
        "tenant_id": tenant_id,
        "message": "All tenant cache entries cleared" if success else "Redis clear failed, in-memory cleared"
    }


@router.post("/warmup/projects")
async def warmup_project_cache(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Pre-warm the project cache by loading all active projects.
    Useful after cache invalidation or server restart.
    """
    from database import get_async_db
    from services.cached_data import cached_data
    
    tenant_id = current_user.tenant_id
    
    async for db in get_async_db():
        projects = await cached_data.get_all_active_projects(db, tenant_id)
        name_map = await cached_data.get_project_name_map(db, tenant_id)
        return {
            "status": "success",
            "tenant_id": str(tenant_id),
            "projects_cached": len(projects),
            "name_mappings_cached": len(name_map)
        }


@router.post("/warmup/categories")
async def warmup_category_cache(
    region: str = "IND",
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Pre-warm the category cache for a specific region.
    """
    from database import get_async_db
    from services.cached_data import cached_data
    
    # Normalize region to handle array-like strings - returns List[str]
    normalized_regions = normalize_region(region)
    tenant_id = current_user.tenant_id
    
    # Warm cache for all regions in the list
    total_categories = 0
    total_mappings = 0
    
    async for db in get_async_db():
        for reg in normalized_regions:
            categories = await cached_data.get_all_categories(db, tenant_id, reg)
            name_map = await cached_data.get_category_name_map(db, tenant_id, reg)
            total_categories += len(categories)
            total_mappings += len(name_map)
        
        return {
            "status": "success",
            "tenant_id": str(tenant_id),
            "regions": normalized_regions,
            "categories_cached": total_categories,
            "name_mappings_cached": total_mappings
        }
