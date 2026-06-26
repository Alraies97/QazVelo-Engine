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
                data = await websocket.receive_text()

                try:
                    raw_json = json.loads(data)
                    validated: AnalyticsCreate = AnalyticsCreate(**raw_json)

                    db_record = AnalyticsModel(
                        user_id=user_id,
                        metric_name=validated.metric_name,
                        metric_value=validated.metric_value,
                        extra_payload=validated.extra_payload,
                    )
                    db.add(db_record)
                    await db.commit()
                    await db.refresh(db_record)

                    await websocket.send_json({
                        "status": "success",
                        "message": "Data persisted",
                        "record_id": db_record.id,
                        "metric": validated.metric_name,
                    })

                except json.JSONDecodeError:
                    await websocket.send_json({"status": "error", "message": "Invalid JSON"})
                except ValidationError as exc:
                    await websocket.send_json({"status": "error", "message": exc.errors()})

    except WebSocketDisconnect:
        print(f"Client '{username}' (id={user_id}) disconnected from analytics stream.")
