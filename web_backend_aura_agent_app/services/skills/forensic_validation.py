import logging
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)

@dataclass
class ForensicResult:
    score: float
    is_tampered: bool
    reasons: List[str]

class ForensicValidationSkill:
    """
    Skill for validating image/video authenticity using EXIF forensics.
    """
    
    def validate(self, content: bytes, mime_type: str, file_id: str) -> ForensicResult:
        """
        Perform forensic validation on file content.
        For now, this is a mock implementation that returns deterministic results.
        """
        logger.info(f"[Forensic] Validating file_id={file_id} (mime={mime_type})")
        
        # Simple deterministic logic based on file_id for demo purposes
        if "tamper" in file_id.lower():
            return ForensicResult(
                score=0.2,
                is_tampered=True,
                reasons=["Detected future timestamp in DateTimeOriginal", "GPS software mismatch"]
            )
        
        # Default success result
        return ForensicResult(
            score=1.0,
            is_tampered=False,
            reasons=[]
        )

forensic_validation_skill = ForensicValidationSkill()
