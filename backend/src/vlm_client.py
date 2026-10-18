import os
import httpx
import logging
import asyncio
from dotenv import load_dotenv

load_dotenv()

VLM_PROVIDER = os.getenv("VLM_PROVIDER", "mock") # 'mock', 'ollama', 'cloud'
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "moondream")

logger = logging.getLogger(__name__)

MOCK_NARRATIONS = [
    "A person in a red jacket walks into the frame.",
    "A silver car drives past the intersection.",
    "A bird lands on the street lamp.",
    "Two people are having a conversation near the entrance.",
    "The camera detects significant movement in the background.",
    "A delivery truck parks on the side of the road."
]
mock_idx = 0

def generate_narration_sync(frame_base64: str) -> str:
    """
    Synchronous narration generator for execution in worker threads via asyncio.to_thread().
    """
    if VLM_PROVIDER == "mock":
        global mock_idx
        narration = MOCK_NARRATIONS[mock_idx % len(MOCK_NARRATIONS)]
        mock_idx += 1
        return narration
    
    if VLM_PROVIDER == "ollama":
        try:
            import ollama
            client = ollama.Client(host=OLLAMA_HOST)
            response = client.chat(
                model=OLLAMA_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": "This is security camera footage. Focus on the green bounding box or primary subject in motion. Describe the specific security event or person's action in one clear, objective sentence. If the image is unclear, state 'Subject in motion near the camera.'",
                        "images": [frame_base64],
                    }
                ],
                options={"num_predict": 45},
                stream=False
            )
            content = ""
            if hasattr(response, "message") and hasattr(response.message, "content"):
                content = response.message.content.strip()
            elif isinstance(response, dict):
                content = response.get("message", {}).get("content", "").strip()

            if not content:
                content = "No narration generated."
            return content
        except ImportError:
            logger.error("ollama python package not installed.")
            return "Error: ollama package missing."
        except Exception as e:
            logger.error(f"Ollama connection error: {e}")
            return "Failed to connect to Ollama."

    if VLM_PROVIDER == "cloud":
        return "Cloud API provider not fully configured yet. Add your OpenAI logic here."
            
    return f"Unsupported VLM_PROVIDER: {VLM_PROVIDER}"

async def generate_narration(frame_base64: str) -> str:
    """
    Asynchronous wrapper calling generate_narration_sync via asyncio.to_thread.
    """
    return await asyncio.to_thread(generate_narration_sync, frame_base64)
