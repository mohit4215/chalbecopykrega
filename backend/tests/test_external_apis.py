import json
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import User
from app.services.core_engine import LiveWebSearchClient
from app.services.stripe_service import StripeService

class TestLiveWebSearchMocking:
    """Tests mocking SerpAPI and Bing web cross-referencing logic."""

    def test_query_construction(self):
        client = LiveWebSearchClient(serpapi_key="mock_key")
        chunk = "Attention is all you need introducing the Transformer neural architecture."
        queries = client.construct_queries(chunk)

        assert "exact_query" in queries
        assert "semantic_query" in queries
        assert queries["exact_query"].startswith('"')
        assert queries["exact_query"].endswith('"')
        assert "transformer" in queries["semantic_query"].lower()

    @pytest.mark.asyncio
    async def test_serpapi_mocked_search_success(self):
        client = LiveWebSearchClient(serpapi_key="mock_serpapi_key")

        mock_serpapi_response = {
            "organic_results": [
                {
                    "title": "Attention Is All You Need - NeurIPS Papers",
                    "link": "https://arxiv.org/abs/1706.03762",
                    "snippet": "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks."
                },
                {
                    "title": "Transformer Architecture Explained",
                    "link": "https://towardsdatascience.com/transformer",
                    "snippet": "An intuitive guide to the self-attention mechanism and Transformers."
                }
            ]
        }

        # Mock httpx.AsyncClient.get to avoid hitting the live internet
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = MagicMock(spec=Response)
            mock_resp.status_code = 200
            mock_resp.json.return_value = mock_serpapi_response
            mock_get.return_value = mock_resp

            results = await client.search_serpapi('"Attention is all you need"', top_k=2)

            assert len(results) == 2
            assert results[0]["title"] == "Attention Is All You Need - NeurIPS Papers"
            assert "arxiv.org" in results[0]["url"]
            assert "dominant sequence" in results[0]["snippet"]

    @pytest.mark.asyncio
    async def test_serpapi_network_failure_resilience(self):
        client = LiveWebSearchClient(serpapi_key="mock_serpapi_key")

        # Simulate external network timeout
        with patch("httpx.AsyncClient.get", side_effect=Exception("Connection Timeout")):
            results = await client.search_serpapi("Test query", top_k=3)
            # The client must gracefully return an empty list rather than crashing
            assert results == []


class TestStripeMonetizationMocking:
    """Tests mocking Stripe checkout sessions and webhook payment fulfillment."""

    @pytest.mark.asyncio
    async def test_create_checkout_session_mocked(self, client: AsyncClient, auth_headers: dict):
        mock_session_obj = MagicMock()
        mock_session_obj.id = "cs_test_mock_session_12345"
        mock_session_obj.url = "https://checkout.stripe.com/pay/cs_test_mock_session_12345"

        with patch("stripe.checkout.Session.create", return_value=mock_session_obj):
            payload = {
                "plan_id": "credits_25",
                "success_url": "http://localhost:3000/billing?status=success",
                "cancel_url": "http://localhost:3000/billing?status=cancelled"
            }
            response = await client.post("/api/create-checkout-session", json=payload, headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "checkout_url" in data
            assert data["session_id"] == "cs_test_mock_session_12345"

    @pytest.mark.asyncio
    async def test_stripe_webhook_credit_pack_fulfillment(
        self,
        client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        initial_credits = test_user.scan_credits

        # Synthesize checkout.session.completed event for 25 credit pack
        webhook_event = {
            "id": "evt_test_checkout_pack",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_webhook_pack",
                    "client_reference_id": test_user.id,
                    "mode": "payment",
                    "metadata": {
                        "user_id": test_user.id,
                        "plan_id": "credits_25",
                        "credits": "25"
                    }
                }
            }
        }

        # Send raw webhook payload
        payload_bytes = json.dumps(webhook_event).encode("utf-8")
        response = await client.post(
            "/api/webhook",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "stripe-signature": "t=123,v1=mock_signature"
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "processed"

        # Verify user record updated in database
        query = select(User).where(User.id == test_user.id)
        res = await db_session.execute(query)
        updated_user = res.scalar_one()
        assert updated_user.scan_credits == initial_credits + 25

    @pytest.mark.asyncio
    async def test_stripe_webhook_pro_subscription_upgrade(
        self,
        client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        # Synthesize checkout.session.completed event for Pro subscription
        webhook_event = {
            "id": "evt_test_checkout_pro",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_webhook_pro",
                    "client_reference_id": test_user.id,
                    "mode": "subscription",
                    "metadata": {
                        "user_id": test_user.id,
                        "plan_id": "pro_monthly"
                    }
                }
            }
        }

        payload_bytes = json.dumps(webhook_event).encode("utf-8")
        response = await client.post(
            "/api/webhook",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "stripe-signature": "t=123,v1=mock_signature"
            }
        )
        assert response.status_code == 200

        # Verify user upgraded to PRO
        query = select(User).where(User.id == test_user.id)
        res = await db_session.execute(query)
        updated_user = res.scalar_one()
        assert updated_user.subscription_tier == "pro"
        assert updated_user.subscription_status == "active"
