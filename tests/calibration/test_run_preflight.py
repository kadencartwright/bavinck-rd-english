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
from calibration.validation import REPO_ROOT


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

    def test_wrapper_supports_smoke_test_only_with_default_manifest(self) -> None:
        result = subprocess.run(
            ["./run-calibration", "--smoke-test-only"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )

        self.assertNotIn("the following arguments are required: --run-manifest", result.stderr)
        self.assertIn("validated run manifest bundle", result.stdout)


if __name__ == "__main__":
    unittest.main()
