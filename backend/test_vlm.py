import asyncio
from src.vlm_client import generate_narration
import cv2
import base64
import numpy as np

async def test():
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
    frame_b64 = base64.b64encode(buffer).decode('utf-8')
    res = await generate_narration(frame_b64)
    print("NARRATION RESULT:", res)

if __name__ == "__main__":
    asyncio.run(test())
