## 1. Domain Contracts

- [ ] 1.1 Extend calibration-domain schemas for lint defects with stable IDs, routing metadata, confidence, and scope fields
- [ ] 1.2 Extend review payload schemas to require structured findings with disposition, repairability, and evidence fields
- [ ] 1.3 Add schemas and exported contracts for routing decisions and structured repair task payloads

## 2. Deterministic Prose Lint

- [ ] 2.1 Add deterministic prose lint rules for cheap structure and surface-form checks such as delimiter balance, repeated text, and citation-shape damage
- [ ] 2.2 Classify new prose lint rules as hard or soft findings and include them in lint summaries and persisted round artifacts
- [ ] 2.3 Add fixture-backed tests for the new deterministic prose lint rules and severity thresholds

## 3. Review Routing And Repair

- [ ] 3.1 Narrow judge review normalization to semantic and doctrinal findings and emit the structured routing contract
- [ ] 3.2 Add a post-review routing node and service that converts structured findings into accept, repair, re-review, or escalate decisions
- [ ] 3.3 Update repair execution to consume structured repair tasks with origin references, scope, and handler intent
- [ ] 3.4 Re-run deterministic lint and the configured follow-up review path after review-derived repair before final acceptance

## 4. Artifacts And Operator Visibility

- [ ] 4.1 Persist routing summaries and repair task artifacts alongside existing lint and review outputs
- [ ] 4.2 Export durable eval bundle metadata that shows which issues were lint-detected, judge-detected, auto-repaired, or escalated
- [ ] 4.3 Update prompt assets and operator documentation to reflect the narrower judge role and the new automated routing behavior
