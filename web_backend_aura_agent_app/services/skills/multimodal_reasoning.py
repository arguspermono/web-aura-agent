import json
import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_FALLBACK_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.0-flash",
)
INLINE_FILE_SIZE_LIMIT = 15 * 1024 * 1024

@dataclass
class AnalysisResult:
    visual_score: float
    damage_type: str
    ai_explanation: str
    requires_manual_review: bool = False

class MultimodalReasoningSkill:
    """
    Skill for multimodal analysis using Gemini (Vertex AI).
    """
    
    def __init__(self, settings: Any = None):
        self.settings = settings
        self.initialized = True
        logger.info("MultimodalReasoningSkill initialised")

    def _candidate_model_ids(self) -> List[str]:
        configured = (getattr(self.settings, "GEMINI_MODEL_ID", "") or "").strip()
        seen: set[str] = set()
        models: List[str] = []

        for model_id in [configured, *DEFAULT_FALLBACK_MODELS]:
            if model_id and model_id not in seen:
                seen.add(model_id)
                models.append(model_id)

        return models

    def _candidate_locations(self) -> List[str]:
        configured = (getattr(self.settings, "VERTEX_AI_LOCATION", "") or "").strip() or "global"
        locations = [configured]
        if configured != "global":
            locations.append("global")
        return locations

    def _build_prompt(self, claim_type: str, description: str) -> str:
        description_text = description.strip() or "No additional customer description provided."
        return (
            "You analyze e-commerce complaint evidence.\n"
            f"Claim type: {claim_type or 'unknown'}\n"
            f"Customer description: {description_text}\n\n"
            "Return JSON only with keys:\n"
            "- visual_score: float between 0 and 1\n"
            "- damage_type: short snake_case string\n"
            "- ai_explanation: short evidence-based explanation\n\n"
            "Rules:\n"
            "- Higher visual_score only if evidence clearly supports customer claim.\n"
            "- If evidence is ambiguous, use 0.45 to 0.70.\n"
            "- Do not invent details not visible in evidence."
        )

    async def _build_parts(
        self,
        file_ids: List[str],
        file_sizes: Dict[str, int],
        file_content_types: Dict[str, str],
        storage_service: Any,
    ) -> List[Any]:
        if getattr(self.settings, "MOCK_MODE", True):
            return []

        from vertexai.generative_models import Part

        parts: List[Any] = []
        bucket = getattr(storage_service, "_bucket", None)
        bucket_name = getattr(bucket, "name", None)

        for file_id in file_ids:
            mime_type = file_content_types.get(file_id, "application/octet-stream")
            file_size = int(file_sizes.get(file_id, 0) or 0)

            if bucket_name and file_size > INLINE_FILE_SIZE_LIMIT:
                parts.append(Part.from_uri(f"gs://{bucket_name}/uploads/{file_id}", mime_type=mime_type))
                continue

            content = await storage_service.download_file(file_id)
            if not content:
                logger.warning("[Gemini] Empty content for file_id=%s", file_id)
                continue

            parts.append(Part.from_data(data=content, mime_type=mime_type))

        return parts

    def _parse_response(self, raw_text: str) -> AnalysisResult:
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()

        payload = json.loads(text)
        visual_score = float(payload.get("visual_score", 0.6))
        visual_score = max(0.0, min(1.0, visual_score))
        damage_type = str(payload.get("damage_type", "general_damage") or "general_damage")
        ai_explanation = str(payload.get("ai_explanation", "Analysis complete.") or "Analysis complete.")
        return AnalysisResult(
            visual_score=visual_score,
            damage_type=damage_type,
            ai_explanation=ai_explanation,
        )

    async def analyze(
        self, 
        file_ids: List[str], 
        file_sizes: Dict[str, int],
        file_content_types: Dict[str, str],
        claim_type: str,
        description: str,
        storage_service: Any
    ) -> AnalysisResult:
        """
        Analyze evidence using Gemini Vision.
        If MOCK_MODE is enabled, returns deterministic mock response.
        """
        logger.info(f"[Gemini] Analyzing {len(file_ids)} files for claim_type={claim_type}")
        
        # Check mock mode from settings if available
        is_mock = getattr(self.settings, "MOCK_MODE", True)
        
        if is_mock:
            # Deterministic mock response
            visual_score = 0.95 if "defect" in claim_type.lower() else 0.85
            return AnalysisResult(
                visual_score=visual_score,
                damage_type="product_defect",
                ai_explanation=f"Evidence clearly shows physical damage consistent with the user's description. Context received: {description[:120] or 'No additional context provided.'}"
            )
        try:
            import vertexai
            from vertexai.generative_models import GenerativeModel, GenerationConfig
        except Exception as exc:
            logger.exception("[Gemini] Vertex AI SDK import failed: %s", exc)
            return AnalysisResult(
                visual_score=0.0,
                damage_type="system_unavailable",
                ai_explanation="Gemini SDK is unavailable. Route claim to manual review.",
                requires_manual_review=True,
            )

        prompt = self._build_prompt(claim_type, description)
        parts = await self._build_parts(file_ids, file_sizes, file_content_types, storage_service)
        if not parts:
            return AnalysisResult(
                visual_score=0.55,
                damage_type="insufficient_evidence",
                ai_explanation="No readable evidence could be loaded. Route claim to manual review.",
                requires_manual_review=True,
            )

        last_error: Optional[Exception] = None
        project_id = getattr(self.settings, "GCP_PROJECT_ID", None)

        for location in self._candidate_locations():
            vertexai.init(project=project_id, location=location)

            for model_id in self._candidate_model_ids():
                try:
                    logger.info("[Gemini] Trying model=%s location=%s", model_id, location)
                    model = GenerativeModel(model_id)
                    response = await model.generate_content_async(
                        [*parts, prompt],
                        generation_config=GenerationConfig(
                            temperature=0.2,
                            response_mime_type="application/json",
                        ),
                    )
                    response_text = getattr(response, "text", "") or ""
                    result = self._parse_response(response_text)
                    logger.info(
                        "[Gemini] Success model=%s location=%s visual_score=%.2f damage_type=%s",
                        model_id,
                        location,
                        result.visual_score,
                        result.damage_type,
                    )
                    return result
                except Exception as exc:
                    last_error = exc
                    logger.warning("[Gemini] Model failed model=%s location=%s error=%s", model_id, location, exc)

        logger.exception("[Gemini] All model attempts failed", exc_info=last_error)
        error_message = str(last_error) if last_error else "Unknown Gemini error."
        return AnalysisResult(
            visual_score=0.0,
            damage_type="system_unavailable",
            ai_explanation=f"Gemini analysis unavailable: {error_message}. Route claim to manual review.",
            requires_manual_review=True,
        )

# Global instance
multimodal_reasoning_skill: Optional[MultimodalReasoningSkill] = None

def init_multimodal_skill(settings: Any):
    global multimodal_reasoning_skill
    multimodal_reasoning_skill = MultimodalReasoningSkill(settings)
