## ADDED Requirements

### Requirement: Slice glossaries SHALL be generated from a canonical glossary inventory
The system SHALL support generating each slice glossary from a canonical glossary inventory rather than requiring each slice glossary to be authored independently.

#### Scenario: Generating a slice glossary from canonical terms
- **WHEN** an operator generates inputs for a calibration slice
- **THEN** the system writes `inputs/glossary.yaml` for that slice using entries selected from the canonical glossary inventory

### Requirement: Slice glossary generation SHALL prune to excerpt-relevant terms
The system SHALL include a canonical glossary entry in a generated slice glossary only when the entry is relevant to the slice excerpt according to deterministic presence-based matching.

#### Scenario: Matching term is included
- **WHEN** a canonical glossary entry's source phrase is present in the slice excerpt
- **THEN** the generated slice glossary includes that entry

#### Scenario: Non-matching term is excluded
- **WHEN** a canonical glossary entry's source phrase is absent from the slice excerpt
- **THEN** the generated slice glossary omits that entry

### Requirement: Slice glossary generation SHALL support explicit forced entries and local overrides
The system SHALL support explicit inclusion of forced glossary entries and slice-local override terms in addition to excerpt-matched canonical terms.

#### Scenario: Forced entry survives pruning
- **WHEN** a slice configuration marks a glossary entry as forced
- **THEN** the generated slice glossary includes that entry even if excerpt matching alone would exclude it

#### Scenario: Slice-local override is merged
- **WHEN** a slice declares a local glossary override term
- **THEN** the generated slice glossary includes the override alongside canonical projected terms without duplicating the same source entry

### Requirement: Generated slice glossaries SHALL be deterministic and auditable
The system SHALL generate the same slice glossary content from the same canonical glossary, slice excerpt, and override inputs.

#### Scenario: Regeneration is stable
- **WHEN** an operator regenerates a slice glossary without changing the canonical glossary, excerpt, or overrides
- **THEN** the generated `inputs/glossary.yaml` content is byte-for-byte identical to the prior generated result
