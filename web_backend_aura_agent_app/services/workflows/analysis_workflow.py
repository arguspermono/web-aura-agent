"""
Workflow: Claim Analysis Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Orchestrates the full asynchronous AI analysis pipeline for a single claim.

Cloud Run async strategy:
  ┌─────────────────────────────────────────────────────────────────┐
  │  POST /claims/{id}/analyze                                      │
  │    → sets status="processing"                                   │
  │    → enqueues run_analysis_pipeline() as a BackgroundTask       │
  │    → returns 202 IMMEDIATELY (no timeout risk)                  │
  │                                                                 │
  │  BackgroundTask runs in the same Cloud Run instance:            │
  │    Step 1: uploading_evidence      → Firestore update           │
  │    Step 2: analyzing_evidence      → Gemini multimodal skill    │
  │    Step 3: detecting_damage_patterns → EXIF forensic skill      │
  │    Step 4: calculating_confidence  → weighted formula           │
  │    Step 5: generating_report       → decision + FCM + Midtrans  │
  │                                                                 │
  │  Flutter Firestore listener receives each step in real-time.    │
  └─────────────────────────────────────────────────────────────────┘

Confidence formula (from API contract):
  confidence = (visual * 0.6) + (exif * 0.2) + (trust * 0.2)

Decision thresholds:
  ≥ 0.90  → AUTO_APPROVE  (trigger Midtrans refund)
  0.75–0.89 → NEEDS_REVIEW
  < 0.75  → REJECT
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from services.skills.forensic_validation import forensic_validation_skill
from services.firebase_service import firebase_service
from services.storage_service import storage_service
from services.fraud_service import fraud_service
from services.payment_service import payment_service

logger = logging.getLogger(__name__)

# ── Pipeline step labels (written to Firestore, read by Flutter) ──────────────
STEP_UPLOADING   = "uploading_evidence"
STEP_ANALYZING   = "analyzing_evidence"
STEP_DETECTING   = "detecting_damage_patterns"
STEP_CALCULATING = "calculating_confidence_score"
STEP_GENERATING  = "generating_report"
STEP_COMPLETE    = "complete"
STEP_FAILED      = "failed"

# ── Weights & thresholds (API contract) ───────────────────────────────────────
W_VISUAL, W_EXIF, W_TRUST = 0.6, 0.2, 0.2
THRESHOLD_APPROVE = 0.90
THRESHOLD_REVIEW  = 0.75


async def run_analysis_pipeline(claim_id: str, claim_doc: dict[str, Any]) -> None:
    """
    Async entry-point called as a FastAPI BackgroundTask.

    MUST NOT raise unhandled exceptions — any uncaught error is caught here
    and written back to Firestore so the Flutter UI can surface it gracefully.
    """
    logger.info("[Pipeline:%s] Started", claim_id)
    try:
        await _execute(claim_id, claim_doc)
    except Exception as exc:
        logger.exception("[Pipeline:%s] Fatal error: %s", claim_id, exc)
        await _fail(claim_id, str(exc))


# ── Internal pipeline ─────────────────────────────────────────────────────────

async def _execute(claim_id: str, claim_doc: dict[str, Any]) -> None:
    file_ids: list[str] = claim_doc.get("file_ids", [])
    user_id: str = claim_doc.get("user_id", "")
    order_id: str = claim_doc.get("order_id", "")
    claim_type: str = claim_doc.get("claim_type", "")
    text_desc: str = claim_doc.get("text_description") or ""
    voice_desc: str = claim_doc.get("voice_description") or ""
    product_price: float = float(claim_doc.get("product_price") or claim_doc.get("item_value") or 0.0)
    refund_amount: float = float(claim_doc.get("refund_amount") or product_price or 0.0)
    combined_description = "\n".join(part for part in [text_desc, voice_desc] if part).strip()

    # ── Step 1: uploading_evidence ────────────────────────────────────────────
    await _update_step(claim_id, STEP_UPLOADING)
    logger.info("[Pipeline:%s] Step 1 — files: %s", claim_id, file_ids)

    # ── Step 2: analyzing_evidence (Gemini Multimodal) ────────────────────────
    await _update_step(claim_id, STEP_ANALYZING)

    # Import here to avoid circular dependency at module load time
    from core.config import settings
    from services.skills.multimodal_reasoning import init_multimodal_skill, multimodal_reasoning_skill

    if multimodal_reasoning_skill is None:
        init_multimodal_skill(settings)
        from services.skills.multimodal_reasoning import multimodal_reasoning_skill

    if multimodal_reasoning_skill is None:
        raise RuntimeError("MultimodalReasoningSkill has not been initialised")

    # Retrieve file size + content-type metadata from Firestore (stored at upload time)
    file_meta = await firebase_service.get_files_metadata(file_ids)
    file_sizes = {fid: meta.get("size_bytes", 0) for fid, meta in file_meta.items()}
    file_types = {fid: meta.get("content_type", "image/jpeg") for fid, meta in file_meta.items()}

    reasoning = await multimodal_reasoning_skill.analyze(
        file_ids=file_ids,
        file_sizes=file_sizes,
        file_content_types=file_types,
        claim_type=claim_type,
        description=combined_description,
        storage_service=storage_service,
    )
    visual_score = reasoning.visual_score
    logger.info("[Pipeline:%s] Gemini visual_score=%.2f damage_type=%s", claim_id, visual_score, reasoning.damage_type)

    # ── Step 3: detecting_damage_patterns (EXIF Forensic Validation) ──────────
    await _update_step(claim_id, STEP_DETECTING)

    exif_score = 0.7  # default when no image files present
    for file_id in file_ids:
        mime = file_types.get(file_id, "image/jpeg")
        if mime.startswith("image/") or mime.startswith("video/"):
            try:
                content = await storage_service.download_file(file_id)
                forensic = forensic_validation_skill.validate(content, mime, file_id)
                exif_score = forensic.score
                logger.info(
                    "[Pipeline:%s] EXIF score=%.2f tampered=%s reasons=%s",
                    claim_id, forensic.score, forensic.is_tampered, forensic.reasons,
                )
                break  # Validate first evidence file; extend to all if needed
            except Exception as exc:
                logger.warning("[Pipeline:%s] EXIF validation failed for %s: %s", claim_id, file_id, exc)

    # ── Step 4: calculating_confidence_score ──────────────────────────────────
    await _update_step(claim_id, STEP_CALCULATING)

    trust_score = await fraud_service.get_user_trust_score(user_id)
    confidence = (visual_score * W_VISUAL) + (exif_score * W_EXIF) + (trust_score * W_TRUST)
    logger.info(
        "[Pipeline:%s] confidence=%.4f (visual=%.2f exif=%.2f trust=%.2f)",
        claim_id, confidence, visual_score, exif_score, trust_score,
    )

    # ── Step 5: generating_report (Decision Engine) ───────────────────────────
    await _update_step(claim_id, STEP_GENERATING)

    if reasoning.requires_manual_review:
        decision = "NEEDS_REVIEW"
        status = "review"
    elif confidence >= THRESHOLD_APPROVE:
        decision = "AUTO_APPROVE"
        status = "approved"
        await payment_service.trigger_refund(order_id, amount=refund_amount)
    elif confidence >= THRESHOLD_REVIEW:
        decision = "NEEDS_REVIEW"
        status = "review"
    else:
        decision = "REJECT"
        status = "rejected"

    # Persist full result to Firestore
    await firebase_service.update_claim_analysis(
        claim_id=claim_id,
        status=status,
        current_step=STEP_COMPLETE,
        confidence_score=confidence,
        decision=decision,
        visual_score=visual_score,
        exif_score=exif_score,
        trust_score=trust_score,
        ai_explanation=reasoning.ai_explanation,
        damage_type=reasoning.damage_type,
        refund_value=refund_amount if status == "approved" else 0.0,
    )

    # FCM push notification
    fcm_body = {
        "approved": f"Your claim has been approved. Refund of Rp{int(refund_amount):,} is being processed.",
        "review": "Your claim is under manual review. We'll update you soon.",
        "rejected": "Your claim could not be approved based on the evidence provided.",
    }.get(status, "Your claim status has been updated.")

    await firebase_service.send_fcm_notification(user_id, "Claim Update — Aura Agent", fcm_body)
    logger.info("[Pipeline:%s] Complete — decision=%s confidence=%.4f", claim_id, decision, confidence)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _update_step(claim_id: str, step: str) -> None:
    try:
        await firebase_service.update_claim_step(claim_id, step)
    except Exception as exc:
        logger.warning("[Pipeline:%s] Could not write step '%s': %s", claim_id, step, exc)


async def _fail(claim_id: str, reason: str) -> None:
    try:
        await firebase_service.update_claim_analysis(
            claim_id=claim_id,
            status="failed",
            current_step=STEP_FAILED,
            confidence_score=0.0,
            decision="SYSTEM_ERROR",
            visual_score=0.0,
            exif_score=0.0,
            trust_score=0.0,
            ai_explanation=f"Pipeline failed: {reason}",
            damage_type="unknown",
            refund_value=0.0,
        )
    except Exception as exc:
        logger.error("[Pipeline:%s] Could not write failure state: %s", claim_id, exc)
