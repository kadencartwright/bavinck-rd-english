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


class ValidateCliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = REPO_ROOT

    def test_default_preflight_succeeds(self) -> None:
        result = subprocess.run(
            [sys.executable, "src/calibration/validate_calibration.py"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("validated run manifest bundle", result.stdout)

    def test_all_calibration_succeeds(self) -> None:
        result = subprocess.run(
            [sys.executable, "src/calibration/validate_calibration.py", "--all-calibration"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("validated", result.stdout)

    def test_invalid_referenced_file_fails_usefully(self) -> None:
        manifest_path = self.repo_root / "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["glossary_path"] = "data/calibration/slices/vol2-god-incomprehensibility-001/inputs/missing.yaml"

        with TemporaryDirectory() as temp_dir:
            bad_manifest = Path(temp_dir) / "bad-run-manifest.json"
            bad_manifest.write_text(json.dumps(manifest), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, "src/calibration/validate_calibration.py", "--run-manifest", str(bad_manifest)],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("glossary_path", result.stderr)
        self.assertIn("does not exist", result.stderr)

    def test_invalid_json_manifest_fails_without_traceback(self) -> None:
        with TemporaryDirectory() as temp_dir:
            bad_manifest = Path(temp_dir) / "bad-run-manifest.json"
            bad_manifest.write_text("{bad json\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, "src/calibration/validate_calibration.py", "--run-manifest", str(bad_manifest)],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid JSON", result.stderr)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
