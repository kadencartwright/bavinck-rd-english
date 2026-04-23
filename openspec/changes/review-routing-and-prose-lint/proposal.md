## Why

The current calibration workflow treats deterministic lint as a narrow mechanical gate and treats judge review as advisory output that does not drive the graph. That leaves too many cheap prose and structure problems for the judge to detect, increases model cost, and makes post-review remediation too ambiguous to automate confidently.

We need a tighter contract between lint, review, routing, and repair so that inexpensive deterministic checks catch as much surface-form risk as possible, while the judge focuses on residual semantic and doctrinal issues that truly need model judgment.

## What Changes

- Add a deterministic prose lint capability that checks structure, formatting, citation shape, sentence-level damage, repeated text, and other cheap surface-form risks before judge review.
- Add a review routing capability that converts judge findings into explicit machine-readable dispositions such as accept, repair, rejudge, or escalate.
- Add a structured repair task payload so repair handlers receive bounded, span-scoped work items instead of only free-text findings.
- Narrow judge review to semantic faithfulness, doctrinal ambiguity, and residual prose concerns that deterministic lint cannot assess reliably.
- Preserve run artifacts that show which issues were caught by lint, which were escalated to judge review, and which routing decisions were taken automatically.

## Capabilities

### New Capabilities
- `deterministic-prose-lint`: Run cheap deterministic prose and structure checks before judge review and emit routable defect records.
- `review-routing-contract`: Represent judge findings as structured routing decisions that can trigger automated repair, re-review, or escalation.
- `repair-task-payload`: Pass bounded, machine-readable repair tasks with stable finding identifiers, scope, and disposition metadata.

### Modified Capabilities

## Impact

Affected areas include `libs/deterministic-lint`, calibration domain schemas for lint and review payloads, LangGraph routing in `libs/translation-workflow`, repair and review service contracts, run artifact export, and prompt assets for judge review.
