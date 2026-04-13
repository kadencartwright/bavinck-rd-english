## Context

The repository now runs calibration through a NestJS + LangGraph workflow with explicit translation, lint, repair, review, and finalize nodes. That architecture is good enough to extend, but the next tuning loop exposed a practical problem: a batch rerun across the 10 baseline manifests failed before any translation artifacts were written. Each run validated the manifest bundle and then died with a raw `fetch failed` error in the provider path, which leaves the operator without provider name, URL, retry state, or request stage context.

The current repair path is also still transitional. Repair uses the translation stage model and an inline prompt string rather than repo-backed prompt files and a dedicated model profile stage. That is enough to prove routing in tests, but it is too implicit for repeated prompt tuning or for comparing repair behavior separately from first-pass translation.

Finally, at least one stored baseline run already shows `translation` ending with `finish_reason: "length"` on a large slice. That means the current one-shot translation shape is not robust enough to support longer calibration passages without chunk-aware execution.

## Goals / Non-Goals

**Goals:**
- Make repair a first-class configurable stage in the calibration workflow.
- Make provider and transport failures actionable in CLI output and persisted artifacts.
- Support chunked execution for longer calibration slices without losing deterministic linting and eval comparability.
- Update operator documentation so the current runtime and rerun workflow are accurately described.

**Non-Goals:**
- Build a generalized multi-agent runtime beyond the calibration workflow.
- Introduce a database, queue system, or hosted orchestration control plane.
- Redesign the review rubric or replace the current deterministic lint categories wholesale.
- Expand from calibration runs to full-volume translation orchestration in this change.

## Decisions

### Decision: Repair becomes an explicit configurable stage

The runtime will support a dedicated `repair` stage in model profiles and prompt bundles.

Rationale:
- Repair behavior should be tuned independently from initial translation behavior.
- Repo-backed prompt files keep repair experiments auditable and reproducible.
- The graph already models repair as a distinct node, so configuration should match runtime semantics.

Alternatives considered:
- Continue using the translation stage model and an inline repair prompt: simpler, but too opaque for repeatable tuning.
- Hard-require an entirely separate repair model for every profile: too rigid for the first hardening pass.

### Decision: Repair configuration remains backward compatible

Repair-stage prompt files and model settings will be supported explicitly, but the runtime will fall back to translation-stage settings when older bundles or profiles omit repair configuration.

Rationale:
- Existing manifests and prompt bundles should remain runnable during the migration.
- This lets us introduce `baseline-v2` without breaking historical artifacts.

Alternatives considered:
- Breaking schema change that requires repair settings everywhere immediately: cleaner long term, but unnecessary disruption now.

### Decision: Provider failures must be wrapped with stage-aware diagnostics

The provider client will wrap network and fetch-layer failures with provider name, base URL, stage, and retry attempt details, and the workflow will persist failure context before the process exits.

Rationale:
- `fetch failed` by itself is not operationally useful.
- The current batch rerun shows transport failure is now a first-order operational concern.
- Stage-aware failure records make reruns and retry policy easier to reason about.

Alternatives considered:
- Leave raw fetch errors alone and rely on shell logs: insufficient for operators.
- Add very verbose debug dumps for every request by default: noisy and risks leaking unnecessary request detail.

### Decision: Chunking is introduced as workflow-owned execution, not external preprocessing

Long calibration slices will be translated in bounded chunks selected from the already-materialized excerpt text, then recomposed for downstream linting and review.

Rationale:
- The failure mode is runtime output length, not slice-definition correctness.
- Keeping chunking in workflow execution preserves the existing slice manifests and avoids creating duplicate fixture definitions.
- This keeps chunk boundaries inspectable in run artifacts and lets later repair work target chunk-local failures if needed.

Alternatives considered:
- Split the existing calibration slices into smaller canonical fixtures: reduces runtime complexity, but loses the ability to evaluate longer section coherence.
- Raise token caps and keep one-shot execution: not reliable enough for large sections and provider variation.

### Decision: Chunking preserves final-run comparability through stable artifacts

The workflow will persist chunk-level outputs and compose a final translation artifact that remains the canonical input to lint, review, and durable evaluation export.

Rationale:
- Historical comparison still needs one final translation per run.
- Chunk-level artifacts are useful for diagnosis without changing the eval bundle contract.

Alternatives considered:
- Persist only chunk outputs: too awkward for comparison and review.
- Hide chunk outputs entirely: loses the main debugging value of chunked execution.

## Risks / Trade-offs

- [Backward-compatible repair configuration may leave two code paths alive temporarily] → Mitigation: keep fallback behavior narrow and document the migration target in the prompt-bundle and model-profile comments.
- [Chunking can introduce local coherence seams between chunks] → Mitigation: chunk on paragraph boundaries and include bounded neighboring context in the chunk translation prompt.
- [Better failure reporting can still miss root causes inside provider infrastructure] → Mitigation: capture provider name, base URL, retry attempt, and fetch-layer error text so operators can distinguish local misconfiguration from upstream outage.
- [More artifacts per run can create noise] → Mitigation: keep chunk artifacts in transient run directories while preserving a single canonical eval bundle output.

## Migration Plan

1. Extend config schemas and loaders to support explicit repair-stage settings and prompt files with compatibility fallbacks.
2. Update repair execution to use repo-backed prompt construction and stage-specific model settings.
3. Harden the provider client and workflow error path so failures persist actionable diagnostics.
4. Introduce chunk planning and chunk-aware translation assembly for long slices.
5. Add a new prompt bundle revision and rerun baseline manifests through the hardened workflow.
6. Update README and runner guidance after the runtime behavior is in place.

## Open Questions

- Should chunking be enabled automatically by excerpt size, or explicitly by run-manifest/config threshold?
- Do we want chunk-aware repair in the first implementation, or only whole-draft repair after chunk assembly?
- Should retry classification stay shell-driven in `run-calibration-batch`, or move into the application once provider diagnostics are richer?
