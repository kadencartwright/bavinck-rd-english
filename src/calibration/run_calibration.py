#!/usr/bin/env python3
"""Materialize a calibration run and generate evaluation reports."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.common import (
    extract_json_object,
    extract_preserved_spans,
    load_json,
    load_dotenv,
    parse_glossary_terms,
    relative_to_repo,
    render_template,
    sha256_text,
    write_json,
)
from calibration.openai_compat import create_chat_completion, extract_message_text


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
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_dotenv(args.dotenv_path)
    run_manifest = load_json(args.run_manifest)
    slice_manifest = load_json(Path(str(run_manifest["slice_manifest_path"])))
    prompt_bundle_metadata = load_json(Path(str(run_manifest["prompt_bundle_path"])) / "metadata.json")
    model_profile = load_json(Path(str(run_manifest["model_profile_path"])))

    run_id = str(run_manifest["run_id"])
    run_dir = args.output_root / run_id
    inputs_dir = run_dir / "inputs"
    outputs_dir = run_dir / "outputs"
    review_dir = run_dir / "review"
    reports_dir = run_dir / "reports"
    for directory in [inputs_dir, outputs_dir, review_dir, reports_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    source_text_path = Path(str(slice_manifest["source"]["text_path"]))
    source_metadata_path = Path(str(slice_manifest["source"]["metadata_path"]))
    slice_excerpt_path = Path(str(slice_manifest["excerpt"]["path"]))
    glossary_path = Path(str(run_manifest["glossary_path"]))
    style_guide_path = Path(str(run_manifest["style_guide_path"]))
    rubric_path = Path(str(run_manifest["rubric_path"]))
    prompt_bundle_path = Path(str(run_manifest["prompt_bundle_path"]))
    model_profile_path = Path(str(run_manifest["model_profile_path"]))

    current_source_text = source_text_path.read_text(encoding="utf-8")
    current_source_sha = sha256_text(current_source_text)
    expected_source_sha = str(slice_manifest["source_identity"]["clean_sha256"])
    source_drift = current_source_sha != expected_source_sha
    if source_drift and not args.allow_source_drift:
        raise RuntimeError(
            "Source drift detected between the current cleaned source and the stored slice manifest. "
            "Rerun with --allow-source-drift only if you are intentionally auditing drift."
        )

    _copy(source_text_path, inputs_dir / "source.txt")
    _copy(source_metadata_path, inputs_dir / "source-metadata.json")
    _copy(slice_excerpt_path, inputs_dir / "excerpt.txt")
    _copy(glossary_path, inputs_dir / "glossary.yaml")
    _copy(style_guide_path, inputs_dir / "style-guide.md")
    _copy(rubric_path, inputs_dir / "rubric.yaml")
    _copy(args.run_manifest, inputs_dir / "run-manifest.json")
    _copy(Path(str(run_manifest["slice_manifest_path"])), inputs_dir / "slice-manifest.json")
    _copy(model_profile_path, inputs_dir / "model-profile.json")
    _copy(prompt_bundle_path / "metadata.json", inputs_dir / "prompt-bundle-metadata.json")
    _copy(prompt_bundle_path / "translation-system.txt", inputs_dir / "translation-system.txt")
    _copy(prompt_bundle_path / "review-system.txt", inputs_dir / "review-system.txt")
    _copy(prompt_bundle_path / "translation-user-template.txt", inputs_dir / "translation-user-template.txt")
    _copy(prompt_bundle_path / "review-user-template.txt", inputs_dir / "review-user-template.txt")

    translation_output_path = outputs_dir / "translation.md"
    translation_request = build_translation_request(
        run_id=run_id,
        run_manifest=run_manifest,
        slice_manifest=slice_manifest,
        prompt_bundle_metadata=prompt_bundle_metadata,
        model_profile=model_profile,
        excerpt_text=slice_excerpt_path.read_text(encoding="utf-8"),
        glossary_path=glossary_path,
        style_guide_path=style_guide_path,
        prompt_bundle_path=prompt_bundle_path,
    )
    write_json(inputs_dir / "translation-request.json", translation_request["request_record"])
    translation_response = create_chat_completion(
        provider_name=translation_request["provider_name"],
        model=translation_request["model"],
        messages=translation_request["messages"],
        temperature=translation_request["temperature"],
        max_tokens=translation_request["max_tokens"],
        timeout_seconds=translation_request["timeout_seconds"],
    )
    write_json(outputs_dir / "translation-response.json", translation_response)
    translation_text = extract_message_text(translation_response).strip() + "\n"
    translation_output_path.write_text(translation_text, encoding="utf-8")

    findings_path = review_dir / "findings.md"
    review_request = build_review_request(
        run_id=run_id,
        run_manifest=run_manifest,
        slice_manifest=slice_manifest,
        prompt_bundle_metadata=prompt_bundle_metadata,
        model_profile=model_profile,
        excerpt_text=slice_excerpt_path.read_text(encoding="utf-8"),
        translation_text=translation_text,
        glossary_path=glossary_path,
        style_guide_path=style_guide_path,
        rubric_path=rubric_path,
        prompt_bundle_path=prompt_bundle_path,
    )
    write_json(review_dir / "review-request.json", review_request["request_record"])
    review_response = create_chat_completion(
        provider_name=review_request["provider_name"],
        model=review_request["model"],
        messages=review_request["messages"],
        temperature=review_request["temperature"],
        max_tokens=review_request["max_tokens"],
        timeout_seconds=review_request["timeout_seconds"],
    )
    write_json(review_dir / "review-response.json", review_response)
    review_payload = extract_json_object(extract_message_text(review_response))
    write_json(review_dir / "review-structured.json", review_payload)
    findings_path.write_text(render_findings_markdown(review_payload), encoding="utf-8")

    excerpt_text = slice_excerpt_path.read_text(encoding="utf-8")
    glossary_terms = parse_glossary_terms(glossary_path)
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
    write_json(reports_dir / "evaluation.json", report)
    write_markdown_report(reports_dir / "evaluation.md", report)

    print(f"Materialized run: {relative_to_repo(run_dir)}")
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
        "max_tokens": int(translation_stage.get("max_tokens", 6000)),
        "timeout_seconds": int(translation_stage.get("timeout_seconds", 300)),
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
            "max_tokens": translation_stage.get("max_tokens", 6000),
            "messages": messages,
            "prompt_files": prompt_bundle_metadata.get("prompt_files"),
        },
    }


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
        "max_tokens": int(review_stage.get("max_tokens", 3000)),
        "timeout_seconds": int(review_stage.get("timeout_seconds", 300)),
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
            "max_tokens": review_stage.get("max_tokens", 3000),
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


def _copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(source.read_bytes())


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
