## Context

The repo needs a canonical glossary inventory before slice-level glossary pruning can work well at scale. That inventory should not be assembled by scanning full volumes with an LLM on every run; instead, we need a deterministic offline mining pass that extracts candidate terms, records where they occur, and summarizes how often and how broadly they appear.

The main constraints are compute cost and auditability. Candidate mining should be cheap enough to run over full cleaned source texts, deterministic enough to compare across reruns, and structured enough that later manual or model-assisted glossary triage can consume the outputs without reparsing the corpus.

## Goals / Non-Goals

**Goals:**
- Define a deterministic mining step for glossary candidates over source texts.
- Record every observed usage location for each candidate in a durable artifact.
- Produce a metadata artifact summarizing candidate frequency and spread across source text regions.
- Keep the mining pass cheap and reproducible so it can run over whole books or volumes.

**Non-Goals:**
- Decide which candidates become canonical glossary entries.
- Run semantic or LLM-based classification during the mining pass.
- Replace slice-level glossary projection or runtime glossary loading.
- Solve every normalization or title-policy issue in this change.

## Decisions

### Decision: Candidate mining is deterministic and text-local

The mining pass will operate directly over cleaned source texts with deterministic tokenization and candidate extraction rules.

Rationale:
- This keeps compute bounded and makes reruns comparable.
- It avoids mixing candidate discovery with later semantic judgment.
- It makes the mining artifacts suitable as stable inputs to downstream curation.

Alternatives considered:
- Use an LLM to extract glossary candidates directly from whole sections: more flexible, but too expensive and too hard to audit.
- Hand-curate candidates without mining artifacts: simple initially, but not scalable and not reproducible.

### Decision: Usage locations are first-class artifacts

The system will emit a usage-location artifact that records every observed occurrence of each candidate in the source text.

Rationale:
- Later triage depends on seeing whether a term is concentrated, diffuse, section-local, or corpus-wide.
- Frequency counts alone are not enough to validate whether a term is glossary-worthy.
- Explicit locations let downstream tools build context windows without rescanning the full corpus.

Alternatives considered:
- Keep only aggregate counts: cheaper, but insufficient for review and curation.
- Store only a few sample contexts: more compact, but incomplete and less auditable.

### Decision: Frequency and spread are summarized separately from raw usages

The mining pipeline will emit a metadata overview artifact that summarizes candidate-level counts and spread metrics independently of the raw usage-location artifact.

Rationale:
- Operators and later ranking logic need a compact summary without loading all usage rows.
- Separation keeps the raw usage artifact complete while making coarse filtering cheap.

Alternatives considered:
- Store summary fields only in the raw usage artifact: workable, but awkward for downstream consumption.
- Skip raw usages and keep only summary metrics: too lossy.

### Decision: Filtering is ranking-oriented, not destructive

Frequency and spread filtering will identify candidates that meet configured thresholds, but the pipeline should preserve enough information to inspect both retained and excluded candidates.

Rationale:
- Thresholds will evolve as we learn more about the corpus.
- Operators need to understand why a term was retained or excluded.

Alternatives considered:
- Hard-delete excluded candidates from all outputs: simpler, but loses auditability.
- Skip thresholding entirely: leaves too much noise for downstream curation.

## Risks / Trade-offs

- [Deterministic extraction rules miss useful terms] → Mitigation: keep rules inspectable, preserve excluded candidates, and allow later rule iteration.
- [Usage artifacts become large for full-volume runs] → Mitigation: keep the format append-friendly and separate raw usages from metadata summaries.
- [Spread metrics are misleading if source segmentation is weak] → Mitigation: anchor spread to explicit source locations and stable regions such as lines, sections, or configured buckets.
- [Thresholds may be overfit to one volume] → Mitigation: treat filtering as configurable and preserve auditable raw outputs.

## Migration Plan

1. Define candidate, usage, and metadata artifact schemas.
2. Implement deterministic candidate extraction and usage recording over cleaned source text.
3. Implement frequency and spread summarization with configurable thresholds.
4. Run the mining pass on at least one source text and inspect the artifacts before using them for canonical glossary curation.

## Open Questions

- What exact candidate units should be mined first: n-grams, title phrases, normalized noun phrases, or a combination?
- What spread metric is most useful for glossary triage: section count, line-range dispersion, or bucket coverage?
- Should excluded candidates be written to the same artifacts with flags, or to separate retained/rejected outputs?
