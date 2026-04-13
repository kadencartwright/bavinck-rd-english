## ADDED Requirements

### Requirement: The system SHALL mine glossary candidates deterministically from source text
The system SHALL support deterministic candidate mining over cleaned source texts to produce a reusable set of glossary candidates without relying on model inference during the mining pass.

#### Scenario: Mining candidates from a source text
- **WHEN** an operator runs glossary candidate mining for a cleaned source text
- **THEN** the system emits a candidate-term artifact containing the mined candidate terms for that source text

### Requirement: The system SHALL emit a usage-location artifact for every mined candidate occurrence
The system SHALL record every observed occurrence of every mined candidate in a durable usage-location artifact.

#### Scenario: Candidate occurrence is recorded
- **WHEN** a mined candidate appears in one or more locations in the source text
- **THEN** the usage-location artifact contains one record for each observed occurrence with its source location

### Requirement: The system SHALL emit a frequency-and-spread metadata overview
The system SHALL emit a metadata overview artifact that summarizes per-candidate frequency and spread across the source text.

#### Scenario: Metadata overview includes aggregate measures
- **WHEN** glossary candidate mining completes for a source text
- **THEN** the metadata overview artifact contains per-candidate summary values for occurrence frequency and distribution across the source text

### Requirement: The system SHALL support configurable frequency and spread filtering
The system SHALL evaluate mined candidates against configurable frequency and spread thresholds so downstream glossary curation can rank or reduce the candidate set.

#### Scenario: Candidate meets configured thresholds
- **WHEN** a mined candidate satisfies the configured frequency and spread thresholds
- **THEN** the metadata overview marks that candidate as retained by the filter

#### Scenario: Candidate misses configured thresholds
- **WHEN** a mined candidate fails the configured frequency or spread thresholds
- **THEN** the metadata overview marks that candidate as excluded by the filter while preserving its mined artifact data for inspection

### Requirement: Mining outputs SHALL remain stable across identical reruns
The system SHALL regenerate identical mining artifacts when the same source text and mining configuration are used.

#### Scenario: Rerun produces stable artifacts
- **WHEN** glossary candidate mining is rerun with unchanged source text and unchanged mining configuration
- **THEN** the candidate-term artifact, usage-location artifact, and metadata overview artifact are byte-for-byte identical to the prior outputs
