from __future__ import annotations

import os
from typing import Any

import httpx

from .types import Question, SystemOneResponse


class KevError(Exception):
    def __init__(
        self,
        message: str,
        status: int | None = None,
        body: Any = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class KevClient:
    """HTTP client for a Kev Decision API server."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str = "kev-latest",
        timeout: float = 120.0,
    ) -> None:
        self.base_url = (
            base_url
            or os.environ.get("KEV_BASE_URL")
            or os.environ.get("TYPESAFE_BASE_URL")
            or "http://127.0.0.1:3000"
        ).rstrip("/")
        self.api_key = (
            api_key
            or os.environ.get("KEV_API_KEY")
            or os.environ.get("TYPESAFE_API_KEY")
        )
        self.model = model or os.environ.get("KEV_MODEL", "kev-latest")
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def health(self) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{self.base_url}/health", headers=self._headers())
            res.raise_for_status()
            return res.json()

    def system_one(
        self,
        state: Any,
        questions: dict[str, Question | dict[str, Any]],
        *,
        model: str | None = None,
        trace: bool | None = None,
    ) -> SystemOneResponse:
        normalized: dict[str, Any] = {}
        for name, q in questions.items():
            if hasattr(q, "model_dump"):
                normalized[name] = q.model_dump(exclude_none=True)  # type: ignore[union-attr]
            else:
                normalized[name] = q

        payload: dict[str, Any] = {
            "model": model or self.model,
            "state": state,
            "questions": normalized,
        }
        if trace is not None:
            payload["trace"] = trace

        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(
                f"{self.base_url}/v1/systemone",
                headers={**self._headers(), "Content-Type": "application/json"},
                json=payload,
            )
            if res.status_code >= 400:
                try:
                    body: Any = res.json()
                    message = body.get("error", {}).get("message", res.text)
                except Exception:
                    body = res.text
                    message = res.text
                raise KevError(message, status=res.status_code, body=body)
            return SystemOneResponse.model_validate(res.json())

    def __enter__(self) -> KevClient:
        return self

    def __exit__(self, *args: object) -> None:
        return None
