"""
Embedding Service - Generates and manages embeddings for expense categories.

LOCAL EMBEDDING IMPLEMENTATION using sentence-transformers
----------------------------------------------------------
This service uses a local embedding model (all-MiniLM-L6-v2) which:
- Runs entirely locally without external API calls
- Generates embeddings in ~5-10ms per text
- Uses 384-dimensional vectors (compact and fast)
- No cost per embedding generation

Storage/Update/Removal Strategy:
---------------------------------
STORAGE:
- Primary: PostgreSQL with pgvector extension (if available)
- Fallback: JSON file in ./data/embeddings/
- Cache: In-memory dict with 24h TTL per region

UPDATE:
- On policy category CREATE: Generate embedding immediately
- On policy category UPDATE: Regenerate embedding
- On policy ACTIVATE/DEACTIVATE: Update cache flags, no re-embedding
- Manual: Admin API endpoint to force refresh

REMOVAL:
- On policy category DELETE: Remove from DB and cache
- On policy DEACTIVATE: Keep embedding but exclude from matching
- Cache expiry: Auto-reload from DB after 24h

Performance:
- Local model: ~5-10ms per embedding (vs ~200ms for API)
- First load: ~2-3 seconds (model loading)
- Subsequent: Near instant from cache
"""
import logging
import json
import os
import numpy as np
from typing import Dict, List, Optional, Tuple, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from threading import Lock
from pathlib import Path
from uuid import UUID

from config import settings

logger = logging.getLogger(__name__)

# Embedding dimension for all-MiniLM-L6-v2 model
EMBEDDING_DIMENSION = 384

# Local model name - fast and accurate for semantic similarity
LOCAL_MODEL_NAME = "all-MiniLM-L6-v2"


