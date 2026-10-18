import asyncio
import websockets
import json

async def listen():
    uri = "ws://localhost:8000/ws/stream?source=webcam"
    async with websockets.connect(uri) as websocket:
        print("Connected to WS")
        for i in range(10):
            try:
                message = await websocket.recv()
                data = json.loads(message)
                print(f"Frame {data.get('totalFrames')}:")
                print(f"  dropped: {data.get('droppedFrames')}")
                print(f"  narration: {repr(data.get('narration'))}")
            except Exception as e:
                print("Error:", e)
                break

if __name__ == "__main__":
    asyncio.run(listen())
