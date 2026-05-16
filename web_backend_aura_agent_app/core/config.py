from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Aura-Agent API"
    VERSION: str = "1.0.0"
    # FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
    FRONTEND_ORIGINS: str = "*"

    # ── Mock mode ─────────────────────────────────────────────────────────────
    # Set MOCK_MODE=false in .env to enable real GCP integrations.
    # When True, all GCP calls are skipped and deterministic mock values returned.
    MOCK_MODE: bool = True

    # ── GCP / Firebase ────────────────────────────────────────────────────────
    GCP_PROJECT_ID: str = "your-gcp-project-id"
    GCS_BUCKET_NAME: str = "your-gcs-bucket-name"
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None  # Path to service account JSON
    FIREBASE_DATABASE_URL: Optional[str] = None           # e.g. https://<project>.firebaseio.com

    # ── Vertex AI / Gemini ────────────────────────────────────────────────────
    VERTEX_AI_LOCATION: str = "asia-southeast2"
    GEMINI_MODEL_ID: str = "gemini-2.5-flash"
    GOOGLE_AI_API_KEY: Optional[str] = None

    # ── BigQuery ──────────────────────────────────────────────────────────────
    BIGQUERY_DATASET: str = "aura_agent"
    BIGQUERY_TABLE: str = "user_trust_scores"

    # ── Midtrans Sandbox ──────────────────────────────────────────────────────
    MIDTRANS_IS_PRODUCTION: bool = False
    MIDTRANS_SERVER_KEY: str = "mock-server-key"
    MIDTRANS_CLIENT_KEY: str = "mock-client-key"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
