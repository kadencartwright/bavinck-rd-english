# Calibration Report: vol2-creation-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** - Current cleaned source matches the stored slice manifest identity.
- `rubric-present`: **pass** - Rubric path: data/calibration/slices/vol2-creation-001/inputs/rubric.yaml
- `translation-output`: **pass** - Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** - All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** - All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** - Dutch Scripture references were normalized to standard English forms.
- `dutch-residue`: **pass** - No tracked Dutch abbreviations or residue remained in the translated output.
- `output-shape`: **pass** - Translation output contains only the translated passage with preserved structure.
- `prose-quality`: **fail** - Ungrammatical syntax in the Justin Martyr sentence and mistranslation of the idiom 'om strijd' compromise readability and accuracy.
- `review-flagging`: **pass** - Findings clearly identify the specific prose and semantic defects.

## Token Usage

- Totals: prompt=8066, completion=16222, total=24288, cached=0, uncached-prompt=8066, billable=24288, reasoning=7478
- Stage `translation`: prompt=3031, completion=8305, total=11336, cached=0, uncached-prompt=3031, billable=11336, reasoning=0
- Stage `review`: prompt=5035, completion=7917, total=12952, cached=0, uncached-prompt=5035, billable=12952, reasoning=7478

## Qualitative Findings

See `data/calibration/evals/vol2-creation-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
