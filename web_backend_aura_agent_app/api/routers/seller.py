from fastapi import APIRouter, Query
from typing import Any, List

from core.responses import error_response
from models.schemas import StandardResponse, SellerDecisionRequest
from services.firebase_service import firebase_service
from services.storage_service import storage_service

router = APIRouter()

# TODO: replace with Firebase Auth token verification in production
@router.get("/claims", response_model=StandardResponse)
async def get_seller_claims(role: str = Query(..., description="Role for mock mode")):
    if role != "seller":
        return error_response(403, "FORBIDDEN", "Must be seller to access this resource")

    all_claims = await firebase_service.get_all_claims()
    filtered_claims = []
    
    for claim in all_claims:
        status = claim.get("status", "pending")
        # Include all claims so seller can see incoming ones
        filtered_claims.append({
            "claim_id": claim.get("id"),
            "status": status,
            "created_at": claim.get("created_at"),
            "ai_verdict": claim.get("ai_decision"),
            "confidence_score": claim.get("confidence_score"),
            "damage_type": claim.get("damage_type"),
        })
            
    # Sort claims by created_at descending (newest first)
    filtered_claims.sort(key=lambda x: x.get("created_at") or "", reverse=True)
            
    return StandardResponse(
        status="ok",
        data=filtered_claims,
        message="Seller claims retrieved successfully"
    )

@router.get("/claims/{claim_id}", response_model=StandardResponse)
async def get_seller_claim_detail(claim_id: str, role: str = Query(..., description="Role for mock mode")):
    if role != "seller":
        return error_response(403, "FORBIDDEN", "Must be seller to access this resource")

    claim = await firebase_service.get_claim(claim_id)
    if not claim:
        return error_response(404, "NOT_FOUND", "Claim not found")

    # Generate a fresh signed URL for the first evidence file
    evidence_url = None
    file_urls = []
    file_ids = claim.get("file_ids", [])

    if file_ids:
        # Resolve URLs for ALL file_ids
        files_metadata = await firebase_service.get_files_metadata(file_ids)
        for fid in file_ids:
            # Try fresh signed URL from storage first
            fresh_url = await storage_service.get_signed_url(fid)
            if not fresh_url:
                # Fall back to the signed_url saved at upload time in Firestore
                fresh_url = files_metadata.get(fid, {}).get("signed_url")
            if fresh_url:
                file_urls.append(fresh_url)

        evidence_url = file_urls[0] if file_urls else None

    ai_analysis = {
        "verdict": claim.get("ai_decision"),
        "confidence_score": claim.get("confidence_score"),
        "damage_description": claim.get("damage_type") or claim.get("ai_explanation"),
        "recommendation": claim.get("ai_explanation")
    }

    claim_detail = {
        "claim_id": claim.get("id"),
        "status": claim.get("status"),
        "created_at": claim.get("created_at"),
        "evidence_url": evidence_url,       # primary image for <img src="...">
        "file_urls": file_urls,             # all evidence files
        "customer_reason": claim.get("text_description") or claim.get("voice_description"),
        "ai_analysis": ai_analysis,
        "seller_decision": claim.get("seller_decision")
    }

    return StandardResponse(
        status="ok",
        data=claim_detail,
        message="Claim details retrieved successfully"
    )


@router.post("/claims/{claim_id}/decision", response_model=StandardResponse)
async def submit_seller_decision(
    claim_id: str,
    req: SellerDecisionRequest,
    role: str = Query(..., description="Role for mock mode")
):
    if role != "seller":
        return error_response(403, "FORBIDDEN", "Must be seller to access this resource")

    claim = await firebase_service.get_claim(claim_id)
    if not claim:
        return error_response(404, "NOT_FOUND", "Claim not found")

    if claim.get("seller_decision") is not None:
        return error_response(409, "CONFLICT", "Decision already made for this claim")

    updated_claim = await firebase_service.update_seller_decision(
        claim_id=claim_id,
        decision=req.decision,
        seller_note=req.seller_note or ""
    )
    
    if not updated_claim:
        return error_response(500, "INTERNAL_ERROR", "Failed to update claim")

    seller_decision = updated_claim.get("seller_decision", {})

    return StandardResponse(
        status="ok",
        data={
            "claim_id": claim_id,
            "decision": seller_decision.get("decision"),
            "seller_note": seller_decision.get("seller_note"),
            "updated_at": updated_claim.get("updated_at")
        },
        message="Seller decision submitted successfully"
    )
