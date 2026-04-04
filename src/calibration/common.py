#!/usr/bin/env python3
"""Shared helpers for calibration slice and run workflows."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path


SECTION_RE = re.compile(r"^§\s+(?P<number>\d+)\.\s+(?P<title>.+)$")
SUBSECTION_RE = re.compile(r"^(?P<number>\d+)\.\s+")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def relative_to_repo(path: Path) -> str:
    return path.resolve().relative_to(Path.cwd().resolve()).as_posix()


def find_sections(lines: list[str]) -> list[dict[str, object]]:
    sections: list[dict[str, object]] = []
    for line_number, line in enumerate(lines, start=1):
        match = SECTION_RE.match(line)
        if not match:
            continue
        sections.append(
            {
                "number": int(match.group("number")),
                "title": match.group("title").strip(),
                "line_number": line_number,
            }
        )
    return sections


def get_section_bounds(lines: list[str], section_number: int) -> dict[str, object]:
    sections = find_sections(lines)
    for index, section in enumerate(sections):
        if section["number"] != section_number:
            continue
        end_line = len(lines)
        if index + 1 < len(sections):
            end_line = int(sections[index + 1]["line_number"]) - 1
        return {
            "number": section["number"],
            "title": section["title"],
            "start_line": section["line_number"],
            "end_line": end_line,
        }
    available = ", ".join(str(section["number"]) for section in sections)
    raise ValueError(f"Could not find section {section_number}. Available sections: {available}")


def find_subsections(lines: list[str], section_start: int, section_end: int) -> list[dict[str, int]]:
    subsections: list[dict[str, int]] = []
    for line_number in range(section_start + 1, section_end + 1):
        line = lines[line_number - 1]
        if not SUBSECTION_RE.match(line):
            continue
        previous_line = lines[line_number - 2] if line_number > 1 else ""
        if previous_line.strip():
            continue
        subsections.append(
            {
                "number": int(SUBSECTION_RE.match(line).group("number")),
                "line_number": line_number,
            }
        )
    return subsections


def select_slice_range(
    lines: list[str],
    *,
    section_number: int,
    start_subsection: int | None,
    end_subsection: int | None,
) -> dict[str, object]:
    section = get_section_bounds(lines, section_number)
    if start_subsection is None and end_subsection is None:
        return {
            "section_number": section["number"],
            "section_title": section["title"],
            "start_line": section["start_line"],
            "end_line": section["end_line"],
            "start_subsection": None,
            "end_subsection": None,
        }

    if start_subsection is None or end_subsection is None:
        raise ValueError("start_subsection and end_subsection must be provided together")

    subsections = find_subsections(lines, int(section["start_line"]), int(section["end_line"]))
    subsection_lookup = {entry["number"]: entry["line_number"] for entry in subsections}
    if start_subsection not in subsection_lookup or end_subsection not in subsection_lookup:
        available = ", ".join(str(entry["number"]) for entry in subsections)
        raise ValueError(
            "Requested subsection range is not available in the section. "
            f"Available subsection markers: {available}"
        )
    if start_subsection > end_subsection:
        raise ValueError("start_subsection cannot be greater than end_subsection")

    ordered = [entry for entry in subsections if start_subsection <= entry["number"] <= end_subsection]
    if not ordered:
        raise ValueError("Requested subsection range did not yield any subsection boundaries")

    start_line = int(section["start_line"])
    next_subsection_line = int(section["end_line"]) + 1
    for entry in subsections:
        if entry["line_number"] > ordered[-1]["line_number"]:
            next_subsection_line = entry["line_number"]
            break

    return {
        "section_number": section["number"],
        "section_title": section["title"],
        "start_line": start_line,
        "end_line": next_subsection_line - 1,
        "start_subsection": start_subsection,
        "end_subsection": end_subsection,
    }


def read_excerpt(lines: list[str], start_line: int, end_line: int) -> str:
    excerpt = "\n".join(lines[start_line - 1 : end_line]).strip("\n")
    return excerpt + "\n"


def parse_glossary_terms(path: Path) -> list[dict[str, str]]:
    terms: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped == "terms:":
            continue
        if stripped.startswith("- source:"):
            if current:
                terms.append(current)
            current = {"source": _yaml_scalar(stripped.split(":", 1)[1].strip())}
            continue
        if current is None or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        current[key.strip()] = _yaml_scalar(value.strip())
    if current:
        terms.append(current)
    return terms


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = _yaml_scalar(value.strip())
        os.environ.setdefault(key, value)


def render_template(template: str, context: dict[str, str]) -> str:
    rendered = template
    for key, value in context.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", value)
    return rendered


def extract_json_object(text: str) -> dict[str, object]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = _strip_code_fences(stripped)
    return json.loads(stripped)


def extract_preserved_spans(text: str) -> list[str]:
    spans = re.findall(r"[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]+", text)
    unique_spans: list[str] = []
    for span in spans:
        if span not in unique_spans:
            unique_spans.append(span)
    return unique_spans


def _yaml_scalar(value: str) -> str:
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    return value


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines:
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()
