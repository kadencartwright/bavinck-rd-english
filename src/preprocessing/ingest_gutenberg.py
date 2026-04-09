#!/usr/bin/env python3
"""Extract the Gutenberg body text and source metadata from a raw text file."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path


START_MARKER_RE = re.compile(r"^\*\*\* START OF THE PROJECT GUTENBERG EBOOK .+ \*\*\*$")
END_MARKER_RE = re.compile(r"^\*\*\* END OF THE PROJECT GUTENBERG EBOOK .+ \*\*\*$")

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


@dataclass
class ValidationError(RuntimeError):
    document_type: str
    path: str | None
    errors: list[str]

    def __str__(self) -> str:
        header = self.document_type if not self.path else f"{self.document_type}: {self.path}"
        body = "\n".join(f"  - {error}" for error in self.errors)
        return f"{header}\n{body}" if body else header


def validate_source_metadata(payload: dict[str, object], *, path: Path | None = None) -> dict[str, object]:
    errors: list[str] = []

    def required_string(key: str) -> str | None:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{key}: must be a non-empty string")
            return None
        return value

    def optional_string(key: str) -> None:
        value = payload.get(key)
        if value is not None and (not isinstance(value, str) or not value.strip()):
            errors.append(f"{key}: must be a non-empty string when present")

    def required_positive_int(key: str) -> int | None:
        value = payload.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
            errors.append(f"{key}: must be a positive integer")
            return None
        return value

    def required_sha256(key: str) -> str | None:
        value = required_string(key)
        if value is not None and not SHA256_RE.match(value):
            errors.append(f"{key}: must be a SHA-256 hex digest")
        return value

    source_file = required_string("source_file")
    source_format = required_string("source_format")
    title = required_string("title")
    author = required_string("author")
    language = required_string("language")
    ebook_id = required_string("ebook_id")
    raw_char_count = required_positive_int("raw_char_count")
    clean_char_count = required_positive_int("clean_char_count")
    raw_sha256 = required_sha256("raw_sha256")
    clean_sha256 = required_sha256("clean_sha256")
    preserves_editor_notes = payload.get("preserves_editor_notes")

    if source_format and source_format != "project_gutenberg_txt":
        errors.append("source_format: must equal 'project_gutenberg_txt'")
    if preserves_editor_notes is not True and preserves_editor_notes is not False:
        errors.append("preserves_editor_notes: must be a boolean")

    for key in ["release_date", "updated_date", "gutenberg_url", "original_publication", "credits"]:
        optional_string(key)

    if raw_char_count is not None and clean_char_count is not None and raw_char_count < clean_char_count:
        errors.append("raw_char_count: must be greater than or equal to clean_char_count")

    if source_file is not None and not Path(source_file).exists():
        errors.append(f"source_file: path does not exist: {source_file}")

    if errors:
        raise ValidationError("source_metadata", str(path) if path else None, errors)

    return payload


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


def parse_header_fields(header: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    current_label: str | None = None

    for raw_line in header.split("\n"):
        line = raw_line.rstrip()
        field_match = re.match(r"^([A-Za-z][A-Za-z ]+):\s*(.*)$", line)
        if field_match:
            current_label = field_match.group(1)
            fields[current_label] = field_match.group(2).strip()
            continue

        if current_label and raw_line[:1].isspace() and line.strip():
            continuation = line.strip()
            existing = fields[current_label]
            fields[current_label] = f"{existing} {continuation}".strip()
            continue

        current_label = None

    return fields


def extract_release_fields(release_value: str | None) -> tuple[str | None, str | None, str | None]:
    if not release_value:
        return None, None, None

    match = re.match(
        r"^(.+?)\s*\[eBook #(\d+)\](?:\s*Most recently updated:\s*(.+))?$",
        release_value,
    )
    if not match:
        return None, None, None
    return match.group(1).strip(), match.group(2).strip(), (
        match.group(3).strip() if match.group(3) else None
    )


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_metadata(input_path: Path, header: str, cleaned_text: str, raw_text: str) -> dict[str, object]:
    fields = parse_header_fields(header)
    release_date, ebook_id, updated_date = extract_release_fields(fields.get("Release date"))
    return {
        "source_file": str(input_path),
        "source_format": "project_gutenberg_txt",
        "title": fields.get("Title"),
        "author": fields.get("Author"),
        "language": fields.get("Language"),
        "release_date": release_date,
        "updated_date": updated_date,
        "ebook_id": ebook_id,
        "gutenberg_url": fields.get("Other information and formats"),
        "original_publication": fields.get("Original publication"),
        "credits": fields.get("Credits"),
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
    validate_source_metadata(metadata, path=args.output_metadata, validate_paths=True)

    args.output_text.parent.mkdir(parents=True, exist_ok=True)
    args.output_metadata.parent.mkdir(parents=True, exist_ok=True)
    args.output_text.write_text(cleaned_text, encoding="utf-8")
    args.output_metadata.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, ValidationError) as exc:
        raise SystemExit(f"error: {exc}")
