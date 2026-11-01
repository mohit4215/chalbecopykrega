"""
Real-time Task Progress Streaming Service.
Supports Redis Pub/Sub (for distributed Celery workers) with automatic in-process fallback
for single-process/eager deployments and testing environments.
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional, Set, Tuple, AsyncGenerator
from app.tasks.celery_worker import EAGER_TASK_STORE, record_eager_result

logger = logging.getLogger("plagiarism.task_stream")

REDIS_URL = (os.getenv("REDIS_URL") or os.getenv("CELERY_BROKER_URL") or "").strip()

# In-process subscription registry: task_id -> set of (asyncio_loop, queue)
_LOCAL_SUBSCRIPTIONS: Dict[str, Set[Tuple[asyncio.AbstractEventLoop, asyncio.Queue]]] = {}
_sync_redis_client = None


def _get_sync_redis():
    """Lazy initialize sync Redis client for publishing from worker threads."""
    global _sync_redis_client
    if not REDIS_URL or not REDIS_URL.startswith(("redis://", "rediss://")):
        return None
    if _sync_redis_client is None:
        try:
            import redis
            _sync_redis_client = redis.from_url(REDIS_URL, socket_timeout=3, socket_connect_timeout=3)
        except Exception as e:
            logger.warning(f"Could not initialize sync Redis client for pub/sub: {e}")
            _sync_redis_client = None
    return _sync_redis_client


def publish_task_event(task_id: str, event: Dict[str, Any]) -> None:
    """
    Publish a live task progress event to both Redis Pub/Sub (if available)
    and in-memory WebSocket subscriber queues.
    """
    if not task_id:
        return

    # 1. Update eager task store for queryable persistence
    status = event.get("status", "processing")
    state = "SUCCESS" if status == "success" else ("FAILURE" if status == "failure" else "PROGRESS")
    record_eager_result(
        task_id=task_id,
        state=state,
        result=event.get("report"),
        error=event.get("error"),
        step=event.get("step"),
        progress=event.get("progress"),
        message=event.get("message"),
    )

    # 2. Publish to Redis Pub/Sub channel if configured
    r = _get_sync_redis()
    if r:
        try:
            channel = f"task_progress:{task_id}"
            r.publish(channel, json.dumps(event))
            logger.debug(f"Published event to Redis channel {channel}: {event.get('step')}")
        except Exception as exc:
            logger.warning(f"Failed to publish task event to Redis ({task_id}): {exc}")

    # 3. Publish to local in-process subscribers (thread-safe)
    subscribers = _LOCAL_SUBSCRIPTIONS.get(task_id)
    if subscribers:
        dead_subs = set()
        for loop, queue in list(subscribers):
            try:
                if loop.is_running():
                    loop.call_soon_threadsafe(queue.put_nowait, event)
                else:
                    queue.put_nowait(event)
            except Exception as exc:
                logger.debug(f"Error dispatching to subscriber queue: {exc}")
                dead_subs.add((loop, queue))
        if dead_subs:
            subscribers.difference_update(dead_subs)


def _register_local_subscriber(task_id: str, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue) -> None:
    if task_id not in _LOCAL_SUBSCRIPTIONS:
        _LOCAL_SUBSCRIPTIONS[task_id] = set()
    _LOCAL_SUBSCRIPTIONS[task_id].add((loop, queue))


def _unregister_local_subscriber(task_id: str, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue) -> None:
    if task_id in _LOCAL_SUBSCRIPTIONS:
        _LOCAL_SUBSCRIPTIONS[task_id].discard((loop, queue))
        if not _LOCAL_SUBSCRIPTIONS[task_id]:
            _LOCAL_SUBSCRIPTIONS.pop(task_id, None)


async def subscribe_task_events(task_id: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Subscribes to real-time events for a specific task.
    Yields initial state if already recorded, then streams live progress events.
    Exits once a terminal state ('success' or 'failure') is received.
    """
    # Check if task is already in a terminal or progress state
    stored = EAGER_TASK_STORE.get(task_id)
    if stored is not None:
        state = stored.get("state")
        if state == "SUCCESS":
            yield {
                "task_id": task_id,
                "status": "success",
                "step": "completed",
                "progress": 100,
                "message": "Plagiarism analysis completed successfully!",
                "report": stored.get("result"),
            }
            return
        elif state == "FAILURE":
            err = stored.get("error") or "Document processing failed."
            yield {
                "task_id": task_id,
                "status": "failure",
                "step": "failed",
                "progress": 0,
                "message": err,
                "error": err,
            }
            return
        elif state in ("PROGRESS", "processing"):
            yield {
                "task_id": task_id,
                "status": "processing",
                "step": stored.get("step", "processing"),
                "progress": stored.get("progress", 25),
                "message": stored.get("message", "Processing document..."),
            }

    # 1. Try Redis Async Pub/Sub if REDIS_URL is configured
    if REDIS_URL and REDIS_URL.startswith(("redis://", "rediss://")):
        try:
            import redis.asyncio as aioredis
            redis_async = aioredis.from_url(REDIS_URL, decode_responses=True, socket_timeout=5)
            pubsub = redis_async.pubsub()
            channel = f"task_progress:{task_id}"
            await pubsub.subscribe(channel)
            logger.info(f"Subscribed to Redis channel {channel}")

            try:
                while True:
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message.get("type") == "message":
                        data_str = message.get("data")
                        if data_str:
                            event = json.loads(data_str)
                            yield event
                            if event.get("status") in ("success", "failure"):
                                return
                    # Periodic heartbeat / check eager store in case message was dropped
                    await asyncio.sleep(0.1)
                    current_stored = EAGER_TASK_STORE.get(task_id)
                    if current_stored and current_stored.get("state") in ("SUCCESS", "FAILURE"):
                        if current_stored.get("state") == "SUCCESS":
                            yield {
                                "task_id": task_id,
                                "status": "success",
                                "step": "completed",
                                "progress": 100,
                                "message": "Plagiarism analysis completed successfully!",
                                "report": current_stored.get("result"),
                            }
                        else:
                            yield {
                                "task_id": task_id,
                                "status": "failure",
                                "step": "failed",
                                "progress": 0,
                                "message": current_stored.get("error", "Failed"),
                                "error": current_stored.get("error"),
                            }
                        return
            finally:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
                await redis_async.close()
        except Exception as redis_exc:
            logger.warning(f"Redis pub/sub subscriber failed ({redis_exc}); falling back to local queue.")

    # 2. In-Process Queue Fallback
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()
    _register_local_subscriber(task_id, loop, queue)

    try:
        while True:
            # Wait for event with a timeout to verify if completed in eager store
            try:
                event = await asyncio.wait_for(queue.get(), timeout=2.0)
                yield event
                if event.get("status") in ("success", "failure"):
                    break
            except asyncio.TimeoutError:
                current_stored = EAGER_TASK_STORE.get(task_id)
                if current_stored and current_stored.get("state") in ("SUCCESS", "FAILURE"):
                    if current_stored.get("state") == "SUCCESS":
                        yield {
                            "task_id": task_id,
                            "status": "success",
                            "step": "completed",
                            "progress": 100,
                            "message": "Plagiarism analysis completed successfully!",
                            "report": current_stored.get("result"),
                        }
                    else:
                        yield {
                            "task_id": task_id,
                            "status": "failure",
                            "step": "failed",
                            "progress": 0,
                            "message": current_stored.get("error", "Failed"),
                            "error": current_stored.get("error"),
                        }
                    break
    finally:
        _unregister_local_subscriber(task_id, loop, queue)