@dataclass
class CategoryEmbedding:
    """Stored embedding for a category"""
    category_code: str
    category_name: str
    category_type: str  # REIMBURSEMENT or ALLOWANCE
    region: str
    embedding: List[float]
    keywords: List[str]
    max_amount: Optional[float]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    def to_dict(self) -> Dict:
        """Convert to serializable dict"""
        return {
            "category_code": self.category_code,
            "category_name": self.category_name,
            "category_type": self.category_type,
            "region": self.region,
            "embedding": self.embedding,
            "keywords": self.keywords,
            "max_amount": self.max_amount,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "CategoryEmbedding":
        """Create from dict"""
        return cls(
            category_code=data["category_code"],
            category_name=data["category_name"],
            category_type=data["category_type"],
            region=data["region"],
            embedding=data["embedding"],
            keywords=data.get("keywords", []),
            max_amount=data.get("max_amount"),
            description=data.get("description"),
            is_active=data.get("is_active", True),
            created_at=datetime.fromisoformat(data["created_at"]) if isinstance(data["created_at"], str) else data["created_at"],
            updated_at=datetime.fromisoformat(data["updated_at"]) if isinstance(data["updated_at"], str) else data["updated_at"],
        )


@dataclass
class RegionEmbeddingCache:
    """Cache entry for a region's embeddings"""
    region: str
    embeddings: List[CategoryEmbedding]
    embedding_matrix: Optional[np.ndarray]  # Pre-computed for fast similarity
    category_codes: List[str]  # Mapping index to category code
    cached_at: datetime
    expires_at: datetime


class EmbeddingService:
    """
    Service for managing category embeddings and semantic matching.
    
    Features:
    - Generate embeddings using local sentence-transformers (all-MiniLM-L6-v2)
    - Store embeddings in PostgreSQL (pgvector) or JSON fallback
    - In-memory caching with 24h TTL
    - Fast cosine similarity matching (~5ms per embedding)
    - Automatic embedding refresh on category updates
    """
    
    _instance = None
    _lock = Lock()
    
    # Storage paths
    EMBEDDINGS_DIR = Path("./data/embeddings")
    
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
        
        self._cache: Dict[str, RegionEmbeddingCache] = {}
        self._cache_ttl = timedelta(hours=24)
        self._cache_lock = Lock()
        self._model = None
        self._pgvector_available = False
        
        # Ensure storage directory exists
        self.EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Check pgvector availability
        self._check_pgvector()
        
        # Initialize local model lazily
        self._load_local_model()
        
        self._initialized = True
        logger.info(f"EmbeddingService initialized with local model. pgvector: {self._pgvector_available}")
    
    def _load_local_model(self):
        """Load the local sentence-transformer model"""
        if self._model is not None:
            return
        
        try:
            from sentence_transformers import SentenceTransformer
            
            logger.info(f"Loading local embedding model: {LOCAL_MODEL_NAME}")
            self._model = SentenceTransformer(LOCAL_MODEL_NAME)
            logger.info(f"Local embedding model loaded successfully: {LOCAL_MODEL_NAME}")
            
        except ImportError:
            logger.warning("sentence-transformers not installed, embeddings will be unavailable")
            self._model = None
        except Exception as e:
            logger.error(f"Failed to load local embedding model: {e}")
            self._model = None
    
    def _check_pgvector(self):
        """Check if pgvector extension is available"""
        try:
            from database import get_sync_db
            from sqlalchemy import text
            
            db = next(get_sync_db())
            result = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
            self._pgvector_available = result.fetchone() is not None
            
            if not self._pgvector_available:
                logger.info("pgvector extension not found, using JSON file storage")
        except Exception as e:
            logger.warning(f"Could not check pgvector: {e}")
            self._pgvector_available = False
    
    def _get_embedding_model(self):
        """Get or initialize the local embedding model"""
        if self._model is None:
            self._load_local_model()
        return self._model
    
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using local sentence-transformer model.
        
        Args:
            text: Text to embed (category name + description + keywords)
            
        Returns:
            384-dimensional embedding vector (all-MiniLM-L6-v2)
        """
        model = self._get_embedding_model()
        if model is None:
            logger.error("Local embedding model not available")
            raise RuntimeError("Embedding model not loaded")
        
        try:
            # Generate embedding using local model (synchronous but fast ~5ms)
            embedding = model.encode(text, convert_to_numpy=True)
            
            # Convert to list for JSON serialization
            embedding_list = embedding.tolist()
            
            logger.debug(f"Generated local embedding for text: {text[:50]}... (dim={len(embedding_list)})")
            return embedding_list
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise
    
    async def generate_query_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for query text (OCR extracted text).
        Uses same local model - no task type distinction needed.
        """
        return await self.generate_embedding(text)
    
    def _build_category_text(self, category: Dict) -> str:
        """Build text representation for embedding"""
        parts = [
            category.get("category_name", ""),
            category.get("category_code", ""),
            category.get("description", "") or "",
        ]
        
        # Add keywords if available
        keywords = category.get("keywords", [])
        if keywords:
            parts.extend(keywords)
        
        return " ".join(filter(None, parts))
    
    async def create_category_embedding(
        self,
        category_code: str,
        category_name: str,
        category_type: str,
        region: str,
        description: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        max_amount: Optional[float] = None,
        is_active: bool = True
    ) -> CategoryEmbedding:
        """
        Create embedding for a new category.
        
        Called when a policy category is created or updated.
        """
        # Build text for embedding
        text_parts = [category_name, category_code]
        if description:
            text_parts.append(description)
        if keywords:
            text_parts.extend(keywords)
        
        text = " ".join(text_parts)
        
        # Generate embedding
        embedding = await self.generate_embedding(text)
        
        now = datetime.utcnow()
        cat_embedding = CategoryEmbedding(
            category_code=category_code,
            category_name=category_name,
            category_type=category_type,
            region=region,
            embedding=embedding,
            keywords=keywords or [],
            max_amount=max_amount,
            description=description,
            is_active=is_active,
            created_at=now,
            updated_at=now,
        )
        
        # Store embedding
        await self._store_embedding(cat_embedding)
        
        # Invalidate cache for this region
        self._invalidate_region_cache(region)
        
        logger.info(f"Created embedding for category: {category_code} in region: {region}")
        return cat_embedding
    
    async def update_category_embedding(
        self,
        category_code: str,
        region: str,
        **updates
    ) -> Optional[CategoryEmbedding]:
        """
        Update embedding for an existing category.
        
        Called when category name, description, or keywords change.
        """
        # Load existing embedding
        existing = await self._load_embedding(category_code, region)
        if not existing:
            logger.warning(f"Category embedding not found: {category_code} in {region}")
            return None
        
        # Check if re-embedding is needed
        needs_reembed = any(
            k in updates for k in ["category_name", "description", "keywords"]
        )
        
        # Update fields
        if "category_name" in updates:
            existing.category_name = updates["category_name"]
        if "description" in updates:
            existing.description = updates["description"]
        if "keywords" in updates:
            existing.keywords = updates["keywords"]
        if "max_amount" in updates:
            existing.max_amount = updates["max_amount"]
        if "is_active" in updates:
            existing.is_active = updates["is_active"]
        
        existing.updated_at = datetime.utcnow()
        
        # Regenerate embedding if needed
        if needs_reembed:
            text = self._build_category_text(asdict(existing))
            existing.embedding = await self.generate_embedding(text)
            logger.info(f"Regenerated embedding for category: {category_code}")
        
        # Store updated embedding
        await self._store_embedding(existing)
        
        # Invalidate cache
        self._invalidate_region_cache(region)
        
        return existing
    
    async def delete_category_embedding(
        self,
        category_code: str,
        region: str
    ) -> bool:
        """
        Delete embedding for a category.
        
        Called when a policy category is deleted.
        """
        try:
            if self._pgvector_available:
                await self._delete_from_pgvector(category_code, region)
            else:
                await self._delete_from_json(category_code, region)
            
            # Invalidate cache
            self._invalidate_region_cache(region)
            
            logger.info(f"Deleted embedding for category: {category_code} in region: {region}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete embedding: {e}")
            return False
    
    async def match_category(
        self,
        text: str,
        region: Union[str, List[str]],
        category_type: str = "REIMBURSEMENT",
        top_k: int = 3,
        tenant_id: Optional[UUID] = None
    ) -> List[Tuple[str, float, bool]]:
        """
        Match text against category embeddings using semantic similarity.
        
        Args:
            text: Text to match (e.g., vendor name, description from OCR)
            region: Employee's region(s) - can be string or list
            category_type: REIMBURSEMENT or ALLOWANCE
            top_k: Number of top matches to return
            tenant_id: Tenant UUID (required for multi-tenant support)
            
        Returns:
            List of (category_code, similarity_score, is_above_threshold)
        """
        # Normalize to list
        regions = region if isinstance(region, list) else [region]
        
        # Collect embeddings from all regions
        all_embeddings = []
        all_codes = []
        
        for reg in regions:
            cache = await self._get_region_embeddings(reg, category_type, tenant_id)
            if cache and cache.embeddings:
                for emb in cache.embeddings:
                    if emb.is_active and emb.category_code not in all_codes:
                        all_embeddings.append(emb)
                        all_codes.append(emb.category_code)
        
        if not all_embeddings:
            regions_str = ', '.join(regions)
            logger.warning(f"No embeddings found for region(s): {regions_str}, type: {category_type}")
            return [("other", 0.0, False)]
        
        # Generate query embedding
        query_embedding = await self.generate_query_embedding(text)
        query_vector = np.array(query_embedding)
        
        # Build combined embedding matrix
        embedding_matrix = np.array([e.embedding for e in all_embeddings])
        
        # Compute similarities
        similarities = self._cosine_similarity_batch(query_vector, embedding_matrix)
        
        # Get top-k matches
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            if idx < len(all_codes):
                code = all_codes[idx]
                score = float(similarities[idx])
                is_match = score >= settings.EMBEDDING_SIMILARITY_THRESHOLD
                results.append((code, score, is_match))
        
        return results
    
    async def get_best_category_match(
        self,
        text: str,
        region: Union[str, List[str]],
        category_type: str = "REIMBURSEMENT",
        tenant_id: Optional[UUID] = None
    ) -> Tuple[str, float, bool]:
        """
        Get the best matching category for text.
        
        Args:
            text: Text to match (e.g., vendor name, description from OCR)
            region: Employee's region(s) - can be string or list
            category_type: REIMBURSEMENT or ALLOWANCE
            tenant_id: Optional tenant UUID for multi-tenant support
            
        Returns:
            (category_code, confidence, is_valid_match)
            If no good match, returns ('other', 0.0, False)
        """
        matches = await self.match_category(text, region, category_type, top_k=1, tenant_id=tenant_id)
        
        if matches and matches[0][2]:  # Has valid match above threshold
            return matches[0]
        
        return ("other", 0.0, False)
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two vectors"""
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    
    def _cosine_similarity_batch(
        self, 
        query: np.ndarray, 
        matrix: np.ndarray
    ) -> np.ndarray:
        """Compute cosine similarity between query and all rows in matrix"""
        # Normalize query
        query_norm = query / np.linalg.norm(query)
        
        # Normalize matrix rows
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        matrix_norm = matrix / norms
        
        # Dot product
        return np.dot(matrix_norm, query_norm)
    
    async def _get_region_embeddings(
        self,
        region: str,
        category_type: str,
        tenant_id: Optional[UUID] = None
    ) -> Optional[RegionEmbeddingCache]:
        """Get embeddings for a region, loading from storage if needed"""
        cache_key = f"{tenant_id or 'default'}_{region}_{category_type}"
        
        with self._cache_lock:
            cache = self._cache.get(cache_key)
            if cache and datetime.utcnow() < cache.expires_at:
                return cache
        
        # Load from storage
        embeddings = await self._load_region_embeddings(region, category_type)
        
        if not embeddings:
            # Try to generate from database
            embeddings = await self._generate_region_embeddings(region, category_type, tenant_id)
        
        if not embeddings:
            return None
        
        # Build cache entry with pre-computed matrix
        active_embeddings = [e for e in embeddings if e.is_active]
        
        if active_embeddings:
            embedding_matrix = np.array([e.embedding for e in active_embeddings])
            category_codes = [e.category_code for e in active_embeddings]
        else:
            embedding_matrix = None
            category_codes = []
        
        now = datetime.utcnow()
        cache = RegionEmbeddingCache(
            region=region,
            embeddings=embeddings,
            embedding_matrix=embedding_matrix,
            category_codes=category_codes,
            cached_at=now,
            expires_at=now + self._cache_ttl,
        )
        
        with self._cache_lock:
            self._cache[cache_key] = cache
        
        logger.info(f"Cached {len(active_embeddings)} embeddings for {region}/{category_type}")
        return cache
    
    async def _generate_region_embeddings(
        self,
        region: str,
        category_type: str,
        tenant_id: Optional[UUID] = None
    ) -> List[CategoryEmbedding]:
        """Generate embeddings for all categories in a region from database (PolicyCategory + CustomClaim)"""
        try:
            from database import get_sync_db
            from models import PolicyCategory, PolicyUpload, CustomClaim
            from sqlalchemy import and_, or_, any_
            
            if not tenant_id:
                logger.warning("No tenant_id provided for embedding generation - multi-tenant support requires tenant_id")
                return []
            
            db = next(get_sync_db())
            
            embeddings = []
            
            # ============ Query PolicyCategory ============
            # Note: PolicyUpload.region is an ARRAY type, so we need to use array operations
            results = db.query(PolicyCategory, PolicyUpload).join(
                PolicyUpload, PolicyCategory.policy_upload_id == PolicyUpload.id
            ).filter(
                and_(
                    PolicyCategory.tenant_id == tenant_id,
                    PolicyCategory.category_type == category_type,
                    PolicyCategory.is_active == True,
                    PolicyUpload.status == "ACTIVE",
                    or_(
                        PolicyUpload.region.any(region),  # Check if region is in the array
                        PolicyUpload.region.any("GLOBAL"),  # Check if GLOBAL is in the array
                        PolicyUpload.region.is_(None)
                    )
                )
            ).all()
            
            for cat, policy in results:
                # Build keywords from description
                keywords = self._extract_keywords(cat.category_name, cat.description)
                
                # Generate embedding
                cat_emb = await self.create_category_embedding(
                    category_code=cat.category_code or cat.category_name,
                    category_name=cat.category_name,
                    category_type=cat.category_type,
                    region=region,
                    description=cat.description,
                    keywords=keywords,
                    max_amount=float(cat.max_amount) if cat.max_amount else None,
                    is_active=cat.is_active,
                )
                embeddings.append(cat_emb)
            
            # ============ Query CustomClaim (standalone categories) ============
            # Note: CustomClaim.region is an ARRAY type, so we use .any() to check if value is in array
            custom_claims = db.query(CustomClaim).filter(
                and_(
                    CustomClaim.tenant_id == tenant_id,
                    CustomClaim.category_type == category_type,
                    CustomClaim.is_active == True,
                    or_(
                        CustomClaim.region.any(region),  # Check if region is in the array
                        CustomClaim.region.any("GLOBAL"),  # Check if GLOBAL is in the array
                        CustomClaim.region.is_(None),  # NULL means all regions
                        CustomClaim.region == []  # Empty array means all regions
                    )
                )
            ).all()
            
            for cc in custom_claims:
                # Build keywords from description and custom fields
                keywords = self._extract_keywords(cc.claim_name, cc.description)
                # Add custom field names/labels as keywords
                if cc.custom_fields:
                    for field_def in cc.custom_fields:
                        if isinstance(field_def, dict):
                            field_name = field_def.get("name") or field_def.get("field_name", "")
                            field_label = field_def.get("label") or field_def.get("field_label", "")
                            if field_name:
                                keywords.add(field_name.lower().replace("_", " "))
                            if field_label:
                                keywords.add(field_label.lower())
                
                # Generate embedding for custom claim
                cat_emb = await self.create_category_embedding(
                    category_code=cc.claim_code,
                    category_name=cc.claim_name,
                    category_type=cc.category_type,
                    region=region,
                    description=cc.description,
                    keywords=list(keywords),
                    max_amount=float(cc.max_amount) if cc.max_amount else None,
                    is_active=cc.is_active,
                )
                embeddings.append(cat_emb)
            
            if not embeddings:
                logger.warning(f"No categories found for {region}/{category_type}")
                return []
            
            logger.info(f"Generated {len(embeddings)} embeddings for {region}/{category_type} (including custom claims)")
            return embeddings
            
        except Exception as e:
            logger.error(f"Failed to generate region embeddings: {e}")
            return []
    
    def _extract_keywords(self, name: str, description: Optional[str]) -> List[str]:
        """Extract keywords from category name and description"""
        keywords = set()
        
        # Add name variations
        keywords.add(name.lower())
        keywords.add(name.replace("_", " ").lower())
        
        # Add words from name
        for word in name.replace("_", " ").split():
            if len(word) > 2:
                keywords.add(word.lower())
        
        # Extract from description
        if description:
            expense_words = {
                "travel", "flight", "train", "cab", "taxi", "uber", "ola", "airport",
                "food", "meal", "lunch", "dinner", "breakfast", "restaurant", "cafe",
                "hotel", "accommodation", "stay", "lodging", "booking",
                "certification", "training", "course", "exam", "conference", "workshop",
                "equipment", "laptop", "computer", "hardware", "device",
                "software", "subscription", "license", "saas",
                "medical", "health", "hospital", "doctor", "pharmacy",
                "passport", "visa", "vfs", "embassy", "consulate",
                "conveyance", "local", "parking", "metro", "bus", "auto"
            }
            desc_lower = description.lower()
            for word in expense_words:
                if word in desc_lower:
                    keywords.add(word)
        
        return list(keywords)
    
    async def _store_embedding(self, embedding: CategoryEmbedding):
        """Store embedding to persistent storage"""
        if self._pgvector_available:
            await self._store_to_pgvector(embedding)
        else:
            await self._store_to_json(embedding)
    
    async def _store_to_json(self, embedding: CategoryEmbedding):
        """Store embedding to JSON file"""
        file_path = self.EMBEDDINGS_DIR / f"{embedding.region}_{embedding.category_type}.json"
        
        # Load existing
        embeddings = {}
        if file_path.exists():
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    embeddings = {e["category_code"]: e for e in data.get("embeddings", [])}
            except Exception as e:
                logger.warning(f"Failed to load existing embeddings: {e}")
        
        # Update/add
        embeddings[embedding.category_code] = embedding.to_dict()
        
        # Save
        with open(file_path, "w") as f:
            json.dump({
                "region": embedding.region,
                "category_type": embedding.category_type,
                "updated_at": datetime.utcnow().isoformat(),
                "embeddings": list(embeddings.values())
            }, f, indent=2)
        
        logger.debug(f"Stored embedding to JSON: {file_path}")
    
    async def _store_to_pgvector(self, embedding: CategoryEmbedding):
        """Store embedding to PostgreSQL with pgvector"""
        # TODO: Implement pgvector storage
        # For now, fall back to JSON
        await self._store_to_json(embedding)
    
    async def _load_embedding(
        self,
        category_code: str,
        region: str
    ) -> Optional[CategoryEmbedding]:
        """Load a single embedding"""
        # Try JSON first
        for category_type in ["REIMBURSEMENT", "ALLOWANCE"]:
            file_path = self.EMBEDDINGS_DIR / f"{region}_{category_type}.json"
            if file_path.exists():
                try:
                    with open(file_path, "r") as f:
                        data = json.load(f)
                        for emb_data in data.get("embeddings", []):
                            if emb_data["category_code"] == category_code:
                                return CategoryEmbedding.from_dict(emb_data)
                except Exception as e:
                    logger.warning(f"Failed to load embedding: {e}")
        return None
    
    async def _load_region_embeddings(
        self,
        region: str,
        category_type: str
    ) -> List[CategoryEmbedding]:
        """Load all embeddings for a region from storage"""
        file_path = self.EMBEDDINGS_DIR / f"{region}_{category_type}.json"
        
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
                return [
                    CategoryEmbedding.from_dict(e) 
                    for e in data.get("embeddings", [])
                ]
        except Exception as e:
            logger.error(f"Failed to load embeddings from JSON: {e}")
            return []
    
    async def _delete_from_json(self, category_code: str, region: str):
        """Delete embedding from JSON storage"""
        for category_type in ["REIMBURSEMENT", "ALLOWANCE"]:
            file_path = self.EMBEDDINGS_DIR / f"{region}_{category_type}.json"
            if not file_path.exists():
                continue
            
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                
                embeddings = [
                    e for e in data.get("embeddings", [])
                    if e["category_code"] != category_code
                ]
                
                data["embeddings"] = embeddings
                data["updated_at"] = datetime.utcnow().isoformat()
                
                with open(file_path, "w") as f:
                    json.dump(data, f, indent=2)
                    
            except Exception as e:
                logger.warning(f"Failed to delete from JSON: {e}")
    
    async def _delete_from_pgvector(self, category_code: str, region: str):
        """Delete embedding from pgvector"""
        # TODO: Implement pgvector deletion
        await self._delete_from_json(category_code, region)
    
    def _invalidate_region_cache(self, region: str):
        """Invalidate cache for a region"""
        with self._cache_lock:
            keys_to_delete = [k for k in self._cache if k.startswith(region)]
            for key in keys_to_delete:
                del self._cache[key]
        logger.debug(f"Invalidated cache for region: {region}")
    
    def invalidate_all_caches(self):
        """Invalidate all caches"""
        with self._cache_lock:
            self._cache.clear()
        logger.info("Invalidated all embedding caches")
    
    async def refresh_region_embeddings(
        self,
        region: str,
        category_type: Optional[str] = None,
        tenant_id: Optional[UUID] = None
    ) -> int:
        """
        Force refresh embeddings for a region.
        
        Called by admin API to regenerate embeddings.
        Returns number of embeddings generated.
        """
        types = [category_type] if category_type else ["REIMBURSEMENT", "ALLOWANCE"]
        count = 0
        
        for cat_type in types:
            # Clear existing
            file_path = self.EMBEDDINGS_DIR / f"{region}_{cat_type}.json"
            if file_path.exists():
                file_path.unlink()
            
            # Regenerate
            embeddings = await self._generate_region_embeddings(region, cat_type, tenant_id)
            count += len(embeddings)
        
        # Invalidate cache
        self._invalidate_region_cache(region)
        
        logger.info(f"Refreshed {count} embeddings for region: {region}")
        return count
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._cache_lock:
            stats = {
                "cached_regions": len(self._cache),
                "regions": {}
            }
            
            for key, cache in self._cache.items():
                stats["regions"][key] = {
                    "total_embeddings": len(cache.embeddings),
                    "active_embeddings": len([e for e in cache.embeddings if e.is_active]),
                    "cached_at": cache.cached_at.isoformat(),
                    "expires_at": cache.expires_at.isoformat(),
                }
            
            return stats


# Global instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get the global embedding service instance"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
