## ADDED Requirements

### Requirement: Calibration workflows SHALL support a first-class repair stage configuration
The system SHALL support repair as an explicit workflow stage with dedicated prompt assets and configurable model settings separate from the primary translation stage.

#### Scenario: Running repair with dedicated stage settings
- **WHEN** deterministic verification routes a draft into repair
- **THEN** the system loads repair-stage prompt content and repair-stage model settings if they are configured

#### Scenario: Falling back for older prompt bundles and model profiles
- **WHEN** a historical prompt bundle or model profile does not define explicit repair-stage configuration
- **THEN** the system falls back to the translation-stage configuration and records that fallback in run artifacts or logs

### Requirement: Repair requests SHALL remain auditable as repo-backed assets
The system SHALL record repair prompt provenance and request metadata in the same repo-visible style used for translation and review stages.

#### Scenario: Inspecting a repaired run
- **WHEN** an operator inspects a run that required repair
- **THEN** the run artifacts identify the repair prompt source and model settings used for each repair round
