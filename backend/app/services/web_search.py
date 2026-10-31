import re
import urllib.parse
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings

class WebSearchCrossReferencer:
    """
    External Web Cross-Referencing Engine.
    Extracts high-entropy salient queries from document chunks,
    queries Bing Search or SerpAPI, and verifies matches against live internet sources.
    """

    def __init__(self):
        self.serpapi_key = settings.SERPAPI_API_KEY
        self.bing_key = settings.BING_SEARCH_API_KEY
        self.max_queries = settings.MAX_WEB_QUERIES_PER_DOC

    @staticmethod
    def extract_salient_queries(chunks: List[Any], max_queries: int = 5) -> List[Dict[str, Any]]:
        """
        Selects distinctive chunks that are least likely to be generic boilerplate.
        Filters out common transition phrases and short fragments.
        """
        stop_phrases = {
            "in conclusion", "furthermore", "as shown in", "for example", 
            "it is important to note", "on the other hand", "table of contents",
            "references", "bibliography", "introduction"
        }

        candidates = []
        for chunk in chunks:
            text = chunk.text.strip()
            words = text.split()
            # Ideal query: 10 to 25 words
            if 10 <= len(words) <= 30:
                lower_text = text.lower()
                if not any(stop in lower_text for stop in stop_phrases):
                    candidates.append({
                        "query": f'"{text[:80]}"' if len(text) > 80 else f'"{text}"',
                        "raw_query": text,
                        "chunk": chunk
                    })

        # Sample evenly across document length
        if len(candidates) <= max_queries:
            return candidates
        
        step = len(candidates) // max_queries
        return [candidates[i * step] for i in range(max_queries)]

    async def search_serpapi(self, query: str) -> List[Dict[str, str]]:
        """Queries Google via SerpAPI."""
        url = "https://serpapi.com/search.json"
        params = {
            "q": query,
            "api_key": self.serpapi_key,
            "engine": "google",
            "num": settings.WEB_VERIFY_TOP_N_RESULTS
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("organic_results", []):
                    results.append({
                        "title": item.get("title", "Internet Source"),
                        "link": item.get("link", ""),
                        "snippet": item.get("snippet", "")
                    })
                return results
        return []

    async def search_bing(self, query: str) -> List[Dict[str, str]]:
        """Queries Bing Web Search API."""
        url = "https://api.bing.microsoft.com/v7.0/search"
        headers = {"Ocp-Apim-Subscription-Key": self.bing_key}
        params = {"q": query, "count": settings.WEB_VERIFY_TOP_N_RESULTS, "responseFilter": "Webpages"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("webPages", {}).get("value", []):
                    results.append({
                        "title": item.get("name", "Internet Source"),
                        "link": item.get("url", ""),
                        "snippet": item.get("snippet", "")
                    })
                return results
        return []

    async def search_duckduckgo(self, query: str) -> List[Dict[str, str]]:
        """Lightweight HTML/API search fallback when no API key is provided."""
        # Clean query quotes for broader match
        clean_q = query.replace('"', '')
        url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(clean_q)}&format=json"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    # RelatedTopics or AbstractText
                    if data.get("AbstractText"):
                        results.append({
                            "title": data.get("Heading", "Wikipedia / Knowledge Base"),
                            "link": data.get("AbstractURL", "https://duckduckgo.com"),
                            "snippet": data.get("AbstractText", "")
                        })
                    for topic in data.get("RelatedTopics", [])[:3]:
                        if "Text" in topic and "FirstURL" in topic:
                            results.append({
                                "title": topic.get("Text")[:60] + "...",
                                "link": topic.get("FirstURL"),
                                "snippet": topic.get("Text")
                            })
                    return results
        except Exception:
            pass
        return []

    async def cross_reference_chunks(self, chunks: List[Any], semantic_matcher: Any) -> List[Dict[str, Any]]:
        """
        Executes web search for top salient chunks, embeds web snippets,
        and computes similarity against the query chunk.
        """
        salient_queries = self.extract_salient_queries(chunks, max_queries=self.max_queries)
        web_matches = []

        for item in salient_queries:
            query = item["query"]
            chunk = item["chunk"]
            results = []

            # Check configured provider
            if self.serpapi_key:
                results = await self.search_serpapi(query)
            elif self.bing_key:
                results = await self.search_bing(query)
            else:
                # Fallback to DuckDuckGo open search
                results = await self.search_duckduckgo(query)

            for res in results:
                snippet = res.get("snippet", "")
                if not snippet:
                    continue

                # Calculate semantic similarity between chunk and web snippet
                chunk_vec = semantic_matcher.compute_embeddings([chunk.text])[0]
                snippet_vec = semantic_matcher.compute_embeddings([snippet])[0]
                sim = semantic_matcher.cosine_similarity(chunk_vec, snippet_vec)

                # If cosine similarity indicates strong similarity or exact n-gram overlap
                if sim >= 0.70:
                    web_matches.append({
                        "start_char": chunk.start_char,
                        "end_char": chunk.end_char,
                        "matched_text": chunk.text,
                        "source_title": res.get("title", "Internet Web Page"),
                        "source_url": res.get("link"),
                        "source_snippet": snippet,
                        "similarity_score": round(float(sim), 4),
                        "match_type": "web",
                        "source_category": "Internet"
                    })
                    break  # One best web match per chunk to avoid noise

        return web_matches
