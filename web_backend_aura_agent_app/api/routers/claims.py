from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from core.responses import error_response
from models.schemas import (
    StandardResponse,
    ClaimCreate,
    ClaimStatusResponse,
    AnalyzeAcceptedResponse,
    ClaimReviewRequest,
)
from services.firebase_service import firebase_service
from services.workflows.analysis_workflow import run_analysis_pipeline
from api.dependencies.auth import get_current_user, get_admin_user

router = APIRouter()


# ── POST /api/v1/claims ───────────────────────────────────────────────────────

@router.post("", response_model=StandardResponse)
@router.post("/", response_model=StandardResponse, include_in_schema=False)
async def create_claim(claim_data: ClaimCreate, user: dict = Depends(get_current_user)):
    """Create a new claim. Returns the full claim document with status=pending."""
    # Ensure users can only create claims for themselves
    if not user.get("admin", False) and claim_data.user_id != user.get("uid"):
        raise HTTPException(status_code=403, detail="Cannot create claim for another user")
        
    try:
        doc = await firebase_service.create_claim(claim_data)
        return StandardResponse(status="ok", data=doc, message="Claim created successfully")
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not create claim: {exc}")


# ── GET /api/v1/claims?user_id={uid} ─────────────────────────────────────────

@router.get("", response_model=StandardResponse)
@router.get("/", response_model=StandardResponse, include_in_schema=False)
async def list_claims(user_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Retrieve all claims. If user_id is provided, filters by user. If omitted, returns all claims (Admin only)."""
    if not user_id:
        if not user.get("admin", False):
            raise HTTPException(status_code=403, detail="Admin privileges required to list all claims without a user_id")
        try:
            docs = await firebase_service.get_all_claims()
            return StandardResponse(status="ok", data=docs, message="All claims retrieved successfully")
        except Exception as exc:
            return error_response(503, "GCP_UNAVAILABLE", f"Could not retrieve all claims: {exc}")

    # Ensure users can only list their own claims, unless admin
    if not user.get("admin", False) and user_id != user.get("uid"):
        raise HTTPException(status_code=403, detail="Cannot access claims for another user")

    try:
        docs = await firebase_service.get_claims_by_user(user_id)
        return StandardResponse(status="ok", data=docs, message="Claims retrieved successfully")
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not retrieve claims for user {user_id}: {exc}")


# ── GET /api/v1/claims/{claim_id} ────────────────────────────────────────────

@router.get("/{claim_id}", response_model=StandardResponse)
async def get_claim(claim_id: str, user: dict = Depends(get_current_user)):
    """Retrieve full claim detail including AI decision result."""
    doc = await firebase_service.get_claim(claim_id)
    if not doc:
        return error_response(404, "CLAIM_NOT_FOUND", f"Claim {claim_id} does not exist.")
        
    if not user.get("admin", False) and doc.get("user_id") != user.get("uid"):
        raise HTTPException(status_code=403, detail="Cannot access this claim")

    # Resolve evidence_url from Firestore file metadata so the frontend
    # can render <img src="..."> without relying on the ephemeral blob URL.
    file_ids = doc.get("file_ids", [])
    if file_ids and not doc.get("evidence_url"):
        from services.firebase_service import firebase_service as fs
        from services.storage_service import storage_service
        files_metadata = await fs.get_files_metadata(file_ids[:1])
        saved_url = files_metadata.get(file_ids[0], {}).get("signed_url")
        fresh_url = await storage_service.get_signed_url(file_ids[0])
        doc["evidence_url"] = fresh_url or saved_url or None

    return StandardResponse(status="ok", data=doc, message="Claim retrieved successfully")



# ── POST /api/v1/claims/{claim_id}/analyze ───────────────────────────────────

@router.post("/{claim_id}/analyze", response_model=StandardResponse, status_code=202)
async def analyze_claim(claim_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """
    Trigger the AI analysis pipeline for a claim.

    Returns 202 Accepted IMMEDIATELY — the pipeline runs as a BackgroundTask.
    This prevents Cloud Run request timeouts for large video files (up to 500 MB).

    Pipeline steps (written to Firestore in real-time for Flutter listener):
      1. uploading_evidence
      2. analyzing_evidence       ← Gemini Multimodal Reasoning skill
      3. detecting_damage_patterns ← EXIF Forensic Validation skill
      4. calculating_confidence_score
      5. generating_report        ← Decision engine + Midtrans + FCM
    """
    doc = await firebase_service.get_claim(claim_id)
    if not doc:
        return error_response(404, "CLAIM_NOT_FOUND", f"Claim {claim_id} does not exist.")

    if not user.get("admin", False) and doc.get("user_id") != user.get("uid"):
        raise HTTPException(status_code=403, detail="Cannot access this claim")

    if doc.get("status") in ("approved", "rejected", "processing"):
        return error_response(
            409,
            "ANALYSIS_ALREADY_RUNNING",
            f"Claim {claim_id} is already in status: {doc['status']}.",
        )

    # Mark as processing immediately so Flutter can start showing the audit screen
    try:
        await firebase_service.update_claim_step(claim_id, "uploading_evidence")
        await firebase_service.update_claim_analysis(
            claim_id=claim_id,
            status="processing",
            current_step="uploading_evidence",
            confidence_score=0.0,
            decision="PENDING",
            visual_score=0.0,
            exif_score=0.0,
            trust_score=0.0,
            ai_explanation="",
            damage_type="",
            refund_value=0.0,
        )
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not start analysis for claim {claim_id}: {exc}")

    # Re-fetch to include the updated status in the accepted response
    updated_doc = await firebase_service.get_claim(claim_id)
    if not updated_doc:
        return error_response(404, "CLAIM_NOT_FOUND", f"Claim {claim_id} does not exist after update.")

    # Enqueue the full pipeline — runs after HTTP response is sent
    background_tasks.add_task(run_analysis_pipeline, claim_id, updated_doc)

    return StandardResponse(
        status="ok",
        data=AnalyzeAcceptedResponse(
            claim_id=claim_id,
            status="processing",
            message="Analysis pipeline started. Poll /status or listen via Firestore realtime.",
        ),
        message="Analysis queued successfully",
    )


# ── GET /api/v1/claims/{claim_id}/status ─────────────────────────────────────

@router.get("/{claim_id}/status", response_model=StandardResponse)
async def get_claim_status(claim_id: str, user: dict = Depends(get_current_user)):
    """
    Lightweight polling endpoint for claim status.
    Returns claim_id, status, current_step, and updated_at.
    Flutter uses this as a fallback when Firestore realtime is unavailable.
    """
    doc = await firebase_service.get_claim(claim_id)
    if not doc:
        return error_response(404, "CLAIM_NOT_FOUND", f"Claim {claim_id} does not exist.")

    if not user.get("admin", False) and doc.get("user_id") != user.get("uid"):
        raise HTTPException(status_code=403, detail="Cannot access this claim")

    return StandardResponse(
        status="ok",
        data=ClaimStatusResponse(
            claim_id=claim_id,
            status=doc.get("status", "unknown"),
            current_step=doc.get("current_step"),
            updated_at=doc.get("updated_at", ""),
        ),
        message="Status retrieved successfully",
    )


# ── PATCH /api/v1/claims/{claim_id}/review ───────────────────────────────────

@router.patch("/{claim_id}/review", response_model=StandardResponse)
async def review_claim(
    claim_id: str, 
    review_data: ClaimReviewRequest, 
    admin: dict = Depends(get_admin_user)
):
    """
    Admin only: Manually review a claim that was flagged for MANUAL_REVIEW.
    Updates the status and decision.
    """
    doc = await firebase_service.get_claim(claim_id)
    if not doc:
        return error_response(404, "CLAIM_NOT_FOUND", f"Claim {claim_id} does not exist.")

    if doc.get("status") not in ("review", "pending", "processing"):
        return error_response(400, "INVALID_STATE", f"Claim is currently '{doc.get('status')}'. Cannot be reviewed.")

    try:
        updated_doc = await firebase_service.update_claim_review(
            claim_id=claim_id,
            status=review_data.status,
            ai_decision=review_data.ai_decision,
            refund_value=review_data.refund_value
        )
        return StandardResponse(
            status="ok",
            data=updated_doc,
            message=f"Claim reviewed successfully by admin {admin.get('email')}"
        )
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not save review: {exc}")

