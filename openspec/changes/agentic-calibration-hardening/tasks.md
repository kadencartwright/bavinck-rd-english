## 1. Repair Stage Configuration

- [ ] 1.1 Extend prompt-bundle and model-profile schemas to support explicit repair-stage configuration with backward-compatible fallbacks
- [ ] 1.2 Replace the inline repair prompt with repo-backed prompt construction and persist repair prompt provenance in artifacts
- [ ] 1.3 Add focused tests for repair-stage fallback and explicit repair-stage configuration

## 2. Run Observability

- [ ] 2.1 Wrap provider fetch failures with stage-aware diagnostics including provider name, base URL, and retry context
- [ ] 2.2 Persist machine-readable failure artifacts for runs that fail after input loading begins
- [ ] 2.3 Update batch retry classification to use the richer failure surface where appropriate

## 3. Chunked Execution

- [ ] 3.1 Add chunk planning and assembly for long calibration slices using paragraph-boundary chunking
- [ ] 3.2 Route chunked translations through existing lint, repair, review, and eval export paths with canonical final artifacts
- [ ] 3.3 Add integration coverage for chunked runs and length-exhaustion regression cases

## 4. Prompt, Eval, And Docs Refresh

- [ ] 4.1 Add a new prompt-bundle revision for the hardened workflow and keep the baseline bundle runnable for historical comparison
- [ ] 4.2 Rerun the baseline manifests through the hardened workflow and refresh durable eval bundles
- [ ] 4.3 Update README and operator guidance to reflect the NestJS/LangGraph runtime, repair-stage configuration, and rerun commands
