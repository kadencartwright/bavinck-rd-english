#!/usr/bin/env python3
"""Extract the Gutenberg body text and source metadata from a raw text file."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


START_MARKER_RE = re.compile(r"^\*\*\* START OF THE PROJECT GUTENBERG EBOOK .+ \*\*\*$")
END_MARKER_RE = re.compile(r"^\*\*\* END OF THE PROJECT GUTENBERG EBOOK .+ \*\*\*$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract cleaned source text and metadata from a Project Gutenberg TXT file."
    )
    parser.add_argument("input", type=Path, help="Path to the raw Gutenberg text file.")
    parser.add_argument(
        "--output-text",
        type=Path,
        required=True,
        help="Path to write the cleaned body text.",
    )
    parser.add_argument(
        "--output-metadata",
        type=Path,
        required=True,
        help="Path to write the extracted metadata as JSON.",
    )
    return parser.parse_args()


def normalize_text(raw_text: str) -> str:
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    return text.lstrip("\ufeff")


def find_marker(lines: list[str], pattern: re.Pattern[str]) -> int:
    for index, line in enumerate(lines):
        if pattern.match(line.strip()):
            return index
    raise ValueError(f"Could not find marker matching: {pattern.pattern}")


def extract_field(header: str, label: str) -> str | None:
    match = re.search(rf"^{re.escape(label)}:\s*(.+)$", header, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None


def extract_release_fields(header: str) -> tuple[str | None, str | None, str | None]:
    match = re.search(
        r"^Release date:\s*(.+?)\s*\[eBook #(\d+)\]\s*(?:\n\s*Most recently updated:\s*(.+))?$",
        header,
        re.MULTILINE,
    )
    if not match:
        return None, None, None
    return match.group(1).strip(), match.group(2).strip(), (
        match.group(3).strip() if match.group(3) else None
    )


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_metadata(input_path: Path, header: str, cleaned_text: str, raw_text: str) -> dict[str, object]:
    release_date, ebook_id, updated_date = extract_release_fields(header)
    return {
        "source_file": str(input_path),
        "source_format": "project_gutenberg_txt",
        "title": extract_field(header, "Title"),
        "author": extract_field(header, "Author"),
        "language": extract_field(header, "Language"),
        "release_date": release_date,
        "updated_date": updated_date,
        "ebook_id": ebook_id,
        "gutenberg_url": extract_field(header, "Other information and formats"),
        "original_publication": extract_field(header, "Original publication"),
        "credits": extract_field(header, "Credits"),
        "raw_char_count": len(raw_text),
        "clean_char_count": len(cleaned_text),
        "raw_sha256": sha256_hex(raw_text),
        "clean_sha256": sha256_hex(cleaned_text),
        "preserves_editor_notes": True,
    }


def main() -> None:
    args = parse_args()
    raw_text = normalize_text(args.input.read_text(encoding="utf-8"))
    lines = raw_text.split("\n")

    start_index = find_marker(lines, START_MARKER_RE)
    end_index = find_marker(lines, END_MARKER_RE)

    header = "\n".join(lines[:start_index]).strip()
    cleaned_text = "\n".join(lines[start_index + 1 : end_index]).strip() + "\n"
    metadata = build_metadata(args.input, header, cleaned_text, raw_text)

    args.output_text.parent.mkdir(parents=True, exist_ok=True)
    args.output_metadata.parent.mkdir(parents=True, exist_ok=True)
    args.output_text.write_text(cleaned_text, encoding="utf-8")
    args.output_metadata.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
