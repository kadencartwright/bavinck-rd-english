## ADDED Requirements

### Requirement: Prompt bundles SHALL be stored as versioned project assets
The system SHALL store prompt text and prompt metadata in stable, versioned files within the repository instead of embedding prompt bodies directly in workflow code.

#### Scenario: Selecting prompts for a run
- **WHEN** an operator prepares a calibration run
- **THEN** the system selects prompt files by repository path or prompt bundle identifier rather than by hard-coded script constants

#### Scenario: Updating prompt wording
- **WHEN** prompt wording changes for a future experiment
- **THEN** the updated prompt bundle can be added or revised without changing the calibration fixture structure or evaluation report format

### Requirement: Model profiles SHALL be swappable without changing fixture definitions
The system SHALL define model choice and provider-specific execution settings in structured model profile files that can be swapped independently of calibration slices and evaluation artifacts.

#### Scenario: Replacing a model profile
- **WHEN** a newer model becomes available for the same pipeline stage
- **THEN** an operator can point a run configuration at a different model profile without changing the slice manifest or rubric structure

#### Scenario: Supporting multiple providers
- **WHEN** the project evaluates models from different providers
- **THEN** the system stores their run settings through a normalized profile format that the workflow can reference consistently

### Requirement: Run manifests SHALL bind stable fixtures to variable execution inputs
The system SHALL define a run manifest format that references the selected slice, prompt bundle, model profiles, glossary inputs, and evaluation rubric for a specific calibration run.

#### Scenario: Reproducing a run
- **WHEN** an operator reruns a historical calibration experiment
- **THEN** the system can reconstruct the intended inputs from the stored run manifest

#### Scenario: Comparing two experiments
- **WHEN** two calibration runs use the same slice but different prompts or models
- **THEN** the system can compare the runs by their manifest references without duplicating the underlying fixture assets
