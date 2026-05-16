from pydantic import BaseModel, Field
from typing import List, Optional, Any, Literal
from datetime import datetime, timezone


class StandardResponse(BaseModel):
    status: str
    data: Optional[Any] = None
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))


# ── Request bodies ────────────────────────────────────────────────────────────

class ClaimCreate(BaseModel):
    user_id: str
    order_id: str
    claim_type: str          # product_defect | shipping_damage | missing_item
    file_ids: List[str]
    text_description: Optional[str] = None
    voice_description: Optional[str] = None
    product_price: Optional[float] = None   # User-entered product price in IDR
    item_value: Optional[float] = None      # Legacy alias for product_price
    refund_amount: Optional[float] = None   # Expected refund in IDR (Rupiah)


class UserRegisterRequest(BaseModel):
    username: str
    email: Optional[str] = None
    role: Literal["buyer", "seller"] = "buyer"

class ClaimReviewRequest(BaseModel):
    status: str              # approved | rejected
    ai_decision: str         # OVERRIDDEN_APPROVE | OVERRIDDEN_REJECT
    refund_value: Optional[float] = None

class SellerDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    seller_note: Optional[str] = ""

# ── Response data shapes ──────────────────────────────────────────────────────

class FileUploadResponse(BaseModel):
    file_id: str
    signed_url: str


class ClaimResponse(BaseModel):
    id: str
    user_id: str
    order_id: str
    claim_type: str
    file_ids: List[str]
    text_description: Optional[str] = None
    voice_description: Optional[str] = None
    product_price: Optional[float] = None
    item_value: Optional[float] = None
    refund_amount: Optional[float] = None
    status: str
    current_step: Optional[str] = None
    confidence_score: Optional[float] = None
    ai_decision: Optional[str] = None
    ai_explanation: Optional[str] = None
    damage_type: Optional[str] = None
    refund_value: Optional[float] = None
    created_at: str
    updated_at: str


class ClaimStatusResponse(BaseModel):
    """Lightweight status polling — used by GET /claims/{id}/status."""
    claim_id: str
    status: str
    current_step: Optional[str] = None
    updated_at: str


class AnalyzeAcceptedResponse(BaseModel):
    """202 Accepted — analysis queued as BackgroundTask."""
    claim_id: str
    status: str = "processing"
    message: str = "Analysis pipeline started. Poll /status or listen via Firestore."


class AnalyzeResultResponse(BaseModel):
    """Full result returned if analysis completes synchronously (rare / test mode)."""
    claim_id: str
    status: str
    confidence_score: float
    decision: str
    visual_score: float
    exif_score: float
    trust_score: float
    ai_explanation: str
    damage_type: str
    refund_value: float
