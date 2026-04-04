## ADDED Requirements

### Requirement: Calibration runs SHALL define explicit acceptance criteria
The system SHALL define a calibration rubric with explicit acceptance criteria for preservation accuracy, glossary adherence, prose quality, and review flagging before evaluating a calibration run.

#### Scenario: Preparing a calibration run
- **WHEN** an operator prepares a calibration run for a selected slice
- **THEN** the system provides or references a rubric that defines the acceptance criteria for that run

#### Scenario: Preventing undocumented evaluation
- **WHEN** a calibration run is evaluated without an associated rubric
- **THEN** the system marks the evaluation as incomplete

### Requirement: Calibration runs SHALL preserve reviewable intermediate and final artifacts
Each calibration run SHALL persist the inputs and outputs needed for later comparison, including excerpt-scoped glossary and style inputs, translation output, and review findings.

#### Scenario: Recording run artifacts
- **WHEN** a calibration run completes
- **THEN** the system stores the run's supporting inputs, generated outputs, and review findings in stable locations associated with the selected slice

#### Scenario: Comparing reruns
- **WHEN** the same calibration slice is rerun after prompt or pipeline changes
- **THEN** the system retains enough artifacts from each run to compare outcomes across runs

### Requirement: Calibration evaluation SHALL separate pass-fail checks from narrative findings
The system SHALL represent calibration evaluation as both explicit checks and reviewer-facing commentary so regressions can be compared without losing qualitative context.

#### Scenario: Reporting automated or normative checks
- **WHEN** a calibration run is reviewed
- **THEN** the evaluation report records whether required checks such as preserved-language integrity and glossary adherence passed or failed

#### Scenario: Reporting qualitative findings
- **WHEN** a reviewer identifies stylistic, doctrinal, or ambiguity concerns in a calibration run
- **THEN** the evaluation report records those concerns separately from the pass-fail checks
