from fastapi import APIRouter, Depends

from api.dependencies.auth import get_current_user
from core.responses import error_response
from models.schemas import StandardResponse, UserRegisterRequest
from pydantic import BaseModel
from services.firebase_service import firebase_service

class RoleUpdateRequest(BaseModel):
    role: str


router = APIRouter()


@router.post("/register", response_model=StandardResponse)
async def register_user(profile: UserRegisterRequest, user: dict = Depends(get_current_user)):
    """
    Persist user profile metadata after Firebase Auth registration/login.
    Firebase owns auth credentials; backend stores app fields like username.
    """
    username = profile.username.strip()
    if not username:
        return error_response(422, "INVALID_USERNAME", "Username is required.")

    user_id = user.get("uid")
    if not user_id:
        return error_response(401, "UNAUTHORIZED", "Authenticated user id is missing.")

    email = profile.email or user.get("email")
    try:
        doc = await firebase_service.upsert_user_profile(
            user_id=user_id,
            username=username,
            email=email,
        )
        return StandardResponse(status="ok", data=doc, message="User profile saved successfully")
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not save user profile: {exc}")

@router.post("/role", response_model=StandardResponse)
async def update_role(payload: RoleUpdateRequest, user: dict = Depends(get_current_user)):
    user_id = user.get("uid")
    if not user_id:
        return error_response(401, "UNAUTHORIZED", "Authenticated user id is missing.")
    
    try:
        # Get existing profile first to preserve username
        existing = await firebase_service.get_user_profile(user_id)
        username = existing.get("username", "") if existing else ""
        
        doc = await firebase_service.upsert_user_profile(
            user_id=user_id,
            username=username,
            email=user.get("email"),
            role=payload.role
        )
        return StandardResponse(status="ok", data=doc, message=f"Role updated to {payload.role}")
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not update role: {exc}")

@router.get("/me", response_model=StandardResponse)
async def get_my_profile(user: dict = Depends(get_current_user)):
    user_id = user.get("uid")
    if not user_id:
        return error_response(401, "UNAUTHORIZED", "Authenticated user id is missing.")
        
    try:
        doc = await firebase_service.get_user_profile(user_id)
        if not doc:
            # Return a default profile if none exists in Firestore
            doc = {
                "user_id": user_id,
                "email": user.get("email"),
                "username": user.get("name", "User"),
                "role": "buyer"
            }
        return StandardResponse(status="ok", data=doc, message="Profile retrieved successfully")
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not retrieve profile: {exc}")
