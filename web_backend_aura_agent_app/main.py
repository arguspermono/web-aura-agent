from contextlib import asynccontextmanager
# pyright: ignore [missing-import]
from fastapi import FastAPI
# pyright: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.routers import upload, claims, users, auth, seller


def _parse_origins(raw_origins: str) -> list[str]:
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup / shutdown lifecycle handler.
    Initialises GCP clients and skills at startup, runs cleanup at shutdown.
    All real-GCP init is skipped when MOCK_MODE=True (default for local dev).
    """
    # ── Startup ───────────────────────────────────────────────────────────────
    if not settings.MOCK_MODE:
        from services.firebase_service import firebase_service
        from services.storage_service import storage_service
        from services.bigquery_service import bigquery_service

        firebase_service.init_firebase(
            credentials_path=settings.GOOGLE_APPLICATION_CREDENTIALS,
            database_url=settings.FIREBASE_DATABASE_URL,
            project_id=settings.GCP_PROJECT_ID,
        )
        storage_service.init_gcs(settings.GCS_BUCKET_NAME)
        bigquery_service.init_bq(
            project_id=settings.GCP_PROJECT_ID,
            dataset=settings.BIGQUERY_DATASET,
            table=settings.BIGQUERY_TABLE,
        )

    # Initialise the multimodal reasoning skill (Vertex AI)
    from services.skills.multimodal_reasoning import init_multimodal_skill
    init_multimodal_skill(settings)

    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    # Add any cleanup here (close DB connections, flush logs, etc.)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Backend for Aura-Agent — Autonomous AI Customer Support Agent "
        "for e-commerce claim resolution. Powered by Gemini via Vertex AI."
    ),
    lifespan=lifespan,
)
app.router.redirect_slashes = False

# CORS — restrict origins in production via environment variable
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(settings.FRONTEND_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(upload.router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(claims.router, prefix="/api/v1/claims", tags=["Claims"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(seller.router, prefix="/api/v1/seller", tags=["Seller"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "Welcome to Aura-Agent API",
        "docs": "/docs",
        "version": settings.VERSION,
        "mock_mode": settings.MOCK_MODE,
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "mock_mode": settings.MOCK_MODE}
