## 1. Calibration Fixture Setup

- [ ] 1.1 Add a calibration fixture directory layout for excerpt text, manifests, rubric inputs, and evaluation reports
- [ ] 1.2 Implement or extend a script that selects a section-based excerpt from cleaned source text and records source line ranges
- [ ] 1.3 Write a machine-readable manifest format for calibration slices, including rationale, stressors, and source identity checks

## 2. Evaluation Inputs

- [ ] 2.1 Create excerpt-scoped glossary and style-guide templates for the first calibration slice
- [ ] 2.2 Create a calibration rubric template that defines acceptance criteria for preservation, glossary adherence, prose quality, and flagging
- [ ] 2.3 Choose and record the first canonical calibration slice from the cleaned Bavinck volume 2 source

## 3. Calibration Run Outputs

- [ ] 3.1 Define stable output paths for translation inputs, generated outputs, and review findings for a calibration run
- [ ] 3.2 Implement report generation that separates pass-fail checks from qualitative reviewer findings
- [ ] 3.3 Add source-drift validation so reruns flag mismatches between the current cleaned source and the stored manifest

## 4. Verification

- [ ] 4.1 Run the fixture-generation workflow on the first selected slice and verify that excerpt text and manifest are written correctly
- [ ] 4.2 Populate the initial glossary, style guide, and rubric for the first calibration slice
- [ ] 4.3 Execute one full calibration run and capture the resulting artifacts and findings for review
