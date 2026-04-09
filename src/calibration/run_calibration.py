#!/usr/bin/env python3
"""Materialize a calibration run and generate evaluation reports."""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.common import (
    extract_json_object,
    extract_preserved_spans,
    load_dotenv,
    relative_to_repo,
    render_template,
    sha256_text,
    write_json,
)
from calibration.openai_compat import create_chat_completion, extract_message_text
from calibration.validation import (
    REPO_ROOT,
    ValidationError,
    load_and_validate_glossary,
    load_and_validate_json,
    load_and_validate_rubric,
    resolve_repo_path,
    validate_commit_safe_eval_record,
    validate_evaluation_report,
    validate_model_profile,
    validate_prompt_bundle_metadata,
    validate_review_payload,
    validate_review_request_record,
    validate_run_manifest_bundle,
    validate_slice_manifest,
    validate_translation_request_record,
)


SCRIPTURE_REFERENCE_SUFFIX = r"\s*\d+(?:(?::|\s+vs?\.\s+|\s+vv?\.\s+)\d+(?:[-–]\d+)?)?"
DUTCH_SCRIPTURE_REFERENCE_FORMS = [
    r"\bHd\.",
    r"\bHand\.",
    r"\bJes\.",
    r"\bJesaia\b",
    r"\bEf\.",
    r"\bHebr\.",
    r"\bRicht\.",
    r"\bOp\.",
    r"\bOpenb\.",
    r"\bSpr\.",
    r"\bPred\.",
    r"\bEzech\.",
    r"\bJoz\.",
    r"\bJak\.",
    r"\bJoh\.",
    r"\bLuk\.",
    r"\bMatth\.",
    r"\b1\s*Petr\.",
    r"\b2\s*Petr\.",
    r"\b1\s*Kon\.",
    r"\b2\s*Kon\.",
    r"\b1\s*S\.",
    r"\b2\s*S\.",
    r"\b1\s*K\.",
    r"\b2\s*K\.",
]
DUTCH_SCRIPTURE_REFERENCE_PATTERNS = [
    re.compile(rf"{form}{SCRIPTURE_REFERENCE_SUFFIX}") for form in DUTCH_SCRIPTURE_REFERENCE_FORMS
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create stable run outputs and evaluation reports for a calibration slice."
    )
    parser.add_argument(
        "--run-manifest",
        type=Path,
        required=True,
        help="Path to the calibration run manifest JSON file.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("data/calibration/runs"),
        help="Root directory that will receive stable run outputs.",
    )
    parser.add_argument(
        "--eval-root",
        type=Path,
        default=Path("data/calibration/evals"),
        help="Root directory that will receive commit-safe eval exports.",
    )
    parser.add_argument(
        "--allow-source-drift",
        action="store_true",
        help="Continue even when the current source text no longer matches the stored slice manifest.",
    )
    parser.add_argument(
        "--dotenv-path",
        type=Path,
        default=Path(".env"),
        help="Optional .env file that supplies provider API keys.",
    )
    parser.add_argument(
        "--skip-provider-smoke-test",
        action="store_true",
        help="Skip the low-cost provider auth/model smoke test that runs before materializing outputs.",
    )
    parser.add_argument(
        "--smoke-test-only",
        action="store_true",
        help="Run only the low-cost provider smoke test and exit without materializing a calibration run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    _log(
        "starting calibration runner "
        f"(run_manifest={args.run_manifest}, output_root={args.output_root}, "
        f"eval_root={args.eval_root}, "
        f"smoke_test_only={args.smoke_test_only}, "
        f"skip_provider_smoke_test={args.skip_provider_smoke_test})"
    )
    _log(f"loading dotenv from {args.dotenv_path}")
    load_dotenv(args.dotenv_path)
    _log("resolving run manifest path")
    run_manifest_path = resolve_repo_path(args.run_manifest, repo_root=REPO_ROOT)
    _log(f"validating run manifest bundle: {relative_to_repo(run_manifest_path)}")
    run_manifest = validate_run_manifest_bundle(run_manifest_path)
    _log("resolving and validating slice manifest")
    slice_manifest_path = resolve_repo_path(str(run_manifest["slice_manifest_path"]), repo_root=REPO_ROOT)
    slice_manifest = load_and_validate_json(
        slice_manifest_path,
        validate_slice_manifest,
        validate_paths=True,
    )
    prompt_bundle_path = resolve_repo_path(str(run_manifest["prompt_bundle_path"]), repo_root=REPO_ROOT)
    _log("resolving and validating prompt bundle metadata")
    prompt_bundle_metadata = load_and_validate_json(
        prompt_bundle_path / "metadata.json",
        validate_prompt_bundle_metadata,
        bundle_dir=prompt_bundle_path,
        validate_paths=True,
    )
    model_profile_path = resolve_repo_path(str(run_manifest["model_profile_path"]), repo_root=REPO_ROOT)
    _log("resolving and validating model profile")
    model_profile = load_and_validate_json(
        model_profile_path,
        validate_model_profile,
    )
    if not args.skip_provider_smoke_test:
        _log("running provider smoke tests")
        smoke_test_provider_connections(model_profile)
        if args.smoke_test_only:
            _log("smoke-test-only mode complete")
            print("Provider smoke tests passed.")
            return 0
    else:
        _log("skipping provider smoke tests")

    run_id = str(run_manifest["run_id"])
    run_dir = args.output_root / run_id
    inputs_dir = run_dir / "inputs"
    outputs_dir = run_dir / "outputs"
    review_dir = run_dir / "review"
    reports_dir = run_dir / "reports"
    _log(f"preparing run directories under {run_dir}")
    for directory in [inputs_dir, outputs_dir, review_dir, reports_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    _log("resolving slice and input artifact paths")
    source_text_path = resolve_repo_path(str(slice_manifest["source"]["text_path"]), repo_root=REPO_ROOT)
    source_metadata_path = resolve_repo_path(str(slice_manifest["source"]["metadata_path"]), repo_root=REPO_ROOT)
    slice_excerpt_path = resolve_repo_path(str(slice_manifest["excerpt"]["path"]), repo_root=REPO_ROOT)
    glossary_path = resolve_repo_path(str(run_manifest["glossary_path"]), repo_root=REPO_ROOT)
    style_guide_path = resolve_repo_path(str(run_manifest["style_guide_path"]), repo_root=REPO_ROOT)
    rubric_path = resolve_repo_path(str(run_manifest["rubric_path"]), repo_root=REPO_ROOT)
    _log("loading glossary and rubric")
    glossary_doc = load_and_validate_glossary(glossary_path, expected_slice_id=str(run_manifest["slice_id"]))
    load_and_validate_rubric(rubric_path, expected_slice_id=str(run_manifest["slice_id"]))

    _log("checking source drift against stored manifest identity")
    current_source_text = source_text_path.read_text(encoding="utf-8")
    current_source_sha = sha256_text(current_source_text)
    expected_source_sha = str(slice_manifest["source_identity"]["clean_sha256"])
    source_drift = current_source_sha != expected_source_sha
    if source_drift and not args.allow_source_drift:
        raise RuntimeError(
            "Source drift detected between the current cleaned source and the stored slice manifest. "
            "Rerun with --allow-source-drift only if you are intentionally auditing drift."
        )

    _log("copying stable input artifacts into run directory")
    _copy(source_text_path, inputs_dir / "source.txt")
    _copy(source_metadata_path, inputs_dir / "source-metadata.json")
    _copy(slice_excerpt_path, inputs_dir / "excerpt.txt")
    _copy(glossary_path, inputs_dir / "glossary.yaml")
    _copy(style_guide_path, inputs_dir / "style-guide.md")
    _copy(rubric_path, inputs_dir / "rubric.yaml")
    _copy(run_manifest_path, inputs_dir / "run-manifest.json")
    _copy(slice_manifest_path, inputs_dir / "slice-manifest.json")
    _copy(model_profile_path, inputs_dir / "model-profile.json")
    _copy(prompt_bundle_path / "metadata.json", inputs_dir / "prompt-bundle-metadata.json")
    _copy(prompt_bundle_path / "translation-system.txt", inputs_dir / "translation-system.txt")
    _copy(prompt_bundle_path / "review-system.txt", inputs_dir / "review-system.txt")
    _copy(prompt_bundle_path / "translation-user-template.txt", inputs_dir / "translation-user-template.txt")
    _copy(prompt_bundle_path / "review-user-template.txt", inputs_dir / "review-user-template.txt")

    translation_output_path = outputs_dir / "translation.md"
    _log("reading excerpt text and building translation request")
    excerpt_text = slice_excerpt_path.read_text(encoding="utf-8")
    translation_request = build_translation_request(
        run_id=run_id,
        run_manifest=run_manifest,
        slice_manifest=slice_manifest,
        prompt_bundle_metadata=prompt_bundle_metadata,
        model_profile=model_profile,
        excerpt_text=excerpt_text,
        glossary_path=glossary_path,
        style_guide_path=style_guide_path,
        prompt_bundle_path=prompt_bundle_path,
    )
    _log("validating and writing translation request record")
    validate_translation_request_record(translation_request["request_record"])
    write_json(inputs_dir / "translation-request.json", translation_request["request_record"])
    _log(
        "calling translation provider "
        f"{translation_request['provider_name']}/{translation_request['model']} "
        f"(max_tokens={translation_request['max_tokens']}, timeout_seconds={translation_request['timeout_seconds']})"
    )
    translation_stream_logger = _ResponseStreamLogger("translation")
    translation_response = create_chat_completion(
        provider_name=translation_request["provider_name"],
        model=translation_request["model"],
        messages=translation_request["messages"],
        temperature=translation_request["temperature"],
        max_tokens=translation_request["max_tokens"],
        timeout_seconds=translation_request["timeout_seconds"],
        stream=True,
        on_stream_delta=translation_stream_logger,
    )
    translation_stream_logger.finish()
    _log("received translation response; writing translation artifacts")
    write_json(outputs_dir / "translation-response.json", translation_response)
    translation_text = extract_message_text(translation_response).strip() + "\n"
    if not translation_text.strip():
        raise RuntimeError(
            "Translation provider returned empty output. "
            f"Aborting run before review for {translation_request['provider_name']}/{translation_request['model']}."
        )
    translation_output_path.write_text(translation_text, encoding="utf-8")

    findings_path = review_dir / "findings.md"
    _log("building review request")
    review_request = build_review_request(
        run_id=run_id,
        run_manifest=run_manifest,
        slice_manifest=slice_manifest,
        prompt_bundle_metadata=prompt_bundle_metadata,
        model_profile=model_profile,
        excerpt_text=excerpt_text,
        translation_text=translation_text,
        glossary_path=glossary_path,
        style_guide_path=style_guide_path,
        rubric_path=rubric_path,
        prompt_bundle_path=prompt_bundle_path,
    )
    _log("validating and writing review request record")
    validate_review_request_record(review_request["request_record"])
    write_json(review_dir / "review-request.json", review_request["request_record"])
    _log(
        "calling review provider "
        f"{review_request['provider_name']}/{review_request['model']} "
        f"(max_tokens={review_request['max_tokens']}, timeout_seconds={review_request['timeout_seconds']})"
    )
    review_stream_logger = _ResponseStreamLogger("review")
    review_response = create_chat_completion(
        provider_name=review_request["provider_name"],
        model=review_request["model"],
        messages=review_request["messages"],
        temperature=review_request["temperature"],
        max_tokens=review_request["max_tokens"],
        timeout_seconds=review_request["timeout_seconds"],
        stream=True,
        on_stream_delta=review_stream_logger,
    )
    review_stream_logger.finish()
    _log("received review response; validating structured review payload")
    write_json(review_dir / "review-response.json", review_response)
    review_text = extract_message_text(review_response)
    try:
        review_payload = extract_json_object(review_text)
    except RuntimeError:
        _log("review output was not valid JSON; requesting one-shot JSON repair")
        review_payload = repair_review_payload(
            review_request=review_request,
            malformed_review_text=review_text,
        )
        write_json(review_dir / "review-repaired.json", review_payload)
    review_payload = normalize_review_payload(review_payload)
    validate_review_payload(review_payload)
    write_json(review_dir / "review-structured.json", review_payload)
    findings_path.write_text(render_findings_markdown(review_payload), encoding="utf-8")

    _log("computing evaluation checks and summary")
    glossary_terms = glossary_doc["terms"]
    preserved_spans = extract_preserved_spans(excerpt_text)
    missing_spans = [span for span in preserved_spans if span not in translation_text]

    glossary_hits = []
    glossary_misses = []
    for term in glossary_terms:
        source_term = term.get("source")
        target_term = term.get("target")
        if not source_term or not target_term or source_term not in excerpt_text:
            continue
        if target_term in translation_text:
            glossary_hits.append(f"{source_term} -> {target_term}")
        else:
            glossary_misses.append(f"{source_term} -> {target_term}")

    untranslated_dutch_scripture_references = find_untranslated_dutch_scripture_references(translation_text)

    checks = [
        {
            "id": "source-identity",
            "status": "fail" if source_drift else "pass",
            "details": (
                f"Expected source SHA {expected_source_sha}; current cleaned source SHA {current_source_sha}."
            ),
        },
        {
            "id": "rubric-present",
            "status": "pass" if rubric_path.exists() else "incomplete",
            "details": f"Rubric path: {relative_to_repo(rubric_path)}",
        },
        {
            "id": "translation-output",
            "status": "pass" if translation_text.strip() else "incomplete",
            "details": f"Translation output path: {relative_to_repo(translation_output_path)}",
        },
        {
            "id": "preserved-language-integrity",
            "status": "pass" if not missing_spans else "fail",
            "details": (
                "All Greek/Hebrew spans found in translation output."
                if not missing_spans
                else "Missing preserved spans: " + ", ".join(missing_spans)
            ),
        },
        {
            "id": "glossary-adherence",
            "status": "pass" if not glossary_misses else "fail",
            "details": (
                "All required glossary targets were found in the translation output."
                if not glossary_misses
                else "Missing glossary targets: " + "; ".join(glossary_misses)
            ),
        },
        {
            "id": "scripture-reference-normalization",
            "status": "fail" if untranslated_dutch_scripture_references else "pass",
            "details": (
                "Dutch Scripture references were normalized to standard English forms."
                if not untranslated_dutch_scripture_references
                else "Untranslated Dutch Scripture reference forms found in translation output: "
                + ", ".join(untranslated_dutch_scripture_references)
            ),
        },
    ]

    review_checks = review_payload.get("checks", {})
    for check_id, payload in review_checks.items():
        if check_id in {"preserved-language-integrity", "glossary-adherence"}:
            continue
        checks.append(
            {
                "id": check_id,
                "status": payload.get("status", "incomplete") if isinstance(payload, dict) else "incomplete",
                "details": payload.get("details", "") if isinstance(payload, dict) else "",
            }
        )

    summary = {
        "pass": sum(1 for check in checks if check["status"] == "pass"),
        "fail": sum(1 for check in checks if check["status"] == "fail"),
        "incomplete": sum(1 for check in checks if check["status"] == "incomplete"),
    }

    report = {
        "schema_version": "1.0",
        "run_id": run_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "slice_id": run_manifest["slice_id"],
        "prompt_bundle_id": run_manifest["prompt_bundle_id"],
        "model_profile_id": run_manifest["model_profile_id"],
        "checks": checks,
        "summary": summary,
        "artifacts": {
            "translation_request_path": relative_to_repo(inputs_dir / "translation-request.json"),
            "translation_response_path": relative_to_repo(outputs_dir / "translation-response.json"),
            "translation_output_path": relative_to_repo(translation_output_path),
            "review_request_path": relative_to_repo(review_dir / "review-request.json"),
            "review_response_path": relative_to_repo(review_dir / "review-response.json"),
            "review_structured_path": relative_to_repo(review_dir / "review-structured.json"),
            "findings_path": relative_to_repo(findings_path),
        },
        "qualitative_findings": {
            "path": relative_to_repo(findings_path),
            "separate_from_checks": True,
        },
        "review_summary": review_payload.get("summary", ""),
        "glossary_hits": glossary_hits,
        "glossary_misses": glossary_misses,
    }
    _log("validating and writing final evaluation report")
    validate_evaluation_report(report)
    write_json(reports_dir / "evaluation.json", report)
    write_markdown_report(reports_dir / "evaluation.md", report)
    _log("exporting commit-safe eval bundle")
    eval_dir = export_commit_safe_eval_bundle(
        eval_root=args.eval_root,
        run_manifest_path=run_manifest_path,
        slice_manifest_path=slice_manifest_path,
        prompt_bundle_path=prompt_bundle_path,
        model_profile_path=model_profile_path,
        glossary_path=glossary_path,
        style_guide_path=style_guide_path,
        rubric_path=rubric_path,
        translation_request=translation_request,
        translation_response=translation_response,
        translation_text=translation_text,
        review_request=review_request,
        review_response=review_response,
        review_payload=review_payload,
        findings_markdown=findings_path.read_text(encoding="utf-8"),
        evaluation_report=report,
    )

    _log(f"run complete: {relative_to_repo(run_dir)}")
    print(f"Materialized run: {relative_to_repo(run_dir)}")
    print(f"Commit-safe eval bundle: {relative_to_repo(eval_dir)}")
    print(f"Evaluation report: {relative_to_repo(reports_dir / 'evaluation.json')}")
    return 0


def build_translation_request(
    *,
    run_id: str,
    run_manifest: dict[str, object],
    slice_manifest: dict[str, object],
    prompt_bundle_metadata: dict[str, object],
    model_profile: dict[str, object],
    excerpt_text: str,
    glossary_path: Path,
    style_guide_path: Path,
    prompt_bundle_path: Path,
) -> dict[str, object]:
    stages = model_profile.get("stages", {})
    translation_stage = stages.get("translation", {})
    template = (prompt_bundle_path / "translation-user-template.txt").read_text(encoding="utf-8")
    user_prompt = render_template(
        template,
        {
            "run_id": run_id,
            "slice_id": str(run_manifest["slice_id"]),
            "slice_title": str(slice_manifest["title"]),
            "selection_rationale": str(slice_manifest["rationale"]),
            "source_excerpt": excerpt_text.strip(),
            "glossary_terms": glossary_path.read_text(encoding="utf-8").strip(),
            "style_guide": style_guide_path.read_text(encoding="utf-8").strip(),
        },
    )
    messages = [
        {
            "role": "system",
            "content": (prompt_bundle_path / "translation-system.txt").read_text(encoding="utf-8").strip(),
        },
        {"role": "user", "content": user_prompt},
    ]
    return {
        "provider_name": str(translation_stage["provider"]),
        "model": str(translation_stage["model"]),
        "temperature": float(translation_stage.get("temperature", 0.2)),
        "max_tokens": int(translation_stage["max_tokens"]) if "max_tokens" in translation_stage else None,
        "timeout_seconds": (
            int(translation_stage["timeout_seconds"]) if "timeout_seconds" in translation_stage else None
        ),
        "messages": messages,
        "request_record": {
            "run_id": run_id,
            "slice_id": run_manifest["slice_id"],
            "prompt_bundle_id": run_manifest["prompt_bundle_id"],
            "model_profile_id": run_manifest["model_profile_id"],
            "stage": "translation",
            "provider": translation_stage["provider"],
            "model": translation_stage["model"],
            "temperature": translation_stage.get("temperature", 0.2),
            "messages": messages,
            "prompt_files": prompt_bundle_metadata.get("prompt_files"),
        },
    }


def find_untranslated_dutch_scripture_references(text: str, *, limit: int = 8) -> list[str]:
    matches: list[str] = []
    seen: set[str] = set()
    for pattern in DUTCH_SCRIPTURE_REFERENCE_PATTERNS:
        for match in pattern.finditer(text):
            snippet = match.group(0).strip()
            if snippet in seen:
                continue
            seen.add(snippet)
            matches.append(snippet)
            if len(matches) >= limit:
                return matches
    return matches


def build_review_request(
    *,
    run_id: str,
    run_manifest: dict[str, object],
    slice_manifest: dict[str, object],
    prompt_bundle_metadata: dict[str, object],
    model_profile: dict[str, object],
    excerpt_text: str,
    translation_text: str,
    glossary_path: Path,
    style_guide_path: Path,
    rubric_path: Path,
    prompt_bundle_path: Path,
) -> dict[str, object]:
    stages = model_profile.get("stages", {})
    review_stage = stages.get("review", {})
    template = (prompt_bundle_path / "review-user-template.txt").read_text(encoding="utf-8")
    user_prompt = render_template(
        template,
        {
            "run_id": run_id,
            "slice_id": str(run_manifest["slice_id"]),
            "slice_title": str(slice_manifest["title"]),
            "source_excerpt": excerpt_text.strip(),
            "translation_output": translation_text.strip(),
            "glossary_terms": glossary_path.read_text(encoding="utf-8").strip(),
            "style_guide": style_guide_path.read_text(encoding="utf-8").strip(),
            "rubric": rubric_path.read_text(encoding="utf-8").strip(),
        },
    )
    messages = [
        {
            "role": "system",
            "content": (prompt_bundle_path / "review-system.txt").read_text(encoding="utf-8").strip(),
        },
        {"role": "user", "content": user_prompt},
    ]
    return {
        "provider_name": str(review_stage["provider"]),
        "model": str(review_stage["model"]),
        "temperature": float(review_stage.get("temperature", 0.1)),
        "max_tokens": int(review_stage["max_tokens"]) if "max_tokens" in review_stage else None,
        "timeout_seconds": int(review_stage["timeout_seconds"]) if "timeout_seconds" in review_stage else None,
        "messages": messages,
        "request_record": {
            "run_id": run_id,
            "slice_id": run_manifest["slice_id"],
            "prompt_bundle_id": run_manifest["prompt_bundle_id"],
            "model_profile_id": run_manifest["model_profile_id"],
            "stage": "review",
            "provider": review_stage["provider"],
            "model": review_stage["model"],
            "temperature": review_stage.get("temperature", 0.1),
            "messages": messages,
            "prompt_files": prompt_bundle_metadata.get("prompt_files"),
        },
    }


def write_markdown_report(path: Path, report: dict[str, object]) -> None:
    lines = [
        f"# Calibration Report: {report['run_id']}",
        "",
        "## Pass-Fail Checks",
        "",
    ]
    for check in report["checks"]:
        lines.append(f"- `{check['id']}`: **{check['status']}** — {check['details']}")
    lines.extend(
        [
            "",
            "## Qualitative Findings",
            "",
            f"See `{report['qualitative_findings']['path']}` for reviewer commentary kept separate from the checks.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def export_commit_safe_eval_bundle(
    *,
    eval_root: Path,
    run_manifest_path: Path,
    slice_manifest_path: Path,
    prompt_bundle_path: Path,
    model_profile_path: Path,
    glossary_path: Path,
    style_guide_path: Path,
    rubric_path: Path,
    translation_request: dict[str, object],
    translation_response: dict[str, object],
    translation_text: str,
    review_request: dict[str, object],
    review_response: dict[str, object],
    review_payload: dict[str, object],
    findings_markdown: str,
    evaluation_report: dict[str, object],
) -> Path:
    run_id = str(evaluation_report["run_id"])
    eval_dir = eval_root / run_id
    eval_dir.mkdir(parents=True, exist_ok=True)

    translation_output_path = eval_dir / "translation.md"
    review_structured_path = eval_dir / "review-structured.json"
    findings_path = eval_dir / "findings.md"
    evaluation_json_path = eval_dir / "evaluation.json"
    evaluation_markdown_path = eval_dir / "evaluation.md"
    eval_record_path = eval_dir / "eval-record.json"

    translation_output_path.write_text(translation_text, encoding="utf-8")
    write_json(review_structured_path, review_payload)
    findings_path.write_text(findings_markdown, encoding="utf-8")

    safe_report = dict(evaluation_report)
    safe_report["artifacts"] = {
        "translation_output_path": relative_to_repo(translation_output_path),
        "review_structured_path": relative_to_repo(review_structured_path),
        "findings_path": relative_to_repo(findings_path),
        "evaluation_markdown_path": relative_to_repo(evaluation_markdown_path),
        "eval_record_path": relative_to_repo(eval_record_path),
    }
    safe_report["qualitative_findings"] = {
        "path": relative_to_repo(findings_path),
        "separate_from_checks": True,
    }
    validate_evaluation_report(safe_report)
    write_json(evaluation_json_path, safe_report)
    write_markdown_report(evaluation_markdown_path, safe_report)

    eval_record = {
        "schema_version": "1.0",
        "sanitization_version": "1.0",
        "run_id": run_id,
        "slice_id": evaluation_report["slice_id"],
        "prompt_bundle_id": evaluation_report["prompt_bundle_id"],
        "model_profile_id": evaluation_report["model_profile_id"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_refs": {
            "run_manifest_path": relative_to_repo(run_manifest_path),
            "slice_manifest_path": relative_to_repo(slice_manifest_path),
            "prompt_bundle_path": relative_to_repo(prompt_bundle_path),
            "model_profile_path": relative_to_repo(model_profile_path),
            "glossary_path": relative_to_repo(glossary_path),
            "style_guide_path": relative_to_repo(style_guide_path),
            "rubric_path": relative_to_repo(rubric_path),
        },
        "stages": {
            "translation": build_commit_safe_stage_record(
                request=translation_request,
                response=translation_response,
            ),
            "review": build_commit_safe_stage_record(
                request=review_request,
                response=review_response,
            ),
        },
        "artifacts": {
            "translation_output_path": relative_to_repo(translation_output_path),
            "review_structured_path": relative_to_repo(review_structured_path),
            "findings_path": relative_to_repo(findings_path),
            "evaluation_report_path": relative_to_repo(evaluation_json_path),
            "evaluation_markdown_path": relative_to_repo(evaluation_markdown_path),
        },
        "hashes": {
            "run_manifest_sha256": sha256_text(run_manifest_path.read_text(encoding="utf-8")),
            "slice_manifest_sha256": sha256_text(slice_manifest_path.read_text(encoding="utf-8")),
            "prompt_bundle_metadata_sha256": sha256_text((prompt_bundle_path / "metadata.json").read_text(encoding="utf-8")),
            "model_profile_sha256": sha256_text(model_profile_path.read_text(encoding="utf-8")),
            "glossary_sha256": sha256_text(glossary_path.read_text(encoding="utf-8")),
            "style_guide_sha256": sha256_text(style_guide_path.read_text(encoding="utf-8")),
            "rubric_sha256": sha256_text(rubric_path.read_text(encoding="utf-8")),
            "translation_output_sha256": sha256_text(translation_output_path.read_text(encoding="utf-8")),
            "review_structured_sha256": sha256_text(review_structured_path.read_text(encoding="utf-8")),
            "findings_sha256": sha256_text(findings_path.read_text(encoding="utf-8")),
            "evaluation_report_sha256": sha256_text(evaluation_json_path.read_text(encoding="utf-8")),
            "evaluation_markdown_sha256": sha256_text(evaluation_markdown_path.read_text(encoding="utf-8")),
        },
    }
    validate_commit_safe_eval_record(eval_record, validate_paths=True)
    write_json(eval_record_path, eval_record)
    return eval_dir


def build_commit_safe_stage_record(
    *,
    request: dict[str, object],
    response: dict[str, object],
) -> dict[str, object]:
    stage_record = {
        "provider": request["provider_name"],
        "model": request["model"],
        "temperature": request["temperature"],
        "prompt_files": dict(request["request_record"].get("prompt_files", {})),
    }
    if request.get("max_tokens") is not None:
        stage_record["max_tokens"] = request["max_tokens"]
    if request.get("timeout_seconds") is not None:
        stage_record["timeout_seconds"] = request["timeout_seconds"]

    usage = response.get("usage")
    if isinstance(usage, dict):
        normalized_usage: dict[str, int] = {}
        for key in ["prompt_tokens", "completion_tokens", "total_tokens"]:
            value = usage.get(key)
            if isinstance(value, int) and value >= 0:
                normalized_usage[key] = value
        completion_details = usage.get("completion_tokens_details")
        if isinstance(completion_details, dict):
            reasoning_tokens = completion_details.get("reasoning_tokens")
            if isinstance(reasoning_tokens, int) and reasoning_tokens >= 0:
                normalized_usage["reasoning_tokens"] = reasoning_tokens
        prompt_details = usage.get("prompt_tokens_details")
        if isinstance(prompt_details, dict):
            cached_tokens = prompt_details.get("cached_tokens")
            if isinstance(cached_tokens, int) and cached_tokens >= 0:
                normalized_usage["cached_tokens"] = cached_tokens
        if normalized_usage:
            stage_record["usage"] = normalized_usage
    return stage_record


def render_findings_markdown(review_payload: dict[str, object]) -> str:
    lines = ["# Reviewer Findings", ""]
    summary = review_payload.get("summary")
    if isinstance(summary, str) and summary.strip():
        lines.extend(["## Summary", "", summary.strip(), ""])
    findings = review_payload.get("findings", [])
    if isinstance(findings, list) and findings:
        lines.extend(["## Findings", ""])
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            severity = finding.get("severity", "unspecified")
            category = finding.get("category", "general")
            detail = finding.get("detail", "")
            lines.append(f"- [{severity}] {category}: {detail}")
        lines.append("")
    recommendations = review_payload.get("recommended_follow_up", [])
    if isinstance(recommendations, list) and recommendations:
        lines.extend(["## Recommended Follow-Up", ""])
        for item in recommendations:
            lines.append(f"- {item}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def normalize_review_payload(review_payload: dict[str, object]) -> dict[str, object]:
    findings = review_payload.get("findings")
    if isinstance(findings, list):
        for item in findings:
            if not isinstance(item, dict):
                continue
            severity = item.get("severity")
            if isinstance(severity, str) and severity.strip().lower() == "info":
                item["severity"] = "low"
    return review_payload


def repair_review_payload(
    *,
    review_request: dict[str, object],
    malformed_review_text: str,
) -> dict[str, object]:
    repair_response = create_chat_completion(
        provider_name=review_request["provider_name"],
        model=review_request["model"],
        messages=[
            {
                "role": "system",
                "content": (
                    "You repair malformed review outputs. "
                    "Return exactly one valid JSON object matching the required review schema. "
                    "Do not include markdown, code fences, or commentary. "
                    "Use severity values high, medium, or low only."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Reformat the following review output into valid JSON with keys "
                    "summary, checks, findings, and recommended_follow_up. "
                    "If a finding severity is 'info', convert it to 'low'.\n\n"
                    f"{malformed_review_text}"
                ),
            },
        ],
        temperature=0.0,
        max_tokens=2000,
        timeout_seconds=120,
        stream=False,
    )
    return extract_json_object(extract_message_text(repair_response))


def _copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(source.read_bytes())


def _log(message: str) -> None:
    print(f"[run_calibration] {message}", file=sys.stderr, flush=True)


class _ResponseStreamLogger:
    def __init__(self, stage_name: str) -> None:
        self.stage_name = stage_name
        self.current_field: str | None = None
        self.started = False

    def __call__(self, field_name: str, text: str) -> None:
        if self.current_field != field_name:
            if self.started:
                print("", file=sys.stderr, flush=True)
            _log(f"{self.stage_name} stream: {field_name}")
            self.current_field = field_name
            self.started = True
        print(text, file=sys.stderr, end="", flush=True)

    def finish(self) -> None:
        if self.started:
            print("", file=sys.stderr, flush=True)
        _log(f"{self.stage_name} stream complete")


def smoke_test_provider_connections(model_profile: dict[str, object]) -> None:
    stages = model_profile.get("stages", {})
    _log("starting provider smoke tests")
    for stage_name in ["translation", "review"]:
        stage = stages.get(stage_name)
        if not isinstance(stage, dict):
            raise RuntimeError(f"Cannot smoke test stage '{stage_name}': missing stage configuration")

        provider_name = str(stage["provider"])
        model = str(stage["model"])
        temperature = float(stage.get("temperature", 1.0))
        timeout_seconds = min(int(stage.get("timeout_seconds", 300)), 30)

        try:
            _log(
                f"smoke test request: stage={stage_name}, provider={provider_name}, "
                f"model={model}, max_tokens=1, timeout_seconds={timeout_seconds}"
            )
            create_chat_completion(
                provider_name=provider_name,
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a connectivity probe. Reply with OK.",
                    },
                    {
                        "role": "user",
                        "content": f"Smoke test for the {stage_name} stage. Reply with OK.",
                    },
                ],
                temperature=temperature,
                max_tokens=1,
                timeout_seconds=timeout_seconds,
            )
        except RuntimeError as exc:
            raise RuntimeError(
                f"Provider smoke test failed for stage '{stage_name}' "
                f"({provider_name}/{model}): {exc}"
            ) from exc

        _log(f"smoke test success: stage={stage_name}, provider={provider_name}, model={model}")
        print(f"Provider smoke test passed: {stage_name} ({provider_name}/{model})")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValidationError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
