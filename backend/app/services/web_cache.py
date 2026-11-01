"""Redis 24-Hour Web Search Query Cache for SerpAPI & Bing Search Optimization.

Prevents expensive and redundant external SERP API calls when multiple students
or subsequent scans query identical or overlapping passages within a 24-hour window.
Includes resilient in-memory TTL fallback when Redis is offline.
"""

import os
import re
import json
import hashlib
import logging
from typing import List, Dict, Optional, Any
from cachetools import TTLCache

logger = logging.getLogger("security.web_cache")

REDIS_URL = os.getenv("REDIS_URL", "")
DEFAULT_CACHE_TTL_SECONDS = 86400  # 24 Hours


class WebSearchCache:
    """
    Two-Tier 24-Hour Web Search Cache:
    - Tier 1: Distributed Redis Cluster (cross-worker / cross-container sharing)
    - Tier 2: In-Memory TTLCache fallback (thread-safe, zero network latency)
    """

    _instance = None

    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_ttl: int = DEFAULT_CACHE_TTL_SECONDS
    ):
        self.redis_url = redis_url or REDIS_URL
        self.default_ttl = default_ttl
        self._memory_cache = TTLCache(maxsize=10000, ttl=default_ttl)
        self._redis_client = None
        self._async_redis = None

        self.hits = 0
        self.misses = 0

        self._init_redis()

    def _init_redis(self):
        """Initializes Redis connections if REDIS_URL is configured."""
        if not self.redis_url:
            logger.debug("WebSearchCache: No REDIS_URL provided. Operating with in-memory 24h TTLCache.")
            return

        try:
            import redis
            self._redis_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=2.0
            )
            self._redis_client.ping()
            logger.info("WebSearchCache: Successfully connected to Redis 24-Hour SERP query cache.")
        except Exception as exc:
            logger.debug(f"WebSearchCache: Redis sync connection failed ({exc}). Using in-memory fallback.")
            self._redis_client = None

        try:
            import redis.asyncio as aioredis
            self._async_redis = aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=2.0
            )
        except Exception:
            self._async_redis = None

    @classmethod
    def get_instance(cls) -> "WebSearchCache":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def normalize_query(query: str) -> str:
        """Strips punctuation, quotes, and collapses whitespace for deterministic hashing."""
        clean = re.sub(r"[^\w\s]", "", query or "").lower().strip()
        return " ".join(clean.split())

    @classmethod
    def make_cache_key(cls, query: str) -> str:
        """Computes deterministic 64-character SHA-256 cache key."""
        normalized = cls.normalize_query(query)
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return f"serp_cache:{digest}"

    async def get_async(self, query: str) -> Optional[List[Dict[str, str]]]:
        """Asynchronously retrieves cached search results from Redis or in-memory TTL."""
        key = self.make_cache_key(query)

        # 1. Try Async Redis
        if self._async_redis is not None:
            try:
                raw_json = await self._async_redis.get(key)
                if raw_json:
                    data = json.loads(raw_json)
                    self.hits += 1
                    logger.debug(f"[SERP Cache HIT - Redis] Key: {key[:16]}... (Query: {query[:30]}...)")
                    return data
            except Exception as e:
                logger.debug(f"Async Redis get failed for {key}: {e}")

        # 2. Check In-Memory Fallback
        if key in self._memory_cache:
            self.hits += 1
            logger.debug(f"[SERP Cache HIT - Memory] Key: {key[:16]}...")
            return self._memory_cache[key]

        self.misses += 1
        return None

    def get_sync(self, query: str) -> Optional[List[Dict[str, str]]]:
        """Synchronously retrieves cached search results."""
        key = self.make_cache_key(query)

        if self._redis_client is not None:
            try:
                raw_json = self._redis_client.get(key)
                if raw_json:
                    data = json.loads(raw_json)
                    self.hits += 1
                    return data
            except Exception as e:
                logger.debug(f"Sync Redis get failed for {key}: {e}")

        if key in self._memory_cache:
            self.hits += 1
            return self._memory_cache[key]

        self.misses += 1
        return None

    async def set_async(
        self,
        query: str,
        results: List[Dict[str, str]],
        ttl_seconds: Optional[int] = None
    ) -> bool:
        """Asynchronously caches search query results with 24-hour expiration."""
        if not results:
            return False

        key = self.make_cache_key(query)
        ttl = ttl_seconds or self.default_ttl
        payload = json.dumps(results)

        # Store in In-Memory Cache
        self._memory_cache[key] = results

        # Store in Async Redis
        if self._async_redis is not None:
            try:
                await self._async_redis.set(key, payload, ex=ttl)
                logger.debug(f"[SERP Cache SAVED] Stored {len(results)} items under {key[:16]} (TTL: {ttl}s)")
                return True
            except Exception as e:
                logger.debug(f"Async Redis set failed for {key}: {e}")

        return True

    def set_sync(
        self,
        query: str,
        results: List[Dict[str, str]],
        ttl_seconds: Optional[int] = None
    ) -> bool:
        """Synchronously caches search query results."""
        if not results:
            return False

        key = self.make_cache_key(query)
        ttl = ttl_seconds or self.default_ttl
        payload = json.dumps(results)

        self._memory_cache[key] = results

        if self._redis_client is not None:
            try:
                self._redis_client.set(key, payload, ex=ttl)
                return True
            except Exception as e:
                logger.debug(f"Sync Redis set failed for {key}: {e}")

        return True

    def get_stats(self) -> Dict[str, Any]:
        """Returns cache telemetry: hit counts, misses, and hit-ratio."""
        total = self.hits + self.misses
        hit_ratio = (self.hits / total * 100) if total > 0 else 0.0
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": total,
            "hit_ratio_pct": round(hit_ratio, 2),
            "memory_cache_entries": len(self._memory_cache),
            "redis_connected": self._redis_client is not None or self._async_redis is not None,
            "ttl_seconds": self.default_ttl,
        }


# FastAPI Dependency
def get_web_search_cache() -> WebSearchCache:
    """FastAPI Dependency providing singleton WebSearchCache."""
    return WebSearchCache.get_instance()
