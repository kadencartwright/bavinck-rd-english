from __future__ import annotations

import json
import shutil
import subprocess
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration import run_calibration
from calibration.common import write_json
from calibration.openai_compat import extract_message_text
from calibration.validation import REPO_ROOT, validate_commit_safe_eval_record


class BackfillEvalBundleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = REPO_ROOT
        self.manifest_path = self.repo_root / "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json"
        self.run_manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        self.slice_manifest_path = self.repo_root / str(self.run_manifest["slice_manifest_path"])
        self.slice_manifest = json.loads(self.slice_manifest_path.read_text(encoding="utf-8"))
        self.prompt_bundle_path = self.repo_root / str(self.run_manifest["prompt_bundle_path"])
        self.prompt_bundle_metadata = json.loads((self.prompt_bundle_path / "metadata.json").read_text(encoding="utf-8"))
        self.model_profile_path = self.repo_root / str(self.run_manifest["model_profile_path"])
        self.model_profile = json.loads(self.model_profile_path.read_text(encoding="utf-8"))
        self.glossary_path = self.repo_root / str(self.run_manifest["glossary_path"])
        self.style_guide_path = self.repo_root / str(self.run_manifest["style_guide_path"])
        self.rubric_path = self.repo_root / str(self.run_manifest["rubric_path"])
        self.excerpt_path = self.repo_root / str(self.slice_manifest["excerpt"]["path"])
        self.source_text_path = self.repo_root / str(self.slice_manifest["source"]["text_path"])
        self.source_metadata_path = self.repo_root / str(self.slice_manifest["source"]["metadata_path"])

    def test_backfill_exports_commit_safe_eval_bundle_from_historical_run(self) -> None:
        with TemporaryDirectory(dir=self.repo_root) as temp_dir:
            temp_root = Path(temp_dir)
            run_dir = self._create_historical_run_dir(temp_root / "runs")
            eval_root = temp_root / "evals"

            result = subprocess.run(
                ["./run-calibration-backfill", "--run-dir", str(run_dir), "--eval-root", str(eval_root)],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            eval_dir = eval_root / str(self.run_manifest["run_id"])
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
            self.assertEqual(eval_record["schema_version"], "1.1")
            self.assertEqual(eval_record["sanitization_version"], "1.1")
            self.assertEqual(
                eval_record["source_refs"]["run_manifest_path"],
                "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json",
            )
            self.assertEqual(eval_record["stages"]["translation"]["finish_reason"], "stop")
            self.assertEqual(eval_record["stages"]["review"]["finish_reason"], "stop")
            self.assertNotIn("data/calibration/runs/", json.dumps(eval_record))

            evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
            self.assertNotIn("data/calibration/runs/", json.dumps(evaluation))
            translation_output_check = next(item for item in evaluation["checks"] if item["id"] == "translation-output")
            self.assertNotIn("data/calibration/runs/", translation_output_check["details"])
            self.assertTrue(translation_output_check["details"].endswith("/translation.md"))
            self.assertNotIn("data/calibration/runs/", evaluation_markdown_path.read_text(encoding="utf-8"))

            self.assertTrue((run_dir / "outputs" / "translation.md").exists())
            self.assertTrue((run_dir / "review" / "findings.md").exists())
            self.assertTrue((run_dir / "reports" / "evaluation.json").exists())

    def test_backfill_fails_when_historical_evaluation_report_is_missing(self) -> None:
        with TemporaryDirectory(dir=self.repo_root) as temp_dir:
            temp_root = Path(temp_dir)
            run_dir = self._create_historical_run_dir(temp_root / "runs")
            (run_dir / "reports" / "evaluation.json").unlink()

            result = subprocess.run(
                ["./run-calibration-backfill", "--run-dir", str(run_dir)],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("required file not found", result.stderr)
            self.assertIn("evaluation.json", result.stderr)

    def _create_historical_run_dir(self, run_root: Path) -> Path:
        run_id = str(self.run_manifest["run_id"])
        run_dir = run_root / run_id
        inputs_dir = run_dir / "inputs"
        outputs_dir = run_dir / "outputs"
        review_dir = run_dir / "review"
        reports_dir = run_dir / "reports"
        for directory in [inputs_dir, outputs_dir, review_dir, reports_dir]:
            directory.mkdir(parents=True, exist_ok=True)

        copies = {
            self.manifest_path: inputs_dir / "run-manifest.json",
            self.slice_manifest_path: inputs_dir / "slice-manifest.json",
            self.model_profile_path: inputs_dir / "model-profile.json",
            self.prompt_bundle_path / "metadata.json": inputs_dir / "prompt-bundle-metadata.json",
            self.prompt_bundle_path / "translation-system.txt": inputs_dir / "translation-system.txt",
            self.prompt_bundle_path / "review-system.txt": inputs_dir / "review-system.txt",
            self.prompt_bundle_path / "translation-user-template.txt": inputs_dir / "translation-user-template.txt",
            self.prompt_bundle_path / "review-user-template.txt": inputs_dir / "review-user-template.txt",
            self.glossary_path: inputs_dir / "glossary.yaml",
            self.style_guide_path: inputs_dir / "style-guide.md",
            self.rubric_path: inputs_dir / "rubric.yaml",
            self.excerpt_path: inputs_dir / "excerpt.txt",
            self.source_text_path: inputs_dir / "source.txt",
            self.source_metadata_path: inputs_dir / "source-metadata.json",
        }
        for source, destination in copies.items():
            shutil.copyfile(source, destination)

        excerpt_text = self.excerpt_path.read_text(encoding="utf-8")
        translation_request = run_calibration.build_translation_request(
            run_id=run_id,
            run_manifest=self.run_manifest,
            slice_manifest=self.slice_manifest,
            prompt_bundle_metadata=self.prompt_bundle_metadata,
            model_profile=self.model_profile,
            excerpt_text=excerpt_text,
            glossary_path=self.glossary_path,
            style_guide_path=self.style_guide_path,
            prompt_bundle_path=self.prompt_bundle_path,
        )
        review_request = run_calibration.build_review_request(
            run_id=run_id,
            run_manifest=self.run_manifest,
            slice_manifest=self.slice_manifest,
            prompt_bundle_metadata=self.prompt_bundle_metadata,
            model_profile=self.model_profile,
            excerpt_text=excerpt_text,
            translation_text="Historical translation output.\n",
            glossary_path=self.glossary_path,
            style_guide_path=self.style_guide_path,
            rubric_path=self.rubric_path,
            prompt_bundle_path=self.prompt_bundle_path,
        )
        write_json(inputs_dir / "translation-request.json", translation_request["request_record"])
        write_json(review_dir / "review-request.json", review_request["request_record"])

        translation_response = {
            "id": "chatcmpl-translation",
            "created": 1,
            "model": "kimi-k2.5",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "Historical translation output.\n",
                        "reasoning_content": "internal reasoning",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 11,
                "completion_tokens": 22,
                "total_tokens": 33,
            },
        }
        review_payload = {
            "summary": "Historical review completed.",
            "checks": {
                "prose-quality": {"status": "pass", "details": "Readable."},
                "review-flagging": {"status": "pass", "details": "Issues called out."},
            },
            "findings": [{"severity": "low", "category": "style", "detail": "Minor issue."}],
            "recommended_follow_up": ["Keep comparing runs."],
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
                        "content": json.dumps(review_payload),
                        "reasoning_content": "review internals",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 44,
                "completion_tokens": 55,
                "total_tokens": 99,
            },
        }
        write_json(outputs_dir / "translation-response.json", translation_response)
        (outputs_dir / "translation.md").write_text(extract_message_text(translation_response).strip() + "\n", encoding="utf-8")
        write_json(review_dir / "review-response.json", review_response)
        write_json(review_dir / "review-structured.json", review_payload)
        findings_markdown = run_calibration.render_findings_markdown(review_payload)
        (review_dir / "findings.md").write_text(findings_markdown, encoding="utf-8")

        historical_report = {
            "schema_version": "1.0",
            "run_id": run_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "slice_id": self.run_manifest["slice_id"],
            "prompt_bundle_id": self.run_manifest["prompt_bundle_id"],
            "model_profile_id": self.run_manifest["model_profile_id"],
            "checks": [
                {
                    "id": "translation-output",
                    "status": "pass",
                    "details": f"Translation output path: data/calibration/runs/{run_id}/outputs/translation.md",
                },
                {
                    "id": "prose-quality",
                    "status": "pass",
                    "details": "Readable.",
                },
                {
                    "id": "review-flagging",
                    "status": "pass",
                    "details": "Issues called out.",
                },
            ],
            "summary": {"pass": 3, "fail": 0, "incomplete": 0},
            "artifacts": {
                "translation_request_path": f"data/calibration/runs/{run_id}/inputs/translation-request.json",
                "translation_response_path": f"data/calibration/runs/{run_id}/outputs/translation-response.json",
                "translation_output_path": f"data/calibration/runs/{run_id}/outputs/translation.md",
                "review_request_path": f"data/calibration/runs/{run_id}/review/review-request.json",
                "review_response_path": f"data/calibration/runs/{run_id}/review/review-response.json",
                "review_structured_path": f"data/calibration/runs/{run_id}/review/review-structured.json",
                "findings_path": f"data/calibration/runs/{run_id}/review/findings.md",
            },
            "qualitative_findings": {
                "path": f"data/calibration/runs/{run_id}/review/findings.md",
                "separate_from_checks": True,
            },
            "review_summary": review_payload["summary"],
            "glossary_hits": [],
            "glossary_misses": [],
        }
        write_json(reports_dir / "evaluation.json", historical_report)
        run_calibration.write_markdown_report(reports_dir / "evaluation.md", historical_report)
        return run_dir


if __name__ == "__main__":
    unittest.main()
