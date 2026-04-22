# Calibration Report: vol2-god-incomprehensibility-quick-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** - Current cleaned source matches the stored slice manifest identity.
- `rubric-present`: **pass** - Rubric path: data/calibration/slices/vol2-god-incomprehensibility-quick-001/inputs/rubric.yaml
- `translation-output`: **pass** - Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** - All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** - All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** - Dutch Scripture references were normalized to standard English forms.
- `dutch-residue`: **pass** - No tracked Dutch abbreviations or residue remained in the translated output.
- `output-shape`: **pass** - Translation output contains only the translated passage with preserved structure.
- `prose-quality`: **fail** - The output fails to render the embedded German phrases correctly, producing the hybrid 'Theology der Thatsachen' instead of preserving the source span or translating it fully. Additionally, 'Immediately as soon as' is tautological prose.
- `review-flagging`: **pass** - Findings explicitly identify the preservation corruption and the prose quality issue.

## Token Usage

- Totals: prompt=2259, completion=3531, total=5790, cached=0, uncached-prompt=2259, billable=5790, reasoning=0
- Stage `translation`: prompt=0, completion=0, total=0, cached=0, uncached-prompt=0, billable=0, reasoning=0
- Stage `review`: prompt=2259, completion=3531, total=5790, cached=0, uncached-prompt=2259, billable=5790, reasoning=0

## Qualitative Findings

See `data/calibration/evals/vol2-god-incomprehensibility-quick-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
