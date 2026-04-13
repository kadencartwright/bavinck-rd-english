## ADDED Requirements

### Requirement: Calibration runs SHALL surface actionable provider failure diagnostics
The system SHALL surface provider failures with enough context to distinguish transport errors, authentication problems, provider HTTP failures, and retry exhaustion.

#### Scenario: Network-layer failure during provider execution
- **WHEN** a provider request fails before receiving an HTTP response
- **THEN** the system reports the workflow stage, provider name, configured base URL, and the underlying fetch-layer error in CLI-visible output

#### Scenario: Provider HTTP failure
- **WHEN** a provider responds with a non-success HTTP status
- **THEN** the system reports the workflow stage, provider name, HTTP status, and response body excerpt in CLI-visible output

### Requirement: Calibration runs SHALL persist failure context before exit
The system SHALL write failure diagnostics to stable run artifacts before a run exits unsuccessfully after input loading has begun.

#### Scenario: Failed run after manifest validation
- **WHEN** a run fails after stable inputs have been snapshotted
- **THEN** the run directory includes a machine-readable failure artifact describing the failed stage and failure details

#### Scenario: Batch rerun inspection
- **WHEN** an operator inspects a failed batch run
- **THEN** the run logs and persisted failure artifact allow the operator to distinguish retryable provider failures from non-retryable configuration or workflow failures
