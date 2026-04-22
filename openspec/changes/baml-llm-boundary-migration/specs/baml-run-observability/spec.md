## ADDED Requirements

### Requirement: Calibration runs SHALL persist BAML-backed stage provenance
The system SHALL persist stage-level provenance from BAML execution so operators can inspect which prompt bundle identity, client selection, and provider interaction produced each calibration artifact.

#### Scenario: Inspecting a completed run
- **WHEN** an operator inspects a completed calibration run
- **THEN** the run and eval artifacts identify the BAML-backed stage execution used for translation, repair if present, and review

### Requirement: Calibration runs SHALL record collector-derived usage and timing data
The system SHALL record token-usage and timing data derived from BAML collectors in the repo’s run and eval artifact surfaces.

#### Scenario: Completed review stage records usage
- **WHEN** a calibration run completes a review stage through BAML
- **THEN** the stage record and eval summary include the usage and timing data available from the associated BAML collector

#### Scenario: Repaired run aggregates multiple stage calls
- **WHEN** a calibration run requires one or more repair rounds
- **THEN** the persisted token-usage totals account for the BAML-backed translation, repair, and review calls used by that run

### Requirement: Calibration runs SHALL retain raw request-response inspection capability
The system SHALL retain a machine-readable way to inspect raw provider request and response context captured through BAML for debugging and audit purposes.

#### Scenario: Investigating a provider failure
- **WHEN** a BAML-backed provider call fails after request construction begins
- **THEN** the persisted diagnostics expose the raw request/response context available from the BAML collector or failure record so the operator can investigate the failure
