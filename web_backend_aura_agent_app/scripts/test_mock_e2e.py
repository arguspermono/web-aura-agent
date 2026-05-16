from __future__ import annotations

import sys
import time
from typing import Any

import requests


BASE_URL = "http://localhost:8000"


def _print_result(step: str, ok: bool, summary: str) -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {step}: {summary}")


def _request(method: str, path: str, **kwargs: Any) -> requests.Response:
    return requests.request(method, f"{BASE_URL}{path}", timeout=10, **kwargs)


def _json_summary(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text[:300]

    data = payload.get("data")
    if isinstance(data, dict):
        interesting = {
            key: data.get(key)
            for key in (
                "id",
                "claim_id",
                "file_id",
                "status",
                "current_step",
                "ai_decision",
                "confidence_score",
            )
            if key in data
        }
        return str(interesting or data)

    return str(payload)[:300]


def _assert_envelope(response: requests.Response) -> dict[str, Any]:
    response.raise_for_status()
    payload = response.json()
    required = {"status", "data", "message", "timestamp"}
    missing = required.difference(payload)
    if missing:
        raise AssertionError(f"response missing envelope keys: {sorted(missing)}")
    if payload["status"] != "ok":
        raise AssertionError(f"response status is not ok: {payload['status']}")
    return payload


def run() -> int:
    claim_id = ""

    try:
        response = _request("GET", "/health")
        response.raise_for_status()
        payload = response.json()
        if payload.get("mock_mode") is not True:
            raise AssertionError(f"mock_mode must be true, got {payload.get('mock_mode')}")
        _print_result("health", True, str(payload))
    except Exception as exc:
        _print_result("health", False, str(exc))
        return 1

    try:
        response = _request(
            "POST",
            "/api/v1/upload",
            files={"file": ("dummy.jpg", b"fake-image-bytes", "image/jpeg")},
        )
        payload = _assert_envelope(response)
        file_id = payload["data"]["file_id"]
        _print_result("upload", True, _json_summary(response))
    except Exception as exc:
        _print_result("upload", False, str(exc))
        return 1

    try:
        response = _request(
            "POST",
            "/api/v1/claims",
            json={
                "user_id": "mock-e2e-user",
                "order_id": f"mock-order-{int(time.time())}",
                "claim_type": "product_defect",
                "file_ids": [file_id],
                "text_description": "Dummy damaged product evidence for mock e2e test.",
                "product_price": 15000.0,
                "refund_amount": 15000.0,
            },
        )
        payload = _assert_envelope(response)
        claim_id = payload["data"]["id"]
        if payload["data"].get("status") != "pending":
            raise AssertionError(f"expected pending claim, got {payload['data'].get('status')}")
        _print_result("create claim", True, _json_summary(response))
    except Exception as exc:
        _print_result("create claim", False, str(exc))
        return 1

    try:
        response = _request("POST", f"/api/v1/claims/{claim_id}/analyze")
        if response.status_code != 202:
            raise AssertionError(f"expected HTTP 202, got {response.status_code}: {response.text}")
        _assert_envelope(response)
        _print_result("trigger analysis", True, _json_summary(response))
    except Exception as exc:
        _print_result("trigger analysis", False, str(exc))
        return 1

    try:
        status_payload: dict[str, Any] | None = None
        for _ in range(15):
            response = _request("GET", f"/api/v1/claims/{claim_id}/status")
            payload = _assert_envelope(response)
            status_payload = payload["data"]
            _print_result("poll status", True, _json_summary(response))
            if status_payload.get("current_step") == "complete":
                break
            time.sleep(1)
        else:
            raise AssertionError(f"current_step did not reach complete: {status_payload}")
    except Exception as exc:
        _print_result("poll status", False, str(exc))
        return 1

    try:
        response = _request("GET", f"/api/v1/claims/{claim_id}")
        payload = _assert_envelope(response)
        claim = payload["data"]
        decision = claim.get("ai_decision")
        if not decision:
            raise AssertionError("ai_decision is missing")
        _print_result(
            "fetch final claim",
            True,
            f"id={claim.get('id')} status={claim.get('status')} decision={decision} "
            f"confidence={claim.get('confidence_score')}",
        )
    except Exception as exc:
        _print_result("fetch final claim", False, str(exc))
        return 1

    print("Mock e2e PASS")
    return 0


if __name__ == "__main__":
    sys.exit(run())
