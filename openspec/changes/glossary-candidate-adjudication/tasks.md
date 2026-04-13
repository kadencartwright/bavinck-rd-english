## 1. Adjudication Contract

- [ ] 1.1 Define the eight adjudication criteria and add schemas for evidence-pack and decision artifacts
- [ ] 1.2 Define adjudication output locations, canonical-inventory admission fields, and configuration needed for reproducible reruns

## 2. Workflow And Decisioning

- [ ] 2.1 Implement deterministic evidence-pack generation from glossary mining artifacts and canonical glossary context
- [ ] 2.2 Implement the staged adjudication workflow for rubric judgment, criterion parsing, and final decision persistence
- [ ] 2.3 Enforce the hard `8/8` admission gate so only fully passing candidates enter the canonical glossary inventory automatically

## 3. Validation And Operator Flow

- [ ] 3.1 Add tests for evidence-pack composition, criterion-result handling, and `8/8` gate behavior
- [ ] 3.2 Run adjudication against a representative mined source text and inspect admitted and non-admitted outputs
- [ ] 3.3 Update glossary curation guidance to describe the new mining → adjudication → slice projection workflow
