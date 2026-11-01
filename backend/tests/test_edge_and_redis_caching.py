"""Tests for Cloudflare Edge Caching Headers and 24-Hour Redis Web Search Query Caching."""

import pytest
from httpx import AsyncClient
from app.services.web_cache import WebSearchCache, get_web_search_cache
from app.services.core_engine import LiveWebSearchClient


@pytest.mark.asyncio
class TestCloudflareEdgeCachingHeaders:

    async def test_public_endpoint_edge_cache_headers(self, client: AsyncClient):
        """Public static / plan endpoints must emit Cloudflare CDN edge caching headers."""
        response = await client.get("/api/billing/plans")
        assert response.status_code == 200

        headers = response.headers
        assert "public" in headers.get("Cache-Control", "")
        assert "s-maxage=86400" in headers.get("Cache-Control", "")
        assert headers.get("Cloudflare-CDN-Cache-Control") == "max-age=86400"
        assert headers.get("CDN-Cache-Control") == "max-age=86400"

    async def test_health_check_edge_cache_headers(self, client: AsyncClient):
        """Health check endpoint is edge-cacheable by Cloudflare."""
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert "s-maxage=86400" in response.headers.get("Cache-Control", "")

    async def test_mutating_requests_never_cached(self, client: AsyncClient):
        """POST, PUT, DELETE requests must emit no-store / no-cache directives."""
        response = await client.post("/api/login", json={"email": "nobody@test.com", "password": "wrong"})
        assert "no-store" in response.headers.get("Cache-Control", "")
        assert "no-cache" in response.headers.get("Cache-Control", "")


@pytest.mark.asyncio
class TestRedisWebSearchQueryCache:

    async def test_web_search_cache_set_and_get(self):
        """Query cache stores and retrieves identical search results within 24-hour TTL."""
        cache = WebSearchCache(redis_url=None, default_ttl=86400)
        query = "Attention Is All You Need introduced the Transformer architecture."

        # 1. First lookup: Cache Miss
        cached = await cache.get_async(query)
        assert cached is None
        assert cache.misses >= 1

        # 2. Store mock SERP API results
        mock_results = [
            {
                "title": "Attention Is All You Need - NeurIPS",
                "url": "https://arxiv.org/abs/1706.03762",
                "snippet": "We propose the Transformer, a model architecture eschewing recurrence..."
            }
        ]
        saved = await cache.set_async(query, mock_results)
        assert saved is True

        # 3. Second lookup: Cache Hit
        cached_hit = await cache.get_async(query)
        assert cached_hit is not None
        assert len(cached_hit) == 1
        assert cached_hit[0]["title"] == "Attention Is All You Need - NeurIPS"
        assert cache.hits >= 1

    async def test_query_normalization_handles_case_and_punctuation(self):
        """Normalized queries match even with slight punctuation or casing differences."""
        cache = WebSearchCache(redis_url=None, default_ttl=86400)
        q1 = "Deep Learning is a subset of Machine Learning!"
        q2 = "deep learning is a subset of machine learning"

        await cache.set_async(q1, [{"title": "Deep Learning Guide", "url": "https://example.com", "snippet": "..."}])

        hit = await cache.get_async(q2)
        assert hit is not None
        assert hit[0]["title"] == "Deep Learning Guide"

    async def test_live_web_search_client_uses_cache(self, monkeypatch):
        """LiveWebSearchClient checks cache before invoking external APIs."""
        client = LiveWebSearchClient(serpapi_key="mock_key")
        cache = get_web_search_cache()

        sample_passage = "In our 14-epoch experimental study using 4-bit quantized LoRA."
        cached_payload = [
            {"title": "LoRA Paper", "url": "https://arxiv.org/abs/2106.09685", "snippet": "Low-rank adaptation..."}
        ]
        await cache.set_async(sample_passage, cached_payload)

        # If SerpAPI is called, it should raise an error
        def fail_serp(*args, **kwargs):
            raise AssertionError("External SerpAPI should not be called when results are cached!")
        monkeypatch.setattr(client, "search_serpapi", fail_serp)

        results = await client.query_web_for_chunk(sample_passage, top_k=2)
        assert results is not None
        assert results[0]["title"] == "LoRA Paper"

    async def test_search_cache_stats_endpoint(self, client: AsyncClient):
        """GET /api/search-cache/stats returns telemetry."""
        response = await client.get("/api/search-cache/stats")
        assert response.status_code == 200
        stats = response.json()
        assert "hits" in stats
        assert "misses" in stats
        assert "ttl_seconds" in stats
        assert stats["ttl_seconds"] == 86400
