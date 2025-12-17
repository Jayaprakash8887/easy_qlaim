"""
Cache Management API endpoints.
Provides health checks and cache management operations.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
import logging

from services.redis_cache import redis_cache
from services.category_cache import category_cache

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def cache_health_check() -> Dict[str, Any]:
    """
    Check Redis cache health and return statistics.
    
    Returns:
        Cache health status and memory usage
    """
    return await redis_cache.health_check()


@router.get("/stats")
async def cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics including hit/miss rates.
    
    Returns:
        Cache statistics and key counts
    """
    try:
        client = await redis_cache._get_async_client()
        
        # Get key counts by prefix
        stats = {
            "projects": 0,
            "employees": 0,
            "policies": 0,
            "categories": 0,
            "settings": 0,
        }
        
        for prefix in ["project", "employee", "policy", "category", "settings"]:
            count = 0
            async for _ in client.scan_iter(match=f"{prefix}:*"):
                count += 1
            stats[f"{prefix}s" if not prefix.endswith("s") else prefix] = count
        
        # Get memory info
        info = await client.info("memory")
        
        return {
            "status": "healthy",
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
async def invalidate_project_cache() -> Dict[str, Any]:
    """Invalidate all project cache entries"""
    count = await redis_cache.invalidate_projects()
    return {"status": "success", "keys_deleted": count}


@router.post("/invalidate/employees")
async def invalidate_employee_cache() -> Dict[str, Any]:
    """Invalidate all employee cache entries"""
    count = await redis_cache.delete_pattern_async("employee:*")
    return {"status": "success", "keys_deleted": count}


@router.post("/invalidate/policies")
async def invalidate_policy_cache(region: Optional[str] = None) -> Dict[str, Any]:
    """Invalidate policy and category cache entries"""
    policy_count = await redis_cache.invalidate_policies(region)
    category_count = await redis_cache.invalidate_categories(region)
    category_cache.clear_cache(region)
    return {
        "status": "success",
        "policy_keys_deleted": policy_count,
        "category_keys_deleted": category_count,
        "in_memory_cache_cleared": True
    }


@router.post("/invalidate/categories")
async def invalidate_category_cache(region: Optional[str] = None) -> Dict[str, Any]:
    """Invalidate category cache entries"""
    count = await redis_cache.invalidate_categories(region)
    category_cache.clear_cache(region)
    return {
        "status": "success",
        "redis_keys_deleted": count,
        "in_memory_cache_cleared": True
    }


@router.post("/invalidate/settings")
async def invalidate_settings_cache(setting_key: Optional[str] = None) -> Dict[str, Any]:
    """Invalidate settings cache entries"""
    count = await redis_cache.invalidate_settings(setting_key)
    return {"status": "success", "keys_deleted": count}


@router.post("/invalidate/all")
async def invalidate_all_cache() -> Dict[str, Any]:
    """
    Invalidate ALL cache entries.
    Use with caution - this will cause a spike in database queries.
    """
    success = await redis_cache.clear_all()
    category_cache.clear_cache()
    return {
        "status": "success" if success else "partial",
        "message": "All cache entries cleared" if success else "Redis clear failed, in-memory cleared"
    }


@router.post("/warmup/projects")
async def warmup_project_cache() -> Dict[str, Any]:
    """
    Pre-warm the project cache by loading all active projects.
    Useful after cache invalidation or server restart.
    """
    from database import get_async_db
    from services.cached_data import cached_data
    
    async for db in get_async_db():
        projects = await cached_data.get_all_active_projects(db)
        name_map = await cached_data.get_project_name_map(db)
        return {
            "status": "success",
            "projects_cached": len(projects),
            "name_mappings_cached": len(name_map)
        }


@router.post("/warmup/categories")
async def warmup_category_cache(region: str = "INDIA") -> Dict[str, Any]:
    """
    Pre-warm the category cache for a specific region.
    """
    from database import get_async_db
    from services.cached_data import cached_data
    
    async for db in get_async_db():
        categories = await cached_data.get_all_categories(db, region)
        name_map = await cached_data.get_category_name_map(db, region)
        return {
            "status": "success",
            "region": region,
            "categories_cached": len(categories),
            "name_mappings_cached": len(name_map)
        }
