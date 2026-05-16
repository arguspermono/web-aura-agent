import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from core.config import settings
from models.schemas import ClaimCreate

# ── Mock in-memory stores (used when MOCK_MODE=True) ──────────────────────────
_CLAIMS_DB: Dict[str, Dict[str, Any]] = {}
_FILES_DB: Dict[str, Dict[str, Any]] = {}
_USERS_DB: Dict[str, Dict[str, Any]] = {}
logger = logging.getLogger(__name__)


class FirebaseService:
    """
    Abstracts all Firestore and FCM interactions.
    When MOCK_MODE=True (default), operations use in-memory dicts.
    When MOCK_MODE=False, operations target real Firestore collections.
    """

    def __init__(self):
        self._db: Any = None  # Firestore client — initialised in init_firebase()

    def init_firebase(self, credentials_path: Optional[str], database_url: Optional[str], project_id: Optional[str] = None):
        """Call once at application startup when MOCK_MODE=False."""
        if settings.MOCK_MODE:
            self._db = None
            logger.info("[Mock Firebase] Skipping Firebase SDK initialisation")
            return

        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            if not firebase_admin._apps:
                # If credentials_path is the gcloud ADC json, use ApplicationDefault()
                if credentials_path and "application_default_credentials.json" not in credentials_path:
                    cred = credentials.Certificate(credentials_path)
                else:
                    cred = credentials.ApplicationDefault()
                
                options = {"databaseURL": database_url}
                if project_id:
                    options["projectId"] = project_id
                    
                firebase_admin.initialize_app(cred, options)

            self._db = firestore.client()
        except Exception as exc:
            logger.error("Firebase init failed: %s", exc)

    # ── File metadata (written at upload time) ────────────────────────────────

    async def save_file_metadata(self, file_id: str, metadata: Dict[str, Any]) -> None:
        """Persist file size + content_type so the workflow can retrieve them."""
        if settings.MOCK_MODE:
            _FILES_DB[file_id] = metadata
            return

        if self._db:
            self._db.collection("files").document(file_id).set(metadata)
        else:
            _FILES_DB[file_id] = metadata

    async def get_files_metadata(self, file_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Return {file_id: {size_bytes, content_type, ...}} for a list of IDs."""
        result = {}
        for fid in file_ids:
            if settings.MOCK_MODE:
                result[fid] = _FILES_DB.get(fid, {})
                continue

            if self._db:
                doc = self._db.collection("files").document(fid).get()
                result[fid] = doc.to_dict() or {} if doc.exists else {}
            else:
                result[fid] = _FILES_DB.get(fid, {})
        return result

    # ── Claim CRUD ────────────────────────────────────────────────────────────

    async def upsert_user_profile(self, user_id: str, username: str, email: Optional[str] = None, role: str = "buyer") -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        existing = _USERS_DB.get(user_id, {}) if settings.MOCK_MODE else {}
        doc = {
            **existing,
            "id": user_id,
            "username": username,
            "email": email,
            "role": role,
            "updated_at": now,
        }
        if "created_at" not in doc:
            doc["created_at"] = now

        if settings.MOCK_MODE:
            _USERS_DB[user_id] = doc
            return doc

        if self._db:
            self._db.collection("users").document(user_id).set(doc, merge=True)
            saved = self._db.collection("users").document(user_id).get()
            return saved.to_dict() or doc

        _USERS_DB[user_id] = doc
        return doc

    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        if settings.MOCK_MODE:
            return _USERS_DB.get(user_id)

        if self._db:
            try:
                doc = self._db.collection("users").document(user_id).get()
                return doc.to_dict() if doc.exists else None
            except Exception:
                return None
        return _USERS_DB.get(user_id)

    async def create_claim(self, claim_data: ClaimCreate) -> Dict[str, Any]:
        claim_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        product_price = claim_data.product_price if claim_data.product_price is not None else claim_data.item_value
        doc = {
            "id": claim_id,
            "user_id": claim_data.user_id,
            "order_id": claim_data.order_id,
            "claim_type": claim_data.claim_type,
            "file_ids": claim_data.file_ids,
            "text_description": claim_data.text_description,
            "voice_description": claim_data.voice_description,
            "product_price": product_price,
            "item_value": product_price,
            "refund_amount": claim_data.refund_amount,
            "status": "pending",
            "current_step": None,
            "confidence_score": None,
            "ai_decision": None,
            "ai_explanation": None,
            "damage_type": None,
            "refund_value": None,
            "created_at": now,
            "updated_at": now,
        }
        if settings.MOCK_MODE:
            _CLAIMS_DB[claim_id] = doc
            return doc

        if self._db:
            self._db.collection("claims").document(claim_id).set(doc)
        else:
            _CLAIMS_DB[claim_id] = doc
        return doc

    async def get_claim(self, claim_id: str) -> Optional[Dict[str, Any]]:
        if settings.MOCK_MODE:
            return _CLAIMS_DB.get(claim_id)

        if self._db:
            try:
                doc = self._db.collection("claims").document(claim_id).get()
                return doc.to_dict() if doc.exists else None
            except Exception as exc:
                logger.error("Firestore get_claim failed for %s: %s", claim_id, exc)
                return None
        return _CLAIMS_DB.get(claim_id)

    async def get_claims_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        if settings.MOCK_MODE:
            return [d for d in _CLAIMS_DB.values() if d["user_id"] == user_id]

        if self._db:
            try:
                docs = self._db.collection("claims").where("user_id", "==", user_id).stream()
                return [d.to_dict() for d in docs]
            except Exception as exc:
                logger.error("Firestore get_claims_by_user failed for %s: %s", user_id, exc)
                return []
        return [d for d in _CLAIMS_DB.values() if d["user_id"] == user_id]

    async def get_all_claims(self) -> List[Dict[str, Any]]:
        if settings.MOCK_MODE:
            return list(_CLAIMS_DB.values())

        if self._db:
            try:
                docs = self._db.collection("claims").stream()
                return [d.to_dict() for d in docs]
            except Exception as exc:
                logger.error("Firestore get_all_claims failed: %s", exc)
                return []
        return list(_CLAIMS_DB.values())

    # ── Pipeline step updates (real-time Flutter listener) ────────────────────

    async def update_claim_step(self, claim_id: str, step: str) -> None:
        """
        Writes current_step to Firestore. Flutter's realtime listener receives
        this immediately, driving the step-progress animation on Screen 2.
        """
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        patch = {"current_step": step, "updated_at": now}
        if settings.MOCK_MODE:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)
            return

        if self._db:
            self._db.collection("claims").document(claim_id).update(patch)
        else:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)

    async def update_claim_analysis(
        self,
        claim_id: str,
        status: str,
        current_step: str,
        confidence_score: float,
        decision: str,
        visual_score: float,
        exif_score: float,
        trust_score: float,
        ai_explanation: str,
        damage_type: str,
        refund_value: float,
    ) -> Optional[Dict[str, Any]]:
        """Persist the full analysis result after the pipeline completes."""
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        patch = {
            "status": status,
            "current_step": current_step,
            "confidence_score": confidence_score,
            "ai_decision": decision,
            "visual_score": visual_score,
            "exif_score": exif_score,
            "trust_score": trust_score,
            "ai_explanation": ai_explanation,
            "damage_type": damage_type,
            "refund_value": refund_value,
            "updated_at": now,
        }
        if settings.MOCK_MODE:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)
            return _CLAIMS_DB.get(claim_id)

        if self._db:
            self._db.collection("claims").document(claim_id).update(patch)
            doc = self._db.collection("claims").document(claim_id).get()
            return doc.to_dict()
        else:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)
            return _CLAIMS_DB.get(claim_id)

    async def update_claim_review(self, claim_id: str, status: str, ai_decision: str, refund_value: Optional[float] = None) -> Optional[Dict[str, Any]]:
        """Admin override for manual review."""
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        patch: Dict[str, Any] = {
            "status": status,
            "ai_decision": ai_decision,
            "updated_at": now
        }
        if refund_value is not None:
            patch["refund_value"] = refund_value

        if settings.MOCK_MODE:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)
            return _CLAIMS_DB.get(claim_id)

        if self._db:
            self._db.collection("claims").document(claim_id).update(patch)
            doc = self._db.collection("claims").document(claim_id).get()
            return doc.to_dict()
        else:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)
            return _CLAIMS_DB.get(claim_id)

    async def update_seller_decision(self, claim_id: str, decision: str, seller_note: str) -> Optional[Dict[str, Any]]:
        """Seller decision to approve or reject the claim."""
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        status = "refund_approved" if decision == "approved" else "rejected"
        patch: Dict[str, Any] = {
            "status": status,
            "seller_decision": {
                "decision": decision,
                "seller_note": seller_note,
                "timestamp": now
            },
            "updated_at": now
        }

        if settings.MOCK_MODE:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)
            return _CLAIMS_DB.get(claim_id)

        if self._db:
            self._db.collection("claims").document(claim_id).update(patch)
            doc = self._db.collection("claims").document(claim_id).get()
            return doc.to_dict()
        else:
            if claim_id in _CLAIMS_DB:
                _CLAIMS_DB[claim_id].update(patch)
            return _CLAIMS_DB.get(claim_id)

    # ── FCM Push Notifications ────────────────────────────────────────────────

    async def send_fcm_notification(self, user_id: str, title: str, body: str) -> bool:
        """
        Sends FCM push notification to the user's device.
        Requires the user's FCM token to be stored in Firestore under users/{user_id}.
        Falls back to a log message in mock mode.
        """
        if settings.MOCK_MODE:
            logger.info("[Mock FCM] user=%s title=%s body=%s", user_id, title, body)
            return True

        if self._db:
            try:
                from firebase_admin import messaging
                user_doc = self._db.collection("users").document(user_id).get()
                fcm_token = user_doc.to_dict().get("fcm_token") if user_doc.exists else None
                if not fcm_token:
                    return False
                message = messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    token=fcm_token,
                )
                messaging.send(message)
                return True
            except Exception as exc:
                logger.warning("FCM send failed: %s", exc)
                return False
        else:
            print(f"[Mock FCM] → user={user_id} | {title}: {body}")
            return True


firebase_service = FirebaseService()
