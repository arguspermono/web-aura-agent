import uuid
import logging
from typing import Any
from core.config import settings

logger = logging.getLogger(__name__)


class PaymentService:
    def __init__(self):
        self._core_api: Any = None

    def _get_client(self) -> Any:
        """Lazy-init Midtrans client — only when MOCK_MODE=False."""
        if self._core_api is None:
            import midtransclient  # type: ignore[import]
            self._core_api = midtransclient.CoreApi(
                is_production=settings.MIDTRANS_IS_PRODUCTION,
                server_key=settings.MIDTRANS_SERVER_KEY,
                client_key=settings.MIDTRANS_CLIENT_KEY,
            )
        return self._core_api

    async def trigger_refund(
        self,
        order_id: str,
        amount: float = 0.0,
        reason: str = "Aura-Agent Auto Refund",
    ) -> bool:
        """
        Trigger Midtrans refund API.
        When MOCK_MODE=True: logs a mock response and returns True immediately.
        When MOCK_MODE=False: calls Midtrans sandbox/production API.
        """
        if settings.MOCK_MODE:
            logger.info(
                "[Mock Midtrans] Refund queued — order=%s amount=%.2f reason=%s",
                order_id, amount, reason,
            )
            return True

        try:
            logger.info("Calling Midtrans refund for order=%s amount=%.2f", order_id, amount)
            refund_params: dict[str, Any] = {
                "refund_key": f"refund-{uuid.uuid4().hex[:8]}-{order_id}",
                "reason": reason,
            }
            if amount > 0:
                refund_params["amount"] = int(amount)  # Midtrans expects integer IDR

            client = self._get_client()
            response = client.transactions.refund(order_id, refund_params)
            logger.info("Midtrans refund response: %s", response)
            return True
        except Exception as exc:
            logger.error("Midtrans refund failed for order=%s: %s", order_id, exc)
            return False


payment_service = PaymentService()

