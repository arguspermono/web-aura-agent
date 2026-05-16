# pyright: ignore [missing-import]
from fastapi import APIRouter, UploadFile, File, Depends
from core.responses import error_response
from models.schemas import StandardResponse, FileUploadResponse
from services.storage_service import storage_service
from services.firebase_service import firebase_service
from api.dependencies.auth import get_current_user
router = APIRouter()

ALLOWED_MIME_PREFIXES = ("image/", "video/", "audio/")


@router.post("", response_model=StandardResponse)
@router.post("/", response_model=StandardResponse, include_in_schema=False)
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Accept multipart file (image/video/audio), upload to GCS,
    return signed URL and file_id.

    Fix: route is POST /  (prefix in main.py is /api/v1/upload)
    Previously was POST /upload causing a double-path bug.
    """
    # Validate MIME type
    if not file.content_type or not any(file.content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        return error_response(
            422,
            "INVALID_FILE_TYPE",
            f"Unsupported media type: {file.content_type}. Allowed: image/*, video/*, audio/*.",
        )

    try:
        content = await file.read()

        file_id, signed_url = await storage_service.upload_file(
            filename=file.filename or "evidence",
            content=content,
            content_type=file.content_type or "application/octet-stream",
        )

        # Persist file metadata in Firestore so the analysis workflow
        # can retrieve size + content_type without re-fetching GCS headers.
        await firebase_service.save_file_metadata(file_id, {
            "file_id": file_id,
            "filename": file.filename,
            "content_type": file.content_type or "application/octet-stream",
            "size_bytes": len(content),
            "signed_url": signed_url,
        })

        return StandardResponse(
            status="ok",
            data=FileUploadResponse(file_id=file_id, signed_url=signed_url),
            message="File uploaded successfully",
        )
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not upload file: {exc}")

@router.get("/{file_id}/url", response_model=StandardResponse)
async def get_file_url(file_id: str, user: dict = Depends(get_current_user)):
    """
    Generate a fresh signed URL for an existing file.
    """
    try:
        signed_url = await storage_service.get_signed_url(file_id)
        if not signed_url:
            return error_response(404, "FILE_NOT_FOUND", f"File {file_id} does not exist.")
        
        return StandardResponse(
            status="ok",
            data={"file_id": file_id, "signed_url": signed_url},
            message="Fresh signed URL generated"
        )
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not generate signed URL for file {file_id}: {exc}")


@router.get("/{file_id}/view")
async def view_file(file_id: str, user: dict = Depends(get_current_user)):
    """
    Proxy the raw file bytes from GCS through the backend.
    Use this as the <img src="..."> URL instead of a signed GCS URL.
    This works with ADC user credentials (no service account key needed).
    """
    from fastapi.responses import Response
    from services.firebase_service import firebase_service as fs

    try:
        content = await storage_service.download_file(file_id)
        if not content:
            return error_response(404, "FILE_NOT_FOUND", f"File {file_id} has no content.")

        # Get content type from Firestore metadata
        files_meta = await fs.get_files_metadata([file_id])
        content_type = files_meta.get(file_id, {}).get("content_type", "application/octet-stream")

        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Cache-Control": "private, max-age=300",
                "Content-Disposition": "inline",
            },
        )
    except Exception as exc:
        return error_response(503, "GCP_UNAVAILABLE", f"Could not stream file {file_id}: {exc}")

