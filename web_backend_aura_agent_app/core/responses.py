from datetime import datetime, timezone
from typing import Any

from fastapi.responses import JSONResponse


def error_response(status_code: int, error_code: str, message: str, data: Any = None) -> JSONResponse:
    """Return the standard structured error envelope used by API routes."""
    payload: dict[str, Any] = {
        "status": "error",
        "error_code": error_code,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if data is not None:
        payload["data"] = data
    return JSONResponse(status_code=status_code, content=payload)
