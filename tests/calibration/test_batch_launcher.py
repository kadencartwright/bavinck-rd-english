from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.validation import REPO_ROOT


class BatchLauncherTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = REPO_ROOT

    def test_manifest_list_must_exist(self) -> None:
        result = subprocess.run(
            ["./run-calibration-batch", "--manifest-list", "config/calibration/run-manifests/missing.txt"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("manifest list not found", result.stderr)

    def test_max_parallel_must_be_positive_integer(self) -> None:
        with TemporaryDirectory() as temp_dir:
            manifest_list = Path(temp_dir) / "list.txt"
            manifest_list.write_text(
                "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json\n",
                encoding="utf-8",
            )
            result = subprocess.run(
                ["./run-calibration-batch", "--manifest-list", str(manifest_list), "--max-parallel", "0"],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be greater than zero", result.stderr)


if __name__ == "__main__":
    unittest.main()
