import asyncio
import websockets
import json

async def test_pipeline():
    # 🌟 1. ضع هنا توكن JWT صالح (Access Token) قمت بتوليده من مسار الـ login سابقاً
    TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhc2RlciIsInVzZXJfaWQiOjEsImV4cCI6MTc4MjQ1NTIwNiwidHlwZSI6ImFjY2VzcyJ9.lsyZCo5SLoWQRLneA6BmNpl32hxMhM-fNJDO8Xz6pGE"

    url = f"ws://127.0.0.1:8000/ws/analytics?token={TOKEN}"
    
    print(f"Connecting to {url}...")
    try:
        async with websockets.connect(url) as websocket:
            print("✅ Connected successfully to the pipeline!")
            
            # 🌟 2. تجهيز بيانات وهمية تطابق الـ Pydantic Schema تماماً
            mock_data = {
                "metric_name": "BTC/USDT",
                "metric_value": 68450.75,
                "extra_payload": {
                    "bid_volume": 15.4,
                    "ask_volume": 8.9,
                    "engine_source": "QuantFlow_v1"
                }
            }
            
            # إرسال البيانات كـ نص JSON
            print(f"Sending mock data: {mock_data}")
            await websocket.send(json.dumps(mock_data))
            
            # استقبال رد السيرفر (Acknowledgment)
            response = await websocket.recv()
            print(f"📥 Server Response: {response}")
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")

# تشغيل الفحص
asyncio.run(test_pipeline())