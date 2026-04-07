#!/usr/bin/env python3
"""Validation for source metadata and calibration workflow inputs."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from json import JSONDecodeError
from pathlib import Path
from typing import Callable


REPO_ROOT = Path(__file__).resolve().parents[2]
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
FIXED_TEMPERATURE_MODELS = {
    ("moonshot", "kimi-k2.5"): 1.0,
}


@dataclass
class ValidationError(RuntimeError):
    """Structured validation failure with per-field details."""

    document_type: str
    path: str | None
    errors: list[str]

    def __str__(self) -> str:
        header = self.document_type
        if self.path:
            header = f"{header}: {self.path}"
        body = "\n".join(f"  - {error}" for error in self.errors)
        return f"{header}\n{body}" if body else header


def load_and_validate_json(
    path: Path,
    validator: Callable[..., dict[str, object]],
    **kwargs: object,
) -> dict[str, object]:
    repo_root = kwargs.get("repo_root")
    repo_root_path = Path(repo_root) if repo_root is not None else None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except JSONDecodeError as exc:
        raise ValidationError(
            _document_type_for_validator(validator),
            display_path(path, repo_root=repo_root_path),
            [f"invalid JSON at line {exc.lineno} column {exc.colno}: {exc.msg}"],
        ) from exc
    return validator(payload, path=path, **kwargs)


def load_and_validate_glossary(
    path: Path,
    *,
    expected_slice_id: str | None = None,
) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    return validate_glossary_yaml_text(text, path=path, expected_slice_id=expected_slice_id)


def load_and_validate_rubric(
    path: Path,
    *,
    expected_slice_id: str | None = None,
) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    return validate_rubric_yaml_text(text, path=path, expected_slice_id=expected_slice_id)


def validate_source_metadata(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
    validate_paths: bool = False,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    source_file = _required_string(payload, "source_file", errors)
    source_format = _required_string(payload, "source_format", errors)
    title = _required_string(payload, "title", errors)
    author = _required_string(payload, "author", errors)
    language = _required_string(payload, "language", errors)
    ebook_id = _required_string(payload, "ebook_id", errors)
    raw_char_count = _required_positive_int(payload, "raw_char_count", errors)
    clean_char_count = _required_positive_int(payload, "clean_char_count", errors)
    raw_sha256 = _required_sha256(payload, "raw_sha256", errors)
    clean_sha256 = _required_sha256(payload, "clean_sha256", errors)
    _required_bool(payload, "preserves_editor_notes", errors)

    if source_format and source_format != "project_gutenberg_txt":
        errors.append("source_format: must equal 'project_gutenberg_txt'")
    for field in ["release_date", "updated_date", "gutenberg_url", "original_publication", "credits"]:
        _optional_string(payload, field, errors)

    if raw_char_count and clean_char_count and raw_char_count < clean_char_count:
        errors.append("raw_char_count: must be greater than or equal to clean_char_count")
    if validate_paths and source_file:
        source_path = resolve_repo_path(source_file, repo_root=repo_root)
        if not source_path.exists():
            errors.append(f"source_file: path does not exist: {display_path(source_path, repo_root=repo_root)}")

    if errors:
        raise ValidationError("source_metadata", display_path(path, repo_root=repo_root) if path else None, errors)
    return payload


def validate_slice_manifest(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
    validate_paths: bool = False,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    schema_version = _required_string(payload, "schema_version", errors)
    slice_id = _required_slug(payload, "slice_id", errors)
    _required_string(payload, "title", errors)
    _required_string(payload, "rationale", errors)
    stressors = _required_nonempty_string_list(payload, "stressors", errors)
    source = _required_object(payload, "source", errors)
    selection = _required_object(payload, "selection", errors)
    source_identity = _required_object(payload, "source_identity", errors)
    excerpt = _required_object(payload, "excerpt", errors)
    expected_inputs = _required_object(payload, "expected_inputs", errors)
    report_root = _required_string(payload, "report_root", errors)

    if schema_version and schema_version != "1.0":
        errors.append("schema_version: must equal '1.0'")
    if report_root and slice_id and report_root != f"data/calibration/runs/{slice_id}":
        errors.append(f"report_root: expected 'data/calibration/runs/{slice_id}'")
    if stressors is not None and len(stressors) == 0:
        errors.append("stressors: must contain at least one item")

    source_text_path = None
    source_metadata_path = None
    excerpt_path = None
    if source is not None:
        source_text = _required_nested_string(source, "source", "text_path", errors)
        source_metadata = _required_nested_string(source, "source", "metadata_path", errors)
        _required_nested_string(source, "source", "title", errors)
        _required_nested_string(source, "source", "author", errors)
        _required_nested_string(source, "source", "ebook_id", errors)
        _required_nested_string(source, "source", "language", errors)
        if source_text:
            source_text_path = resolve_repo_path(source_text, repo_root=repo_root)
        if source_metadata:
            source_metadata_path = resolve_repo_path(source_metadata, repo_root=repo_root)

    if selection is not None:
        section_number = _required_nested_positive_int(selection, "selection", "section_number", errors)
        _required_nested_string(selection, "selection", "section_title", errors)
        start_subsection = _allow_none_nested_int(selection, "selection", "start_subsection", errors)
        end_subsection = _allow_none_nested_int(selection, "selection", "end_subsection", errors)
        start_line = _required_nested_positive_int(selection, "selection", "start_line", errors)
        end_line = _required_nested_positive_int(selection, "selection", "end_line", errors)
        if section_number is not None and section_number <= 0:
            errors.append("selection.section_number: must be positive")
        if start_line is not None and end_line is not None and start_line > end_line:
            errors.append("selection.start_line: must be less than or equal to selection.end_line")
        if (start_subsection is None) != (end_subsection is None):
            errors.append("selection.start_subsection: must be null when selection.end_subsection is null, and vice versa")
        if (
            start_subsection is not None
            and end_subsection is not None
            and start_subsection > end_subsection
        ):
            errors.append("selection.start_subsection: must be less than or equal to selection.end_subsection")

    if source_identity is not None:
        _required_nested_sha256(source_identity, "source_identity", "clean_sha256", errors)
        _required_nested_positive_int(source_identity, "source_identity", "clean_char_count", errors)

    if excerpt is not None:
        excerpt_file = _required_nested_string(excerpt, "excerpt", "path", errors)
        _required_nested_positive_int(excerpt, "excerpt", "line_count", errors)
        _required_nested_positive_int(excerpt, "excerpt", "word_count", errors)
        _required_nested_sha256(excerpt, "excerpt", "sha256", errors)
        if excerpt_file:
            excerpt_path = resolve_repo_path(excerpt_file, repo_root=repo_root)

    expected_input_paths: dict[str, Path] = {}
    if expected_inputs is not None:
        for key in ["glossary_path", "style_guide_path", "rubric_path"]:
            value = _required_nested_string(expected_inputs, "expected_inputs", key, errors)
            if value:
                expected_input_paths[key] = resolve_repo_path(value, repo_root=repo_root)

    if validate_paths:
        if source_text_path is not None and not source_text_path.exists():
            errors.append(f"source.text_path: path does not exist: {display_path(source_text_path, repo_root=repo_root)}")
        if source_metadata_path is not None and not source_metadata_path.exists():
            errors.append(
                f"source.metadata_path: path does not exist: {display_path(source_metadata_path, repo_root=repo_root)}"
            )
        if excerpt_path is not None and not excerpt_path.exists():
            errors.append(f"excerpt.path: path does not exist: {display_path(excerpt_path, repo_root=repo_root)}")
        for key, expected_path in expected_input_paths.items():
            if not expected_path.exists():
                errors.append(f"expected_inputs.{key}: path does not exist: {display_path(expected_path, repo_root=repo_root)}")

        if source_metadata_path is not None and source_metadata_path.exists():
            source_metadata = load_and_validate_json(
                source_metadata_path,
                validate_source_metadata,
                repo_root=repo_root,
                validate_paths=True,
            )
            if source is not None:
                for key in ["title", "author", "ebook_id", "language"]:
                    manifest_value = source.get(key)
                    metadata_key = key
                    if metadata_key == "ebook_id":
                        metadata_value = source_metadata.get("ebook_id")
                    else:
                        metadata_value = source_metadata.get(metadata_key)
                    if manifest_value != metadata_value:
                        errors.append(f"source.{key}: expected '{metadata_value}' to match source metadata")
            clean_sha = source_identity.get("clean_sha256") if source_identity else None
            if clean_sha is not None and clean_sha != source_metadata.get("clean_sha256"):
                errors.append("source_identity.clean_sha256: must match source metadata clean_sha256")
            clean_char_count = source_identity.get("clean_char_count") if source_identity else None
            if clean_char_count is not None and clean_char_count != source_metadata.get("clean_char_count"):
                errors.append("source_identity.clean_char_count: must match source metadata clean_char_count")

        if source_text_path is not None and source_text_path.exists() and source_identity is not None:
            clean_char_count = source_identity.get("clean_char_count")
            actual_clean_char_count = len(source_text_path.read_text(encoding="utf-8"))
            if clean_char_count is not None and clean_char_count != actual_clean_char_count:
                errors.append("source_identity.clean_char_count: must match the content length of source.text_path")

        if excerpt_path is not None and excerpt_path.exists():
            excerpt_text = excerpt_path.read_text(encoding="utf-8")
            excerpt_hash = _sha256_text(excerpt_text)
            expected_hash = excerpt.get("sha256") if excerpt else None
            if expected_hash != excerpt_hash:
                errors.append("excerpt.sha256: must match the content of excerpt.path")

    if errors:
        raise ValidationError("slice_manifest", display_path(path, repo_root=repo_root) if path else None, errors)
    return payload


def validate_prompt_bundle_metadata(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    bundle_dir: Path | None = None,
    repo_root: Path | None = None,
    validate_paths: bool = False,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    schema_version = _required_string(payload, "schema_version", errors)
    prompt_bundle_id = _required_slug(payload, "prompt_bundle_id", errors)
    _required_string(payload, "description", errors)
    stages = _required_list(payload, "stages", errors)
    prompt_files = _required_object(payload, "prompt_files", errors)
    notes = payload.get("notes")

    if schema_version and schema_version != "1.0":
        errors.append("schema_version: must equal '1.0'")
    if stages is not None:
        allowed_stages = {"translation", "review"}
        if not stages:
            errors.append("stages: must contain at least one item")
        else:
            stage_values = []
            for index, item in enumerate(stages):
                if not isinstance(item, str) or not item.strip():
                    errors.append(f"stages[{index}]: must be a non-empty string")
                    continue
                stage_values.append(item.strip())
                if item.strip() not in allowed_stages:
                    errors.append(f"stages[{index}]: unsupported stage '{item.strip()}'")
            for required_stage in ["translation", "review"]:
                if required_stage not in stage_values:
                    errors.append(f"stages: missing required stage '{required_stage}'")
    if notes is not None and not (
        isinstance(notes, list) and all(isinstance(item, str) and item.strip() for item in notes)
    ):
        errors.append("notes: must be a list of non-empty strings when present")

    prompt_file_map: dict[str, str] = {}
    if prompt_files is not None:
        for key in [
            "translation_system",
            "translation_user_template",
            "review_system",
            "review_user_template",
        ]:
            value = _required_nested_string(prompt_files, "prompt_files", key, errors)
            if value:
                prompt_file_map[key] = value

    if bundle_dir is not None and prompt_bundle_id and bundle_dir.name != prompt_bundle_id:
        errors.append(f"prompt_bundle_id: expected '{prompt_bundle_id}' to match bundle directory '{bundle_dir.name}'")

    if validate_paths and bundle_dir is not None:
        for key, relative_file in prompt_file_map.items():
            target = bundle_dir / relative_file
            if not target.exists():
                errors.append(f"prompt_files.{key}: path does not exist: {display_path(target, repo_root=repo_root)}")
        template_requirements = {
            "translation_user_template": [
                "{{run_id}}",
                "{{slice_id}}",
                "{{slice_title}}",
                "{{selection_rationale}}",
                "{{glossary_terms}}",
                "{{style_guide}}",
                "{{source_excerpt}}",
            ],
            "review_user_template": [
                "{{run_id}}",
                "{{slice_id}}",
                "{{slice_title}}",
                "{{source_excerpt}}",
                "{{translation_output}}",
                "{{glossary_terms}}",
                "{{style_guide}}",
                "{{rubric}}",
            ],
        }
        for key, placeholders in template_requirements.items():
            relative_file = prompt_file_map.get(key)
            if not relative_file:
                continue
            target = bundle_dir / relative_file
            if not target.exists():
                continue
            content = target.read_text(encoding="utf-8")
            for placeholder in placeholders:
                if placeholder not in content:
                    errors.append(f"prompt_files.{key}: missing placeholder {placeholder}")

    if errors:
        raise ValidationError(
            "prompt_bundle_metadata",
            display_path(path, repo_root=repo_root) if path else None,
            errors,
        )
    return payload


def validate_model_profile(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    schema_version = _required_string(payload, "schema_version", errors)
    _required_slug(payload, "model_profile_id", errors)
    _required_string(payload, "description", errors)
    stages = _required_object(payload, "stages", errors)

    if schema_version and schema_version != "1.0":
        errors.append("schema_version: must equal '1.0'")

    if stages is not None:
        for stage_name in ["translation", "review"]:
            stage = stages.get(stage_name)
            if not isinstance(stage, dict):
                errors.append(f"stages.{stage_name}: must be an object")
                continue
            provider = _required_nested_string(stage, f"stages.{stage_name}", "provider", errors)
            model = _required_nested_string(stage, f"stages.{stage_name}", "model", errors)
            mode = _required_nested_string(stage, f"stages.{stage_name}", "mode", errors)
            temperature = _required_nested_number(stage, f"stages.{stage_name}", "temperature", errors)
            _optional_nested_positive_int(stage, f"stages.{stage_name}", "max_tokens", errors)
            _optional_nested_positive_int(stage, f"stages.{stage_name}", "timeout_seconds", errors)
            if provider and provider not in {"moonshot", "z-ai"}:
                errors.append(f"stages.{stage_name}.provider: unsupported provider '{provider}'")
            if mode and mode not in {"batch", "standard"}:
                errors.append(f"stages.{stage_name}.mode: unsupported mode '{mode}'")
            if temperature is not None and not (0.0 <= temperature <= 2.0):
                errors.append(f"stages.{stage_name}.temperature: must be between 0.0 and 2.0")
            fixed_temperature = FIXED_TEMPERATURE_MODELS.get((provider, model))
            if (
                fixed_temperature is not None
                and temperature is not None
                and float(temperature) != fixed_temperature
            ):
                errors.append(
                    f"stages.{stage_name}.temperature: must equal {fixed_temperature} for {provider} model '{model}'"
                )

    if errors:
        raise ValidationError("model_profile", display_path(path, repo_root=repo_root) if path else None, errors)
    return payload


def validate_run_manifest(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
    validate_paths: bool = False,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    schema_version = _required_string(payload, "schema_version", errors)
    run_id = _required_slug(payload, "run_id", errors)
    slice_id = _required_slug(payload, "slice_id", errors)
    slice_manifest_path_value = _required_string(payload, "slice_manifest_path", errors)
    prompt_bundle_id = _required_slug(payload, "prompt_bundle_id", errors)
    prompt_bundle_path_value = _required_string(payload, "prompt_bundle_path", errors)
    model_profile_id = _required_slug(payload, "model_profile_id", errors)
    model_profile_path_value = _required_string(payload, "model_profile_path", errors)
    glossary_path_value = _required_string(payload, "glossary_path", errors)
    style_guide_path_value = _required_string(payload, "style_guide_path", errors)
    rubric_path_value = _required_string(payload, "rubric_path", errors)

    if schema_version and schema_version != "1.0":
        errors.append("schema_version: must equal '1.0'")
    for legacy_field in ["seed_translation_path", "seed_findings_path", "manual_checks"]:
        if legacy_field in payload:
            errors.append(f"{legacy_field}: legacy placeholder field is not allowed in the live workflow")

    slice_manifest_path = None
    prompt_bundle_path = None
    model_profile_path = None
    glossary_path = None
    style_guide_path = None
    rubric_path = None
    if slice_manifest_path_value:
        slice_manifest_path = resolve_repo_path(slice_manifest_path_value, repo_root=repo_root)
    if prompt_bundle_path_value:
        prompt_bundle_path = resolve_repo_path(prompt_bundle_path_value, repo_root=repo_root)
    if model_profile_path_value:
        model_profile_path = resolve_repo_path(model_profile_path_value, repo_root=repo_root)
    if glossary_path_value:
        glossary_path = resolve_repo_path(glossary_path_value, repo_root=repo_root)
    if style_guide_path_value:
        style_guide_path = resolve_repo_path(style_guide_path_value, repo_root=repo_root)
    if rubric_path_value:
        rubric_path = resolve_repo_path(rubric_path_value, repo_root=repo_root)

    if validate_paths:
        for field, resolved in [
            ("slice_manifest_path", slice_manifest_path),
            ("prompt_bundle_path", prompt_bundle_path),
            ("model_profile_path", model_profile_path),
            ("glossary_path", glossary_path),
            ("style_guide_path", style_guide_path),
            ("rubric_path", rubric_path),
        ]:
            if resolved is not None and not resolved.exists():
                errors.append(f"{field}: path does not exist: {display_path(resolved, repo_root=repo_root)}")

        slice_manifest = None
        if slice_manifest_path is not None and slice_manifest_path.exists():
            slice_manifest = load_and_validate_json(
                slice_manifest_path,
                validate_slice_manifest,
                repo_root=repo_root,
                validate_paths=True,
            )
            if slice_id and slice_manifest.get("slice_id") != slice_id:
                errors.append(
                    f"slice_id: expected '{slice_id}' to match referenced slice manifest '{slice_manifest.get('slice_id')}'"
                )

        if prompt_bundle_path is not None and prompt_bundle_path.exists():
            metadata_path = prompt_bundle_path / "metadata.json"
            if not metadata_path.exists():
                errors.append(
                    f"prompt_bundle_path: expected metadata.json in {display_path(prompt_bundle_path, repo_root=repo_root)}"
                )
            else:
                prompt_bundle = load_and_validate_json(
                    metadata_path,
                    validate_prompt_bundle_metadata,
                    repo_root=repo_root,
                    bundle_dir=prompt_bundle_path,
                    validate_paths=True,
                )
                if prompt_bundle_id and prompt_bundle.get("prompt_bundle_id") != prompt_bundle_id:
                    errors.append(
                        f"prompt_bundle_id: expected '{prompt_bundle_id}' to match referenced prompt bundle '{prompt_bundle.get('prompt_bundle_id')}'"
                    )

        if model_profile_path is not None and model_profile_path.exists():
            model_profile = load_and_validate_json(
                model_profile_path,
                validate_model_profile,
                repo_root=repo_root,
            )
            if model_profile_id and model_profile.get("model_profile_id") != model_profile_id:
                errors.append(
                    f"model_profile_id: expected '{model_profile_id}' to match referenced model profile '{model_profile.get('model_profile_id')}'"
                )

        if slice_manifest is not None:
            expected_inputs = slice_manifest.get("expected_inputs", {})
            expected_glossary = resolve_repo_path(str(expected_inputs.get("glossary_path")), repo_root=repo_root)
            expected_style = resolve_repo_path(str(expected_inputs.get("style_guide_path")), repo_root=repo_root)
            expected_rubric = resolve_repo_path(str(expected_inputs.get("rubric_path")), repo_root=repo_root)
            for field, actual, expected in [
                ("glossary_path", glossary_path, expected_glossary),
                ("style_guide_path", style_guide_path, expected_style),
                ("rubric_path", rubric_path, expected_rubric),
            ]:
                if actual is not None and actual != expected:
                    errors.append(
                        f"{field}: expected {display_path(expected, repo_root=repo_root)} to match slice manifest expected input"
                    )

    if run_id and not SLUG_RE.match(run_id):
        errors.append("run_id: must be filesystem-safe slug characters")

    if errors:
        raise ValidationError("run_manifest", display_path(path, repo_root=repo_root) if path else None, errors)
    return payload


def validate_glossary_yaml_text(
    text: str,
    *,
    path: Path | None = None,
    expected_slice_id: str | None = None,
) -> dict[str, object]:
    payload, parse_errors = _parse_simple_yaml_document(text, "terms")
    errors = list(parse_errors)

    schema_version = _required_string(payload, "schema_version", errors)
    slice_id = _required_string(payload, "slice_id", errors)
    terms = _required_list(payload, "terms", errors)

    if schema_version and schema_version != "1.0":
        errors.append("schema_version: must equal '1.0'")
    if expected_slice_id and slice_id and slice_id != expected_slice_id:
        errors.append(f"slice_id: expected '{expected_slice_id}'")
    if terms is not None:
        if not terms:
            errors.append("terms: must contain at least one item")
        seen_sources: set[str] = set()
        for index, item in enumerate(terms):
            if not isinstance(item, dict):
                errors.append(f"terms[{index}]: must be an object")
                continue
            source = _required_nested_string(item, f"terms[{index}]", "source", errors)
            _required_nested_string(item, f"terms[{index}]", "target", errors)
            _optional_nested_string(item, f"terms[{index}]", "notes", errors)
            if source:
                if source in seen_sources:
                    errors.append(f"terms[{index}].source: duplicate source term '{source}'")
                seen_sources.add(source)

    if errors:
        raise ValidationError("slice_glossary", display_path(path, repo_root=REPO_ROOT) if path else None, errors)
    return payload


def validate_rubric_yaml_text(
    text: str,
    *,
    path: Path | None = None,
    expected_slice_id: str | None = None,
) -> dict[str, object]:
    payload, parse_errors = _parse_simple_yaml_document(text, "criteria")
    errors = list(parse_errors)

    schema_version = _required_string(payload, "schema_version", errors)
    slice_id = _required_string(payload, "slice_id", errors)
    criteria = _required_list(payload, "criteria", errors)

    if schema_version and schema_version != "1.0":
        errors.append("schema_version: must equal '1.0'")
    if expected_slice_id and slice_id and slice_id != expected_slice_id:
        errors.append(f"slice_id: expected '{expected_slice_id}'")
    required_criteria = {
        "preserved-language-integrity",
        "glossary-adherence",
        "prose-quality",
        "review-flagging",
    }
    seen_ids: set[str] = set()
    if criteria is not None:
        if not criteria:
            errors.append("criteria: must contain at least one item")
        for index, item in enumerate(criteria):
            if not isinstance(item, dict):
                errors.append(f"criteria[{index}]: must be an object")
                continue
            criterion_id = _required_nested_string(item, f"criteria[{index}]", "id", errors)
            _required_nested_string(item, f"criteria[{index}]", "requirement", errors)
            status_values = _required_nested_string(item, f"criteria[{index}]", "status_values", errors)
            if criterion_id:
                seen_ids.add(criterion_id)
            if status_values:
                values = {part.strip() for part in status_values.split("|")}
                for required_status in {"pass", "fail", "incomplete"}:
                    if required_status not in values:
                        errors.append(
                            f"criteria[{index}].status_values: must contain '{required_status}'"
                        )
    for criterion_id in sorted(required_criteria):
        if criterion_id not in seen_ids:
            errors.append(f"criteria: missing required criterion '{criterion_id}'")

    if errors:
        raise ValidationError("slice_rubric", display_path(path, repo_root=REPO_ROOT) if path else None, errors)
    return payload


def validate_review_payload(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    _required_string(payload, "summary", errors)
    checks = _required_object(payload, "checks", errors)
    findings = _required_list(payload, "findings", errors)
    follow_up = _required_list(payload, "recommended_follow_up", errors)

    if checks is not None:
        for required_key in ["prose-quality", "review-flagging"]:
            check = checks.get(required_key)
            if not isinstance(check, dict):
                errors.append(f"checks.{required_key}: must be an object")
                continue
            status = _required_nested_string(check, f"checks.{required_key}", "status", errors)
            _required_nested_string(check, f"checks.{required_key}", "details", errors)
            if status and status not in {"pass", "fail", "incomplete"}:
                errors.append(f"checks.{required_key}.status: must be one of pass, fail, incomplete")

    if findings is not None:
        for index, item in enumerate(findings):
            if not isinstance(item, dict):
                errors.append(f"findings[{index}]: must be an object")
                continue
            severity = _required_nested_string(item, f"findings[{index}]", "severity", errors)
            _required_nested_string(item, f"findings[{index}]", "category", errors)
            _required_nested_string(item, f"findings[{index}]", "detail", errors)
            if severity and severity not in {"high", "medium", "low", "info"}:
                errors.append(f"findings[{index}].severity: must be one of high, medium, low, info")

    if follow_up is not None:
        for index, item in enumerate(follow_up):
            if not isinstance(item, str) or not item.strip():
                errors.append(f"recommended_follow_up[{index}]: must be a non-empty string")

    if errors:
        raise ValidationError("review_payload", display_path(path, repo_root=repo_root) if path else None, errors)
    return payload


def validate_translation_request_record(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
) -> dict[str, object]:
    return _validate_request_record(payload, expected_stage="translation", path=path, repo_root=repo_root)


def validate_review_request_record(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
) -> dict[str, object]:
    return _validate_request_record(payload, expected_stage="review", path=path, repo_root=repo_root)


def validate_evaluation_report(
    payload: dict[str, object],
    *,
    path: Path | None = None,
    repo_root: Path | None = None,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    schema_version = _required_string(payload, "schema_version", errors)
    _required_slug(payload, "run_id", errors)
    _required_string(payload, "slice_id", errors)
    _required_string(payload, "prompt_bundle_id", errors)
    _required_string(payload, "model_profile_id", errors)
    checks = _required_list(payload, "checks", errors)
    summary = _required_object(payload, "summary", errors)
    artifacts = _required_object(payload, "artifacts", errors)
    qualitative_findings = _required_object(payload, "qualitative_findings", errors)

    if schema_version and schema_version != "1.0":
        errors.append("schema_version: must equal '1.0'")

    pass_count = fail_count = incomplete_count = 0
    seen_ids: set[str] = set()
    if checks is not None:
        for index, item in enumerate(checks):
            if not isinstance(item, dict):
                errors.append(f"checks[{index}]: must be an object")
                continue
            check_id = _required_nested_string(item, f"checks[{index}]", "id", errors)
            status = _required_nested_string(item, f"checks[{index}]", "status", errors)
            _required_nested_string(item, f"checks[{index}]", "details", errors)
            if check_id:
                if check_id in seen_ids:
                    errors.append(f"checks[{index}].id: duplicate check id '{check_id}'")
                seen_ids.add(check_id)
            if status:
                if status not in {"pass", "fail", "incomplete"}:
                    errors.append(f"checks[{index}].status: must be one of pass, fail, incomplete")
                elif status == "pass":
                    pass_count += 1
                elif status == "fail":
                    fail_count += 1
                else:
                    incomplete_count += 1

    if summary is not None:
        expected_summary = {
            "pass": pass_count,
            "fail": fail_count,
            "incomplete": incomplete_count,
        }
        for key, expected_value in expected_summary.items():
            actual = _required_nested_nonnegative_int(summary, "summary", key, errors)
            if actual is not None and actual != expected_value:
                errors.append(f"summary.{key}: expected {expected_value} to match checks")

    if artifacts is not None:
        for key, value in artifacts.items():
            if not isinstance(value, str) or not value.strip():
                errors.append(f"artifacts.{key}: must be a non-empty string")
    if qualitative_findings is not None:
        _required_nested_string(qualitative_findings, "qualitative_findings", "path", errors)
        separate = qualitative_findings.get("separate_from_checks")
        if separate is not True:
            errors.append("qualitative_findings.separate_from_checks: must be true")

    if errors:
        raise ValidationError(
            "evaluation_report",
            display_path(path, repo_root=repo_root) if path else None,
            errors,
        )
    return payload


def validate_run_manifest_bundle(
    run_manifest_path: Path,
    *,
    repo_root: Path | None = None,
) -> dict[str, object]:
    repo_root = repo_root or REPO_ROOT
    run_manifest = load_and_validate_json(
        run_manifest_path,
        validate_run_manifest,
        repo_root=repo_root,
        validate_paths=True,
    )
    slice_manifest_path = resolve_repo_path(str(run_manifest["slice_manifest_path"]), repo_root=repo_root)
    slice_manifest = load_and_validate_json(
        slice_manifest_path,
        validate_slice_manifest,
        repo_root=repo_root,
        validate_paths=True,
    )
    glossary_path = resolve_repo_path(str(run_manifest["glossary_path"]), repo_root=repo_root)
    style_guide_path = resolve_repo_path(str(run_manifest["style_guide_path"]), repo_root=repo_root)
    rubric_path = resolve_repo_path(str(run_manifest["rubric_path"]), repo_root=repo_root)
    load_and_validate_glossary(glossary_path, expected_slice_id=str(slice_manifest["slice_id"]))
    load_and_validate_rubric(rubric_path, expected_slice_id=str(slice_manifest["slice_id"]))
    if not style_guide_path.exists():
        raise ValidationError(
            "style_guide",
            display_path(style_guide_path, repo_root=repo_root),
            ["path does not exist"],
        )
    prompt_bundle_path = resolve_repo_path(str(run_manifest["prompt_bundle_path"]), repo_root=repo_root)
    load_and_validate_json(
        prompt_bundle_path / "metadata.json",
        validate_prompt_bundle_metadata,
        repo_root=repo_root,
        bundle_dir=prompt_bundle_path,
        validate_paths=True,
    )
    model_profile_path = resolve_repo_path(str(run_manifest["model_profile_path"]), repo_root=repo_root)
    load_and_validate_json(
        model_profile_path,
        validate_model_profile,
        repo_root=repo_root,
    )
    return run_manifest


def resolve_repo_path(path_value: str | Path, *, repo_root: Path | None = None) -> Path:
    repo_root = repo_root or REPO_ROOT
    path = Path(path_value)
    if path.is_absolute():
        return path.resolve()
    return (repo_root / path).resolve()


def display_path(path: Path | None, *, repo_root: Path | None = None) -> str | None:
    if path is None:
        return None
    repo_root = repo_root or REPO_ROOT
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def _validate_request_record(
    payload: dict[str, object],
    *,
    expected_stage: str,
    path: Path | None = None,
    repo_root: Path | None = None,
) -> dict[str, object]:
    errors: list[str] = []
    repo_root = repo_root or REPO_ROOT

    _required_slug(payload, "run_id", errors)
    _required_string(payload, "slice_id", errors)
    _required_string(payload, "prompt_bundle_id", errors)
    _required_string(payload, "model_profile_id", errors)
    stage = _required_string(payload, "stage", errors)
    provider = _required_string(payload, "provider", errors)
    _required_string(payload, "model", errors)
    temperature = _required_number(payload, "temperature", errors)
    _optional_positive_int(payload, "max_tokens", errors)
    messages = _required_list(payload, "messages", errors)
    prompt_files = _required_object(payload, "prompt_files", errors)

    if stage and stage != expected_stage:
        errors.append(f"stage: expected '{expected_stage}'")
    if provider and provider not in {"moonshot", "z-ai"}:
        errors.append(f"provider: unsupported provider '{provider}'")
    if temperature is not None and not (0.0 <= temperature <= 2.0):
        errors.append("temperature: must be between 0.0 and 2.0")
    if messages is not None:
        if not messages:
            errors.append("messages: must contain at least one item")
        for index, item in enumerate(messages):
            if not isinstance(item, dict):
                errors.append(f"messages[{index}]: must be an object")
                continue
            role = _required_nested_string(item, f"messages[{index}]", "role", errors)
            _required_nested_string(item, f"messages[{index}]", "content", errors)
            if role and role not in {"system", "user", "assistant"}:
                errors.append(f"messages[{index}].role: unsupported role '{role}'")
    if prompt_files is not None and not prompt_files:
        errors.append("prompt_files: must not be empty")

    if errors:
        raise ValidationError(
            f"{expected_stage}_request_record",
            display_path(path, repo_root=repo_root) if path else None,
            errors,
        )
    return payload


def _parse_simple_yaml_document(text: str, list_key: str) -> tuple[dict[str, object], list[str]]:
    payload: dict[str, object] = {}
    items: list[dict[str, str]] = []
    current_item: dict[str, str] | None = None
    errors: list[str] = []
    seen_list_key = False

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        stripped = raw_line.strip()
        if indent == 0:
            current_item = None
            if stripped.endswith(":"):
                key = stripped[:-1].strip()
                if key != list_key:
                    errors.append(f"line {line_number}: unexpected list key '{key}', expected '{list_key}'")
                    continue
                payload[list_key] = items
                seen_list_key = True
                continue
            if ":" not in stripped:
                errors.append(f"line {line_number}: expected 'key: value' entry")
                continue
            key, value = stripped.split(":", 1)
            payload[key.strip()] = _parse_yaml_scalar(value.strip())
            continue

        if not seen_list_key:
            errors.append(f"line {line_number}: encountered indented content before '{list_key}:'")
            continue

        if indent == 2 and stripped.startswith("- "):
            rest = stripped[2:]
            if ":" not in rest:
                errors.append(f"line {line_number}: expected '- key: value' list item")
                continue
            key, value = rest.split(":", 1)
            current_item = {key.strip(): _parse_yaml_scalar(value.strip())}
            items.append(current_item)
            continue

        if indent == 4:
            if current_item is None:
                errors.append(f"line {line_number}: found list item field without a current list item")
                continue
            if ":" not in stripped:
                errors.append(f"line {line_number}: expected 'key: value' field")
                continue
            key, value = stripped.split(":", 1)
            current_item[key.strip()] = _parse_yaml_scalar(value.strip())
            continue

        errors.append(f"line {line_number}: unsupported indentation level {indent}")

    if not seen_list_key:
        payload[list_key] = items
    return payload, errors


def _parse_yaml_scalar(value: str) -> str:
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    return value


def _document_type_for_validator(validator: Callable[..., dict[str, object]]) -> str:
    name = getattr(validator, "__name__", "")
    if name.startswith("validate_"):
        return name.removeprefix("validate_")
    return "json_document"


def _required_object(payload: dict[str, object], field: str, errors: list[str]) -> dict[str, object] | None:
    value = payload.get(field)
    if not isinstance(value, dict):
        errors.append(f"{field}: must be an object")
        return None
    return value


def _required_list(payload: dict[str, object], field: str, errors: list[str]) -> list[object] | None:
    value = payload.get(field)
    if not isinstance(value, list):
        errors.append(f"{field}: must be a list")
        return None
    return value


def _required_string(payload: dict[str, object], field: str, errors: list[str]) -> str | None:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{field}: must be a non-empty string")
        return None
    return value.strip()


def _required_slug(payload: dict[str, object], field: str, errors: list[str]) -> str | None:
    value = _required_string(payload, field, errors)
    if value is not None and not SLUG_RE.match(value):
        errors.append(f"{field}: must contain only lowercase letters, numbers, dots, underscores, or hyphens")
    return value


def _optional_string(payload: dict[str, object], field: str, errors: list[str]) -> str | None:
    value = payload.get(field)
    if value is None:
        return None
    if not isinstance(value, str):
        errors.append(f"{field}: must be a string when present")
        return None
    return value


def _required_bool(payload: dict[str, object], field: str, errors: list[str]) -> bool | None:
    value = payload.get(field)
    if not isinstance(value, bool):
        errors.append(f"{field}: must be a boolean")
        return None
    return value


def _required_positive_int(payload: dict[str, object], field: str, errors: list[str]) -> int | None:
    value = payload.get(field)
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        errors.append(f"{field}: must be a positive integer")
        return None
    return value


def _optional_positive_int(payload: dict[str, object], field: str, errors: list[str]) -> int | None:
    value = payload.get(field)
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        errors.append(f"{field}: must be a positive integer when present")
        return None
    return value


def _required_nonnegative_int(payload: dict[str, object], field: str, errors: list[str]) -> int | None:
    value = payload.get(field)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        errors.append(f"{field}: must be a non-negative integer")
        return None
    return value


def _required_number(payload: dict[str, object], field: str, errors: list[str]) -> float | None:
    value = payload.get(field)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        errors.append(f"{field}: must be a number")
        return None
    return float(value)


def _required_sha256(payload: dict[str, object], field: str, errors: list[str]) -> str | None:
    value = _required_string(payload, field, errors)
    if value is not None and not SHA256_RE.match(value):
        errors.append(f"{field}: must be a 64-character lowercase sha256 hex digest")
    return value


def _required_nonempty_string_list(
    payload: dict[str, object],
    field: str,
    errors: list[str],
) -> list[str] | None:
    value = payload.get(field)
    if not isinstance(value, list):
        errors.append(f"{field}: must be a list")
        return None
    strings: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            errors.append(f"{field}[{index}]: must be a non-empty string")
            continue
        strings.append(item.strip())
    return strings


def _required_nested_string(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> str | None:
    value = payload.get(nested_field)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{field}.{nested_field}: must be a non-empty string")
        return None
    return value.strip()


def _optional_nested_string(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> str | None:
    value = payload.get(nested_field)
    if value is None:
        return None
    if not isinstance(value, str):
        errors.append(f"{field}.{nested_field}: must be a string when present")
        return None
    return value


def _required_nested_positive_int(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> int | None:
    value = payload.get(nested_field)
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        errors.append(f"{field}.{nested_field}: must be a positive integer")
        return None
    return value


def _optional_nested_positive_int(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> int | None:
    value = payload.get(nested_field)
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        errors.append(f"{field}.{nested_field}: must be a positive integer when present")
        return None
    return value


def _required_nested_nonnegative_int(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> int | None:
    value = payload.get(nested_field)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        errors.append(f"{field}.{nested_field}: must be a non-negative integer")
        return None
    return value


def _required_nested_number(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> float | None:
    value = payload.get(nested_field)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        errors.append(f"{field}.{nested_field}: must be a number")
        return None
    return float(value)


def _allow_none_nested_int(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> int | None:
    value = payload.get(nested_field)
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool):
        errors.append(f"{field}.{nested_field}: must be an integer or null")
        return None
    return value


def _required_nested_sha256(
    payload: dict[str, object],
    field: str,
    nested_field: str,
    errors: list[str],
) -> str | None:
    value = _required_nested_string(payload, field, nested_field, errors)
    if value is not None and not SHA256_RE.match(value):
        errors.append(f"{field}.{nested_field}: must be a 64-character lowercase sha256 hex digest")
    return value


def _sha256_text(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()
