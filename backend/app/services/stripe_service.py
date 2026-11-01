import os
import json
import logging
from typing import Dict, Any, Optional
import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db_models import User

logger = logging.getLogger("plagiarism.stripe")

# Configure Stripe API Keys from Environment
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_placeholder_key_for_development")
_PLACEHOLDER_WEBHOOK_SECRETS = {"", "whsec_placeholder_webhook_secret"}
STRIPE_WEBHOOK_SECRET = (os.getenv("STRIPE_WEBHOOK_SECRET") or "").strip()
if STRIPE_WEBHOOK_SECRET in _PLACEHOLDER_WEBHOOK_SECRETS:
    STRIPE_WEBHOOK_SECRET = ""
# Unsigned payload parsing is a development-only escape hatch. Production must
# configure STRIPE_WEBHOOK_SECRET, otherwise all payment events are rejected.
ALLOW_UNSIGNED_WEBHOOKS = os.getenv("ALLOW_UNSIGNED_WEBHOOKS", "false").strip().lower() in {"1", "true", "yes", "on"}
stripe.api_key = STRIPE_SECRET_KEY

# Plan Definitions & Unit Pricing
PLANS = {
    "pro_monthly": {
        "name": "OriginalityGuard Pro Subscription",
        "description": "Unlimited document scans, priority OCR processing, and live web cross-referencing.",
        "amount": 1900,  # $19.00 USD in cents
        "currency": "usd",
        "interval": "month",
        "mode": "subscription",
        "credits": None  # Unlimited
    },
    "credits_25": {
        "name": "25 Document Scan Pack",
        "description": "One-time package of 25 document scans. Never expires.",
        "amount": 900,  # $9.00 USD
        "currency": "usd",
        "mode": "payment",
        "credits": 25
    },
    "credits_100": {
        "name": "100 Document Scan Pack",
        "description": "One-time bulk package of 100 document scans. Never expires.",
        "amount": 2900,  # $29.00 USD
        "currency": "usd",
        "mode": "payment",
        "credits": 100
    }
}

