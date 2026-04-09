from __future__ import annotations

import json
import subprocess
import sys
import unittest
from unittest.mock import patch
from pathlib import Path
from tempfile import TemporaryDirectory

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration import run_calibration
from calibration.validation import REPO_ROOT, validate_commit_safe_eval_record


class RunPreflightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = REPO_ROOT

    def test_wrapper_refuses_invalid_manifest_before_live_run(self) -> None:
        manifest_path = self.repo_root / "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["glossary_path"] = "data/calibration/slices/vol2-god-incomprehensibility-001/inputs/missing.yaml"

        with TemporaryDirectory() as temp_dir:
            bad_manifest = Path(temp_dir) / "bad-run-manifest.json"
            bad_manifest.write_text(json.dumps(manifest), encoding="utf-8")
            result = subprocess.run(
                ["./run-calibration", "--run-manifest", str(bad_manifest)],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("glossary_path", result.stderr)
        self.assertNotIn("Missing API key", result.stderr)

    def test_provider_smoke_test_uses_stage_models_with_minimal_budget(self) -> None:
        profile_path = self.repo_root / "config/calibration/model-profiles/kimi-k2_5-glm5-baseline.json"
        profile = json.loads(profile_path.read_text(encoding="utf-8"))

        with patch("calibration.run_calibration.create_chat_completion") as mock_completion:
            mock_completion.return_value = {"choices": [{"message": {"content": "OK"}}]}
            run_calibration.smoke_test_provider_connections(profile)

        self.assertEqual(mock_completion.call_count, 2)
        translation_call = mock_completion.call_args_list[0].kwargs
        review_call = mock_completion.call_args_list[1].kwargs
        self.assertEqual(translation_call["provider_name"], "moonshot")
        self.assertEqual(translation_call["model"], "kimi-k2.5")
        self.assertEqual(translation_call["max_tokens"], 1)
        self.assertEqual(review_call["provider_name"], "z-ai")
        self.assertEqual(review_call["model"], "glm-5")
        self.assertEqual(review_call["max_tokens"], 1)

    def test_provider_smoke_test_includes_stage_context_on_failure(self) -> None:
        profile_path = self.repo_root / "config/calibration/model-profiles/kimi-k2_5-glm5-baseline.json"
        profile = json.loads(profile_path.read_text(encoding="utf-8"))

        with patch("calibration.run_calibration.create_chat_completion") as mock_completion:
            mock_completion.side_effect = [
                {"choices": [{"message": {"content": "OK"}}]},
                RuntimeError("z-ai API request failed with HTTP 401: bad token"),
            ]
            with self.assertRaises(RuntimeError) as context:
                run_calibration.smoke_test_provider_connections(profile)

        self.assertIn("stage 'review'", str(context.exception))
        self.assertIn("z-ai/glm-5", str(context.exception))

    def test_detects_untranslated_dutch_scripture_references(self) -> None:
        matches = run_calibration.find_untranslated_dutch_scripture_references(
            "Acts 17:23, but also Hd. 17:28, Jes. 40:28, and Op. 22:4 remain."
        )

        self.assertEqual(matches, ["Hd. 17:28", "Jes. 40:28", "Op. 22:4"])

    def test_wrapper_supports_smoke_test_only_with_default_manifest(self) -> None:
        result = subprocess.run(
            ["./run-calibration", "--smoke-test-only"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )

        self.assertNotIn("the following arguments are required: --run-manifest", result.stderr)
        self.assertIn("validated run manifest bundle", result.stdout)

    def test_runner_exports_commit_safe_eval_bundle(self) -> None:
        manifest_path = self.repo_root / "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json"
        translation_response = {
            "id": "chatcmpl-translation",
            "created": 1,
            "model": "kimi-k2.5",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "Sample translation output.\n",
                        "reasoning_content": "internal chain of thought",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 11,
                "completion_tokens": 22,
                "total_tokens": 33,
                "completion_tokens_details": {"reasoning_tokens": 7},
            },
        }
        review_response = {
            "id": "chatcmpl-review",
            "created": 2,
            "model": "glm-5",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(
                            {
                                "summary": "Review completed.",
                                "checks": {
                                    "prose-quality": {"status": "pass", "details": "Readable."},
                                    "review-flagging": {"status": "pass", "details": "Issues called out."},
                                },
                                "findings": [{"severity": "low", "category": "style", "detail": "Minor issue."}],
                                "recommended_follow_up": ["Keep comparing runs."],
                            }
                        ),
                        "reasoning_content": "review internals",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 44,
                "completion_tokens": 55,
                "total_tokens": 99,
                "prompt_tokens_details": {"cached_tokens": 3},
            },
        }

        with TemporaryDirectory(dir=self.repo_root) as temp_dir:
            run_root = Path(temp_dir) / "runs"
            eval_root = Path(temp_dir) / "evals"
            argv = [
                "run_calibration.py",
                "--run-manifest",
                str(manifest_path),
                "--output-root",
                str(run_root),
                "--eval-root",
                str(eval_root),
                "--skip-provider-smoke-test",
            ]
            with (
                patch.object(sys, "argv", argv),
                patch(
                    "calibration.run_calibration.create_chat_completion",
                    side_effect=[translation_response, review_response],
                ),
            ):
                result = run_calibration.main()
            self.assertEqual(result, 0)
            eval_dir = eval_root / "vol2-god-incomprehensibility-001-baseline"
            run_dir = run_root / "vol2-god-incomprehensibility-001-baseline"
            eval_record_path = eval_dir / "eval-record.json"
            evaluation_path = eval_dir / "evaluation.json"
            evaluation_markdown_path = eval_dir / "evaluation.md"

            self.assertTrue(eval_record_path.exists())
            self.assertTrue(evaluation_path.exists())
            self.assertTrue((eval_dir / "prompts" / "translation-system.txt").exists())
            self.assertTrue((eval_dir / "prompts" / "translation-user.txt").exists())
            self.assertTrue((eval_dir / "prompts" / "review-system.txt").exists())
            self.assertTrue((eval_dir / "prompts" / "review-user.txt").exists())

            eval_record = json.loads(eval_record_path.read_text(encoding="utf-8"))
            validate_commit_safe_eval_record(eval_record, validate_paths=True)
            self.assertNotIn("messages", json.dumps(eval_record))
            self.assertNotIn("reasoning_content", json.dumps(eval_record))
            self.assertEqual(eval_record["schema_version"], "1.1")
            self.assertEqual(eval_record["sanitization_version"], "1.1")
            self.assertEqual(eval_record["stages"]["translation"]["finish_reason"], "stop")
            self.assertEqual(eval_record["stages"]["review"]["finish_reason"], "stop")
            self.assertEqual(eval_record["stages"]["translation"]["usage"]["reasoning_tokens"], 7)
            self.assertEqual(eval_record["stages"]["review"]["usage"]["cached_tokens"], 3)
            self.assertIn("translation_system_prompt_path", eval_record["artifacts"])
            self.assertIn("translation_user_prompt_path", eval_record["artifacts"])
            self.assertIn("review_system_prompt_path", eval_record["artifacts"])
            self.assertIn("review_user_prompt_path", eval_record["artifacts"])
            self.assertNotIn("data/calibration/runs/", json.dumps(eval_record))

            safe_report = json.loads(evaluation_path.read_text(encoding="utf-8"))
            artifact_paths = json.dumps(safe_report["artifacts"])
            self.assertNotIn("translation_response_path", safe_report["artifacts"])
            self.assertNotIn("review_response_path", safe_report["artifacts"])
            self.assertNotIn("translation_request_path", safe_report["artifacts"])
            self.assertNotIn("review_request_path", safe_report["artifacts"])
            self.assertNotIn("data/calibration/runs/", artifact_paths)
            self.assertNotIn("data/calibration/runs/", evaluation_markdown_path.read_text(encoding="utf-8"))

            self.assertTrue((run_dir / "outputs" / "translation-response.json").exists())
            self.assertTrue((run_dir / "review" / "review-response.json").exists())
            self.assertFalse((run_dir / "outputs" / "translation.md").exists())
            self.assertFalse((run_dir / "review" / "findings.md").exists())
            self.assertFalse((run_dir / "reports" / "evaluation.json").exists())
            self.assertFalse((run_dir / "reports" / "evaluation.md").exists())

    def test_runner_fails_fast_on_empty_translation_output(self) -> None:
        manifest_path = self.repo_root / "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json"
        translation_response = {
            "id": "chatcmpl-translation",
            "created": 1,
            "model": "kimi-k2.5",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "   ",
                        "reasoning_content": "internal chain of thought",
                    },
                    "finish_reason": "stop",
                }
            ],
        }

        with TemporaryDirectory(dir=self.repo_root) as temp_dir:
            run_root = Path(temp_dir) / "runs"
            eval_root = Path(temp_dir) / "evals"
            argv = [
                "run_calibration.py",
                "--run-manifest",
                str(manifest_path),
                "--output-root",
                str(run_root),
                "--eval-root",
                str(eval_root),
                "--skip-provider-smoke-test",
            ]
            with (
                patch.object(sys, "argv", argv),
                patch(
                    "calibration.run_calibration.create_chat_completion",
                    side_effect=[translation_response],
                ) as mock_completion,
            ):
                with self.assertRaises(RuntimeError) as context:
                    run_calibration.main()

            self.assertIn("empty output", str(context.exception))
            self.assertEqual(mock_completion.call_count, 1)
            self.assertFalse((eval_root / "vol2-god-incomprehensibility-001-baseline").exists())
            self.assertFalse(
                (run_root / "vol2-god-incomprehensibility-001-baseline" / "review" / "review-request.json").exists()
            )

    def test_runner_flags_untranslated_dutch_scripture_references_in_evaluation(self) -> None:
        manifest_path = self.repo_root / "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json"
        translation_response = {
            "id": "chatcmpl-translation",
            "created": 1,
            "model": "kimi-k2.5",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "God reveals himself in Hd. 17:23 and Jes. 40:28.\n",
                    },
                    "finish_reason": "stop",
                }
            ],
        }
        review_response = {
            "id": "chatcmpl-review",
            "created": 2,
            "model": "glm-5",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(
                            {
                                "summary": "Review completed.",
                                "checks": {
                                    "prose-quality": {"status": "pass", "details": "Readable."},
                                    "review-flagging": {"status": "pass", "details": "Issues called out."},
                                },
                                "findings": [{"severity": "low", "category": "style", "detail": "Minor issue."}],
                                "recommended_follow_up": ["Keep comparing runs."],
                            }
                        ),
                    },
                    "finish_reason": "stop",
                }
            ],
        }

        with TemporaryDirectory(dir=self.repo_root) as temp_dir:
            run_root = Path(temp_dir) / "runs"
            eval_root = Path(temp_dir) / "evals"
            argv = [
                "run_calibration.py",
                "--run-manifest",
                str(manifest_path),
                "--output-root",
                str(run_root),
                "--eval-root",
                str(eval_root),
                "--skip-provider-smoke-test",
            ]
            with (
                patch.object(sys, "argv", argv),
                patch(
                    "calibration.run_calibration.create_chat_completion",
                    side_effect=[translation_response, review_response],
                ),
            ):
                result = run_calibration.main()

            self.assertEqual(result, 0)
            evaluation_path = eval_root / "vol2-god-incomprehensibility-001-baseline" / "evaluation.json"
            evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
            check = next(item for item in evaluation["checks"] if item["id"] == "scripture-reference-normalization")

            self.assertEqual(check["status"], "fail")
            self.assertIn("Hd. 17:23", check["details"])
            self.assertIn("Jes. 40:28", check["details"])


if __name__ == "__main__":
    unittest.main()
