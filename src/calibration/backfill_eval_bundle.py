#!/usr/bin/env python3
"""Backfill a commit-safe eval bundle from an existing transient run directory."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.common import extract_json_object, sha256_text, write_json  # noqa: E402
from calibration.openai_compat import extract_message_text  # noqa: E402
from calibration.run_calibration import (  # noqa: E402
    export_commit_safe_eval_bundle,
    normalize_review_payload,
    render_findings_markdown,
)
from calibration.validation import (  # noqa: E402
    REPO_ROOT,
    ValidationError,
    load_and_validate_json,
    resolve_repo_path,
    validate_commit_safe_eval_record,
    validate_review_payload,
    validate_review_request_record,
    validate_run_manifest,
    validate_translation_request_record,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a durable commit-safe eval bundle from an existing transient calibration run."
    )
    parser.add_argument(
        "--run-dir",
        type=Path,
        required=True,
        help="Path to an existing data/calibration/runs/<run_id> directory.",
    )
    parser.add_argument(
        "--eval-root",
        type=Path,
        default=Path("data/calibration/evals"),
        help="Root directory that will receive the durable Git-tracked eval bundle.",
    )
    parser.add_argument(
        "--run-manifest",
        type=Path,
        help="Optional canonical run manifest path to record in source_refs. Defaults to config/calibration/run-manifests/<run_id>.json.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    run_dir = _resolve_user_path(args.run_dir)
    eval_root = _resolve_user_path(args.eval_root)
    _log(f"backfilling eval bundle from transient run directory {run_dir}")

    inputs_dir = run_dir / "inputs"
    outputs_dir = run_dir / "outputs"
    review_dir = run_dir / "review"
    reports_dir = run_dir / "reports"
    for directory in [inputs_dir, outputs_dir, review_dir, reports_dir]:
        if not directory.exists():
            raise RuntimeError(f"missing required run subdirectory: {directory}")

    copied_run_manifest_path = inputs_dir / "run-manifest.json"
    copied_slice_manifest_path = inputs_dir / "slice-manifest.json"
    copied_model_profile_path = inputs_dir / "model-profile.json"
    copied_glossary_path = inputs_dir / "glossary.yaml"
    copied_style_guide_path = inputs_dir / "style-guide.md"
    copied_rubric_path = inputs_dir / "rubric.yaml"
    copied_prompt_bundle_metadata_path = inputs_dir / "prompt-bundle-metadata.json"
    translation_request_path = inputs_dir / "translation-request.json"
    review_request_path = review_dir / "review-request.json"
    translation_response_path = outputs_dir / "translation-response.json"
    review_response_path = review_dir / "review-response.json"
    evaluation_report_path = reports_dir / "evaluation.json"

    run_manifest = load_and_validate_json(copied_run_manifest_path, validate_run_manifest)
    run_id = str(run_manifest["run_id"])
    if run_dir.name != run_id:
        raise RuntimeError(f"run directory name '{run_dir.name}' does not match run_id '{run_id}'")

    model_profile = _load_json(copied_model_profile_path)
    translation_request_record = load_and_validate_json(translation_request_path, validate_translation_request_record)
    review_request_record = load_and_validate_json(review_request_path, validate_review_request_record)
    translation_request = _inflate_request_record(translation_request_record, model_profile=model_profile)
    review_request = _inflate_request_record(review_request_record, model_profile=model_profile)
    translation_response = _load_json(translation_response_path)
    review_response = _load_json(review_response_path)
    translation_text = _load_translation_text(outputs_dir, translation_response)
    review_payload = _load_review_payload(review_dir, review_response)
    findings_markdown = _load_findings_markdown(review_dir, review_payload)
    evaluation_report = _load_json(evaluation_report_path)

    canonical_run_manifest_path = resolve_repo_path(
        args.run_manifest or Path(f"config/calibration/run-manifests/{run_id}.json"),
        repo_root=REPO_ROOT,
    )

    prompt_bundle_dir = run_dir / ".backfill-prompt-bundle"
    _prepare_prompt_bundle_dir(inputs_dir=inputs_dir, prompt_bundle_dir=prompt_bundle_dir)
    try:
        eval_dir = export_commit_safe_eval_bundle(
            eval_root=eval_root,
            run_manifest_path=copied_run_manifest_path,
            slice_manifest_path=copied_slice_manifest_path,
            prompt_bundle_path=prompt_bundle_dir,
            model_profile_path=copied_model_profile_path,
            glossary_path=copied_glossary_path,
            style_guide_path=copied_style_guide_path,
            rubric_path=copied_rubric_path,
            translation_request=translation_request,
            translation_response=translation_response,
            translation_text=translation_text,
            review_request=review_request,
            review_response=review_response,
            review_payload=review_payload,
            findings_markdown=findings_markdown,
            evaluation_report=evaluation_report,
        )
    finally:
        shutil.rmtree(prompt_bundle_dir, ignore_errors=True)

    eval_record_path = eval_dir / "eval-record.json"
    eval_record = _load_json(eval_record_path)
    eval_record["source_refs"] = _canonical_source_refs(
        run_manifest=run_manifest,
        canonical_run_manifest_path=canonical_run_manifest_path,
    )
    eval_record["hashes"].update(
        _copied_input_hashes(
            copied_run_manifest_path=copied_run_manifest_path,
            copied_slice_manifest_path=copied_slice_manifest_path,
            copied_prompt_bundle_metadata_path=copied_prompt_bundle_metadata_path,
            copied_model_profile_path=copied_model_profile_path,
            copied_glossary_path=copied_glossary_path,
            copied_style_guide_path=copied_style_guide_path,
            copied_rubric_path=copied_rubric_path,
        )
    )
    validate_commit_safe_eval_record(eval_record)
    write_json(eval_record_path, eval_record)

    _log(f"backfill complete: {eval_dir}")
    print(f"Backfilled commit-safe eval bundle: {eval_dir}")
    return 0


def _resolve_user_path(path: Path) -> Path:
    if path.is_absolute():
        return path.resolve()
    return (REPO_ROOT / path).resolve()


def _load_json(path: Path) -> dict[str, object]:
    if not path.exists():
        raise RuntimeError(f"required file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _load_translation_text(outputs_dir: Path, translation_response: dict[str, object]) -> str:
    translation_output_path = outputs_dir / "translation.md"
    if translation_output_path.exists():
        return translation_output_path.read_text(encoding="utf-8")
    return extract_message_text(translation_response).strip() + "\n"


def _load_review_payload(review_dir: Path, review_response: dict[str, object]) -> dict[str, object]:
    structured_path = review_dir / "review-structured.json"
    repaired_path = review_dir / "review-repaired.json"
    if structured_path.exists():
        payload = _load_json(structured_path)
    elif repaired_path.exists():
        payload = _load_json(repaired_path)
    else:
        payload = extract_json_object(extract_message_text(review_response))
    payload = normalize_review_payload(payload)
    validate_review_payload(payload)
    return payload


def _load_findings_markdown(review_dir: Path, review_payload: dict[str, object]) -> str:
    findings_path = review_dir / "findings.md"
    if findings_path.exists():
        return findings_path.read_text(encoding="utf-8")
    return render_findings_markdown(review_payload)


def _inflate_request_record(
    request_record: dict[str, object],
    *,
    model_profile: dict[str, object],
) -> dict[str, object]:
    stage_name = str(request_record["stage"])
    stages = model_profile.get("stages")
    if not isinstance(stages, dict):
        raise RuntimeError("model profile is missing stages configuration")
    stage_config = stages.get(stage_name)
    if not isinstance(stage_config, dict):
        raise RuntimeError(f"model profile is missing stage configuration for '{stage_name}'")
    return {
        "provider_name": request_record["provider"],
        "model": request_record["model"],
        "temperature": request_record["temperature"],
        "max_tokens": stage_config.get("max_tokens"),
        "timeout_seconds": stage_config.get("timeout_seconds"),
        "messages": request_record["messages"],
        "request_record": request_record,
    }


def _prepare_prompt_bundle_dir(*, inputs_dir: Path, prompt_bundle_dir: Path) -> None:
    if prompt_bundle_dir.exists():
        shutil.rmtree(prompt_bundle_dir)
    prompt_bundle_dir.mkdir(parents=True, exist_ok=True)
    copies = {
        inputs_dir / "prompt-bundle-metadata.json": prompt_bundle_dir / "metadata.json",
        inputs_dir / "translation-system.txt": prompt_bundle_dir / "translation-system.txt",
        inputs_dir / "review-system.txt": prompt_bundle_dir / "review-system.txt",
        inputs_dir / "translation-user-template.txt": prompt_bundle_dir / "translation-user-template.txt",
        inputs_dir / "review-user-template.txt": prompt_bundle_dir / "review-user-template.txt",
    }
    for source, destination in copies.items():
        if not source.exists():
            raise RuntimeError(f"required prompt bundle file not found: {source}")
        destination.write_bytes(source.read_bytes())


def _canonical_source_refs(
    *,
    run_manifest: dict[str, object],
    canonical_run_manifest_path: Path,
) -> dict[str, str]:
    return {
        "run_manifest_path": _relative_to_repo_if_possible(canonical_run_manifest_path),
        "slice_manifest_path": _relative_to_repo_if_possible(resolve_repo_path(str(run_manifest["slice_manifest_path"]))),
        "prompt_bundle_path": _relative_to_repo_if_possible(resolve_repo_path(str(run_manifest["prompt_bundle_path"]))),
        "model_profile_path": _relative_to_repo_if_possible(resolve_repo_path(str(run_manifest["model_profile_path"]))),
        "glossary_path": _relative_to_repo_if_possible(resolve_repo_path(str(run_manifest["glossary_path"]))),
        "style_guide_path": _relative_to_repo_if_possible(resolve_repo_path(str(run_manifest["style_guide_path"]))),
        "rubric_path": _relative_to_repo_if_possible(resolve_repo_path(str(run_manifest["rubric_path"]))),
    }


def _copied_input_hashes(
    *,
    copied_run_manifest_path: Path,
    copied_slice_manifest_path: Path,
    copied_prompt_bundle_metadata_path: Path,
    copied_model_profile_path: Path,
    copied_glossary_path: Path,
    copied_style_guide_path: Path,
    copied_rubric_path: Path,
) -> dict[str, str]:
    return {
        "run_manifest_sha256": sha256_text(copied_run_manifest_path.read_text(encoding="utf-8")),
        "slice_manifest_sha256": sha256_text(copied_slice_manifest_path.read_text(encoding="utf-8")),
        "prompt_bundle_metadata_sha256": sha256_text(copied_prompt_bundle_metadata_path.read_text(encoding="utf-8")),
        "model_profile_sha256": sha256_text(copied_model_profile_path.read_text(encoding="utf-8")),
        "glossary_sha256": sha256_text(copied_glossary_path.read_text(encoding="utf-8")),
        "style_guide_sha256": sha256_text(copied_style_guide_path.read_text(encoding="utf-8")),
        "rubric_sha256": sha256_text(copied_rubric_path.read_text(encoding="utf-8")),
    }


def _relative_to_repo_if_possible(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def _log(message: str) -> None:
    print(f"[backfill_eval_bundle] {message}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValidationError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
