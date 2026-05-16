"""
Seed Script: BigQuery User Trust Scores
========================================
Inserts 50 mock user records into the BigQuery aura_agent.user_trust_scores table.

Usage:
    python -m scripts.seed_bigquery

Requirements:
    - MOCK_MODE=false in .env (or set explicitly below)
    - GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC configured
    - GCP_PROJECT_ID, BIGQUERY_DATASET, BIGQUERY_TABLE set in .env

The script is idempotent: existing user_ids are skipped.
"""
import sys
import logging
from pathlib import Path

# ── Ensure project root is on sys.path ────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ── Load .env before importing settings ───────────────────────────────────────
from dotenv import load_dotenv  # type: ignore[import]
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seed_bigquery")


def main() -> None:
    from core.config import settings

    logger.info("=== Aura-Agent BigQuery Seed Script ===")
    logger.info("Project   : %s", settings.GCP_PROJECT_ID)
    logger.info("Dataset   : %s", settings.BIGQUERY_DATASET)
    logger.info("Table     : %s", settings.BIGQUERY_TABLE)
    logger.info("Mock Mode : %s", settings.MOCK_MODE)

    if settings.MOCK_MODE:
        logger.error(
            "MOCK_MODE=True — this script requires a real GCP connection. "
            "Set MOCK_MODE=false in .env and re-run."
        )
        sys.exit(1)

    from services.bigquery_service import bigquery_service

    # Initialise client
    bigquery_service.init_bq(
        project_id=settings.GCP_PROJECT_ID,
        dataset=settings.BIGQUERY_DATASET,
        table=settings.BIGQUERY_TABLE,
    )

    # Ensure dataset + table exist
    logger.info("Ensuring dataset and table exist...")
    bigquery_service.ensure_table_exists()

    # Seed records
    logger.info("Seeding 50 mock user records...")
    inserted = bigquery_service.seed_mock_users(n=50)

    if inserted == 0:
        logger.info("✓ All 50 users already present — no changes made.")
    else:
        logger.info("✓ Successfully inserted %d new user records.", inserted)

    logger.info("=== Seed complete ===")


if __name__ == "__main__":
    main()
