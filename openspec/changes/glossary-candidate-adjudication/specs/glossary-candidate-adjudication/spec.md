## ADDED Requirements

### Requirement: The system SHALL build deterministic evidence packs for glossary candidate adjudication
The system SHALL transform retained glossary mining candidates into bounded evidence packs that contain the candidate facts needed for adjudication without requiring the judging layer to rescan the full source text.

#### Scenario: Evidence pack is built from mining artifacts
- **WHEN** an operator runs glossary candidate adjudication for a mined source text
- **THEN** the system writes an evidence pack for each adjudicated candidate that includes candidate identity, frequency and spread metadata, observed surface forms, and sampled usage context derived from the mining artifacts

### Requirement: The system SHALL evaluate each candidate against an explicit eight-criterion rubric
The system SHALL produce criterion-level adjudication results for each candidate using a rubric with exactly eight explicit criteria.

#### Scenario: Candidate receives criterion-level judgment
- **WHEN** a candidate is adjudicated
- **THEN** the system records eight criterion results for that candidate with pass or fail outcomes and supporting rationale

### Requirement: The system SHALL admit candidates only when all eight criteria pass
The system SHALL require a full `8/8` pass before a glossary candidate can be admitted automatically into the canonical glossary inventory.

#### Scenario: Candidate satisfies the full rubric
- **WHEN** a candidate receives passing results for all eight adjudication criteria
- **THEN** the system marks the candidate as admitted for canonical glossary inclusion

#### Scenario: Candidate misses one or more criteria
- **WHEN** a candidate fails any adjudication criterion
- **THEN** the system does not admit that candidate automatically into the canonical glossary inventory

### Requirement: The system SHALL persist adjudication artifacts for auditability
The system SHALL write durable adjudication outputs that preserve both the evidence used for judgment and the final decision state for every processed candidate.

#### Scenario: Candidate decision artifacts are written
- **WHEN** glossary candidate adjudication completes for a candidate
- **THEN** the system persists artifacts that capture the candidate's evidence pack, criterion results, final decision state, and adjudication configuration
