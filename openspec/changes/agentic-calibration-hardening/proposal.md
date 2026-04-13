## Why

The current LangGraph calibration workflow is structurally in place, but the next round of work is blocked by three concrete gaps: repair is still configured inline instead of as a first-class stage, long slices can still fail by exhausting model output length, and provider transport failures collapse to a bare `fetch failed` message that is not actionable for operators.

We need to harden the calibration runtime now so the "agentic model" can be tuned through real reruns instead of stalling on opaque infrastructure failures and fragile stage configuration.

## What Changes

- Introduce a first-class repair stage with prompt assets and model-profile settings that can differ from the primary translation stage.
- Add actionable calibration-run observability for provider failures, retries, stage context, and partial artifact persistence.
- Add chunked calibration execution for long slices so translation can complete without relying on one monolithic model response.
- Update operator-facing documentation and run guidance to reflect the NestJS/LangGraph runtime, repair-stage configuration, and rerun workflow.

## Capabilities

### New Capabilities
- `repair-stage-configuration`: Configure repair as an explicit workflow stage with dedicated prompt assets and model settings.
- `calibration-run-observability`: Surface actionable failure diagnostics and preserve enough context to debug provider and workflow failures.
- `chunked-calibration-execution`: Execute long calibration slices through bounded chunking while preserving deterministic checks and stable eval artifacts.

### Modified Capabilities

None.

## Impact

Affected areas include the provider client, prompt-bundle and model-profile schemas, calibration workflow nodes and services, artifact export behavior, CLI logging, calibration manifests and prompt assets, and contributor-facing documentation in the repository.
