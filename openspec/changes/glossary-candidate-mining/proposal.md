## Why

We need a scalable way to build the canonical glossary inventory before slice-level pruning can work well. Candidate mining should be deterministic, cheap enough to run over full volumes, and rich enough to produce auditable artifacts for downstream glossary triage.

## What Changes

- Add deterministic glossary candidate mining over source texts to extract reusable term candidates.
- Add frequency and spread filtering so mined candidates can be ranked and reduced before any manual or model-assisted triage.
- Emit three durable mining artifacts: a candidate term artifact, a usage-location artifact, and a metadata overview artifact summarizing frequency and spread.
- Define a stable artifact format so later glossary curation steps can consume the mining outputs without reparsing source text.

## Capabilities

### New Capabilities
- `glossary-candidate-artifacts`: Mine glossary candidates from source texts and emit durable artifacts for term inventory, usage locations, and frequency/spread metadata.

### Modified Capabilities

## Impact

- New offline mining tooling over `data/clean/`
- New artifact outputs under `data/calibration/` or adjacent mining output roots
- Future canonical glossary curation workflow
- Operator workflow for building a project-wide glossary inventory
