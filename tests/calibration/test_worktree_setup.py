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


class WorktreeSetupScriptTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = REPO_ROOT
        self.script_path = self.repo_root / "scripts" / "setup-worktree"

    def test_copies_env_from_primary_worktree_and_installs_requirements(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            primary_root = temp_path / "primary"
            worktree_root = temp_path / "worktree"
            bin_dir = temp_path / "bin"
            primary_root.mkdir()
            worktree_root.mkdir()
            (worktree_root / "scripts").mkdir()
            bin_dir.mkdir()

            (primary_root / ".env").write_text("MOONSHOT_API_KEY=primary-key\n", encoding="utf-8")
            (worktree_root / "requirements.txt").write_text("pytest\n", encoding="utf-8")

            copied_script = worktree_root / "scripts" / "setup-worktree"
            copied_script.write_text(self.script_path.read_text(encoding="utf-8"), encoding="utf-8")
            copied_script.chmod(copied_script.stat().st_mode | stat.S_IXUSR)

            git_stub = bin_dir / "git"
            git_stub.write_text(
                "#!/usr/bin/env sh\n"
                "if [ \"$1\" = \"worktree\" ] && [ \"$2\" = \"list\" ] && [ \"$3\" = \"--porcelain\" ]; then\n"
                f"  printf 'worktree {primary_root}\\nHEAD deadbeef\\nbranch refs/heads/main\\n\\n'\n"
                f"  printf 'worktree {worktree_root}\\nHEAD cafefood\\nbranch refs/heads/topic\\n'\n"
                "  exit 0\n"
                "fi\n"
                "echo unexpected git invocation: \"$@\" >&2\n"
                "exit 1\n",
                encoding="utf-8",
            )
            git_stub.chmod(git_stub.stat().st_mode | stat.S_IXUSR)

            python_stub = bin_dir / "python3"
            install_log = temp_path / "pip-args.txt"
            python_stub.write_text(
                "#!/usr/bin/env sh\n"
                f"printf '%s\\n' \"$@\" > \"{install_log}\"\n",
                encoding="utf-8",
            )
            python_stub.chmod(python_stub.stat().st_mode | stat.S_IXUSR)

            env = os.environ.copy()
            env["PATH"] = f"{bin_dir}:{env['PATH']}"

            result = subprocess.run(
                ["./scripts/setup-worktree"],
                cwd=worktree_root,
                capture_output=True,
                text=True,
                env=env,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertEqual(
                (worktree_root / ".env").read_text(encoding="utf-8"),
                "MOONSHOT_API_KEY=primary-key\n",
            )
            self.assertEqual(
                install_log.read_text(encoding="utf-8").splitlines(),
                ["-m", "pip", "install", "-r", "requirements.txt"],
            )
            self.assertIn("copied .env", result.stderr)
            self.assertIn("installing Python dependencies from requirements.txt", result.stderr)

    def test_does_not_overwrite_existing_env_without_force(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            primary_root = temp_path / "primary"
            worktree_root = temp_path / "worktree"
            bin_dir = temp_path / "bin"
            primary_root.mkdir()
            worktree_root.mkdir()
            (worktree_root / "scripts").mkdir()
            bin_dir.mkdir()

            (primary_root / ".env").write_text("MOONSHOT_API_KEY=primary-key\n", encoding="utf-8")
            (worktree_root / ".env").write_text("MOONSHOT_API_KEY=current-key\n", encoding="utf-8")

            copied_script = worktree_root / "scripts" / "setup-worktree"
            copied_script.write_text(self.script_path.read_text(encoding="utf-8"), encoding="utf-8")
            copied_script.chmod(copied_script.stat().st_mode | stat.S_IXUSR)

            git_stub = bin_dir / "git"
            git_stub.write_text(
                "#!/usr/bin/env sh\n"
                "if [ \"$1\" = \"worktree\" ] && [ \"$2\" = \"list\" ] && [ \"$3\" = \"--porcelain\" ]; then\n"
                f"  printf 'worktree {primary_root}\\nHEAD deadbeef\\nbranch refs/heads/main\\n\\n'\n"
                f"  printf 'worktree {worktree_root}\\nHEAD cafefood\\nbranch refs/heads/topic\\n'\n"
                "  exit 0\n"
                "fi\n"
                "echo unexpected git invocation: \"$@\" >&2\n"
                "exit 1\n",
                encoding="utf-8",
            )
            git_stub.chmod(git_stub.stat().st_mode | stat.S_IXUSR)

            env = os.environ.copy()
            env["PATH"] = f"{bin_dir}:{env['PATH']}"

            result = subprocess.run(
                ["./scripts/setup-worktree"],
                cwd=worktree_root,
                capture_output=True,
                text=True,
                env=env,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertEqual(
                (worktree_root / ".env").read_text(encoding="utf-8"),
                "MOONSHOT_API_KEY=current-key\n",
            )
            self.assertIn("use --force to overwrite", result.stderr)
            self.assertIn("nothing to install", result.stderr)


if __name__ == "__main__":
    unittest.main()
