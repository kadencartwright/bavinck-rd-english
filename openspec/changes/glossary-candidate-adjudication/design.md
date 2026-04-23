## Context

The current glossary miner is intentionally deterministic and recall-oriented. It extracts candidates, records usage locations, and applies coarse frequency and spread thresholds, but it explicitly does not decide which candidates should become canonical glossary entries. That leaves a missing workflow step between mining and `generated-slice-glossaries`: a candidate can be retained by mining and still be too generic, noisy, semantically unstable, or redundant to merit inclusion in the canonical glossary inventory.

The user wants a harder gate: candidates should advance only when they satisfy all eight adjudication criteria. That implies a new stage that is stricter than mining, model-assisted rather than purely heuristic, and auditable enough that rejected and admitted candidates can both be explained later.

## Goals / Non-Goals

**Goals:**
- Introduce a post-mining adjudication stage that evaluates retained candidates before canonical glossary admission.
- Define an explicit eight-criterion rubric and make `8/8` a hard requirement for automatic admission.
- Preserve auditable evidence for every judged candidate so decisions can be inspected without reparsing the source text.
- Use a narrow agent-oriented architecture that separates deterministic evidence collection from rubric judgment and final decision writing.

**Non-Goals:**
- Replace the existing deterministic mining pass or move semantic judgment into the miner itself.
- Redesign slice glossary projection behavior beyond consuming a better canonical inventory.
- Fully automate canonical English target creation, notes authoring, or final human editorial policy.
- Build a generalized multi-agent platform beyond the glossary adjudication workflow.

## Decisions

### Decision: Adjudication is a distinct stage after mining and before canonical glossary projection

The system will treat adjudication as a separate workflow that consumes mining artifacts rather than extending the miner to make semantic decisions inline.

Rationale:
- Mining remains deterministic, cheap, and stable across reruns.
- Adjudication can evolve independently without destabilizing artifact generation.
- This matches the existing division between candidate discovery and later glossary curation.

Alternatives considered:
- Add rubric judgment directly inside mining: simpler pipeline shape, but it blurs deterministic extraction and model-based decision making.
- Skip a formal adjudication stage and curate candidates manually: workable at small scale, but not aligned with the user's goal of agent-assisted judging.

### Decision: Automatic admission requires a full eight-criterion pass

The adjudication rubric will produce eight explicit criterion results per candidate, and the system will admit a candidate automatically only when all eight criteria pass.

Rationale:
- The user wants an intentionally strict canonical glossary gate.
- An all-pass rule is easy to audit and easy to reason about operationally.
- Hard gating prevents frequency-retained but semantically weak candidates from leaking into the canonical glossary.

Alternatives considered:
- Weighted scoring or threshold averages: more flexible, but less transparent and easier to game.
- Human review for every candidate: higher precision, but too slow for corpus-scale curation.

### Decision: Evidence packs are first-class artifacts

Before any model judgment, the system will build a deterministic evidence pack for each candidate from mining outputs and nearby glossary context.

Rationale:
- The judging layer needs a stable, bounded input format.
- Evidence packs make reruns auditable even if prompts or models later change.
- Operators can inspect candidate evidence without loading all raw usages for the source text.

Alternatives considered:
- Feed raw mining artifacts directly into the model: possible, but too noisy and token-expensive.
- Build evidence windows ad hoc at prompt time only: less durable and harder to compare across reruns.

### Decision: The judge architecture stays narrow and staged

The adjudication workflow will use a small staged graph rather than eight independent agents. A deterministic evidence builder prepares input, a rubric judge returns criterion-level results, and a final decision node resolves admission status and persistence.

Rationale:
- The core need is structured judgment, not unconstrained agent debate.
- A staged flow is easier to test and recover than many loosely coordinated workers.
- Criterion-level output still leaves room for later specialization if one rubric dimension proves especially noisy.

Alternatives considered:
- Eight separate criterion agents with a voting layer: expressive, but adds disagreement resolution complexity immediately.
- One monolithic prompt with no intermediate artifacts: simpler to implement, but weaker for auditability and failure diagnosis.

### Decision: Every candidate gets a persisted decision artifact, not only admitted ones

The workflow will write durable decision records for admitted, rejected, and unresolved candidates, including criterion outcomes and rationale.

Rationale:
- Canonical glossary curation needs traceable exclusion reasons, not just a positive inventory.
- Rejected or unresolved candidates are useful when revising criteria, prompts, or canonical coverage.
- This preserves the same auditability principle already used by mining artifacts.

Alternatives considered:
- Persist only admitted candidates: smaller output, but poor reviewability.
- Persist only aggregate summaries for rejected candidates: cheaper, but loses criterion-level traceability.

## Risks / Trade-offs

- [An `8/8` rule may reject worthwhile but borderline terms] → Mitigation: persist non-admitted decisions with criterion-level detail so the rubric can be tuned later without losing candidate history.
- [Model judgment may drift across prompt or model changes] → Mitigation: keep evidence-pack inputs deterministic and persist adjudication configuration with each decision artifact.
- [Evidence packs may still be too large for high-frequency candidates] → Mitigation: cap usage-window sampling deterministically while preserving summary counts and first/last-seen metadata.
- [A narrow staged graph may miss nuance that specialized judges could catch] → Mitigation: make criterion outputs explicit so later specialized nodes can be introduced without changing artifact contracts.

## Migration Plan

1. Define the adjudication rubric, evidence-pack schema, and decision artifact schema.
2. Build deterministic evidence-pack generation from candidate-term, usage-location, and metadata-overview artifacts.
3. Implement the staged adjudication workflow and the `8/8` admission gate.
4. Run adjudication on at least one mined source text and inspect admitted versus rejected outputs before wiring the canonical inventory into slice glossary generation.
5. Update operator guidance so canonical glossary curation runs as mining → adjudication → slice projection.

## Open Questions

- What are the exact eight criteria names and definitions we want to lock for the first pass?
- Should non-`8/8` outcomes be split into `rejected` and `needs_review`, or should every non-admitted candidate be treated uniformly at first?
- Does the first version need duplicate-merge judgment against an existing canonical glossary, or only standalone candidate admission?
