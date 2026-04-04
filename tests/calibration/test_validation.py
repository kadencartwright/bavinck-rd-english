from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.common import extract_json_object
from calibration.validation import (
    REPO_ROOT,
    ValidationError,
    load_and_validate_glossary,
    load_and_validate_json,
    load_and_validate_rubric,
    validate_evaluation_report,
    validate_model_profile,
    validate_prompt_bundle_metadata,
    validate_review_payload,
    validate_run_manifest,
    validate_slice_manifest,
    validate_source_metadata,
)


class ValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = REPO_ROOT

    def load_json(self, relative_path: str) -> dict[str, object]:
        return json.loads((self.repo_root / relative_path).read_text(encoding="utf-8"))

    def test_valid_source_metadata_passes(self) -> None:
        payload = self.load_json("data/metadata/pg67966.json")
        validate_source_metadata(payload, path=self.repo_root / "data/metadata/pg67966.json", validate_paths=True)

    def test_missing_required_source_metadata_field_fails(self) -> None:
        payload = self.load_json("data/metadata/pg67966.json")
        payload["title"] = ""
        with self.assertRaises(ValidationError) as context:
            validate_source_metadata(payload)
        self.assertIn("title", str(context.exception))

    def test_invalid_sha256_fails(self) -> None:
        payload = self.load_json("data/metadata/pg67966.json")
        payload["clean_sha256"] = "bad"
        with self.assertRaises(ValidationError) as context:
            validate_source_metadata(payload)
        self.assertIn("clean_sha256", str(context.exception))

    def test_valid_slice_manifest_passes(self) -> None:
        payload = self.load_json("data/calibration/slices/vol2-god-incomprehensibility-001/manifest.json")
        validate_slice_manifest(
            payload,
            path=self.repo_root / "data/calibration/slices/vol2-god-incomprehensibility-001/manifest.json",
            validate_paths=True,
        )

    def test_slice_manifest_mismatched_sha_fails(self) -> None:
        payload = self.load_json("data/calibration/slices/vol2-god-incomprehensibility-001/manifest.json")
        payload["source_identity"]["clean_sha256"] = "0" * 64
        with self.assertRaises(ValidationError) as context:
            validate_slice_manifest(payload, validate_paths=True)
        self.assertIn("source_identity.clean_sha256", str(context.exception))

    def test_slice_manifest_bad_line_range_fails(self) -> None:
        payload = self.load_json("data/calibration/slices/vol2-god-incomprehensibility-001/manifest.json")
        payload["selection"]["start_line"] = payload["selection"]["end_line"] + 1
        with self.assertRaises(ValidationError) as context:
            validate_slice_manifest(payload)
        self.assertIn("selection.start_line", str(context.exception))

    def test_slice_manifest_mismatched_clean_char_count_fails(self) -> None:
        payload = self.load_json("data/calibration/slices/vol2-god-incomprehensibility-001/manifest.json")
        payload["source_identity"]["clean_char_count"] += 1
        with self.assertRaises(ValidationError) as context:
            validate_slice_manifest(payload, validate_paths=True)
        self.assertIn("source_identity.clean_char_count", str(context.exception))

    def test_valid_prompt_bundle_metadata_passes(self) -> None:
        path = self.repo_root / "config/calibration/prompt-bundles/baseline-v1/metadata.json"
        payload = self.load_json("config/calibration/prompt-bundles/baseline-v1/metadata.json")
        validate_prompt_bundle_metadata(payload, path=path, bundle_dir=path.parent, validate_paths=True)

    def test_prompt_bundle_metadata_missing_prompt_file_key_fails(self) -> None:
        payload = self.load_json("config/calibration/prompt-bundles/baseline-v1/metadata.json")
        del payload["prompt_files"]["translation_system"]
        with self.assertRaises(ValidationError) as context:
            validate_prompt_bundle_metadata(payload)
        self.assertIn("translation_system", str(context.exception))

    def test_prompt_bundle_metadata_missing_file_fails(self) -> None:
        with TemporaryDirectory() as temp_dir:
            bundle_dir = Path(temp_dir) / "baseline-v1"
            bundle_dir.mkdir()
            metadata = self.load_json("config/calibration/prompt-bundles/baseline-v1/metadata.json")
            (bundle_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
            (bundle_dir / "review-system.txt").write_text("json", encoding="utf-8")
            (bundle_dir / "review-user-template.txt").write_text("{{source_excerpt}}{{translation_output}}{{rubric}}", encoding="utf-8")
            (bundle_dir / "translation-user-template.txt").write_text("{{source_excerpt}}", encoding="utf-8")
            with self.assertRaises(ValidationError) as context:
                validate_prompt_bundle_metadata(metadata, bundle_dir=bundle_dir, validate_paths=True)
            self.assertIn("translation_system", str(context.exception))

    def test_prompt_bundle_metadata_missing_context_placeholder_fails(self) -> None:
        with TemporaryDirectory() as temp_dir:
            bundle_dir = Path(temp_dir) / "baseline-v1"
            bundle_dir.mkdir()
            metadata = self.load_json("config/calibration/prompt-bundles/baseline-v1/metadata.json")
            (bundle_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
            (bundle_dir / "translation-system.txt").write_text("sys", encoding="utf-8")
            (bundle_dir / "review-system.txt").write_text("sys", encoding="utf-8")
            (bundle_dir / "translation-user-template.txt").write_text(
                "{{run_id}}\n{{slice_id}}\n{{slice_title}}\n{{selection_rationale}}\n{{source_excerpt}}",
                encoding="utf-8",
            )
            (bundle_dir / "review-user-template.txt").write_text(
                "{{run_id}}\n{{slice_id}}\n{{slice_title}}\n{{source_excerpt}}\n{{translation_output}}\n{{rubric}}",
                encoding="utf-8",
            )
            with self.assertRaises(ValidationError) as context:
                validate_prompt_bundle_metadata(metadata, bundle_dir=bundle_dir, validate_paths=True)
            self.assertIn("{{glossary_terms}}", str(context.exception))
            self.assertIn("{{style_guide}}", str(context.exception))

    def test_valid_model_profile_passes(self) -> None:
        payload = self.load_json("config/calibration/model-profiles/kimi-k2_5-glm5-baseline.json")
        validate_model_profile(payload)

    def test_unsupported_provider_fails(self) -> None:
        payload = self.load_json("config/calibration/model-profiles/kimi-k2_5-glm5-baseline.json")
        payload["stages"]["translation"]["provider"] = "unknown"
        with self.assertRaises(ValidationError) as context:
            validate_model_profile(payload)
        self.assertIn("unsupported provider", str(context.exception))

    def test_invalid_numeric_bounds_fail(self) -> None:
        payload = self.load_json("config/calibration/model-profiles/kimi-k2_5-glm5-baseline.json")
        payload["stages"]["translation"]["temperature"] = 3.0
        with self.assertRaises(ValidationError) as context:
            validate_model_profile(payload)
        self.assertIn("temperature", str(context.exception))

    def test_valid_run_manifest_passes(self) -> None:
        payload = self.load_json("config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json")
        validate_run_manifest(payload, validate_paths=True)

    def test_run_manifest_mismatched_ids_fail(self) -> None:
        payload = self.load_json("config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json")
        payload["model_profile_id"] = "different"
        with self.assertRaises(ValidationError) as context:
            validate_run_manifest(payload, validate_paths=True)
        self.assertIn("model_profile_id", str(context.exception))

    def test_run_manifest_legacy_fields_fail(self) -> None:
        payload = self.load_json("config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json")
        payload["seed_translation_path"] = "legacy"
        with self.assertRaises(ValidationError) as context:
            validate_run_manifest(payload)
        self.assertIn("legacy placeholder field", str(context.exception))

    def test_valid_glossary_yaml_passes(self) -> None:
        load_and_validate_glossary(
            self.repo_root / "data/calibration/slices/vol2-god-incomprehensibility-001/inputs/glossary.yaml",
            expected_slice_id="vol2-god-incomprehensibility-001",
        )

    def test_duplicate_glossary_terms_fail(self) -> None:
        text = """schema_version: "1.0"
slice_id: "slice"
terms:
  - source: "a"
    target: "b"
  - source: "a"
    target: "c"
"""
        with self.assertRaises(ValidationError) as context:
            from calibration.validation import validate_glossary_yaml_text

            validate_glossary_yaml_text(text, expected_slice_id="slice")
        self.assertIn("duplicate source term", str(context.exception))

    def test_valid_rubric_yaml_passes(self) -> None:
        load_and_validate_rubric(
            self.repo_root / "data/calibration/slices/vol2-god-incomprehensibility-001/inputs/rubric.yaml",
            expected_slice_id="vol2-god-incomprehensibility-001",
        )

    def test_missing_required_criterion_fails(self) -> None:
        text = """schema_version: "1.0"
slice_id: "slice"
criteria:
  - id: "prose-quality"
    requirement: "x"
    status_values: "pass|fail|incomplete"
"""
        with self.assertRaises(ValidationError) as context:
            from calibration.validation import validate_rubric_yaml_text

            validate_rubric_yaml_text(text, expected_slice_id="slice")
        self.assertIn("review-flagging", str(context.exception))

    def test_valid_review_payload_passes(self) -> None:
        payload = {
            "summary": "Looks good.",
            "checks": {
                "prose-quality": {"status": "pass", "details": "Okay"},
                "review-flagging": {"status": "pass", "details": "Okay"},
            },
            "findings": [{"severity": "low", "category": "style", "detail": "Minor"}],
            "recommended_follow_up": ["Ship it"],
        }
        validate_review_payload(payload)

    def test_malformed_review_payload_fails(self) -> None:
        payload = {
            "summary": "Bad.",
            "checks": {"prose-quality": {"status": "pass", "details": "Ok"}},
            "findings": [],
            "recommended_follow_up": [],
        }
        with self.assertRaises(ValidationError) as context:
            validate_review_payload(payload)
        self.assertIn("review-flagging", str(context.exception))

    def test_valid_evaluation_report_passes(self) -> None:
        payload = {
            "schema_version": "1.0",
            "run_id": "run-1",
            "slice_id": "slice",
            "prompt_bundle_id": "bundle",
            "model_profile_id": "profile",
            "checks": [
                {"id": "a", "status": "pass", "details": "ok"},
                {"id": "b", "status": "fail", "details": "bad"},
            ],
            "summary": {"pass": 1, "fail": 1, "incomplete": 0},
            "artifacts": {"translation_output_path": "x"},
            "qualitative_findings": {"path": "y", "separate_from_checks": True},
        }
        validate_evaluation_report(payload)

    def test_evaluation_report_summary_mismatch_fails(self) -> None:
        payload = {
            "schema_version": "1.0",
            "run_id": "run-1",
            "slice_id": "slice",
            "prompt_bundle_id": "bundle",
            "model_profile_id": "profile",
            "checks": [{"id": "a", "status": "pass", "details": "ok"}],
            "summary": {"pass": 0, "fail": 0, "incomplete": 0},
            "artifacts": {"translation_output_path": "x"},
            "qualitative_findings": {"path": "y", "separate_from_checks": True},
        }
        with self.assertRaises(ValidationError) as context:
            validate_evaluation_report(payload)
        self.assertIn("summary.pass", str(context.exception))

    def test_load_and_validate_json_reports_invalid_json_usefully(self) -> None:
        with TemporaryDirectory() as temp_dir:
            bad_path = Path(temp_dir) / "bad-run-manifest.json"
            bad_path.write_text("{bad json\n", encoding="utf-8")
            with self.assertRaises(ValidationError) as context:
                load_and_validate_json(bad_path, validate_run_manifest)
        self.assertIn("invalid JSON", str(context.exception))

    def test_extract_json_object_invalid_json_raises_runtime_error(self) -> None:
        with self.assertRaises(RuntimeError) as context:
            extract_json_object("{not json}")
        self.assertIn("Could not parse model JSON output", str(context.exception))


if __name__ == "__main__":
    unittest.main()
