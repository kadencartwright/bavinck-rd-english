## Why

Calibration slices are currently carrying hand-authored glossaries, which will not scale to full-book slicing. We need a way to derive small, relevant slice glossaries from a canonical term inventory so prompts stay focused, token usage stays bounded, and terminology policy remains consistent across hundreds of slices.

## What Changes

- Add a canonical global glossary source for reusable theological terms, title-normalization entries, and other slice-projectable glossary data.
- Add glossary projection rules that generate each slice glossary from the global glossary by keeping only terms exercised in the slice excerpt.
- Support forced slice glossary entries for cases that must always be included, such as section-title terms or other explicitly configured requirements.
- Add deterministic generation tooling so slice glossaries can be regenerated rather than maintained manually.
- Preserve support for slice-local overrides so unusual section-specific terminology can still be declared when needed.

## Capabilities

### New Capabilities
- `generated-slice-glossaries`: Generate per-slice glossary inputs from a canonical glossary inventory using excerpt-aware pruning and explicit slice overrides.

### Modified Capabilities

## Impact

- New glossary source files under `data/calibration/`
- Slice-generation and calibration fixture tooling
- Manifest and glossary-loading workflow under `libs/calibration-config`
- Operator workflow for creating and maintaining full-book slice sets
