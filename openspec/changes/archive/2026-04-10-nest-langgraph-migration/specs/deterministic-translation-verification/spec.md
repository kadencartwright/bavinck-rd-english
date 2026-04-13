## ADDED Requirements

### Requirement: Translation verification SHALL emit structured deterministic defects
The system SHALL run deterministic translation verification against each draft and SHALL emit a structured defect payload that can be consumed by repair logic and evaluation reporting.

#### Scenario: Reporting hard defects
- **WHEN** verification detects preserved-language corruption, untranslated Dutch residue, glossary target misses, or output-shape violations
- **THEN** the system records each failure as a structured defect with a defect category and evidence

#### Scenario: Reporting a clean verification pass
- **WHEN** verification finds no hard defects in a translation draft
- **THEN** the system records a clean verification result that allows the workflow to continue without repair

### Requirement: Verification SHALL check exact preserved-language integrity
The system SHALL detect whether preserved Greek, Hebrew, Latin, or German spans were altered rather than merely omitted.

#### Scenario: Detecting preserved-span corruption
- **WHEN** a translation draft changes a preserved span by adding diacritics, normalizing spelling, or substituting nearby terms
- **THEN** the verification result marks the draft as failing preserved-language integrity and records the changed evidence

#### Scenario: Accepting exact preserved spans
- **WHEN** all preserved-language spans appear exactly as required in the translation draft
- **THEN** the verification result marks preserved-language integrity as passing

### Requirement: Verification SHALL be reusable across draft and repair rounds
The system SHALL apply the same deterministic verification rules to the initial draft and to each repaired draft so outcomes remain comparable across rounds.

#### Scenario: Re-verifying a repaired draft
- **WHEN** a repair node produces a new translation draft
- **THEN** the system reruns deterministic verification against the repaired draft before any further routing decision is made

#### Scenario: Comparing verification outcomes across rounds
- **WHEN** an operator inspects a run that required repair
- **THEN** the run artifacts show the verification outcomes and defect changes for each draft round
