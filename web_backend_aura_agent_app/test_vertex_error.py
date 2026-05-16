import os
import asyncio
from google.cloud import storage
import vertexai
from vertexai.generative_models import GenerativeModel, Part

project_id = "aura-agent-495809"
location = "us-central1"
model_id = "gemini-1.5-pro-001"
bucket_name = "aura-agent-495809.firebasestorage.app"

async def test_vertex():
    vertexai.init(project=project_id, location=location)
    model = GenerativeModel(model_id)
    
    print("Test 1: Simple text prompt")
    try:
        response = await model.generate_content_async("Hello")
        print("Test 1 Success!")
    except Exception as e:
        print(f"Test 1 Failed: {e}")
        
    print("\nTest 2: Inline bytes (dummy image)")
    try:
        dummy_image = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00"
        part = Part.from_data(data=dummy_image, mime_type="image/jpeg")
        response = await model.generate_content_async([part, "Describe this image"])
        print("Test 2 Success!")
    except Exception as e:
        print(f"Test 2 Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_vertex())
