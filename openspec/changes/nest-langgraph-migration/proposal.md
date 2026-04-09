## Why

The current calibration pipeline is a compact Python script stack that proved the workflow, but it is no longer the architecture we want to keep extending. We want to rebuild the project as a TypeScript-first NestJS application with LangGraph orchestration so future work on translation, verification, repair loops, and operator tooling happens in a framework that better matches the maintainer's strengths and is more enjoyable to evolve.

## What Changes

- **BREAKING** Replace the Python calibration runner with a NestJS application as the primary runtime for calibration workflows.
- Introduce a NestJS module structure that separates prompt loading, provider clients, deterministic linting, artifact persistence, and workflow orchestration into explicit services.
- Introduce a LangGraph-based execution graph for calibration runs so translation, linting, repair, review, and escalation are modeled as explicit state transitions rather than a fixed script sequence.
- Add a deterministic translation verification stage that emits structured defects for preserved-language corruption, untranslated Dutch markers, glossary misses, and output-shape violations before review proceeds.
- Add a bounded repair loop that routes failing drafts back through targeted translation repair and re-verification before final review.
- Preserve the existing repo-centered artifact model so prompts, run manifests, eval bundles, and findings remain versioned and comparable across runs.

## Capabilities

### New Capabilities
- `nestjs-calibration-app`: A NestJS application runtime for executing calibration runs through CLI and application services.
- `langgraph-run-orchestration`: A LangGraph state machine that drives translation, deterministic verification, repair, and review for a calibration run.
- `deterministic-translation-verification`: Code-based linting that validates translation drafts and produces structured hard-failure defects for repair and evaluation.

### Modified Capabilities

None.

## Impact

Affected systems include the current Python runner and validation code under `src/calibration/`, project configuration assets for prompts and model profiles, the future TypeScript application and library structure, and the persisted calibration artifacts under `data/calibration/`. New dependencies will include NestJS and LangGraph for JavaScript/TypeScript, and the migration will establish Node/TypeScript as the primary implementation platform for the repository's calibration workflow.
