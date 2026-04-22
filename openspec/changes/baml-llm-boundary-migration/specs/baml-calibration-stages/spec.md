## ADDED Requirements

### Requirement: Calibration workflows SHALL execute LLM-backed stages through BAML functions
The system SHALL execute translation, review, and repair stages through BAML-generated functions rather than direct ad hoc chat-completion requests from workflow services.

#### Scenario: Clean run uses BAML translation and review
- **WHEN** a calibration run reaches translation and then passes deterministic lint without needing repair
- **THEN** the translation stage is executed through a BAML translation function and the review stage is executed through a BAML review function

#### Scenario: Repair path uses BAML repair
- **WHEN** deterministic lint detects hard defects and routes the workflow into repair
- **THEN** the repair stage is executed through a BAML repair function before the workflow returns to lint

### Requirement: Calibration prompt selection SHALL remain bundle-versioned under BAML
The system SHALL continue to associate each calibration run with a prompt bundle identity, and that identity SHALL resolve the BAML prompt variant used for translation, review, and repair.

#### Scenario: Manifest selects a prompt variant
- **WHEN** a run manifest references a prompt bundle identity for a calibration run
- **THEN** the runtime selects the corresponding BAML prompt variant and records that bundle identity in run and eval artifacts

### Requirement: Review output SHALL be produced as a structured BAML contract
The review stage SHALL return a structured payload from BAML that satisfies the calibration review schema without requiring a second model call to repair malformed JSON text.

#### Scenario: Review returns valid structured findings
- **WHEN** the review stage completes successfully
- **THEN** the workflow receives a structured review payload with summary, checks, findings, and recommended follow-up fields ready for domain validation

#### Scenario: Review contract cannot be satisfied
- **WHEN** the review stage cannot produce a payload that satisfies the structured BAML contract
- **THEN** the workflow fails the review stage directly instead of issuing a separate JSON-repair prompt
