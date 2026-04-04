#!/usr/bin/env python3
"""Minimal OpenAI-compatible chat client for calibration runs."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key_env: str
    default_base_url: str


PROVIDERS: dict[str, ProviderConfig] = {
    "moonshot": ProviderConfig(
        name="moonshot",
        api_key_env="MOONSHOT_API_KEY",
        default_base_url="https://api.moonshot.ai/v1",
    ),
    "z-ai": ProviderConfig(
        name="z-ai",
        api_key_env="ZAI_API_KEY",
        default_base_url="https://api.z.ai/api/paas/v4",
    ),
}


def create_chat_completion(
    *,
    provider_name: str,
    model: str,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int | None = None,
    timeout_seconds: int = 180,
) -> dict[str, object]:
    provider = PROVIDERS.get(provider_name)
    if provider is None:
        available = ", ".join(sorted(PROVIDERS))
        raise ValueError(f"Unsupported provider '{provider_name}'. Available providers: {available}")

    api_key = os.getenv(provider.api_key_env)
    if not api_key:
        raise RuntimeError(
            f"Missing API key for provider '{provider_name}'. "
            f"Set {provider.api_key_env} in the environment or .env."
        )

    base_url = os.getenv(_base_url_env_var(provider_name), provider.default_base_url).rstrip("/")
    url = f"{base_url}/chat/completions"
    payload: dict[str, object] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"{provider_name} API request failed with HTTP {exc.code}: {body}"
        ) from exc
    except URLError as exc:
        raise RuntimeError(f"{provider_name} API request failed: {exc}") from exc


def extract_message_text(response: dict[str, object]) -> str:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError(f"Model response did not contain choices: {response}")
    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        if parts:
            return "\n".join(parts)
    raise RuntimeError(f"Could not extract text content from model response: {response}")


def _base_url_env_var(provider_name: str) -> str:
    normalized = provider_name.upper().replace("-", "_")
    return f"{normalized}_BASE_URL"
