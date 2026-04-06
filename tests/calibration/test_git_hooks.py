from __future__ import annotations

import os
import stat
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.validation import REPO_ROOT


class GitHookTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = REPO_ROOT

    def test_secret_scan_script_fails_when_gitleaks_missing(self) -> None:
        env = os.environ.copy()
        env["GITLEAKS_BIN"] = "definitely-missing-gitleaks"
        result = subprocess.run(
            ["./scripts/pre-commit-secret-scan"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
            env=env,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("gitleaks is required", result.stderr)

    def test_secret_scan_script_invokes_configured_scanner(self) -> None:
        with TemporaryDirectory() as temp_dir:
            fake_scanner = Path(temp_dir) / "fake-gitleaks"
            fake_scanner.write_text(
                "#!/usr/bin/env sh\n"
                "printf '%s\\n' \"$@\" > \"$FAKE_GITLEAKS_ARGS_FILE\"\n",
                encoding="utf-8",
            )
            fake_scanner.chmod(fake_scanner.stat().st_mode | stat.S_IXUSR)
            args_file = Path(temp_dir) / "args.txt"

            env = os.environ.copy()
            env["GITLEAKS_BIN"] = str(fake_scanner)
            env["FAKE_GITLEAKS_ARGS_FILE"] = str(args_file)

            result = subprocess.run(
                ["./scripts/pre-commit-secret-scan"],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                env=env,
            )
            recorded_args = args_file.read_text(encoding="utf-8").splitlines()

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("scanning staged changes", result.stderr)
        self.assertEqual(
            recorded_args,
            ["git", "--staged", "--pre-commit", "--redact=20", "--no-banner", "--no-color"],
        )


if __name__ == "__main__":
    unittest.main()
