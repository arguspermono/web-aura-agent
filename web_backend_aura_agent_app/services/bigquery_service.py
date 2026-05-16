"""
BigQuery Service
================
Handles all Google BigQuery interactions for user trust scoring.

Table schema (aura_agent.user_trust_scores):
  user_id          STRING    NOT NULL
  total_orders     INT64
  total_refunds    INT64
  account_age_days INT64
  trust_score      FLOAT64   -- 0.0 to 1.0

MOCK_MODE=True  → deterministic hash-based score, zero GCP dependency
MOCK_MODE=False → real parameterized BigQuery query
"""
from __future__ import annotations

import hashlib
import logging
import random
from typing import Any, Optional
from core.config import settings

logger = logging.getLogger(__name__)


def _deterministic_float(seed: str, low: float, high: float) -> float:
    """Stable float in [low, high) derived from seed string."""
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    return low + (h % 10_000) / 10_000.0 * (high - low)


class BigQueryService:
    """
    Abstracts BigQuery interactions for user trust scoring.
    Initialise with init_bq() at application startup (MOCK_MODE=False only).
    """

    def __init__(self) -> None:
        self._client: Any = None
        self._dataset: str = "aura_agent"
        self._table: str = "user_trust_scores"
        self._project: str = ""

    def init_bq(self, project_id: str, dataset: str, table: str) -> None:
        """
        Call once at application startup when MOCK_MODE=False.
        Initialises the BigQuery client with Application Default Credentials.
        """
        if settings.MOCK_MODE:
            self._client = None
            self._project = project_id
            self._dataset = dataset
            self._table = table
            logger.info("[Mock BQ] Skipping BigQuery client initialisation")
            return

        try:
            from google.cloud import bigquery  # type: ignore[import]

            self._client = bigquery.Client(project=project_id)
            self._dataset = dataset
            self._table = table
            self._project = project_id
            logger.info(
                "BigQuery client initialised — project=%s table=%s.%s",
                project_id, dataset, table,
            )
        except Exception as exc:
            logger.error("BigQuery init failed: %s", exc)

    @property
    def _full_table(self) -> str:
        return f"`{self._project}.{self._dataset}.{self._table}`"

    # ── Trust Score Query ──────────────────────────────────────────────────────

    async def get_trust_score(self, user_id: str) -> float:
        """
        Return the trust_score for a user.

        MOCK_MODE=False → runs a parameterized BigQuery SELECT.
        Falls back to 0.7 (neutral) if user not found.
        """
        if settings.MOCK_MODE:
            score = _deterministic_float(f"trust:{user_id}", 0.6, 1.0)
            logger.info("[Mock BQ] user=%s trust_score=%.4f", user_id, score)
            return score

        if self._client is None:
            # Fallback: deterministic mock (shouldn't reach here if init_bq was called)
            score = _deterministic_float(f"trust:{user_id}", 0.6, 1.0)
            logger.warning("[BQ Fallback] client not init — using mock score=%.4f", score)
            return score

        try:
            from google.cloud import bigquery  # type: ignore[import]

            query = f"""
                SELECT trust_score
                FROM {self._full_table}
                WHERE user_id = @user_id
                LIMIT 1
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("user_id", "STRING", user_id)
                ]
            )
            results = self._client.query(query, job_config=job_config).result()
            for row in results:
                score = float(row.trust_score)
                logger.info("[BQ] user=%s trust_score=%.4f", user_id, score)
                return score

            # User not in BigQuery — return neutral score
            logger.warning("[BQ] user=%s not found in trust table — defaulting to 0.7", user_id)
            return 0.7

        except Exception as exc:
            logger.error("[BQ] Query failed for user=%s: %s", user_id, exc)
            return 0.7  # Safe neutral fallback

    # ── Seed / Admin Utilities ─────────────────────────────────────────────────

    def ensure_table_exists(self) -> None:
        """Create the BigQuery dataset and table if they do not already exist."""
        if settings.MOCK_MODE:
            logger.info("[Mock BQ] Skipping table creation")
            return

        if self._client is None:
            raise RuntimeError("BigQueryService not initialised — call init_bq() first")

        from google.cloud import bigquery  # type: ignore[import]
        from google.api_core.exceptions import NotFound  # type: ignore[import]

        # Create dataset
        dataset_ref = bigquery.DatasetReference(self._project, self._dataset)
        try:
            self._client.get_dataset(dataset_ref)
            logger.info("[BQ] Dataset %s already exists", self._dataset)
        except NotFound:
            ds = bigquery.Dataset(dataset_ref)
            ds.location = "asia-southeast2"
            self._client.create_dataset(ds)
            logger.info("[BQ] Created dataset %s", self._dataset)

        # Create table
        table_ref = dataset_ref.table(self._table)
        try:
            self._client.get_table(table_ref)
            logger.info("[BQ] Table %s already exists", self._table)
        except NotFound:
            schema = [
                bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("total_orders", "INT64"),
                bigquery.SchemaField("total_refunds", "INT64"),
                bigquery.SchemaField("account_age_days", "INT64"),
                bigquery.SchemaField("trust_score", "FLOAT64"),
            ]
            table = bigquery.Table(table_ref, schema=schema)
            self._client.create_table(table)
            logger.info("[BQ] Created table %s", self._table)

    def seed_mock_users(self, n: int = 50) -> int:
        """
        Insert n mock user records into BigQuery.
        Idempotent: uses MERGE to skip existing user_ids.
        Returns number of rows actually inserted.
        """
        if settings.MOCK_MODE:
            logger.info("[Mock BQ] Skipping BigQuery seed for %d users", n)
            return n

        if self._client is None:
            raise RuntimeError("BigQueryService not initialised — call init_bq() first")

        from google.cloud import bigquery  # type: ignore[import]

        # Build deterministic seed rows
        rng = random.Random(42)  # Fixed seed → reproducible data
        rows = []
        for i in range(n):
            uid = f"mock-user-{i:03d}"
            # Spread trust scores: ~20% low (<0.5), ~30% medium, ~50% high
            tier = rng.random()
            if tier < 0.20:
                trust = round(rng.uniform(0.2, 0.5), 4)
            elif tier < 0.50:
                trust = round(rng.uniform(0.5, 0.75), 4)
            else:
                trust = round(rng.uniform(0.75, 1.0), 4)

            rows.append({
                "user_id": uid,
                "total_orders": rng.randint(1, 200),
                "total_refunds": rng.randint(0, 20),
                "account_age_days": rng.randint(30, 2000),
                "trust_score": trust,
            })

        # MERGE to avoid duplicates
        merge_sql = f"""
            MERGE {self._full_table} AS T
            USING UNNEST(@rows) AS S
            ON T.user_id = S.user_id
            WHEN NOT MATCHED THEN
              INSERT (user_id, total_orders, total_refunds, account_age_days, trust_score)
              VALUES (S.user_id, S.total_orders, S.total_refunds, S.account_age_days, S.trust_score)
        """

        # BigQuery MERGE doesn't support UNNEST of structs via query params easily,
        # so we use insert_rows_json with an existence check instead.
        table_ref = f"{self._project}.{self._dataset}.{self._table}"

        # Get existing user_ids
        existing_query = f"SELECT user_id FROM `{table_ref}`"
        existing = {row.user_id for row in self._client.query(existing_query).result()}
        new_rows = [r for r in rows if r["user_id"] not in existing]

        if not new_rows:
            logger.info("[BQ Seed] All %d users already exist — nothing to insert", n)
            return 0

        errors = self._client.insert_rows_json(table_ref, new_rows)
        if errors:
            logger.error("[BQ Seed] Insert errors: %s", errors)
            raise RuntimeError(f"BigQuery seed insert failed: {errors}")

        logger.info("[BQ Seed] Inserted %d / %d new user records", len(new_rows), n)
        return len(new_rows)


bigquery_service = BigQueryService()
