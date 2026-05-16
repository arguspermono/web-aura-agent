import os
import vertexai
from vertexai.generative_models import GenerativeModel

project_id = "aura-agent-495809"
location = "us-central1"
model_id = "gemini-1.5-pro"

print(f"Testing project={project_id}, location={location}, model={model_id}")
vertexai.init(project=project_id, location=location)

try:
    model = GenerativeModel(model_id)
    response = model.generate_content("Hello")
    print("Success:", response.text)
except Exception as e:
    print("Error:", e)
