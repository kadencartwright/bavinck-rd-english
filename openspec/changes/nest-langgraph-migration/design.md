## Context

The repository currently executes calibration runs through a Python script pipeline with repo-backed inputs, OpenAI-compatible provider calls, and evaluation artifacts written to `data/calibration/`. That stack was useful for bootstrapping the workflow, but it hard-codes a two-stage `translation -> review` model and mixes orchestration, provider access, validation, and artifact persistence inside a small script surface.

The desired end state is a TypeScript-first application that fits the maintainer's strengths and makes future workflow changes easier to reason about. The main architectural shifts are:
- move the runtime into NestJS so workflow logic, provider clients, prompt loading, persistence, and linting become explicit application services
- represent calibration execution as a LangGraph state machine rather than a fixed script path
- promote deterministic verification into a first-class stage that can block or route translation repair before review
- preserve the repo-centered artifact contract so prompt bundles, manifests, translations, findings, and evaluations remain stable and comparable

This change is intentionally a big-bang migration. The goal is not to maintain a long-lived dual Python/TypeScript runtime, but to replace the Python implementation path with a NestJS + LangGraph application.

## Goals / Non-Goals

**Goals:**
- Rebuild calibration execution as a NestJS application with explicit module boundaries.
- Model calibration runs as a LangGraph state machine with deterministic routing.
- Add a bounded repair loop driven by deterministic lint defects before review.
- Preserve stable input and output artifacts in the repository so reruns remain comparable.
- Keep domain contracts typed and explicit so agent-assisted development in TypeScript stays ergonomic.

**Non-Goals:**
- Preserve runtime parity with every Python module or internal function name.
- Introduce a database or hosted control plane in the first migration.
- Solve full-volume translation architecture beyond the calibration workflow.
- Build a generalized multi-agent swarm framework for arbitrary tasks.

## Decisions

### Decision: NestJS becomes the primary application runtime

The new implementation will be organized as a NestJS application with standalone execution support for CLI-oriented workflows.

Rationale:
- The maintainer prefers TypeScript and wants a framework that encourages modular architecture and testable services.
- NestJS gives clear seams for provider clients, prompt loading, linting, orchestration, and artifact persistence without forcing the project into a web-first shape.
- A shared application container allows the same services to back CLI execution now and optional API or queue workers later.

Alternatives considered:
- Stay on Python and refine the existing script stack: lower migration cost, but it keeps the project in a language and structure the maintainer does not want to extend.
- Use plain TypeScript scripts without a framework: lighter, but less satisfying for long-term module structure and less aligned with the stated goal of using NestJS deliberately.

### Decision: LangGraph owns run orchestration

Calibration execution will be represented as a LangGraph graph with explicit nodes for translation, deterministic verification, repair, review, and failure or escalation outcomes.

Rationale:
- The workflow now needs conditional routing and bounded iteration, not just sequential stages.
- LangGraph makes state transitions explicit and inspectable, which matches the desired `translate -> lint -> repair -> relint -> review` loop.
- The graph abstraction leaves room for later operator interrupts or manual escalation without redesigning the runtime model.

Alternatives considered:
- OpenAI Agents SDK: attractive for lightweight agent primitives, but less explicit for state-machine-oriented orchestration.
- Custom in-house orchestration layer on top of Nest services: viable, but less fun and less aligned with the explicit choice to try LangGraph.

### Decision: Deterministic verification is a hard gate before review

The application will run code-based translation verification before the review stage and will use the resulting defect set to decide whether repair is required.

Rationale:
- Many recurring calibration failures are machine-detectable and should not depend on reviewer judgment.
- Deterministic checks are better than LLM review for exact preservation and residue detection.
- Hard-gating these failures before review keeps the reviewer focused on prose, meaning, and ambiguity instead of preventable mechanical errors.

Alternatives considered:
- Keep deterministic checks as post-hoc evaluation only: simpler, but it does not improve drafts before review.
- Let a review model detect and route everything: too noisy for exact preservation and reference normalization defects.

### Decision: Repair is bounded and defect-driven

When verification fails on hard defects, the system will run a repair step that receives the current draft and a structured defect payload, then re-run verification until the draft is clean or a configured round limit is reached.

Rationale:
- Bounded repair gives the workflow the same useful feedback loop coding agents get from tests without creating an open-ended agent system.
- Structured defects make the repair step local and auditable.
- A fixed round limit prevents the graph from turning into an opaque retry machine.

Alternatives considered:
- Full retranslation on every failure: easier to implement, but more likely to regress otherwise good parts of the draft.
- Unlimited repair retries: harder to reason about and poor for reproducibility.

### Decision: Repo-backed artifacts remain the system of record

The migration will keep run manifests, prompt bundles, model profiles, eval bundles, and review findings as repository-visible artifacts rather than hiding state inside framework-specific storage.

Rationale:
- The project already relies on versioned artifacts for comparison across runs.
- Repo-backed assets keep the workflow inspectable and easy to diff during prompt and pipeline tuning.
- This avoids coupling the migration to a database before the domain model settles.

Alternatives considered:
- Move all run state into a database immediately: more dynamic, but unnecessary complexity for the first migration.
- Store only LangGraph runtime state and reconstruct reports later: reduces visibility and weakens comparability.

## Risks / Trade-offs

- [Big-bang migration drops a working Python path before the TypeScript path has matured] → Mitigation: define artifact and behavior parity requirements up front and port the calibration runner end-to-end before deleting Python entrypoints.
- [LangGraph introduces a larger abstraction than the current workflow strictly needs] → Mitigation: keep the graph intentionally small and centered on calibration execution rather than modeling every future pipeline stage now.
- [NestJS can encourage over-engineering for a repo-centered batch workflow] → Mitigation: start with standalone application execution and file-system persistence, and defer HTTP APIs or queue infrastructure until they are needed.
- [Deterministic lint rules may initially underfit or overfit the translation failures] → Mitigation: make defect categories explicit and treat linting as an evolvable service with fixture-backed tests.
- [A bounded repair loop may still fail on semantically ambiguous passages] → Mitigation: add an explicit escalation outcome when hard defects persist or when a later review stage flags unresolved ambiguity.

## Migration Plan

1. Create a NestJS workspace that defines the new application shell, domain contracts, and service boundaries.
2. Port the current prompt, manifest, and eval artifact contracts into typed TypeScript models and validation utilities.
3. Port the provider client layer and prompt rendering into Nest services.
4. Implement the LangGraph calibration graph with translation, lint, repair, and review nodes.
5. Reproduce the current calibration artifact layout from the TypeScript runtime so historical comparison remains possible.
6. Validate the new runtime against the existing calibration fixtures and latest runs.
7. Remove or retire the Python runner once the NestJS path becomes the canonical execution route.

## Open Questions

- Should the first NestJS application expose only a CLI entrypoint, or should it also include an internal HTTP API from day one?
- Which validation library should define domain contracts in TypeScript: Zod, class-validator plus Nest DTOs, or both for different layers?
- Should unresolved hard defects terminate the run immediately after the repair limit, or continue into review with an explicit escalated status?
- How much run state should LangGraph persist between node executions versus recomputing from repo artifacts during local development?
