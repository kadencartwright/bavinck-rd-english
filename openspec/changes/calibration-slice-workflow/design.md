## Context

The repository currently contains a project-level plan, a downloaded Project Gutenberg source text for Bavinck volume 2, and an ingestion script that removes the Gutenberg wrapper while preserving the edition's internal editor notes. There is not yet a defined workflow for turning the cleaned source into a stable calibration fixture and evaluating a first end-to-end translation pass on that fixture.

This change sits across multiple parts of the future pipeline:
- preprocessing must select and package a representative excerpt
- shared inputs must define a localized glossary and style guide for the excerpt
- prompt and model configuration must be stored as replaceable project assets
- translation and review stages must write outputs in a repeatable layout
- evaluation must express whether the run is acceptable to expand beyond the sample

The calibration slice should stress the hardest parts of the pipeline early: formal theological prose, inline Greek and Hebrew, citations, and terminology that will later require glossary control.

## Goals / Non-Goals

**Goals:**
- Define a repeatable way to select a representative excerpt from cleaned source text.
- Define the required files and metadata for a calibration fixture.
- Define the required outputs and rubric for a calibration run.
- Make the first calibration run comparable across prompt and pipeline revisions.
- Keep prompts and model choice external to core workflow code so future model swaps do not require structural rewrites.

**Non-Goals:**
- Translating a full chapter or volume.
- Locking the project to a specific model provider or prompt wording.
- Designing publication/export formats such as EPUB, PDF, or DOCX.
- Solving long-range coherence beyond the calibration excerpt.

## Decisions

### Decision: Calibration slices use semantic section boundaries

The workflow will define slices by section-level source boundaries, not arbitrary token windows or line counts.

Rationale:
- The cleaned Gutenberg text does not expose stable page markers that are useful for automation.
- Section boundaries are more interpretable for human review and easier to compare across reruns.
- The selection process can still record source line ranges in the manifest for traceability.

Alternatives considered:
- Fixed-size line windows: easier to script, but likely to split arguments or citations midstream.
- Token-budget chunking: useful later for translation execution, but too implementation-specific for initial calibration selection.

### Decision: Each calibration slice has a manifest as the source of truth

Every selected excerpt will carry a machine-readable manifest that records title, source file, line range, rationale, observed stressors, and expected supporting inputs.

Rationale:
- The calibration fixture must remain stable while prompts and scripts evolve.
- Review findings need to point back to a single immutable selection definition.
- The manifest creates a contract between preprocessing, translation, and evaluation steps.

Alternatives considered:
- Deriving metadata from filenames only: too brittle and loses selection rationale.
- Embedding all metadata in prose documentation: harder to validate and automate.

### Decision: Calibration evaluation produces both normative checks and reviewer-facing findings

The evaluation workflow will require a small set of pass/fail checks alongside narrative findings.

Rationale:
- Purely narrative review makes regressions hard to compare across reruns.
- Purely binary checks miss the theological and stylistic nuance that motivated the calibration effort.
- A mixed format lets automation catch preservation failures while human review focuses on translation quality.

Alternatives considered:
- Human review only: high signal, but too inconsistent for iterative prompt tuning.
- Automated scoring only: insufficient for doctrinal and register-sensitive prose.

### Decision: Prompt bundles and model profiles are versioned project assets

Prompt text, model selection, and provider-specific settings will live in structured files referenced by a run manifest rather than being embedded directly in scripts.

Rationale:
- The user wants the repository to remain durable even as model options change over time.
- Stable fixture and evaluation layouts are only useful if the variable inputs can be swapped independently.
- Externalized configuration makes prompt and model experiments reproducible and easier to compare.

Alternatives considered:
- Hard-coding model IDs and prompts in scripts: fast initially, but guarantees churn as models change.
- Storing prompts in ad hoc notes outside the repo: lower implementation cost, but poor traceability and reproducibility.

### Decision: Calibration runs reference immutable input versions

Each calibration run will record which prompt bundle version, model profile, glossary input, and source fixture it used.

Rationale:
- Evaluation results are not comparable unless the exact variable inputs are known.
- This creates a stable distinction between durable assets and ephemeral run outputs.
- Future model upgrades can be assessed by changing a profile reference instead of redesigning the workflow.

Alternatives considered:
- Recording only the final model name in reports: insufficient because prompts and provider settings also affect outcomes.
- Recomputing inputs from current repo state: too fragile for long-term comparison.

### Decision: Initial calibration inputs stay local to the excerpt

The first glossary and style materials will be excerpt-scoped instead of attempting a project-wide canonical reference set.

Rationale:
- The highest-value unknown is whether a narrow, controlled run can succeed.
- Localized inputs reduce premature effort on terms that may not appear in the first sample.
- Excerpt-scoped artifacts can later seed broader shared references.

Alternatives considered:
- Building the full glossary before calibration: high upfront cost and likely rework.
- Running without any glossary/style inputs: cheaper initially, but weakens the value of the calibration result.

## Risks / Trade-offs

- [A selected excerpt may not represent later volumes or harder theological terminology] → Mitigation: require the manifest to record why the slice is representative and what stressors it contains.
- [Keeping glossary and style inputs local may create later migration work into shared references] → Mitigation: require stable fields and documented rationale so local inputs can be promoted into shared assets.
- [Evaluator subjectivity may still blur pass/fail decisions] → Mitigation: require explicit acceptance criteria and separate them from reviewer commentary.
- [Source line ranges may drift if the cleaned text is regenerated differently] → Mitigation: record source hashes alongside line ranges in fixture metadata.
- [Provider-specific features may leak into otherwise generic workflow code] → Mitigation: isolate provider settings in model profiles and keep execution code keyed to normalized run manifests.

## Migration Plan

No runtime migration is required. Implementation will introduce new calibration fixture files and reports alongside the current source assets. If the workflow changes later, existing manifests and reports should remain readable as historical calibration records.

## Open Questions

- Which exact section or contiguous set of sections should be the first canonical calibration slice?
- How much of the first-pass review must be human-authored versus model-assisted?
- Should the first acceptance rubric include quantitative thresholds beyond preservation and glossary adherence?
- What normalized schema should model profiles use so different providers can be swapped with minimal adapter logic?
