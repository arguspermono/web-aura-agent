from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
from core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Validates the Firebase JWT token from the Authorization header.
    Returns the decoded token payload.
    """
    if settings.MOCK_MODE:
        # In mock mode, we bypass actual Firebase validation for easier testing
        # We can extract the uid from the token string if we want to simulate different users,
        # but for simplicity, we just return a mock user payload.
        token = credentials.credentials
        mock_uid = token if len(token) > 5 else "mock-user-123"
        return {
            "uid": mock_uid,
            "email": f"{mock_uid}@example.com",
            "name": f"User {mock_uid}",
            "admin": token == "mock-admin-token"
        }

    token = credentials.credentials
    try:
        from firebase_admin import auth

        decoded_token = auth.verify_id_token(token, clock_skew_seconds=10)
        decoded_token["name"] = (
            decoded_token.get("name")
            or decoded_token.get("display_name")
            or decoded_token.get("email", "").split("@")[0]
            or decoded_token.get("uid")
        )
        return decoded_token
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError as e:
        logger.error(f"Invalid token error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    """
    Ensures the authenticated user has the 'admin' custom claim set to True.
    """
    if not user.get("admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Admin role required.",
        )
    return user
