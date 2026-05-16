from fastapi import APIRouter, Depends
from typing import Any
import uuid

from core.responses import error_response
from models.schemas import StandardResponse, UserRegisterRequest
from services.firebase_service import firebase_service

router = APIRouter()

@router.post("/register", response_model=StandardResponse)
async def register_user(req: UserRegisterRequest):
    """
    Mock register user endpoint.
    Generates a UUID and stores the user in the mock DB.
    """
    user_id = str(uuid.uuid4())
    doc = await firebase_service.upsert_user_profile(
        user_id=user_id,
        username=req.username,
        email=req.email,
        role=req.role
    )
    # Generate a mock token for development purposes
    token = f"mock-token-{user_id}"
    
    return StandardResponse(
        status="ok",
        data={"user": doc, "token": token},
        message="User registered successfully"
    )

@router.get("/me", response_model=StandardResponse)
async def get_me(user_id: str):
    """
    Mock get user profile.
    Accepts user_id as query param for mock purposes.
    """
    doc = await firebase_service.get_user_profile(user_id)
    if not doc:
        return error_response(404, "USER_NOT_FOUND", "User not found")
        
    return StandardResponse(
        status="ok",
        data={"user": doc},
        message="User profile retrieved successfully"
    )
