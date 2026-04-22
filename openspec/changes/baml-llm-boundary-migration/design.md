## Context

The current calibration runtime splits LLM execution across three local concerns:

- prompt assembly from prompt-bundle text files
- direct OpenAI-compatible HTTP execution against Moonshot and Z.AI
- stage-specific response parsing and repair logic, especially for structured review output

That shape works, but it leaves the repo maintaining transport and parsing code that is orthogonal to the calibration workflow itself. The most brittle seam is review: the runtime asks for JSON, tries to parse arbitrary model text, and then makes a second model call to repair malformed JSON. The repo also depends on request/response metadata for commit-safe eval artifacts, so any migration has to preserve provenance and usage visibility rather than only changing prompt syntax.

The migration is cross-cutting because it touches config loading, stage execution services, run/eval artifact generation, build scripts, and test strategy. The goal is to replace the LLM boundary while keeping the Nest application, LangGraph orchestration, slice inputs, manifests, and deterministic lint workflow intact.

## Goals / Non-Goals

**Goals:**
- Move translation, review, and repair prompts into BAML functions with typed inputs and outputs.
- Keep calibration stage selection driven by existing model profiles and manifests rather than hard-coding a provider per function.
- Preserve or improve current run/eval auditability, including raw request/response context, token usage, and timing.
- Remove the bespoke review JSON extraction and repair flow by making structured review a first-class BAML return type.
- Integrate BAML generation into the repo build and test workflow in a way that fits the current Nest CommonJS setup.

**Non-Goals:**
- Replace Nest, LangGraph, or the overall calibration workflow graph.
- Rewrite deterministic lint or artifact-bundling behavior that does not depend on the LLM boundary.
- Migrate glossary mining or other non-LLM deterministic tools to BAML.
- Expand provider support beyond the current Moonshot and Z.AI-backed calibration profiles in this change.
- Rework the run-manifest domain model more than needed to express BAML-backed prompt provenance.

## Decisions

### Decision: Replace only the LLM boundary, not the workflow container

The migration will keep the current `load_inputs -> translate -> lint -> repair -> review -> finalize` workflow shape and only replace the stage execution layer beneath translation, repair, and review.

Rationale:
- The workflow graph is already separated cleanly from provider transport concerns.
- Keeping the existing orchestration limits migration risk and preserves current operator behavior.
- It narrows verification to stage parity, prompt provenance, and artifact output rather than forcing a second architectural rewrite.

Alternatives considered:
- Rewrite the full calibration runtime around BAML-only execution: unnecessary and higher risk.
- Keep the custom client and use BAML only for review: helpful, but leaves the prompt boundary split across two systems.

### Decision: Model profiles remain the runtime source of truth for provider and stage settings

Existing `model_profile` data will continue to define provider, model, timeout, temperature, and stage separation. The runtime will map those settings into BAML `ClientRegistry` clients at call time instead of encoding provider selection directly into the `.baml` functions.

Rationale:
- Calibration experiments already depend on manifest-driven stage configuration.
- Reusing model profiles avoids mixing experiment control with prompt definitions.
- BAML runtime client selection is designed for this exact case.

Alternatives considered:
- Hard-code one provider/model per BAML function: simpler initially, but breaks manifest-driven calibration.
- Replace model profiles with BAML client definitions as the primary config surface: possible later, but too large for this migration.

### Decision: BAML functions become the prompt source of truth, while prompt bundle identity remains for provenance

Prompt text will move into `baml_src/` as BAML functions and reusable template strings. The calibration runtime will keep `prompt_bundle_id` in manifests and eval records, but prompt-bundle loading will shift from reading `.txt` prompt files to resolving a BAML prompt variant/namespace associated with that bundle identity.

Rationale:
- BAML only pays off if prompt structure and output contracts live in the same system.
- Keeping `prompt_bundle_id` preserves the calibration experiment surface and existing eval comparisons.
- This avoids dragging legacy file-templating code forward just to imitate the current arrangement.

