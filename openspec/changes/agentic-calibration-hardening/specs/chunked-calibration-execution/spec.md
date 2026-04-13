## ADDED Requirements

### Requirement: Calibration workflows SHALL support chunked execution for long slices
The system SHALL support translating a calibration slice through bounded chunking when a one-shot translation would exceed practical model output limits.

#### Scenario: Long slice routed through chunking
- **WHEN** a calibration slice exceeds the configured chunking threshold
- **THEN** the system divides the excerpt on stable paragraph boundaries and translates the resulting chunks in sequence

#### Scenario: Short slice bypasses chunking
- **WHEN** a calibration slice remains below the configured chunking threshold
- **THEN** the system executes the existing single-pass translation path without chunk planning

### Requirement: Chunked execution SHALL preserve canonical final-run artifacts
The system SHALL assemble chunk outputs into one canonical translation artifact for downstream deterministic verification, review, and durable evaluation export.

#### Scenario: Reviewing a chunked run
- **WHEN** a chunked translation run completes
- **THEN** the durable eval bundle contains one final translation output for comparison, while transient run artifacts retain chunk-level outputs for diagnosis

### Requirement: Chunk boundaries SHALL remain inspectable
The system SHALL preserve chunk planning metadata so operators can trace final output back to individual chunk executions.

#### Scenario: Investigating a coherence issue
- **WHEN** an operator inspects a suspicious section in a chunked run
- **THEN** the run artifacts identify the chunk boundaries and per-chunk outputs that contributed to the final assembled draft
