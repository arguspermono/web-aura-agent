import uuid
import logging
from typing import Tuple, Optional
from core.config import settings

logger = logging.getLogger(__name__)

# In-memory store for mock downloads: {file_id: bytes}
_MOCK_STORE: dict[str, bytes] = {}


class StorageService:
    """
    Abstracts Google Cloud Storage file operations.
    When MOCK_MODE=True (default): stores files in-memory and returns fake URLs.
    When MOCK_MODE=False: uploads to real GCS bucket and generates v4 signed URLs.
    """

    def __init__(self):
        self._client = None
        self._bucket = None

    def init_gcs(self, bucket_name: str):
        """Call once at startup when MOCK_MODE=False."""
        if settings.MOCK_MODE:
            self._client = None
            self._bucket = None
            logger.info("[Mock GCS] Skipping GCS client initialisation")
            return

        try:
            from google.cloud import storage as gcs
            self._client = gcs.Client()
            self._bucket = self._client.bucket(bucket_name)
            logger.info("GCS client initialised — bucket: %s", bucket_name)
        except Exception as exc:
            logger.error("GCS init failed: %s", exc)

    async def upload_file(
        self, filename: str, content: bytes, content_type: str
    ) -> Tuple[str, str]:
        """
        Upload a file and return (file_id, signed_url).

        GCS path convention: uploads/{file_id} — this is the path the
        Multimodal Reasoning skill constructs for GCS URI references.
        """
        file_id = str(uuid.uuid4())
        gcs_path = f"uploads/{file_id}"

        if settings.MOCK_MODE:
            _MOCK_STORE[file_id] = content
            signed_url = f"https://storage.googleapis.com/mock-bucket/{gcs_path}/{filename}"
            logger.info("[Mock GCS] Stored %s as file_id=%s (%d bytes)", filename, file_id, len(content))
            return file_id, signed_url

        if self._bucket:
            import asyncio
            await asyncio.to_thread(self._bucket.blob(gcs_path).upload_from_string, content, content_type)
            # Always use backend proxy URL — Compute Engine credentials don't have a private key
            # to generate signed URLs. The proxy endpoint serves the file using ADC credentials.
            signed_url = f"/api/v1/upload/{file_id}/view"
            logger.info("Uploaded %s (%d bytes) → gs://%s/%s", filename, len(content), self._bucket.name, gcs_path)
        else:
            # Mock: persist bytes in memory for later download_file() calls
            _MOCK_STORE[file_id] = content
            signed_url = f"https://storage.googleapis.com/mock-bucket/{gcs_path}/{filename}"
            logger.info("[Mock GCS] Stored %s as file_id=%s (%d bytes)", filename, file_id, len(content))

        return file_id, signed_url

    async def download_file(self, file_id: str) -> bytes:
        """
        Download raw bytes for a file by its ID.
        Called by the forensic validation skill (EXIF extraction)
        and by the multimodal reasoning skill for small inline files.
        Large files (≥20 MB) are passed via GCS URI — this method is NOT called for them.
        """
        gcs_path = f"uploads/{file_id}"

        if settings.MOCK_MODE:
            content = _MOCK_STORE.get(file_id, b"")
            logger.info("[Mock GCS] Retrieved file_id=%s (%d bytes)", file_id, len(content))
            return content

        if self._bucket:
            import asyncio
            blob = self._bucket.blob(gcs_path)
            content = await asyncio.to_thread(blob.download_as_bytes)
            logger.info("Downloaded file_id=%s (%d bytes) from GCS", file_id, len(content))
            return content
        else:
            content = _MOCK_STORE.get(file_id, b"")
            logger.info("[Mock GCS] Retrieved file_id=%s (%d bytes)", file_id, len(content))
            return content

    async def delete_file(self, file_id: str) -> bool:
        """Delete a file from GCS (used for cleanup after rejection, if required)."""
        gcs_path = f"uploads/{file_id}"
        if settings.MOCK_MODE:
            _MOCK_STORE.pop(file_id, None)
            return True

        if self._bucket:
            try:
                self._bucket.blob(gcs_path).delete()
                return True
            except Exception as exc:
                logger.warning("Could not delete %s: %s", gcs_path, exc)
                return False
        else:
            _MOCK_STORE.pop(file_id, None)
            return True

    async def get_signed_url(self, file_id: str) -> Optional[str]:
        """
        Generate a fresh v4 signed URL for an existing file.
        Returns None if the file doesn't exist (mock mode).
        """
        gcs_path = f"uploads/{file_id}"

        if settings.MOCK_MODE:
            if file_id in _MOCK_STORE:
                return f"https://storage.googleapis.com/mock-bucket/{gcs_path}/evidence"
            return None
        
        if self._bucket:
            blob = self._bucket.blob(gcs_path)
            if not blob.exists():
                return None
            # Always use backend proxy URL — Compute Engine credentials can't generate signed URLs
            return f"/api/v1/upload/{file_id}/view"
        else:
            if file_id in _MOCK_STORE:
                return f"https://storage.googleapis.com/mock-bucket/{gcs_path}/evidence"
            return None
storage_service = StorageService()
