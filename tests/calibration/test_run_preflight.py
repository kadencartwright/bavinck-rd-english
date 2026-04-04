from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

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


if __name__ == "__main__":
    unittest.main()
