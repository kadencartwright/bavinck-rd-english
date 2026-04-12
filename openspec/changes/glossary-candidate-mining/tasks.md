## 1. Mining Inputs And Schemas

- [ ] 1.1 Define mining configuration and output schemas for candidate terms, usage locations, and frequency/spread metadata
- [ ] 1.2 Decide and encode the initial deterministic candidate extraction rules and stable source-location model

## 2. Candidate Mining And Filtering

- [ ] 2.1 Implement deterministic candidate extraction over cleaned source text and emit the candidate-term artifact
- [ ] 2.2 Implement usage-location recording for every mined occurrence and emit the raw usage artifact
- [ ] 2.3 Implement frequency and spread summarization with configurable retain/exclude filtering in the metadata overview artifact

## 3. Verification And Operator Workflow

- [ ] 3.1 Add tests for deterministic reruns, usage-location completeness, and threshold-based retain/exclude behavior
- [ ] 3.2 Run the mining pipeline on at least one source text and inspect the three artifacts for shape and stability
- [ ] 3.3 Document how operators run mining and consume the term, usage, and metadata artifacts during glossary curation
