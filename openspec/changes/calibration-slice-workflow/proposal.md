## Why

The repository has a project-level translation plan, but it does not yet define a repeatable calibration workflow for validating the pipeline on a representative excerpt before scaling to a full volume. We need that workflow now because the main risks are quality, preserved-language handling, and terminology consistency, not repository scaffolding.

## What Changes

- Add a repeatable calibration-slice workflow that selects a representative excerpt from the cleaned source text using section boundaries instead of arbitrary line counts.
- Define the metadata and manifest required to describe a calibration slice, including source location, selection rationale, and expected stressors such as Greek, Hebrew, citations, and dense theological prose.
- Define the artifacts required for a first-pass calibration run, including excerpt text, glossary/style inputs, evaluation rubric, translation outputs, and review findings.
- Define the acceptance criteria for a calibration run so later implementation can judge whether the pipeline is ready to expand beyond the sample excerpt.

## Capabilities

### New Capabilities
- `calibration-slices`: Create and manage representative calibration excerpts from the cleaned source text with stable manifests and selection criteria.
- `calibration-evaluation`: Record the rubric, outputs, and findings for a repeatable calibration run over a selected excerpt.

### Modified Capabilities

None.

## Impact

Affected systems include source ingestion outputs under `data/`, future preprocessing and translation scripts under `src/`, and the evaluation artifacts that will live alongside calibration fixtures and reports. This change establishes the contract for the first executable slice of the translation pipeline and will guide prompt files, glossary inputs, and review automation.
