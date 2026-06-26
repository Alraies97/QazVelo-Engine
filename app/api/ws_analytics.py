from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
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
    token: str = Query(...) 
):
    await websocket.accept()
    
    try:
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        
        async with AsyncSessionLocal() as db:
            current_user = await get_current_user(credentials=credentials, db=db)
            
    except Exception as e:
        print(f"❌ WebSocket Auth Error: {str(e)}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                raw_json = json.loads(data)
                
                validated_data = AnalyticsCreate(**raw_json)
                
                db_record = AnalyticsModel(
                    user_id=current_user.id,
                    metric_name=validated_data.metric_name,
                    metric_value=validated_data.metric_value,
                    extra_payload=validated_data.extra_payload
                )
                
                async with AsyncSessionLocal() as db:
                    db.add(db_record)
                    await db.commit()
                
                await websocket.send_json({
                    "status": "success", 
                    "message": "Data persisted safely",
                    "metric": validated_data.metric_name
                })
                
            except (json.JSONDecodeError, ValidationError) as e:
                await websocket.send_json({"status": "error", "message": "Invalid data format"})
                
    except WebSocketDisconnect:
        print(f"Client {current_user.username} disconnected from analytics stream.")