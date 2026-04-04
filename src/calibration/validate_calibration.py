#!/usr/bin/env python3
"""Offline validation entrypoint for calibration inputs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.validation import (  # noqa: E402
    REPO_ROOT,
    ValidationError,
    display_path,
    load_and_validate_glossary,
    load_and_validate_json,
    load_and_validate_rubric,
    validate_model_profile,
    validate_prompt_bundle_metadata,
    validate_run_manifest_bundle,
    validate_slice_manifest,
    validate_source_metadata,
    resolve_repo_path,
)


DEFAULT_RUN_MANIFEST = Path("config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate source metadata and calibration configuration.")
    parser.add_argument("--run-manifest", type=Path, help="Validate a specific run manifest and its referenced inputs.")
    parser.add_argument("--slice-manifest", type=Path, help="Validate a specific slice manifest.")
    parser.add_argument("--all-calibration", action="store_true", help="Validate all calibration manifests, profiles, bundles, glossaries, and rubrics.")
    parser.add_argument("--all-source-metadata", action="store_true", help="Validate all source metadata JSON files.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    targets = sum(
        1 for value in [args.run_manifest, args.slice_manifest, args.all_calibration, args.all_source_metadata] if value
    )
    if targets > 1:
        raise RuntimeError("choose only one validation target at a time")

    if args.all_source_metadata:
        count = validate_all_source_metadata()
        print(f"validated {count} source metadata files")
        return 0
    if args.all_calibration:
        count = validate_all_calibration()
        print(f"validated {count} calibration documents")
        return 0
    if args.slice_manifest:
        manifest_path = resolve_path(args.slice_manifest)
        load_and_validate_json(
            manifest_path,
            validate_slice_manifest,
            repo_root=REPO_ROOT,
            validate_paths=True,
        )
        print(f"validated slice manifest: {display_path(manifest_path, repo_root=REPO_ROOT)}")
        return 0

    run_manifest_path = resolve_path(args.run_manifest or DEFAULT_RUN_MANIFEST)
    validate_run_manifest_bundle(run_manifest_path, repo_root=REPO_ROOT)
    print(f"validated run manifest bundle: {display_path(run_manifest_path, repo_root=REPO_ROOT)}")
    return 0


def validate_all_source_metadata() -> int:
    count = 0
    for path in sorted((REPO_ROOT / "data/metadata").glob("*.json")):
        load_and_validate_json(path, validate_source_metadata, repo_root=REPO_ROOT, validate_paths=True)
        count += 1
    return count


def validate_all_calibration() -> int:
    count = 0
    for bundle_metadata_path in sorted((REPO_ROOT / "config/calibration/prompt-bundles").glob("*/metadata.json")):
        load_and_validate_json(
            bundle_metadata_path,
            validate_prompt_bundle_metadata,
            repo_root=REPO_ROOT,
            bundle_dir=bundle_metadata_path.parent,
            validate_paths=True,
        )
        count += 1
    for model_profile_path in sorted((REPO_ROOT / "config/calibration/model-profiles").glob("*.json")):
        load_and_validate_json(model_profile_path, validate_model_profile, repo_root=REPO_ROOT)
        count += 1
    for slice_manifest_path in sorted((REPO_ROOT / "data/calibration/slices").glob("*/manifest.json")):
        slice_manifest = load_and_validate_json(
            slice_manifest_path,
            validate_slice_manifest,
            repo_root=REPO_ROOT,
            validate_paths=True,
        )
        expected_inputs = slice_manifest["expected_inputs"]
        load_and_validate_glossary(
            resolve_repo_path(str(expected_inputs["glossary_path"]), repo_root=REPO_ROOT),
            expected_slice_id=str(slice_manifest["slice_id"]),
        )
        load_and_validate_rubric(
            resolve_repo_path(str(expected_inputs["rubric_path"]), repo_root=REPO_ROOT),
            expected_slice_id=str(slice_manifest["slice_id"]),
        )
        count += 1
    for run_manifest_path in sorted((REPO_ROOT / "config/calibration/run-manifests").glob("*.json")):
        validate_run_manifest_bundle(run_manifest_path, repo_root=REPO_ROOT)
        count += 1
    return count


def resolve_path(path: Path) -> Path:
    if path.is_absolute():
        return path.resolve()
    return (REPO_ROOT / path).resolve()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
