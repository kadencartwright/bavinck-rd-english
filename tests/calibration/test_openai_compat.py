from __future__ import annotations

import json
import sys
import unittest
from unittest.mock import patch
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.openai_compat import create_chat_completion


class FakeStreamingResponse:
    def __init__(self, lines: list[str]) -> None:
        self._lines = [line.encode("utf-8") for line in lines]

    def __enter__(self) -> FakeStreamingResponse:
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def __iter__(self):
        return iter(self._lines)


class OpenAICompatTests(unittest.TestCase):
    def test_streaming_chat_completion_aggregates_reasoning_and_content(self) -> None:
        streamed_events = [
            'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"glm-5","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"plan "},"finish_reason":null}]}\n',
            "\n",
            'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"glm-5","choices":[{"index":0,"delta":{"reasoning_content":"more"},"finish_reason":null}]}\n',
            "\n",
            'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"glm-5","choices":[{"index":0,"delta":{"content":"Hello "},"finish_reason":null}]}\n',
            "\n",
            'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"glm-5","choices":[{"index":0,"delta":{"content":"world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n',
            "\n",
            "data: [DONE]\n",
            "\n",
        ]
        deltas: list[tuple[str, str]] = []

        with (
            patch.dict("os.environ", {"ZAI_API_KEY": "test-key"}, clear=False),
            patch(
                "calibration.openai_compat.urlopen",
                return_value=FakeStreamingResponse(streamed_events),
            ) as mock_urlopen,
        ):
            response = create_chat_completion(
                provider_name="z-ai",
                model="glm-5",
                messages=[{"role": "user", "content": "Hello"}],
                temperature=1.0,
                stream=True,
                on_stream_delta=lambda field, text: deltas.append((field, text)),
            )

        request = mock_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertTrue(payload["stream"])
        self.assertNotIn("max_tokens", payload)
        self.assertEqual(
            deltas,
            [
                ("reasoning_content", "plan "),
                ("reasoning_content", "more"),
                ("content", "Hello "),
                ("content", "world"),
            ],
        )
        self.assertEqual(response["choices"][0]["message"]["reasoning_content"], "plan more")
        self.assertEqual(response["choices"][0]["message"]["content"], "Hello world")
        self.assertEqual(response["choices"][0]["finish_reason"], "stop")
        self.assertEqual(response["usage"]["total_tokens"], 3)


if __name__ == "__main__":
    unittest.main()
