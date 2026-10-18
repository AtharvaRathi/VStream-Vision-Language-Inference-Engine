import asyncio
import base64
import ollama

async def test_moondream():
    with open("dog.jpg", "rb") as f:
        frame_bytes = f.read()
    
    print("Testing moondream with a dog image...")
    client = ollama.AsyncClient(host="http://localhost:11434")
    response = await client.generate(
        model="moondream",
        prompt="Describe this image concisely in one sentence.",
        images=[frame_bytes]
    )
    content = response.get("response", "")
    print("RAW CONTENT:", repr(content))

if __name__ == "__main__":
    asyncio.run(test_moondream())
