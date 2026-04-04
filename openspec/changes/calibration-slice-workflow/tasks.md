## 1. Calibration Fixture Setup

- [x] 1.1 Add a calibration fixture directory layout for excerpt text, manifests, rubric inputs, and evaluation reports
- [x] 1.2 Implement or extend a script that selects a section-based excerpt from cleaned source text and records source line ranges
- [x] 1.3 Write a machine-readable manifest format for calibration slices, including rationale, stressors, and source identity checks

## 2. Prompt And Model Configuration

- [x] 2.1 Add a project directory layout for versioned prompt bundles, model profiles, and calibration run manifests
- [x] 2.2 Define schemas or templates for prompt bundle metadata and normalized model profile files
- [x] 2.3 Ensure calibration runs reference prompt and model configuration by manifest instead of embedding them in workflow code

## 3. Evaluation Inputs

- [x] 3.1 Create excerpt-scoped glossary and style-guide templates for the first calibration slice
- [x] 3.2 Create a calibration rubric template that defines acceptance criteria for preservation, glossary adherence, prose quality, and flagging
- [x] 3.3 Choose and record the first canonical calibration slice from the cleaned Bavinck volume 2 source

## 4. Calibration Run Outputs

- [x] 4.1 Define stable output paths for translation inputs, generated outputs, and review findings for a calibration run
- [x] 4.2 Implement report generation that separates pass-fail checks from qualitative reviewer findings
- [x] 4.3 Add source-drift validation so reruns flag mismatches between the current cleaned source and the stored manifest

## 5. Verification

- [x] 5.1 Run the fixture-generation workflow on the first selected slice and verify that excerpt text and manifest are written correctly
- [x] 5.2 Populate the initial glossary, style guide, rubric, prompt bundle, and model profile for the first calibration slice
- [x] 5.3 Execute one full calibration run and capture the resulting artifacts and findings for review
