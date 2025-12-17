"""
Category Cache Service - Caches reimbursement categories by region
for cost-effective LLM category matching.

This service provides:
1. In-memory caching of categories by region (TTL: 1 day)
2. Category validation against cached data
3. Category formatting for LLM prompts

Cost-saving approaches:
- Local cache avoids DB queries for every request
- Formatted category list for LLM is pre-built
- Category validation happens locally without LLM calls
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from threading import Lock
from uuid import UUID

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class CachedCategory:
    """Cached category data"""
    code: str
    name: str
    category_type: str  # REIMBURSEMENT or ALLOWANCE
    max_amount: Optional[float]
    description: Optional[str]
    keywords: List[str]  # Keywords for matching


@dataclass
class RegionCache:
    """Cache entry for a region"""
    region: str
    categories: List[CachedCategory]
    reimbursement_categories: List[CachedCategory]
    allowance_categories: List[CachedCategory]
    llm_prompt_text: str  # Pre-formatted text for LLM
    cached_at: datetime
    expires_at: datetime


class CategoryCacheService:
    """
    Service for caching and managing reimbursement categories by region.
    
    Features:
    - In-memory caching with 24-hour TTL
    - Thread-safe access
    - Pre-computed LLM prompt text
    - Fast local category validation
    """
    
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        """Singleton pattern for global cache"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._cache: Dict[str, RegionCache] = {}
        self._cache_ttl = timedelta(hours=24)  # 1 day cache
        self._cache_lock = Lock()
        self._initialized = True
        logger.info("CategoryCacheService initialized with 24-hour TTL")
    
    def clear_cache(self, region: str = None):
        """
        Clear the in-memory category cache.
        
        Args:
            region: Optional specific region to clear. If None, clears all regions.
        """
        with self._cache_lock:
            if region:
                region_upper = region.upper()
                if region_upper in self._cache:
                    del self._cache[region_upper]
                    logger.info(f"Category cache cleared for region: {region_upper}")
            else:
                self._cache.clear()
                logger.info("Category cache cleared for all regions")
    
    def get_categories_for_region(
        self,
        region: str,
        category_type: Optional[str] = None
    ) -> List[CachedCategory]:
        """
        Get cached categories for a region.
        
        Args:
            region: Employee's region (e.g., 'INDIA', 'US')
            category_type: Optional filter - 'REIMBURSEMENT' or 'ALLOWANCE'
            
        Returns:
            List of cached categories
        """
        region_upper = region.upper() if region else "GLOBAL"
        
        # Check cache
        cache_entry = self._get_cache_entry(region_upper)
        
        if not cache_entry:
            # Load from database
            cache_entry = self._load_categories_from_db(region_upper)
        
        if not cache_entry:
            return []
        
        # Filter by type if specified
        if category_type == "REIMBURSEMENT":
            return cache_entry.reimbursement_categories
        elif category_type == "ALLOWANCE":
            return cache_entry.allowance_categories
        
        return cache_entry.categories
    
    def get_reimbursement_categories_for_region(
        self,
        region: str
    ) -> List[CachedCategory]:
        """Get only reimbursement categories for a region"""
        return self.get_categories_for_region(region, "REIMBURSEMENT")
    
    def get_llm_prompt_categories(self, region: str) -> str:
        """
        Get pre-formatted category list for LLM prompt.
        
        This is optimized to minimize token usage while providing
        enough context for accurate category matching.
        
        Args:
            region: Employee's region
            
        Returns:
            Formatted string for LLM prompt
        """
        region_upper = region.upper() if region else "GLOBAL"
        
        cache_entry = self._get_cache_entry(region_upper)
        if not cache_entry:
            cache_entry = self._load_categories_from_db(region_upper)
        
        if cache_entry:
            return cache_entry.llm_prompt_text
        
        # Fallback if no categories found
        return self._get_default_categories_prompt()
    
    def validate_category(
        self,
        category: str,
        region: str,
        category_type: str = "REIMBURSEMENT"
    ) -> tuple[str, bool]:
        """
        Validate and normalize a category code.
        
        Args:
            category: Category code/name from LLM
            region: Employee's region
            category_type: 'REIMBURSEMENT' or 'ALLOWANCE'
            
        Returns:
            Tuple of (validated_category, is_valid)
            If invalid, returns ('other', False)
        """
        if not category:
            return ('other', False)
        
        categories = self.get_categories_for_region(region, category_type)
        
        if not categories:
            # No categories found - accept any
            return (category.lower(), True)
        
        category_lower = category.lower().strip()
        
        # Check exact match on code or name
        for cat in categories:
            if cat.code.lower() == category_lower or cat.name.lower() == category_lower:
                return (cat.code.lower(), True)
        
        # Check partial match on keywords
        for cat in categories:
            for keyword in cat.keywords:
                if keyword.lower() in category_lower or category_lower in keyword.lower():
                    return (cat.code.lower(), True)
        
        # No match found
        logger.info(f"Category '{category}' not found in region '{region}' - defaulting to 'other'")
        return ('other', False)
    
    def get_category_name_by_code(self, category_code: str, region: Optional[str] = None) -> str:
        """
        Get human-readable category name from category code.
        Searches through all cached regions if region not specified.
        
        Args:
            category_code: The category code (e.g., 'TRAVEL_WB', 'cc-2025-0001')
            region: Optional region to search in
            
        Returns:
            Human-readable category name or formatted fallback
        """
        if not category_code:
            return "Other"
        
        code_lower = category_code.lower().strip()
        
        # Search in specific region or all regions
        regions_to_search = [region.upper()] if region else list(self._cache.keys())
        
        # If no cached regions and no region specified, try GLOBAL
        if not regions_to_search:
            regions_to_search = ["GLOBAL", "INDIA"]
        
        for reg in regions_to_search:
            cache_entry = self._get_cache_entry(reg)
            if not cache_entry:
                # Try to load from DB
                cache_entry = self._load_categories_from_db(reg)
            
            if cache_entry:
                for cat in cache_entry.categories:
                    if cat.code.lower() == code_lower:
                        return cat.name
        
        # Direct DB lookup as last resort for custom claims
        try:
            from database import get_sync_db
            from models import PolicyCategory, CustomClaim
            from sqlalchemy.orm import Session
            
            db: Session = next(get_sync_db())
            
            # Try CustomClaim first (for codes like CC-2025-0001)
            custom_claim = db.query(CustomClaim).filter(
                CustomClaim.claim_code.ilike(category_code)
            ).first()
            if custom_claim:
                return custom_claim.claim_name
            
            # Try PolicyCategory
            policy_cat = db.query(PolicyCategory).filter(
                PolicyCategory.category_code.ilike(category_code)
            ).first()
            if policy_cat:
                return policy_cat.category_name
                
        except Exception as e:
            logger.warning(f"DB lookup failed for category {category_code}: {e}")
        
        # Fallback: format the code nicely
        return self._format_category_code(category_code)
    
    @staticmethod
    def _format_category_code(category_code: str) -> str:
        """Format a category code as a readable name (fallback)"""
        import re
        
        if not category_code:
            return "Other"
        
        # Check for custom claim codes like CC-2025-0001
        if re.match(r'^[Cc]{1,2}-\d{4}-\d{4,}$', category_code, re.IGNORECASE):
            return "Custom Claim"
        
        # Format standard codes
        formatted = category_code.lower()
        formatted = re.sub(r'_wb$', '', formatted, flags=re.IGNORECASE)
        formatted = re.sub(r'_wob$', '', formatted, flags=re.IGNORECASE)
        formatted = re.sub(r'_reimbursement$', '', formatted, flags=re.IGNORECASE)
        formatted = formatted.replace('_', ' ').replace('-', ' ').strip()
        
        # Title case
        return ' '.join(word.capitalize() for word in formatted.split())
    
    def invalidate_cache(self, region: Optional[str] = None):
        """
        Invalidate cache for a region or all regions.
        
        Call this when policies are updated.
        """
        with self._cache_lock:
            if region:
                region_upper = region.upper()
                if region_upper in self._cache:
                    del self._cache[region_upper]
                    logger.info(f"Invalidated cache for region: {region_upper}")
            else:
                self._cache.clear()
                logger.info("Invalidated all category caches")
    
    def _get_cache_entry(self, region: str) -> Optional[RegionCache]:
        """Get cache entry if valid"""
        with self._cache_lock:
            entry = self._cache.get(region)
            if entry and datetime.utcnow() < entry.expires_at:
                return entry
            elif entry:
                # Expired - remove it
                del self._cache[region]
        return None
    
    def _load_categories_from_db(self, region: str) -> Optional[RegionCache]:
        """Load categories from database and cache them (includes PolicyCategory + CustomClaim)"""
        try:
            from database import get_sync_db
            from models import PolicyCategory, PolicyUpload, CustomClaim
            from sqlalchemy.orm import Session
            from sqlalchemy import and_, or_
            
            db: Session = next(get_sync_db())
            
            # Query categories for region or global (from PolicyCategory)
            query = db.query(PolicyCategory, PolicyUpload).join(
                PolicyUpload, PolicyCategory.policy_upload_id == PolicyUpload.id
            ).filter(
                and_(
                    PolicyCategory.tenant_id == UUID(settings.DEFAULT_TENANT_ID),
                    PolicyCategory.is_active == True,
                    PolicyUpload.status == "ACTIVE",
                    or_(
                        PolicyUpload.region == region,
                        PolicyUpload.region == "GLOBAL",
                        PolicyUpload.region.is_(None)
                    )
                )
            ).order_by(PolicyCategory.display_order)
            
            results = query.all()
            
            # Build cached categories
            all_categories = []
            reimbursement_categories = []
            allowance_categories = []
            
            for cat, policy in results:
                # Extract keywords from description and name
                keywords = self._extract_keywords(cat.category_name, cat.description)
                
                cached = CachedCategory(
                    code=cat.category_code or cat.category_name,
                    name=cat.category_name,
                    category_type=cat.category_type,
                    max_amount=float(cat.max_amount) if cat.max_amount else None,
                    description=cat.description,
                    keywords=keywords
                )
                
                all_categories.append(cached)
                
                if cat.category_type == "REIMBURSEMENT":
                    reimbursement_categories.append(cached)
                elif cat.category_type == "ALLOWANCE":
                    allowance_categories.append(cached)
            
            # ============ INCLUDE CUSTOM CLAIMS ============
            # Custom claims are standalone categories not linked to policy documents
            custom_claims_query = db.query(CustomClaim).filter(
                and_(
                    CustomClaim.tenant_id == UUID(settings.DEFAULT_TENANT_ID),
                    CustomClaim.is_active == True,
                    or_(
                        CustomClaim.region == region,
                        CustomClaim.region == "GLOBAL",
                        CustomClaim.region.is_(None)
                    )
                )
            ).order_by(CustomClaim.display_order)
            
            custom_claims = custom_claims_query.all()
            
            for cc in custom_claims:
                # Extract keywords from description and custom fields
                keywords = self._extract_keywords(cc.claim_name, cc.description)
                # Add custom field names as keywords
                if cc.custom_fields:
                    for field_def in cc.custom_fields:
                        if isinstance(field_def, dict):
                            field_name = field_def.get("name") or field_def.get("field_name", "")
                            field_label = field_def.get("label") or field_def.get("field_label", "")
                            if field_name:
                                keywords.append(field_name)
                            if field_label:
                                keywords.append(field_label)
                
                cached = CachedCategory(
                    code=cc.claim_code,
                    name=cc.claim_name,
                    category_type=cc.category_type,
                    max_amount=float(cc.max_amount) if cc.max_amount else None,
                    description=cc.description,
                    keywords=list(set(keywords))
                )
                
                all_categories.append(cached)
                
                if cc.category_type == "REIMBURSEMENT":
                    reimbursement_categories.append(cached)
                elif cc.category_type == "ALLOWANCE":
                    allowance_categories.append(cached)
            
            if not all_categories:
                logger.warning(f"No categories found for region: {region}")
                return None
            
            # Build LLM prompt text
            llm_prompt = self._build_llm_prompt(reimbursement_categories)
            
            # Create cache entry
            now = datetime.utcnow()
            cache_entry = RegionCache(
                region=region,
                categories=all_categories,
                reimbursement_categories=reimbursement_categories,
                allowance_categories=allowance_categories,
                llm_prompt_text=llm_prompt,
                cached_at=now,
                expires_at=now + self._cache_ttl
            )
            
            # Store in cache
            with self._cache_lock:
                self._cache[region] = cache_entry
            
            logger.info(
                f"Cached {len(reimbursement_categories)} reimbursement, "
                f"{len(allowance_categories)} allowance categories for region: {region}"
            )
            
            return cache_entry
            
        except Exception as e:
            logger.error(f"Failed to load categories from DB: {e}")
            return None
    
    def _extract_keywords(self, name: str, description: Optional[str]) -> List[str]:
        """Extract keywords from category name and description"""
        keywords = []
        
        # Add name variations
        keywords.append(name)
        keywords.append(name.replace("_", " "))
        keywords.append(name.replace(" ", "_"))
        
        # Extract words from name
        words = name.replace("_", " ").split()
        keywords.extend(words)
        
        # Category-specific vendor keywords
        name_lower = name.lower()
        if any(x in name_lower for x in ['travel', 'conveyance', 'transport']):
            keywords.extend(['uber', 'ola', 'rapido', 'meru', 'cab', 'taxi', 'auto', 'rickshaw', 'metro', 'bus'])
        if any(x in name_lower for x in ['fuel', 'petrol', 'diesel']):
            keywords.extend(['petrol', 'diesel', 'fuel', 'cng', 'gas', 'hp', 'indian oil', 'bharat petroleum'])
        if any(x in name_lower for x in ['toll', 'park']):
            keywords.extend(['fastag', 'netc', 'parking', 'toll', 'nhai'])
        if any(x in name_lower for x in ['food', 'meal', 'lunch']):
            keywords.extend(['swiggy', 'zomato', 'restaurant', 'cafe', 'canteen'])
        
        # Extract from description
        if description:
            # Common expense-related words
            expense_words = [
                "travel", "flight", "train", "cab", "taxi", "uber", "ola",
                "food", "meal", "lunch", "dinner", "breakfast", "restaurant",
                "hotel", "accommodation", "stay", "lodging",
                "certification", "training", "course", "exam", "conference",
                "equipment", "laptop", "computer", "hardware",
                "software", "subscription", "license",
                "medical", "health", "hospital", "doctor",
                "passport", "visa", "vfs", "embassy",
                "conveyance", "local", "parking", "metro", "bus"
            ]
            desc_lower = description.lower()
            for word in expense_words:
                if word in desc_lower:
                    keywords.append(word)
        
        return list(set(keywords))
    
    def _build_llm_prompt(self, categories: List[CachedCategory]) -> str:
        """
        Build optimized category list for LLM prompt.
        
        Format is concise to minimize tokens while being clear.
        """
        if not categories:
            return self._get_default_categories_prompt()
        
        lines = ["VALID EXPENSE CATEGORIES (use exact code):"]
        
        for cat in categories:
            line = f"- {cat.code}: {cat.name}"
            if cat.max_amount:
                line += f" (max: ₹{cat.max_amount:,.0f})"
            lines.append(line)
        
        # Always add 'other' as fallback
        lines.append("- other: Other expenses (use when no category matches)")
        
        lines.append("\nIMPORTANT: Use ONLY the category codes listed above. If the expense doesn't match any category, use 'other'.")
        
        return "\n".join(lines)
    
    def _get_default_categories_prompt(self) -> str:
        """Default categories when no policy data available"""
        return """VALID EXPENSE CATEGORIES (use exact code):
- travel: Travel expenses (flights, trains, cabs, etc.)
- food: Food and meals
- accommodation: Hotel and lodging
- certification: Certifications and training
- equipment: Equipment purchases
- software: Software and subscriptions
- medical: Medical expenses
- passport_visa: Passport and visa fees
- conveyance: Local conveyance
- other: Other expenses (use when no category matches)

IMPORTANT: Use ONLY the category codes listed above. If the expense doesn't match any category, use 'other'."""


# Global instance
category_cache = CategoryCacheService()


def get_category_cache() -> CategoryCacheService:
    """Get the global category cache instance"""
    return category_cache