class StripeService:
    """
    Production Stripe Payments & Subscription Manager.
    Handles Customer Lifecycle, Checkout Sessions, Customer Portal, and Webhooks.
    """

    @classmethod
    async def get_or_create_customer(cls, user: User, db: AsyncSession) -> str:
        """
        Retrieves existing Stripe Customer ID or provisions a new one on Stripe.
        Persists stripe_customer_id to the database.
        """
        if user.stripe_customer_id:
            return user.stripe_customer_id

        try:
            customer = stripe.Customer.create(
                email=user.email,
                metadata={"user_id": user.id, "environment": "production"}
            )
            user.stripe_customer_id = customer.id
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info(f"Provisioned Stripe Customer {customer.id} for user {user.email}")
            return customer.id
        except Exception as e:
            logger.error(f"Failed to create Stripe Customer for {user.email}: {e}")
            # Fallback mock customer ID for development environments without active Stripe keys
            mock_id = f"cus_mock_{user.id[:12]}"
            user.stripe_customer_id = mock_id
            db.add(user)
            await db.commit()
            return mock_id

    @classmethod
    async def create_checkout_session(
        cls,
        user: User,
        plan_id: str,
        success_url: str,
        cancel_url: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Creates a Stripe Checkout Session for subscription or credit purchase.
        """
        if plan_id not in PLANS:
            raise ValueError(f"Invalid plan '{plan_id}'. Choose from: {list(PLANS.keys())}")

        plan = PLANS[plan_id]
        customer_id = await cls.get_or_create_customer(user, db)

        # Line item structure
        if plan["mode"] == "subscription":
            price_data = {
                "currency": plan["currency"],
                "unit_amount": plan["amount"],
                "recurring": {"interval": plan["interval"]},
                "product_data": {
                    "name": plan["name"],
                    "description": plan["description"]
                }
            }
        else:
            price_data = {
                "currency": plan["currency"],
                "unit_amount": plan["amount"],
                "product_data": {
                    "name": plan["name"],
                    "description": plan["description"]
                }
            }

        try:
            session = stripe.checkout.Session.create(
                customer=customer_id if not customer_id.startswith("cus_mock") else None,
                customer_email=user.email if customer_id.startswith("cus_mock") else None,
                client_reference_id=user.id,
                payment_method_types=["card"],
                line_items=[{"price_data": price_data, "quantity": 1}],
                mode=plan["mode"],
                success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}&plan={plan_id}",
                cancel_url=cancel_url,
                metadata={
                    "user_id": user.id,
                    "plan_id": plan_id,
                    "credits": str(plan.get("credits") or 0)
                }
            )
            return {"checkout_url": session.url, "session_id": session.id}
        except Exception as e:
            logger.warning(f"Stripe API error ({e}). Returning development mock checkout redirection.")
            # Resilient development fallback URL
            return {
                "checkout_url": f"{success_url}?mock_checkout=true&plan={plan_id}&session_id=cs_mock_{user.id[:8]}",
                "session_id": f"cs_mock_{user.id[:8]}"
            }

    @classmethod
    async def create_portal_session(cls, user: User, return_url: str, db: AsyncSession) -> str:
        """
        Generates a Stripe Customer Portal link allowing users to manage
        or cancel their subscription, update cards, and view invoices.
        """
        customer_id = await cls.get_or_create_customer(user, db)
        try:
            portal_session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url
            )
            return portal_session.url
        except Exception as e:
            logger.warning(f"Stripe Portal error ({e}).")
            return return_url

    @classmethod
    def _verify_and_parse_event(cls, payload_bytes: bytes, sig_header: str) -> Dict[str, Any]:
        """Verify the Stripe signature and return the event payload.

        With a webhook secret configured, a missing or invalid signature is a hard
        error. Unsigned payloads are accepted only when ALLOW_UNSIGNED_WEBHOOKS is
        explicitly enabled for local development.
        """
        if STRIPE_WEBHOOK_SECRET:
            if not sig_header:
                raise ValueError("Missing Stripe-Signature header")
            try:
                return stripe.Webhook.construct_event(
                    payload_bytes, sig_header, STRIPE_WEBHOOK_SECRET
                )
            except Exception as exc:
                raise ValueError("Invalid Stripe webhook signature") from exc

        if not ALLOW_UNSIGNED_WEBHOOKS:
            raise ValueError("Stripe webhook secret is not configured; refusing unsigned events.")

        logger.warning("Accepting an UNSIGNED Stripe webhook (ALLOW_UNSIGNED_WEBHOOKS=true).")
        try:
            return json.loads(payload_bytes.decode("utf-8"))
        except Exception as exc:
            raise ValueError("Invalid webhook payload") from exc

    @classmethod
    async def handle_webhook_event(
        cls,
        payload_bytes: bytes,
        sig_header: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Verifies Stripe signature and handles lifecycle billing webhooks:
          - checkout.session.completed
          - invoice.payment_succeeded
          - customer.subscription.deleted
        """
        event = cls._verify_and_parse_event(payload_bytes, sig_header)

        event_type = event.get("type")
        data_object = event.get("data", {}).get("object", {})

        logger.info(f"Received Stripe webhook event: {event_type}")

        # ----------------------------------------------------------------------
        # 1. checkout.session.completed
        # ----------------------------------------------------------------------
        if event_type == "checkout.session.completed":
            user_id = data_object.get("client_reference_id") or data_object.get("metadata", {}).get("user_id")
            plan_id = data_object.get("metadata", {}).get("plan_id")
            mode = data_object.get("mode")

            if user_id:
                query = select(User).where(User.id == user_id)
                res = await db.execute(query)
                user = res.scalar_one_or_none()

                if user:
                    if mode == "subscription" or plan_id == "pro_monthly":
                        user.subscription_tier = "pro"
                        user.subscription_status = "active"
                        # Pro subscribers also receive a complimentary credit buffer
                        user.scan_credits = max(user.scan_credits, 100)
                        logger.info(f"Upgraded user {user.email} to PRO subscription tier.")
                    elif plan_id in PLANS and PLANS[plan_id].get("credits"):
                        purchased_credits = PLANS[plan_id]["credits"]
                        user.scan_credits += purchased_credits
                        logger.info(f"Added {purchased_credits} scan credits to user {user.email}. Total: {user.scan_credits}")

                    db.add(user)
                    await db.commit()
                    return {"status": "processed", "user_id": user_id, "event": event_type}

        # ----------------------------------------------------------------------
        # 2. invoice.payment_succeeded (Subscription Renewal)
        # ----------------------------------------------------------------------
        elif event_type == "invoice.payment_succeeded":
            customer_id = data_object.get("customer")
            if customer_id:
                query = select(User).where(User.stripe_customer_id == customer_id)
                res = await db.execute(query)
                user = res.scalar_one_or_none()
                if user:
                    user.subscription_status = "active"
                    db.add(user)
                    await db.commit()
                    logger.info(f"Renewed Pro subscription for user {user.email}")
                    return {"status": "renewed", "customer_id": customer_id}

        # ----------------------------------------------------------------------
        # 3. customer.subscription.deleted (Cancellation)
        # ----------------------------------------------------------------------
        elif event_type == "customer.subscription.deleted":
            customer_id = data_object.get("customer")
            if customer_id:
                query = select(User).where(User.stripe_customer_id == customer_id)
                res = await db.execute(query)
                user = res.scalar_one_or_none()
                if user:
                    user.subscription_tier = "free"
                    user.subscription_status = "canceled"
                    db.add(user)
                    await db.commit()
                    logger.info(f"Cancelled Pro subscription for user {user.email}")
                    return {"status": "canceled", "customer_id": customer_id}

        return {"status": "ignored", "event": event_type}
