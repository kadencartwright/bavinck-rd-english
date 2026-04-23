## ADDED Requirements

### Requirement: Calibration workflows SHALL run deterministic prose lint before judge review
The system SHALL run deterministic prose and structure checks after draft generation and before judge review so cheap surface-form risks are detected without invoking an LLM.

#### Scenario: Mechanically damaged draft enters lint
- **WHEN** a translation draft contains detectable structure or surface-form issues such as broken paragraph preservation, duplicated text, malformed citation punctuation, or unmatched delimiters
- **THEN** the deterministic lint stage records those issues as structured findings before the draft can proceed to judge review

#### Scenario: Clean draft bypasses prose lint blocking
- **WHEN** a translation draft contains no hard deterministic prose findings
- **THEN** the workflow allows the draft to proceed to judge review without requiring prose-specific repair

### Requirement: Deterministic prose lint SHALL distinguish hard blockers from soft signals
The system SHALL classify deterministic prose lint findings as either hard defects that block forward progress or soft defects that inform later routing without blocking on their own.

#### Scenario: Hard prose defect blocks the run
- **WHEN** deterministic prose lint identifies a configured hard defect
- **THEN** the workflow routes the draft into repair before judge review

#### Scenario: Soft prose defect is preserved without blocking
- **WHEN** deterministic prose lint identifies a configured soft defect
- **THEN** the workflow persists the finding in lint artifacts and MAY include it in downstream routing context without treating the lint round as failed

### Requirement: Deterministic prose lint findings SHALL be routable artifacts
The system SHALL emit deterministic prose lint findings with stable identifiers and routing metadata so they can be consumed consistently by repair and routing stages.

#### Scenario: Inspecting a prose lint finding
- **WHEN** an operator or downstream handler reads a deterministic prose lint artifact
- **THEN** each finding includes a stable ID, category, severity, scope, evidence, and routing-oriented metadata sufficient to decide whether it is auto-repairable or requires judge review
