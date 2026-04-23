## ADDED Requirements

### Requirement: Repairable issues SHALL be translated into structured repair tasks
The system SHALL convert repairable lint defects and review findings into structured repair task payloads before invoking repair handlers.

#### Scenario: Creating a repair task from a lint defect
- **WHEN** deterministic lint produces a repairable finding
- **THEN** the workflow creates a repair task that references the originating lint finding and preserves its category, scope, and evidence

#### Scenario: Creating a repair task from a review finding
- **WHEN** judge review produces a finding with a `repair` disposition
- **THEN** the workflow creates a repair task that references the originating review finding and includes any span hints or instruction text needed for remediation

### Requirement: Repair task payloads SHALL be bounded and auditable
The system SHALL define repair task payloads with stable task identifiers, origin references, scope metadata, and handler intent so repair behavior remains inspectable and reproducible.

#### Scenario: Inspecting a repair task
- **WHEN** an operator inspects a run that entered repair after lint or review
- **THEN** each repair task identifies its task ID, source finding IDs, origin stage, scope, and intended handler or remediation type

### Requirement: Review-derived repair SHALL trigger verification before acceptance
The system SHALL re-run verification steps after a review-derived repair before allowing a repaired draft to terminate as reviewed.

#### Scenario: Repair completes after review-driven routing
- **WHEN** a draft is repaired in response to structured review findings
- **THEN** the workflow re-runs deterministic lint and any configured follow-up review path before accepting the draft as reviewed
