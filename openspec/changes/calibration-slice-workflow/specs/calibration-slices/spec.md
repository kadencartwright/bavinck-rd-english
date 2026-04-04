## ADDED Requirements

### Requirement: Calibration slice selection SHALL be section-based and traceable
The system SHALL define each calibration slice from a cleaned source text using semantic section boundaries and SHALL record the exact source file and line range used for the slice.

#### Scenario: Creating a calibration slice from a section
- **WHEN** an operator selects a section from a cleaned source text for calibration
- **THEN** the system records the slice with its source file, start line, end line, and section identifier or title

#### Scenario: Rejecting an untraceable slice
- **WHEN** a proposed calibration slice does not include a source file or source line range
- **THEN** the system rejects the slice definition as incomplete

### Requirement: Calibration slice manifests SHALL record selection rationale and stressors
Each calibration slice SHALL include a machine-readable manifest that captures why the excerpt was chosen and which translation stressors it is intended to exercise.

#### Scenario: Recording representative stressors
- **WHEN** a calibration slice is created
- **THEN** its manifest includes a rationale and an explicit list of stressors such as preserved-language spans, citations, footnotes, or dense theological prose

#### Scenario: Reusing a calibration slice definition
- **WHEN** a later pipeline run references an existing calibration slice
- **THEN** the system uses the manifest as the authoritative description of the slice instead of inferring its properties from filenames alone

### Requirement: Calibration slices SHALL produce stable fixture artifacts
The system SHALL materialize each calibration slice as a stable fixture that includes the excerpt text and the metadata required to reproduce later calibration runs.

#### Scenario: Writing fixture artifacts
- **WHEN** a calibration slice is finalized
- **THEN** the system writes the excerpt text and its manifest to stable paths that can be reused by later pipeline stages

#### Scenario: Detecting source drift
- **WHEN** a calibration slice is rerun against a cleaned source whose identity no longer matches the manifest
- **THEN** the system flags the slice for review before continuing