Alternatives considered:
- Preserve `.txt` prompt files and wrap only transport with BAML: weak migration with duplicated prompt systems.
- Eliminate prompt bundle identity entirely: simpler internals, but loses a useful calibration provenance label.

### Decision: Structured review uses a typed BAML return contract instead of manual JSON repair

The review stage will return a typed review payload directly from BAML. The runtime will validate the returned object against the existing domain schema but will no longer run a second model call to repair malformed JSON text.

Rationale:
- This addresses the most brittle part of the current implementation.
- It removes a noisy failure mode and reduces stage complexity.
- It keeps domain validation in place as a final guardrail.

Alternatives considered:
- Keep the JSON repair fallback after BAML migration: possible, but preserves a failure path BAML is supposed to eliminate.
- Trust BAML output without domain validation: too optimistic for calibration artifacts that need strong contracts.

### Decision: Use BAML collectors as the primary observability surface

Stage services will use BAML collectors to capture raw requests, raw responses, timing, retry history, and usage. A thin adapter will normalize collector data into the repo’s existing stage record and eval-record shapes.

Rationale:
- The repo needs stable eval artifacts and audit-friendly provider traces.
- Collectors provide the raw transport information without keeping the custom HTTP client in place.
- A local adapter preserves compatibility with current report generation.

Alternatives considered:
- Record only parsed BAML outputs: insufficient for calibration auditing.
- Keep the custom client in front of BAML to preserve current artifacts: defeats the boundary simplification goal.

### Decision: Generate CommonJS-compatible BAML client code and treat it as repo-managed build input

The repo will generate a TypeScript/CommonJS BAML client and wire generation into package scripts so `build`, `typecheck`, and tests do not depend on manual regeneration.

Rationale:
- The current Nest monorepo is CommonJS-oriented.
- Automatic generation avoids stale client code and missing build failures.
- Keeping generated output local makes the migration straightforward for the existing toolchain.

Alternatives considered:
- Generate ESM and adapt Nest imports: added friction for no clear benefit here.
- Require developers to run `baml-cli generate` manually: too easy to drift.

## Risks / Trade-offs

- [BAML collector data may not map one-to-one onto existing eval artifacts] → Mitigation: define an explicit normalization adapter and keep parity-focused tests for stage records and eval bundles.
- [Prompt bundle compatibility can become confusing if both legacy and BAML assets coexist too long] → Mitigation: make BAML prompts the sole runtime source of truth in this change and keep legacy bundle fields only as provenance metadata.
- [Translation streaming semantics may differ from the custom SSE parser] → Mitigation: verify translation streaming behavior with BAML streaming plus collector/on-tick hooks before removing the current stream-oriented expectations.
- [Generated client code adds build and test coupling] → Mitigation: add generation to repo scripts and CI-equivalent local commands so stale output fails fast.
- [Runtime client overrides could drift from model-profile validation rules] → Mitigation: keep existing model-profile schema validation and make the BAML client-registry mapper a thin translation layer, not a second config source.

## Migration Plan

1. Add BAML dependencies, source directories, generator configuration, and package scripts for generation.
2. Introduce BAML functions and shared types for translation, review, and repair along with runtime client-registry mapping for stage settings.
3. Replace workflow-stage service calls from the custom OpenAI-compatible client to the BAML client while preserving stage record generation through a collector adapter.
4. Update prompt-bundle handling so bundle identity remains available for provenance while BAML becomes the prompt source of truth.
5. Remove review JSON repair logic and retire obsolete provider-client code once stage parity and artifact parity tests pass.

## Open Questions

- Should prompt bundle metadata continue to live under `config/calibration/prompt-bundles/` as compatibility metadata, or should bundle identity move entirely into `baml_src/` after the migration lands?
- How much provider-specific usage detail, such as reasoning-token subfields, should be preserved if BAML collector summaries do not expose every current field directly?
- Should generated `baml_client/` output be committed to the repository or treated as build-generated local output only?
