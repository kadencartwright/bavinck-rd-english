## ADDED Requirements

### Requirement: Calibration execution SHALL run through a NestJS application runtime
The system SHALL execute calibration workflows through a NestJS application that composes provider access, prompt loading, validation, orchestration, and artifact persistence as application services rather than a single script entrypoint.

#### Scenario: Running a calibration manifest from the application runtime
- **WHEN** an operator starts a calibration run for a valid run manifest
- **THEN** the system resolves the manifest, constructs the NestJS application context, and executes the run through application services

#### Scenario: Rejecting invalid runtime inputs
- **WHEN** an operator starts a calibration run with an invalid or incomplete manifest bundle
- **THEN** the NestJS application rejects the run before provider execution begins

### Requirement: The NestJS application SHALL preserve repo-backed calibration artifacts
The system SHALL continue to read prompt bundles, manifests, glossary inputs, and style inputs from repository paths and SHALL write calibration outputs and evaluations to stable repository locations.

#### Scenario: Reading stable inputs
- **WHEN** a calibration run starts
- **THEN** the application loads the selected prompt bundle, model profile, slice manifest, glossary, style guide, and rubric from repository-visible paths

#### Scenario: Writing stable outputs
- **WHEN** a calibration run completes or fails after partial execution
- **THEN** the application writes the run's transient and durable artifacts to stable repository paths that can be inspected later

### Requirement: The NestJS application SHALL support standalone execution
The system SHALL support standalone, non-HTTP execution so operators can run calibration workflows locally without requiring a web server to be running.

#### Scenario: Executing from a CLI entrypoint
- **WHEN** an operator invokes the calibration application from the command line
- **THEN** the system bootstraps the NestJS application context, runs the requested calibration workflow, and exits with a success or failure status
