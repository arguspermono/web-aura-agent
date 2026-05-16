import hashlib
import logging
from io import BytesIO
from PIL import Image  # type: ignore[import]

logger = logging.getLogger(__name__)


def _deterministic_float(seed: str, low: float, high: float) -> float:
    """
    Returns a stable float in [low, high) derived from `seed`.
    Uses MD5 hex digest so the same seed always yields the same value —
    critical for demo reproducibility and deterministic test assertions.
    """
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    return low + (h % 10_000) / 10_000.0 * (high - low)


class FraudService:
    """
    Proxy service for user trust scoring and legacy EXIF validation.

    MOCK_MODE=True  → deterministic hash-based score (no GCP needed)
    MOCK_MODE=False → delegates to bigquery_service.get_trust_score()
    """

    async def get_user_trust_score(self, user_id: str) -> float:
        """
        Return a trust score (0.0–1.0) for the given user.

        Real BigQuery table structure:
          user_id (STRING), total_orders (INT64), total_refunds (INT64),
          account_age_days (INT64), trust_score (FLOAT64)
        """
        from core.config import settings

        if settings.MOCK_MODE:
            score = _deterministic_float(f"trust:{user_id}", 0.6, 1.0)
            logger.info("[Mock BQ] user=%s trust_score=%.4f", user_id, score)
            return score

        # MOCK_MODE=False → delegate to BigQuery service
        from services.bigquery_service import bigquery_service  # lazy import avoids circular dep
        return await bigquery_service.get_trust_score(user_id)

    async def validate_exif_metadata(self, file_content: bytes) -> float:
        """
        Legacy EXIF check — kept for backward compatibility.
        The analysis pipeline now uses ForensicValidationSkill directly.
        Returns a score in 0.0–1.0.
        """
        try:
            image = Image.open(BytesIO(file_content))
            exif = image.getexif()
            if not exif:
                return 0.5  # Missing EXIF
            return 0.9  # Minimal check — ForensicValidationSkill does full validation
        except Exception:
            return 0.8  # Non-image file (video/audio) — neutral score


fraud_service = FraudService()

