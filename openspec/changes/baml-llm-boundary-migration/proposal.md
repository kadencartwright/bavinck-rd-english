## Why

The calibration workflow currently owns prompt templating, OpenAI-compatible transport, response parsing, and malformed-review JSON repair in local TypeScript services. That makes prompt iteration slower, keeps structured review output fragile, and forces the repo to maintain low-level provider plumbing that BAML is designed to handle.

## What Changes

- Add a BAML source tree and generated TypeScript client for calibration-stage LLM calls.
- Migrate translation, review, and repair stage prompts into BAML functions with typed inputs and outputs.
- Replace direct use of the custom OpenAI-compatible chat client in workflow services with a BAML execution layer.
- Preserve runtime stage configurability by mapping existing model-profile settings into BAML runtime client selection instead of hard-coding providers in prompt definitions.
- Preserve commit-safe run and eval artifacts by collecting raw request, response, timing, and token-usage data from BAML execution.
- Remove the current review JSON repair path in favor of BAML-owned structured review parsing.

## Capabilities

### New Capabilities
- `baml-calibration-stages`: Execute translation, review, and repair stages through BAML functions with typed stage contracts and prompt-versioned assets.
- `baml-runtime-client-selection`: Resolve calibration model-profile settings into BAML runtime clients so provider, model, timeout, and temperature remain manifest-driven.
- `baml-run-observability`: Persist BAML-derived request, response, timing, and token-usage context in run and eval artifacts with parity to the current calibration audit surface.

### Modified Capabilities

## Impact

- `package.json` build, typecheck, and test workflows
- New `baml_src/` source files and generated `baml_client/` output
- Calibration execution services under `libs/translation-workflow`
- Provider integration under `libs/provider-clients`
- Prompt-bundle loading and prompt provenance handling under `libs/calibration-config`
- Calibration evaluation and run artifact generation paths
