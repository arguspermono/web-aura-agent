# Aura-Agent FastAPI Backend Implementation Plan

This document outlines the architecture and implementation steps for the Aura-Agent autonomous e-commerce complaint resolution backend.

## User Review Required

> [!IMPORTANT]
> The backend relies heavily on Google Cloud Platform and Firebase services. You will need to provide service account credentials or set up the appropriate GCP environment variables for local testing once the code is written.

## Resolved Questions & Feedback

1. **Project Structure**: You requested lowercase with dashes. Note: Python package names (folders you import from) *must* use underscores instead of dashes (e.g., `ai_service` not `ai-service`) otherwise Python will throw a syntax error during `import`. I will use underscores for Python modules, but the main project directory and any non-code folders can use dashes.
2. **Midtrans**: Since you don't have a key yet, I will mock the Midtrans payment refund logic so the pipeline can still succeed and return a simulated success response.
3. **BigQuery**: I will create a mock BigQuery structure and query for user trust scores and claim history.
4. **Google Cloud Run**: To connect to Google Cloud Run, we will containerize the app using Docker. I will include a `Dockerfile` and `cloudbuild.yaml` (or CLI commands) so you can deploy it seamlessly to Cloud Run.

## Proposed Architecture & Changes

We will use a layered architecture for the FastAPI project to keep the code modular and testable. The code will be placed in `c:\web_programming\web_aura_agent_app`.

### 1. Project Initialization & Dependencies
- Set up `requirements.txt` with dependencies: `fastapi`, `uvicorn`, `python-multipart`, `firebase-admin`, `google-cloud-storage`, `google-cloud-bigquery`, `google-cloud-aiplatform`, `pillow`, `midtransclient`, `pydantic`.
- Add a `Dockerfile` for Google Cloud Run deployment.

### 2. File Structure

#### [NEW] `main.py`
The entry point of the FastAPI application.

#### [NEW] `core/config.py`
Configuration management, loading environment variables.

#### [NEW] `models/schemas.py`
Pydantic models for request and response validation.

#### [NEW] `api/routers/claims.py`
FastAPI router containing the `/api/v1/claims` endpoints.

#### [NEW] `api/routers/upload.py`
FastAPI router containing the `/api/v1/upload` endpoint.

#### [NEW] `services/storage_service.py`
Service for handling uploads to Google Cloud Storage (or mocking it).

#### [NEW] `services/firebase_service.py`
Service for interacting with Firestore.

#### [NEW] `services/ai_service.py`
Service for calling Vertex AI / Gemini Vision Pro.

#### [NEW] `services/fraud_service.py`
Service for querying the mock Google BigQuery trust score.

#### [NEW] `services/payment_service.py`
Service for triggering the mock Midtrans refund API.

#### [NEW] `Dockerfile`
Configuration to build a container image for Google Cloud Run.

### 3. API Endpoints Implementation
- **POST `/api/v1/upload`**: Accept file, validate EXIF (if image), upload to GCS, return file ID and signed URL.
- **POST `/api/v1/claims`**: Save claim metadata to Firestore.
- **GET `/api/v1/claims/{claim_id}`**: Fetch claim document from Firestore.
- **GET `/api/v1/claims?user_id={uid}`**: Query Firestore for claims by user ID.
- **POST `/api/v1/claims/{claim_id}/analyze`**: The core AI analysis pipeline orchestrator.
- **GET `/api/v1/claims/{claim_id}/status`**: Lightweight fetch of the `status` field from Firestore.

## Verification Plan

### Automated Tests
- We will write basic unit tests for the endpoints using `TestClient` from FastAPI.

### Manual Verification
- Run the FastAPI server locally (`uvicorn main:app --reload`).
- Use the `/docs` Swagger UI to manually test the endpoints.

### Google Cloud Run Deployment
To deploy to Google Cloud Run, you will run:
1. `gcloud auth login`
2. `gcloud config set project YOUR_PROJECT_ID`
3. `gcloud run deploy aura-agent-backend --source . --region asia-southeast2 --allow-unauthenticated`
