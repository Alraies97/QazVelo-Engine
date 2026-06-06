import asyncio
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from app.services.market_data import MarketDataService
from app.services.analytics import MarketAnalyticsService
import jwt
from app.core.security import ALGORITHM, SECRET_KEY

async def get_current_user_from_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None

router = APIRouter(tags=["Real-time Streaming"])

@router.websocket("/ws/analytics/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str,window: int = 5):

    await websocket.accept()
    print(f"Client connected for ticker: {ticker}")

    try:
        auth_data = await websocket.receive_json()
        token = auth_data.get("token")
        if not token:
            print("No token provided")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        username = await get_current_user_from_token(token)
        if not username:
            print("Invalid token")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        print(f"User {username} authenticated for ticker {ticker}")
    except Exception as e:
        print(f"Authentication error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        base_prices = MarketDataService.get_historical_price(ticker=ticker.upper(), period="1mo")

        if not base_prices:
            await websocket.send_json({"error": f"No historical data found for ticker: {ticker}"})
            await websocket.close()
            return

        rolling_prices = base_prices[-30:]

        while True:
            last_price = rolling_prices[-1]

            volatility_factor = 0.0015 
            change_percent = random.uniform(-volatility_factor, volatility_factor)
            new_live_price = round(last_price * (1 + change_percent), 2)

            if new_live_price <= 0:
               new_live_price = last_price

            rolling_prices.append(new_live_price)
            if len(rolling_prices) > 100:
                rolling_prices.pop(0)


            analytics_result = MarketAnalyticsService.process_market_indicators(
                prices=rolling_prices,
                period=window
            )

            payload = {
                "ticker": ticker.upper(),
                "live_price": new_live_price,
                "metrics": analytics_result.get("metrics", {})
            }

            await websocket.send_json(payload)
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        print(f"Client disconnected from ticker: {ticker}")

    except Exception as e:
        print(f"Error in WebSocket for ticker {ticker}: {e}")
        await websocket.send_json({"error": "An error occurred while processing data."})
        await websocket.close()
    
