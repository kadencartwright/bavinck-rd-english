## ADDED Requirements

### Requirement: Calibration stage settings SHALL resolve into BAML runtime clients
The system SHALL map stage-level model-profile settings into BAML runtime client selection so each calibration stage uses the configured provider, model, temperature, and timeout behavior for that run.

#### Scenario: Translation and review use different runtime clients
- **WHEN** a model profile configures different provider or model settings for translation and review
- **THEN** the runtime creates or selects distinct BAML clients so each stage uses its own configured settings

#### Scenario: Repair inherits the configured repair-stage settings
- **WHEN** repair runs for a calibration slice
- **THEN** the runtime resolves a BAML client using the repair-stage configuration or the defined fallback stage configuration for repair

### Requirement: Model-profile validation SHALL remain authoritative before BAML execution
The system SHALL continue to validate model-profile data before invoking BAML so invalid providers, disallowed temperatures, or malformed stage settings are rejected before any provider request is sent.

#### Scenario: Invalid stage configuration blocks execution
- **WHEN** a model profile fails schema validation for a stage setting
- **THEN** the calibration run stops before BAML stage execution begins

### Requirement: Provider credentials and endpoint overrides SHALL remain environment-driven
The system SHALL continue to source provider API keys and supported base URL overrides from the environment when resolving BAML runtime clients.

#### Scenario: Missing provider credentials
- **WHEN** a calibration stage resolves a BAML client for a provider without the required API key in the environment
- **THEN** the run fails with a stage-specific configuration error before sending the provider request

#### Scenario: Endpoint override is configured
- **WHEN** an operator sets a supported provider base URL override in the environment
- **THEN** the runtime applies that override when constructing the BAML client for the affected stage
