## Context

The current calibration graph runs deterministic lint before review, but the lint layer is still narrowly focused on preservation, glossary, residue, and output-shape checks. Judge review then produces a free-form `ReviewPayload` with findings and `recommended_follow_up`, but that output does not participate in graph routing and does not give downstream repair handlers enough structure to act safely without human interpretation.

This creates three problems. First, cheap prose and structural issues that could be caught with deterministic heuristics are pushed into an expensive review stage. Second, review findings are too loosely structured to support automated routing between repair, re-review, acceptance, and escalation. Third, repair still receives a mostly free-text defect context, which makes targeted remediation harder than it needs to be and increases the risk of regressions.

The proposed change extends the existing calibration architecture rather than replacing it. Deterministic lint remains the first hard gate, the judge remains responsible for semantic and doctrinal concerns, and the graph gains a routing layer that can automate the common case while reserving human review for low-confidence or high-risk outcomes.

## Goals / Non-Goals

**Goals:**
- Expand deterministic lint to cover cheap prose and structure checks that do not require semantic model judgment.
- Tighten lint and review payload schemas so findings are stable, auditable, and routable.
- Introduce an explicit routing decision after review that can accept, repair, re-review, or escalate without human intervention in the common case.
- Support bounded, span-scoped repair tasks derived from either lint or review findings.
- Preserve run artifacts that show issue provenance, routing decisions, and automated actions taken.

**Non-Goals:**
- Replace judge review with deterministic lint for meaning-level or doctrinal assessment.
- Build a general multi-agent planner outside the calibration workflow.
- Introduce a database or queue-backed orchestration system.
- Solve every prose-quality concern with hard failures; some prose heuristics will remain soft signals.

## Decisions

### Decision: Split quality assessment into deterministic surface checks and judge-only semantic checks

The runtime will distinguish between deterministic prose lint and judge review responsibilities. Deterministic lint will own structure, formatting, citation shape, repeated text, sentence-boundary damage, and other cheap surface-form checks. Judge review will focus on semantic faithfulness, doctrinal ambiguity, and residual prose concerns that cannot be assessed reliably by rules.

Rationale:
- Cheap issues should be caught before an LLM is invoked.
- The judge is most valuable on meaning-level questions, not mechanical cleanup.
- This keeps the review prompt narrower and makes routing decisions more reliable.

Alternatives considered:
- Continue using the judge for all prose concerns: simple, but too expensive and too ambiguous.
- Push all prose assessment into lint: cheaper, but not credible for semantic and doctrinal nuance.

### Decision: Unify lint and review around stable finding identifiers and routing metadata

Both lint defects and review findings will gain stable IDs and explicit routing fields such as category, scope, repairability, confidence, and disposition. The router will consume normalized records instead of reinterpreting free-text messages.

Rationale:
- Stable identifiers make repair, audit, and artifact comparison easier.
- Routing metadata prevents every downstream handler from implementing its own heuristics.
- Confidence and repairability provide a principled boundary between automation and escalation.

Alternatives considered:
- Keep free-form findings and let repair infer intent: lower migration cost, but too brittle.
- Create a separate router-only schema independent from lint and review outputs: cleaner separation, but duplicates payload concepts unnecessarily.

### Decision: Add an explicit post-review routing node to the graph

The graph will gain a routing step after review. That node will consume the structured review payload and decide whether to accept the draft, create repair tasks, request re-review after repair, or escalate the run.

Rationale:
- Today the graph terminates immediately after review, so review cannot influence outcomes.
- A dedicated routing node keeps decision logic inspectable and testable.
- This aligns with the earlier LangGraph intent that unresolved review-stage ambiguity can escalate explicitly.

Alternatives considered:
- Fold routing logic into the review node: fewer nodes, but blurs responsibilities.
- Route directly from finalize based on review output: works, but hides decision-making inside terminal logic.

### Decision: Repair handlers receive bounded task payloads instead of only defect lists

Repair will operate on structured task records that group one or more findings into a bounded unit of work with scope, span hints, disposition, and handler type. The repair stage may still consume lint defects directly for purely mechanical repair, but review-derived work will be translated into task records before repair is invoked.

Rationale:
- Bounded tasks reduce accidental rewrites of already-good text.
- Task grouping lets the router choose specialized repair handlers later without changing review semantics.
- The same artifact structure can support both mechanical and semantic repair tasks.

Alternatives considered:
- Continue passing raw findings directly to repair: simplest, but weak for targeted remediation.
- Require only span-level edits in the first iteration: safer, but too rigid for sentence- or paragraph-level issues.

### Decision: Deterministic prose lint uses hard and soft findings with explicit routing intent

New deterministic prose rules will be classified as either hard blockers or soft signals. Hard findings remain part of the pre-review gate. Soft findings will not block progression on their own, but they will be persisted, summarized, and optionally included in the review context or router decision.

Rationale:
- Not every surface anomaly warrants blocking a run.
- Soft findings let us add heuristics without turning the lint stage into a brittle false-positive machine.
- Routing intent gives the system a consistent way to decide whether a finding requires repair, judge review, or only logging.

Alternatives considered:
- Treat all new prose heuristics as hard failures: too risky for early adoption.
- Keep soft findings entirely out of routing: simpler, but loses their value as prioritization signals.

## Risks / Trade-offs

- [Deterministic prose lint can overfit to current slices and generate noisy false positives] → Mitigation: start with structure and citation rules first, classify heuristic prose checks as soft, and add fixture-backed tests before promoting any rule to hard severity.
- [Richer payload schemas increase migration cost across lint, review, repair, and artifact export] → Mitigation: add compatibility fallbacks where practical and roll out schema changes in a staged sequence.
- [Routing automation can still misclassify meaning-level issues as safe to repair automatically] → Mitigation: require confidence and repairability fields, default uncertain semantic findings to escalation, and keep repair rounds bounded.
- [More artifacts and IDs can make runs harder to inspect casually] → Mitigation: add a routing summary artifact that aggregates issue counts, task counts, and the terminal decision in one place.
- [Targeted repair tasks may still produce broader rewrites than intended] → Mitigation: include scope and span hints in task payloads and re-run lint plus review after review-derived repairs.

## Migration Plan

1. Extend calibration-domain schemas for lint defects, review findings, route decisions, and repair task payloads.
2. Add deterministic prose lint rules and persist their results in existing lint round artifacts.
3. Update judge prompt contracts and review normalization so the review payload emits structured findings with disposition metadata.
4. Add a post-review routing node plus any supporting services that convert findings into repair tasks or escalation decisions.
5. Update repair execution to accept structured tasks and preserve task provenance in run artifacts.
6. Export routing summaries and per-task artifacts in transient and durable eval bundles.
7. Tune thresholds and default escalation policy based on reruns across the calibration baseline set.

## Open Questions

- Which prose heuristics should ship as hard blockers in the first pass, versus soft findings only?
- Should soft lint findings always be included in the judge context, or only when they exceed a threshold?
- Do we want separate repair handlers in the first iteration, or one repair stage that consumes typed tasks?
- Should high-confidence review findings trigger automatic repair immediately, or require a second judge confirmation for some categories?
