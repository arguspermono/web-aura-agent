# Aura-Agent Backend Description

## Overview
Aura-Agent is an autonomous AI customer support backend designed to streamline and automate e-commerce complaint resolutions. The system orchestrates multimodal data analysis, forensic validation, and automated decision-making to process customer claims, analyze evidence, and issue refunds securely and efficiently.

## Architecture & Tech Stack
The backend is built with a layered architecture to maintain modularity and testability.
- **Framework**: FastAPI (Python 3.10+) for high-performance, asynchronous API endpoints.
- **AI Orchestration**: Google Vertex AI (Gemini 3.1 Pro) for multimodal reasoning and image/text analysis.
- **Database**: Firebase Firestore for real-time state tracking and metadata storage.
- **Storage**: Google Cloud Storage (GCS) for secure, scalable handling of user-submitted evidence.
- **Payment Processing**: Midtrans integration for automated refund execution.
- **Messaging**: Firebase Cloud Messaging (FCM) for push notifications and real-time client updates.
- **Deployment**: Containerized via Docker, targeting Google Cloud Run for serverless scalability.

## Core Services
The system is divided into domain-specific service modules:
- **`services/ai_service.py`**: Interacts with Vertex AI / Gemini Vision Pro to perform multimodal analysis on text complaints and image evidence.
- **`services/fraud_service.py`**: Evaluates user trust scores (mocked via BigQuery) and inspects EXIF data to detect potentially fraudulent claims.
- **`services/storage_service.py`**: Handles file uploads to Google Cloud Storage and generates signed URLs for secure access.
- **`services/firebase_service.py`**: Interfaces with Firestore for CRUD operations on claims and real-time state updates.
- **`services/payment_service.py`**: Manages automated refunds via the Midtrans API when a claim is approved.

## Key API Endpoints
- **POST `/api/v1/upload`**: Accepts evidence files, extracts EXIF metadata, uploads to GCS, and returns a signed URL.
- **POST `/api/v1/claims`**: Creates and saves new claim metadata into Firestore.
- **GET `/api/v1/claims/{claim_id}`**: Retrieves the details of a specific claim.
- **GET `/api/v1/claims?user_id={uid}`**: Fetches all claims submitted by a specific user.
- **POST `/api/v1/claims/{claim_id}/analyze`**: Triggers the core asynchronous AI analysis pipeline.
- **GET `/api/v1/claims/{claim_id}/status`**: Lightweight polling endpoint for retrieving the current processing step.

## AI Analysis Pipeline Workflow
The core feature of Aura-Agent is its automated, asynchronous analysis pipeline. The process transitions through the following phases:
1. **`uploading_evidence`**: Validating and securely storing user files.
2. **`analyzing_evidence`**: Utilizing Gemini Multimodal models to assess damage and cross-reference with the user's textual complaint.
3. **`detecting_damage_patterns`**: Forensically validating metadata (EXIF) to ensure image authenticity.
4. **`calculating_confidence_score`**: Aggregating AI reasoning, trust scores, and forensic data into a unified decision metric.
5. **`generating_report`**: Creating a structured resolution summary.
6. **`complete` / `failed`**: Executing final actions (like Midtrans refunds) and notifying the client via FCM.

## Configuration & Testing
The system includes a robust `MOCK_MODE` (configured via `.env`) that bypasses real GCP/Midtrans connections, returning deterministic mock responses. This enables seamless frontend integration testing without risking live data or incurring cloud infrastructure costs.
