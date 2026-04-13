## Context

Calibration slices currently store `inputs/glossary.yaml` as a hand-maintained file per slice. That is manageable for a small calibration set, but it becomes operationally expensive once slicing expands to whole books or whole volumes. The repo already has deterministic slice manifests, excerpt materialization, and run-manifest validation; glossary generation should match that same deterministic pattern rather than introducing more manual fixture editing.

The main constraint is that glossary inputs must remain small and relevant. A full canonical glossary should exist once, but each slice should only carry the entries that are actually exercised by the excerpt, plus any explicitly forced entries required by policy or section metadata.

## Goals / Non-Goals

**Goals:**
- Define a canonical glossary source that can be projected into slice-local glossaries.
- Make slice glossaries excerpt-aware so irrelevant entries are pruned automatically.
- Preserve deterministic generation so slice glossaries can be regenerated and audited.
- Support explicit forced entries and slice-local overrides for cases where simple excerpt matching is insufficient.

**Non-Goals:**
- Rebuild the entire slice-generation pipeline in this change.
- Replace the existing glossary schema used by the runtime.
- Solve every language-normalization rule through glossary entries alone.
- Introduce semantic or embedding-based glossary matching.

## Decisions

### Decision: Maintain one canonical glossary inventory and project it into slices

Slice glossaries will be generated from a canonical glossary file rather than authored independently.

Rationale:
- This keeps terminology policy centralized.
- It avoids drift between slices that exercise the same term.
- It reduces the cost of maintaining hundreds of slice inputs.

Alternatives considered:
- Continue hand-authoring each slice glossary: simple initially, but does not scale.
- Store full canonical glossary in every slice: easy to generate, but wastes tokens and adds prompt noise.

### Decision: Projection is presence-based against the excerpt text

Glossary projection will include entries only when the configured source phrase is present in the slice excerpt after deterministic normalization.

Rationale:
- Presence-based pruning is predictable and auditable.
- It matches the user's goal of keeping only relevant words per slice.
- It keeps implementation straightforward without introducing fuzzy matching ambiguity.

Alternatives considered:
- Fuzzy or semantic matching: more flexible, but harder to reason about and test.
- No pruning: simplest, but contradicts the prompt-size and relevance goal.

### Decision: Forced entries and slice overrides remain first-class

The generator will support two explicit escape hatches: forced inclusion and slice-local overrides.

Rationale:
- Some entries matter even when literal excerpt matching is weak, such as section-title terms or policy-driven title normalization.
- Some sections will have unusual terminology that should not be pushed into the global canonical glossary.

Alternatives considered:
- Rely only on excerpt matching: too brittle for titles and policy-driven inclusions.
- Rely only on manual overrides: returns to hand-maintained fixtures.

### Decision: Generated slice glossaries remain materialized files in slice inputs

The output of projection will still be written to `data/calibration/slices/<slice-id>/inputs/glossary.yaml`.

Rationale:
- This preserves compatibility with the current runtime and manifest validation path.
- Operators can inspect the exact glossary used by a run.
- Regeneration remains deterministic because generated files are commit-safe artifacts.

Alternatives considered:
- Generate glossaries only in memory at runtime: less fixture churn, but weaker auditability and less stable slice setup.

## Risks / Trade-offs

- [Literal matching misses terms because of orthographic variation] → Mitigation: define deterministic normalization rules and allow forced entries.
- [A canonical glossary becomes bloated over time] → Mitigation: keep slice projection strict and use slice-local overrides for narrow cases.
- [Generated files can drift if operators edit them manually] → Mitigation: treat generated glossaries as derived artifacts and document regeneration workflow.
- [Some policy rules do not fit cleanly into source/target glossary entries] → Mitigation: keep the design narrow and leave broader normalization policy in style-guide or deterministic lint inputs.

## Migration Plan

1. Introduce a canonical glossary inventory and generation rules.
2. Add a generator that projects slice glossaries from excerpt text plus forced entries and overrides.
3. Regenerate existing slice glossaries and verify they still validate through the current manifest loader.
4. Use the generated workflow for newly created full-book slices instead of hand-authored glossary files.

## Open Questions

- Should forced entries live in the slice manifest, a slice-local override file, or both?
- How much normalization should projection apply beyond exact phrase matching?
- Should generated glossary files be committed directly, or regenerated as part of a formal fixture-build command?
