#!/usr/bin/env python3
"""Build a calibration slice fixture from a cleaned source text."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from calibration.common import (
    read_excerpt,
    relative_to_repo,
    select_slice_range,
    sha256_text,
    write_json,
)
from calibration.validation import (
    ValidationError,
    load_and_validate_json,
    validate_slice_manifest,
    validate_source_metadata,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Select a section-based calibration slice and write stable fixture artifacts."
    )
    parser.add_argument("--slice-id", required=True, help="Stable identifier for the calibration slice.")
    parser.add_argument(
        "--source-text",
        type=Path,
        required=True,
        help="Path to the cleaned source text file.",
    )
    parser.add_argument(
        "--source-metadata",
        type=Path,
        required=True,
        help="Path to the JSON metadata produced during ingestion.",
    )
    parser.add_argument("--section-number", type=int, required=True, help="Section number to select.")
    parser.add_argument("--start-subsection", type=int, help="First subsection marker to include.")
    parser.add_argument("--end-subsection", type=int, help="Last subsection marker to include.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory to write the fixture excerpt and manifest into.",
    )
    parser.add_argument(
        "--title",
        required=True,
        help="Human-readable title for the selected slice.",
    )
    parser.add_argument(
        "--rationale",
        required=True,
        help="Why this slice is representative for calibration.",
    )
    parser.add_argument(
        "--stressor",
        dest="stressors",
        action="append",
        default=[],
        help="Translation stressor exercised by the slice. Repeat for multiple values.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_text = args.source_text.read_text(encoding="utf-8")
    lines = source_text.splitlines()
    metadata = load_and_validate_json(
        args.source_metadata,
        validate_source_metadata,
        validate_paths=True,
    )

    selection = select_slice_range(
        lines,
        section_number=args.section_number,
        start_subsection=args.start_subsection,
        end_subsection=args.end_subsection,
    )
    excerpt = read_excerpt(lines, int(selection["start_line"]), int(selection["end_line"]))

    args.output_dir.mkdir(parents=True, exist_ok=True)
    excerpt_path = args.output_dir / "excerpt.txt"
    manifest_path = args.output_dir / "manifest.json"
    excerpt_path.write_text(excerpt, encoding="utf-8")

    manifest = {
        "schema_version": "1.0",
        "slice_id": args.slice_id,
        "title": args.title,
        "rationale": args.rationale,
        "stressors": args.stressors,
        "source": {
            "text_path": relative_to_repo(args.source_text),
            "metadata_path": relative_to_repo(args.source_metadata),
            "title": metadata.get("title"),
            "author": metadata.get("author"),
            "ebook_id": metadata.get("ebook_id"),
            "language": metadata.get("language"),
        },
        "selection": {
            "section_number": selection["section_number"],
            "section_title": selection["section_title"],
            "start_subsection": selection["start_subsection"],
            "end_subsection": selection["end_subsection"],
            "start_line": selection["start_line"],
            "end_line": selection["end_line"],
        },
        "source_identity": {
            "clean_sha256": metadata.get("clean_sha256"),
            "clean_char_count": metadata.get("clean_char_count"),
        },
        "excerpt": {
            "path": relative_to_repo(excerpt_path),
            "line_count": int(selection["end_line"]) - int(selection["start_line"]) + 1,
            "word_count": len(excerpt.split()),
            "sha256": sha256_text(excerpt),
        },
        "expected_inputs": {
            "glossary_path": relative_to_repo(args.output_dir / "inputs/glossary.yaml"),
            "style_guide_path": relative_to_repo(args.output_dir / "inputs/style-guide.md"),
            "rubric_path": relative_to_repo(args.output_dir / "inputs/rubric.yaml"),
        },
        "report_root": f"data/calibration/runs/{args.slice_id}",
    }
    validate_slice_manifest(manifest, path=manifest_path, validate_paths=False)
    write_json(manifest_path, manifest)

    print(f"Wrote excerpt: {relative_to_repo(excerpt_path)}")
    print(f"Wrote manifest: {relative_to_repo(manifest_path)}")
    print(
        "Selected lines "
        f"{selection['start_line']}-{selection['end_line']} "
        f"from § {selection['section_number']} {selection['section_title']}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, ValidationError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
