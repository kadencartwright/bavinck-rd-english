#!/usr/bin/env python3
"""Materialize a calibration run and generate evaluation reports."""

from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.common import (
    extract_preserved_spans,
    load_json,
    parse_glossary_terms,
    relative_to_repo,
    sha256_text,
    write_json,
)


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
    return parser.parse_args()


def main() -> int:
    args = parse_args()
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

    translation_output_path = outputs_dir / "translation.md"
    seed_translation_path = run_manifest.get("seed_translation_path")
    if seed_translation_path:
        _copy(Path(str(seed_translation_path)), translation_output_path)
    else:
        translation_output_path.write_text(
            "# Pending translation\n\nNo translation artifact was supplied for this run.\n",
            encoding="utf-8",
        )

    findings_path = review_dir / "findings.md"
    seed_findings_path = run_manifest.get("seed_findings_path")
    if seed_findings_path:
        _copy(Path(str(seed_findings_path)), findings_path)
    else:
        findings_path.write_text("# Pending findings\n\nNo reviewer findings were supplied.\n", encoding="utf-8")

    translation_text = translation_output_path.read_text(encoding="utf-8")
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

    manual_checks = run_manifest.get("manual_checks", {})
    for check_id, payload in manual_checks.items():
        checks.append(
            {
                "id": check_id,
                "status": payload.get("status", "incomplete"),
                "details": payload.get("details", ""),
            }
        )

    summary = {
        "pass": sum(1 for check in checks if check["status"] == "pass"),
        "fail": sum(1 for check in checks if check["status"] == "fail"),
        "incomplete": sum(1 for check in checks if check["status"] == "incomplete"),
    }

    translation_request = {
        "run_id": run_id,
        "slice_id": run_manifest["slice_id"],
        "prompt_bundle_id": run_manifest["prompt_bundle_id"],
        "model_profile_id": run_manifest["model_profile_id"],
        "excerpt_path": "inputs/excerpt.txt",
        "glossary_path": "inputs/glossary.yaml",
        "style_guide_path": "inputs/style-guide.md",
        "rubric_path": "inputs/rubric.yaml",
        "prompt_files": prompt_bundle_metadata.get("prompt_files"),
        "model_stages": model_profile.get("stages"),
    }
    write_json(inputs_dir / "translation-request.json", translation_request)

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
            "translation_output_path": relative_to_repo(translation_output_path),
            "findings_path": relative_to_repo(findings_path),
        },
        "qualitative_findings": {
            "path": relative_to_repo(findings_path),
            "separate_from_checks": True,
        },
        "glossary_hits": glossary_hits,
        "glossary_misses": glossary_misses,
    }
    write_json(reports_dir / "evaluation.json", report)
    write_markdown_report(reports_dir / "evaluation.md", report)

    print(f"Materialized run: {relative_to_repo(run_dir)}")
    print(f"Evaluation report: {relative_to_repo(reports_dir / 'evaluation.json')}")
    return 0


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


def _copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


if __name__ == "__main__":
    raise SystemExit(main())
