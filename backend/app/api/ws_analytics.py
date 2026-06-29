from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.core.database import AsyncSessionLocal
from app.api.users import get_current_user
from app.schemas.analytics import AnalyticsCreate
from app.models.analytics import AnalyticsModel
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
import json

router = APIRouter(prefix="/ws", tags=["WebSockets"])


@router.websocket("/analytics")
async def websocket_analytics_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    await websocket.accept()

    # --- Authentication ---
    # Resolve user inside a short-lived session, then extract plain scalar
    # values immediately so we never carry a detached ORM instance.
    try:
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        async with AsyncSessionLocal() as auth_db:
            current_user = await get_current_user(credentials=credentials, db=auth_db)
            user_id: int = current_user.id
            username: str = current_user.username
    except Exception as exc:
        print(f"WebSocket auth error: {exc}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    # --- Message loop (single persistent session for all writes) ---
    try:
        async with AsyncSessionLocal() as db:
            while True:
                data = await websocket.receive_json()

                try:
                    raw_json = json.loads(data) if isinstance(data, str) else data
                    validated = AnalyticsCreate(**raw_json)

                    payload = {
                        "user_id": user_id,
                        "metric_name": validated.metric_name,
                        "metric_value": validated.metric_value,
                        "extra_payload": validated.extra_payload,
                    }

                    producer = getattr(websocket.app.state, "kafka_producer", None)

                    if producer:
                        # Kafka path: queue for async processing
                        await producer.send_and_wait("market_analytics", payload)
                        await websocket.send_json({
                            "status": "success",
                            "message": "Data queued for processing",
                            "metric": validated.metric_name,
                        })
                    else:
                        # No-Kafka fallback: persist directly to DB and acknowledge
                        record = AnalyticsModel(
                            user_id=user_id,
                            metric_name=validated.metric_name,
                            metric_value=validated.metric_value,
                            extra_payload=validated.extra_payload,
                        )
                        db.add(record)
                        await db.commit()
                        await db.refresh(record)
                        await websocket.send_json({
                            "status": "success",
                            "message": "Data persisted directly (no broker)",
                            "metric": validated.metric_name,
                            "record_id": record.id,
                        })

                except json.JSONDecodeError:
                    await websocket.send_json({"status": "error", "message": "Invalid JSON"})
                except ValidationError as exc:
                    await websocket.send_json({"status": "error", "message": exc.errors()})

    except WebSocketDisconnect:
        print(f"Client '{username}' (id={user_id}) disconnected from analytics stream.")
