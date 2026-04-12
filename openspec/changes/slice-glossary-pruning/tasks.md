## 1. Canonical Glossary Inputs

- [ ] 1.1 Add a canonical glossary source file and define the data needed for projection, forced inclusion, and stable output ordering
- [ ] 1.2 Define where slice-local forced entries and override terms live so slice generation remains deterministic

## 2. Projection And Generation

- [ ] 2.1 Implement excerpt-aware glossary projection that keeps only matched canonical terms plus forced and override entries
- [ ] 2.2 Add deterministic glossary file generation for slice `inputs/glossary.yaml` outputs

## 3. Validation And Adoption

- [ ] 3.1 Add tests for matching, pruning, forced inclusion, override merging, and stable regeneration
- [ ] 3.2 Regenerate existing slice glossaries through the new path and verify manifests still load cleanly
- [ ] 3.3 Update slice-creation operator guidance to use generated glossaries instead of hand-authored per-slice glossary files
