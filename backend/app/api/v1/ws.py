"""WebSocket API for real-time updates."""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.events import EVENTS_CHANNEL, event_bus
from app.core.logging import get_logger
from app.core.redis import get_redis_context
from app.services.auth import AuthService

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = get_logger(__name__)

@router.websocket("")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint for receiving real-time system events.
    """
    user = None
    try:
        # Accept connection first to be able to send error message if auth fails
        await websocket.accept()
        
        if not token:
            logger.warning("WebSocket connection attempt without token")
            await websocket.send_json({"type": "ERROR", "message": "Authentication required"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Authenticate user
        auth_service = AuthService(db)
        try:
            user = await auth_service.validate_access_token(token)
        except Exception as auth_err:
            logger.error("WebSocket auth error", error=str(auth_err))
            await websocket.send_json({"type": "ERROR", "message": "Authentication failed"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        if not user:
            logger.warning("WebSocket connection attempt with invalid token")
            await websocket.send_json({"type": "ERROR", "message": "Invalid token"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        logger.info("WebSocket connected", user_id=str(user.id), email=user.email)
        
        # Subscribe to Redis Pub/Sub events
        async with get_redis_context() as redis:
            pubsub = redis.pubsub()
            await pubsub.subscribe(EVENTS_CHANNEL)
            
            # Keep track of the background task
            stop_event = asyncio.Event()
            
            async def listen_to_redis():
                try:
                    while not stop_event.is_set():
                        # Use a timeout to allow checking stop_event
                        message = await pubsub.get_message(timeout=1.0)
                        if message and message["type"] == "message":
                            # Forward the Redis message to the WebSocket client
                            await websocket.send_text(message["data"])
                except Exception as e:
                    if not stop_event.is_set():
                        logger.error("Error in Redis listen task", error=str(e))
                finally:
                    try:
                        await pubsub.unsubscribe(EVENTS_CHANNEL)
                        await pubsub.close()
                    except Exception:
                        pass

            # Run listener in background
            listen_task = asyncio.create_task(listen_to_redis())
            
            try:
                # Keep connection alive and handle client disconnects
                while True:
                    # We don't expect messages from the client, but we need to listen
                    # to detect when the connection is closed.
                    await websocket.receive_text()
            except WebSocketDisconnect:
                logger.info("WebSocket disconnected", user_id=str(user.id))
            finally:
                stop_event.set()
                listen_task.cancel()
                try:
                    await listen_task
                except asyncio.CancelledError:
                    pass
                    
    except Exception as e:
        user_id = str(user.id) if user else "anonymous"
        logger.error("WebSocket unexpected error", error=str(e), user_id=user_id)
        try:
            if not websocket.client_state.name == "DISCONNECTED":
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass

