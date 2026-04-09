from __future__ import annotations

import stat
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))


class BatchRetryLauncherTests(unittest.TestCase):
    def test_retry_failed_runs_only_engine_overloaded_status_entries(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            script_path = temp_root / "run-calibration-batch"
            script_path.write_text(
                (Path(__file__).resolve().parents[2] / "run-calibration-batch").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

            manifests_dir = temp_root / "config" / "calibration" / "run-manifests"
            manifests_dir.mkdir(parents=True)
            manifest_a = manifests_dir / "run-a.json"
            manifest_b = manifests_dir / "run-b.json"
            manifest_a.write_text("{}", encoding="utf-8")
            manifest_b.write_text("{}", encoding="utf-8")
            manifest_list = manifests_dir / "list.txt"
            manifest_list.write_text(f"{manifest_a}\n{manifest_b}\n", encoding="utf-8")

            log_root = temp_root / "data" / "calibration" / "runs" / "logs"
            log_root.mkdir(parents=True)
            (log_root / "run-a.status").write_text("ok\n", encoding="utf-8")
            (log_root / "run-b.status").write_text("engine-overloaded\n", encoding="utf-8")

            fake_runner = temp_root / "fake-run-calibration"
            invoked_file = temp_root / "invoked.txt"
            fake_runner.write_text(
                "#!/usr/bin/env sh\n"
                f"printf '%s\\n' \"$@\" >> \"{invoked_file}\"\n"
                "exit 0\n",
                encoding="utf-8",
            )
            fake_runner.chmod(fake_runner.stat().st_mode | stat.S_IXUSR)

            env = {"RUN_CALIBRATION_BIN": str(fake_runner)}
            result = subprocess.run(
                [str(script_path), "--manifest-list", str(manifest_list), "--max-parallel", "1", "--retry-failed"],
                cwd=temp_root,
                capture_output=True,
                text=True,
                env=env,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn("skipping run-a", result.stderr)
            self.assertIn("retrying engine_overloaded run run-b", result.stderr)
            self.assertEqual(
                invoked_file.read_text(encoding="utf-8").splitlines(),
                ["--run-manifest", str(manifest_b)],
            )
            self.assertEqual((log_root / "run-b.status").read_text(encoding="utf-8").strip(), "ok")

    def test_retry_failed_reports_when_nothing_matches(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            script_path = temp_root / "run-calibration-batch"
            script_path.write_text(
                (Path(__file__).resolve().parents[2] / "run-calibration-batch").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

            manifests_dir = temp_root / "config" / "calibration" / "run-manifests"
            manifests_dir.mkdir(parents=True)
            manifest_a = manifests_dir / "run-a.json"
            manifest_a.write_text("{}", encoding="utf-8")
            manifest_list = manifests_dir / "list.txt"
            manifest_list.write_text(f"{manifest_a}\n", encoding="utf-8")

            log_root = temp_root / "data" / "calibration" / "runs" / "logs"
            log_root.mkdir(parents=True)
            (log_root / "run-a.status").write_text("ok\n", encoding="utf-8")

            fake_runner = temp_root / "fake-run-calibration"
            fake_runner.write_text("#!/usr/bin/env sh\nexit 99\n", encoding="utf-8")
            fake_runner.chmod(fake_runner.stat().st_mode | stat.S_IXUSR)

            env = {"RUN_CALIBRATION_BIN": str(fake_runner)}
            result = subprocess.run(
                [str(script_path), "--manifest-list", str(manifest_list), "--retry-failed"],
                cwd=temp_root,
                capture_output=True,
                text=True,
                env=env,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn("no engine_overloaded runs matched the manifest list", result.stderr)

    def test_retry_failed_uses_manual_run_artifact_when_status_file_is_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            script_path = temp_root / "run-calibration-batch"
            script_path.write_text(
                (Path(__file__).resolve().parents[2] / "run-calibration-batch").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

            manifests_dir = temp_root / "config" / "calibration" / "run-manifests"
            manifests_dir.mkdir(parents=True)
            manifest_a = manifests_dir / "run-a.json"
            manifest_b = manifests_dir / "run-b.json"
            manifest_a.write_text("{}", encoding="utf-8")
            manifest_b.write_text("{}", encoding="utf-8")
            manifest_list = manifests_dir / "list.txt"
            manifest_list.write_text(f"{manifest_a}\n{manifest_b}\n", encoding="utf-8")

            log_root = temp_root / "data" / "calibration" / "runs" / "logs"
            log_root.mkdir(parents=True)
            (log_root / "run-a.status").write_text("ok\n", encoding="utf-8")

            run_b_outputs = temp_root / "data" / "calibration" / "runs" / "run-b" / "outputs"
            run_b_outputs.mkdir(parents=True)
            (run_b_outputs / "translation-response.json").write_text(
                '{"choices":[{"message":{"content":"","reasoning_content":"thinking"},"finish_reason":"engine_overloaded"}]}',
                encoding="utf-8",
            )

            fake_runner = temp_root / "fake-run-calibration"
            invoked_file = temp_root / "invoked.txt"
            fake_runner.write_text(
                "#!/usr/bin/env sh\n"
                f"printf '%s\\n' \"$@\" >> \"{invoked_file}\"\n"
                "exit 0\n",
                encoding="utf-8",
            )
            fake_runner.chmod(fake_runner.stat().st_mode | stat.S_IXUSR)

            env = {"RUN_CALIBRATION_BIN": str(fake_runner)}
            result = subprocess.run(
                [str(script_path), "--manifest-list", str(manifest_list), "--max-parallel", "1", "--retry-failed"],
                cwd=temp_root,
                capture_output=True,
                text=True,
                env=env,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn("skipping run-a", result.stderr)
            self.assertIn("retrying engine_overloaded run run-b", result.stderr)
            self.assertEqual(
                invoked_file.read_text(encoding="utf-8").splitlines(),
                ["--run-manifest", str(manifest_b)],
            )
            self.assertEqual((log_root / "run-b.status").read_text(encoding="utf-8").strip(), "ok")

    def test_retry_failed_ignores_non_engine_overloaded_failures(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            script_path = temp_root / "run-calibration-batch"
            script_path.write_text(
                (Path(__file__).resolve().parents[2] / "run-calibration-batch").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

            manifests_dir = temp_root / "config" / "calibration" / "run-manifests"
            manifests_dir.mkdir(parents=True)
            manifest_a = manifests_dir / "run-a.json"
            manifest_a.write_text("{}", encoding="utf-8")
            manifest_list = manifests_dir / "list.txt"
            manifest_list.write_text(f"{manifest_a}\n", encoding="utf-8")

            run_a_outputs = temp_root / "data" / "calibration" / "runs" / "run-a" / "outputs"
            run_a_outputs.mkdir(parents=True)
            (run_a_outputs / "translation-response.json").write_text(
                '{"choices":[{"message":{"content":"","reasoning_content":"thinking"},"finish_reason":"stop"}]}',
                encoding="utf-8",
            )

            fake_runner = temp_root / "fake-run-calibration"
            fake_runner.write_text("#!/usr/bin/env sh\nexit 99\n", encoding="utf-8")
            fake_runner.chmod(fake_runner.stat().st_mode | stat.S_IXUSR)

            env = {"RUN_CALIBRATION_BIN": str(fake_runner)}
            result = subprocess.run(
                [str(script_path), "--manifest-list", str(manifest_list), "--retry-failed"],
                cwd=temp_root,
                capture_output=True,
                text=True,
                env=env,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn("no engine_overloaded runs matched the manifest list", result.stderr)

    def test_failed_runs_are_classified_as_engine_overloaded_from_logs(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            script_path = temp_root / "run-calibration-batch"
            script_path.write_text(
                (Path(__file__).resolve().parents[2] / "run-calibration-batch").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

            manifests_dir = temp_root / "config" / "calibration" / "run-manifests"
            manifests_dir.mkdir(parents=True)
            manifest_a = manifests_dir / "run-a.json"
            manifest_a.write_text("{}", encoding="utf-8")
            manifest_list = manifests_dir / "list.txt"
            manifest_list.write_text(f"{manifest_a}\n", encoding="utf-8")

            fake_runner = temp_root / "fake-run-calibration"
            fake_runner.write_text(
                "#!/usr/bin/env sh\n"
                "echo \"error: moonshot response ended with finish_reason 'engine_overloaded' before returning final content.\" >&2\n"
                "exit 1\n",
                encoding="utf-8",
            )
            fake_runner.chmod(fake_runner.stat().st_mode | stat.S_IXUSR)

            env = {"RUN_CALIBRATION_BIN": str(fake_runner)}
            result = subprocess.run(
                [str(script_path), "--manifest-list", str(manifest_list), "--max-parallel", "1"],
                cwd=temp_root,
                capture_output=True,
                text=True,
                env=env,
            )

            self.assertNotEqual(result.returncode, 0)
            status_file = temp_root / "data" / "calibration" / "runs" / "logs" / "run-a.status"
            self.assertEqual(status_file.read_text(encoding="utf-8").strip(), "engine-overloaded")
