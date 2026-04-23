## Why

Deterministic glossary mining is a good recall-oriented first pass, but it still leaves too many retained candidates to promote directly into a canonical glossary inventory. We need an explicit adjudication stage that judges mined candidates against a stricter rubric, so slice glossary generation inherits a smaller, more defensible term set.

## What Changes

- Add a glossary candidate adjudication workflow that consumes mined candidate artifacts and produces canonical glossary admission decisions.
- Define an explicit eight-criterion rubric for candidate judgment and require a full `8/8` pass before a candidate can be admitted automatically.
- Add durable evidence-pack and decision artifacts so each adjudication result is auditable and can be reviewed without rescanning the source corpus.
- Add an agent-oriented judging architecture that separates deterministic evidence gathering from model-based rubric evaluation and final decision persistence.

## Capabilities

### New Capabilities
- `glossary-candidate-adjudication`: Evaluate mined glossary candidates against an explicit rubric, persist adjudication evidence and decisions, and admit only candidates that satisfy all required criteria.

### Modified Capabilities

## Impact

- New adjudication artifacts under `data/calibration/` or an adjacent glossary curation output root
- New model-backed glossary curation workflow between mining and slice glossary projection
- New schemas, orchestration services, and operator guidance for canonical glossary inventory building
- Downstream slice glossary generation will consume a more strictly curated canonical inventory
