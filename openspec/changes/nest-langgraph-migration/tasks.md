## 1. NestJS Workspace

- [x] 1.1 Create the NestJS TypeScript workspace and package management setup for the calibration application
- [x] 1.2 Define the initial module layout for domain contracts, provider clients, prompt loading, artifact storage, workflow orchestration, and deterministic linting
- [x] 1.3 Add standalone application bootstrap and a CLI entrypoint for running calibration manifests

## 2. Domain Contracts And Assets

- [x] 2.1 Port run manifests, prompt bundle metadata, model profiles, review payloads, and evaluation records into typed TypeScript contracts and validators
- [x] 2.2 Port repository path resolution, prompt rendering, and artifact-writing helpers into shared TypeScript services
- [x] 2.3 Preserve compatibility with the existing repo-backed calibration asset layout under `config/` and `data/calibration/`

## 3. Provider And Workflow Runtime

- [x] 3.1 Port the OpenAI-compatible provider client layer into NestJS services for Moonshot and Z-AI
- [x] 3.2 Implement the LangGraph calibration workflow with translation, deterministic verification, repair, review, and terminal outcome nodes
- [x] 3.3 Add bounded repair-loop configuration and state tracking to the LangGraph run state

## 4. Deterministic Verification And Evaluation

- [x] 4.1 Implement deterministic verification for exact preserved-language integrity, untranslated Dutch residue, glossary target checks, and output-shape violations
- [x] 4.2 Emit structured defect payloads and per-round verification artifacts that can drive repair and final evaluation reporting
- [x] 4.3 Reproduce durable evaluation bundles and findings reports from the NestJS runtime in stable repository paths

## 5. Migration And Retirement

- [x] 5.1 Run the new NestJS workflow against the existing calibration fixtures and confirm artifact parity with the current calibration expectations
- [x] 5.2 Remove or retire the Python calibration runner as the primary execution path once the TypeScript workflow is validated
- [x] 5.3 Update contributor-facing documentation to describe the NestJS + LangGraph architecture and new run commands
