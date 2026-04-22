## 1. BAML Scaffold And Build Integration

- [x] 1.1 Add BAML TypeScript dependencies, generator configuration, and repo scripts so client generation runs with build, typecheck, and test workflows
- [x] 1.2 Create the initial `baml_src/` layout with shared types, client definitions, and calibration-stage function files for translation, review, and repair

## 2. Prompt And Stage Migration

- [x] 2.1 Port the current translation, review, and repair prompts into BAML functions with typed inputs and outputs
- [x] 2.2 Replace prompt-bundle text rendering in the workflow services with BAML stage calls while preserving prompt bundle identity for run provenance
- [x] 2.3 Remove the bespoke review JSON parsing and JSON-repair call path once structured BAML review output is wired through domain validation

## 3. Runtime Client Selection And Configuration

- [x] 3.1 Implement a runtime mapper from calibration model-profile settings to BAML `ClientRegistry` clients for translation, repair, and review stages
- [x] 3.2 Preserve environment-driven provider credentials, supported base URL overrides, timeout handling, and stage-specific configuration errors through the BAML execution layer

## 4. Observability, Tests, And Cleanup

- [x] 4.1 Add a collector adapter that maps BAML request, response, timing, and usage data into the existing stage record and eval artifact surfaces
- [x] 4.2 Update integration and unit tests to cover BAML-backed clean runs, repair runs, structured review handling, and artifact parity expectations
- [x] 4.3 Remove obsolete custom provider-client code and update operator documentation or examples for the BAML-backed calibration workflow
