#!/usr/bin/env python3
"""Minimal OpenAI-compatible chat client for calibration runs."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Callable
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
    timeout_seconds: int | None = None,
    stream: bool = False,
    on_stream_delta: Callable[[str, str], None] | None = None,
    max_retries: int = 2,
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
    if stream:
        payload["stream"] = True

    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    attempt = 0
    while True:
        try:
            if timeout_seconds is None:
                response_context = urlopen(request)
            else:
                response_context = urlopen(request, timeout=timeout_seconds)
            with response_context as response:
                if stream:
                    return _read_streaming_chat_completion(response, on_stream_delta=on_stream_delta)
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code == 429 and attempt < max_retries:
                delay_seconds = _retry_delay_seconds(exc, attempt)
                time.sleep(delay_seconds)
                attempt += 1
                continue
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


def _read_streaming_chat_completion(
    response: object,
    *,
    on_stream_delta: Callable[[str, str], None] | None = None,
) -> dict[str, object]:
    completion_id: str | None = None
    created: int | None = None
    model: str | None = None
    role = "assistant"
    finish_reason: str | None = None
    usage: dict[str, object] | None = None
    content_parts: list[str] = []
    reasoning_parts: list[str] = []
    saw_chunk = False
    event_lines: list[str] = []

    def process_event(lines: list[str]) -> bool:
        nonlocal completion_id, created, model, role, finish_reason, usage, saw_chunk

        data_lines = [line[5:].lstrip() for line in lines if line.startswith("data:")]
        if not data_lines:
            return False

        data = "\n".join(data_lines).strip()
        if not data:
            return False
        if data == "[DONE]":
            return True

        chunk = json.loads(data)
        saw_chunk = True
        if completion_id is None and isinstance(chunk.get("id"), str):
            completion_id = chunk["id"]
        if created is None and isinstance(chunk.get("created"), int):
            created = chunk["created"]
        if model is None and isinstance(chunk.get("model"), str):
            model = chunk["model"]
        if isinstance(chunk.get("usage"), dict):
            usage = chunk["usage"]

        choices = chunk.get("choices")
        if isinstance(choices, list) and choices:
            choice = choices[0]
            if isinstance(choice, dict):
                delta = choice.get("delta", {})
                if isinstance(delta, dict):
                    delta_role = delta.get("role")
                    if isinstance(delta_role, str) and delta_role:
                        role = delta_role
                    for field_name, parts in (
                        ("reasoning_content", reasoning_parts),
                        ("content", content_parts),
                    ):
                        piece = delta.get(field_name)
                        if isinstance(piece, str) and piece:
                            parts.append(piece)
                            if on_stream_delta is not None:
                                on_stream_delta(field_name, piece)
                choice_finish_reason = choice.get("finish_reason")
                if isinstance(choice_finish_reason, str) and choice_finish_reason:
                    finish_reason = choice_finish_reason
        return False

    for raw_line in response:
        line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
        if not line:
            if process_event(event_lines):
                break
            event_lines = []
            continue
        if line.startswith(":"):
            continue
        event_lines.append(line)

    if event_lines:
        process_event(event_lines)

    if not saw_chunk:
        raise RuntimeError("Streaming model response did not contain any data chunks.")

    result: dict[str, object] = {
        "id": completion_id or "",
        "object": "chat.completion",
        "created": created or 0,
        "model": model or "",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": role,
                    "content": "".join(content_parts),
                    "reasoning_content": "".join(reasoning_parts),
                },
                "finish_reason": finish_reason,
            }
        ],
    }
    if usage is not None:
        result["usage"] = usage
    return result


def _retry_delay_seconds(exc: HTTPError, attempt: int) -> float:
    retry_after = exc.headers.get("Retry-After") if exc.headers is not None else None
    if retry_after:
        try:
            return max(float(retry_after), 0.0)
        except ValueError:
            pass
    return float(2 ** attempt)
