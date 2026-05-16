"""
Seed Script: Firestore Demo Data
==================================
Inserts demo claims and user FCM tokens into Firestore for end-to-end demos.

Usage:
    python -m scripts.seed_firestore

The script is idempotent: existing document IDs are skipped.
"""
import sys
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # type: ignore[import]
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seed_firestore")


def _ts(days_ago: int = 0) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.isoformat().replace("+00:00", "Z")


DEMO_USERS = [
    {"user_id": "demo-user-001", "fcm_token": "mock-fcm-token-001"},
    {"user_id": "demo-user-002", "fcm_token": "mock-fcm-token-002"},
    {"user_id": "demo-user-003", "fcm_token": "mock-fcm-token-003"},
    {"user_id": "demo-user-004", "fcm_token": "mock-fcm-token-004"},
    {"user_id": "demo-user-005", "fcm_token": "mock-fcm-token-005"},
]

DEMO_CLAIMS = [
    {
        "id": "demo-claim-001",
        "user_id": "demo-user-001",
        "order_id": "ORD-10001",
        "claim_type": "product_defect",
        "file_ids": ["demo-file-001"],
        "voice_description": "The screen cracked upon delivery.",
        "refund_amount": 1500000.0,
        "status": "approved",
        "current_step": "complete",
        "confidence_score": 0.93,
        "visual_score": 0.95,
        "exif_score": 0.90,
        "trust_score": 0.88,
        "ai_decision": "AUTO_APPROVE",
        "ai_explanation": "Clear screen damage consistent with shipping impact. EXIF metadata verified.",
        "damage_type": "screen_crack",
        "refund_value": 1500000.0,
        "created_at": _ts(5),
        "updated_at": _ts(4),
    },
    {
        "id": "demo-claim-002",
        "user_id": "demo-user-002",
        "order_id": "ORD-10002",
        "claim_type": "shipping_damage",
        "file_ids": ["demo-file-002"],
        "voice_description": "Box arrived crushed.",
        "refund_amount": 750000.0,
        "status": "review",
        "current_step": "complete",
        "confidence_score": 0.80,
        "visual_score": 0.78,
        "exif_score": 0.85,
        "trust_score": 0.80,
        "ai_decision": "NEEDS_REVIEW",
        "ai_explanation": "Moderate packaging damage observed, but evidence is inconclusive.",
        "damage_type": "packaging_damage",
        "refund_value": 0.0,
        "created_at": _ts(3),
        "updated_at": _ts(2),
    },
    {
        "id": "demo-claim-003",
        "user_id": "demo-user-003",
        "order_id": "ORD-10003",
        "claim_type": "missing_item",
        "file_ids": ["demo-file-003"],
        "voice_description": "Only received one of two items ordered.",
        "refund_amount": 300000.0,
        "status": "rejected",
        "current_step": "complete",
        "confidence_score": 0.62,
        "visual_score": 0.55,
        "exif_score": 0.20,
        "trust_score": 0.80,
        "ai_decision": "REJECT",
        "ai_explanation": "EXIF metadata indicates image was taken 3 days before order date — possible fraud.",
        "damage_type": "none_detected",
        "refund_value": 0.0,
        "created_at": _ts(7),
        "updated_at": _ts(6),
    },
    {
        "id": "demo-claim-004",
        "user_id": "demo-user-004",
        "order_id": "ORD-10004",
        "claim_type": "product_defect",
        "file_ids": [],
        "voice_description": "Waiting to upload evidence.",
        "refund_amount": 500000.0,
        "status": "pending",
        "current_step": None,
        "confidence_score": None,
        "visual_score": None,
        "exif_score": None,
        "trust_score": None,
        "ai_decision": None,
        "ai_explanation": None,
        "damage_type": None,
        "refund_value": None,
        "created_at": _ts(1),
        "updated_at": _ts(1),
    },
    {
        "id": "demo-claim-005",
        "user_id": "demo-user-005",
        "order_id": "ORD-10005",
        "claim_type": "shipping_damage",
        "file_ids": ["demo-file-005"],
        "voice_description": "Currently analyzing evidence.",
        "refund_amount": 200000.0,
        "status": "processing",
        "current_step": "analyzing_evidence",
        "confidence_score": None,
        "visual_score": None,
        "exif_score": None,
        "trust_score": None,
        "ai_decision": None,
        "ai_explanation": None,
        "damage_type": None,
        "refund_value": None,
        "created_at": _ts(0),
        "updated_at": _ts(0),
    },
]


async def seed(mock_mode: bool) -> None:
    from services.firebase_service import firebase_service

    if not mock_mode:
        from core.config import settings
        firebase_service.init_firebase(
            credentials_path=settings.GOOGLE_APPLICATION_CREDENTIALS,
            database_url=settings.FIREBASE_DATABASE_URL,
        )

    # Seed users
    inserted_users = 0
    for u in DEMO_USERS:
        uid = u["user_id"]
        if firebase_service._db:
            doc_ref = firebase_service._db.collection("users").document(uid)
            if not doc_ref.get().exists:
                doc_ref.set(u)
                inserted_users += 1
                logger.info("Inserted user: %s", uid)
            else:
                logger.info("User already exists: %s", uid)
        else:
            from services.firebase_service import _CLAIMS_DB
            logger.info("[Mock] Would insert user: %s", uid)
            inserted_users += 1

    # Seed claims
    inserted_claims = 0
    for c in DEMO_CLAIMS:
        cid = c["id"]
        if firebase_service._db:
            doc_ref = firebase_service._db.collection("claims").document(cid)
            if not doc_ref.get().exists:
                doc_ref.set(c)
                inserted_claims += 1
                logger.info("Inserted claim: %s [%s]", cid, c["status"])
            else:
                logger.info("Claim already exists: %s", cid)
        else:
            logger.info("[Mock] Would insert claim: %s [%s]", cid, c["status"])
            inserted_claims += 1

    logger.info(
        "✓ Seeded %d users and %d claims",
        inserted_users, inserted_claims,
    )


def main() -> None:
    from core.config import settings
    logger.info("=== Aura-Agent Firestore Seed Script ===")
    logger.info("Mock Mode: %s", settings.MOCK_MODE)
    asyncio.run(seed(mock_mode=settings.MOCK_MODE))
    logger.info("=== Seed complete ===")


if __name__ == "__main__":
    main()
