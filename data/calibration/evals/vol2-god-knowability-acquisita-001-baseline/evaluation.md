# Calibration Report: vol2-god-knowability-acquisita-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** - Current cleaned source matches the stored slice manifest identity.
- `rubric-present`: **pass** - Rubric path: data/calibration/slices/vol2-god-knowability-acquisita-001/inputs/rubric.yaml
- `translation-output`: **pass** - Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** - All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** - All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** - Dutch Scripture references were normalized to standard English forms.
- `dutch-residue`: **pass** - No tracked Dutch abbreviations or residue remained in the translated output.
- `output-shape`: **pass** - Translation output contains only the translated passage with preserved structure.
- `prose-quality`: **pass** - Formal theological prose maintained throughout; Dutch Scripture references correctly translated to English forms; no untranslated Dutch book names or abbreviations remain.
- `review-flagging`: **pass** - Findings identify the Latin phrase modification and awkward phrasing; no doctrinal ambiguity or preservation risks detected.

## Token Usage

- Totals: prompt=11676, completion=17883, total=29559, cached=0, uncached-prompt=11676, billable=29559, reasoning=5337
- Stage `translation`: prompt=4681, completion=12143, total=16824, cached=0, uncached-prompt=4681, billable=16824, reasoning=0
- Stage `review`: prompt=6995, completion=5740, total=12735, cached=0, uncached-prompt=6995, billable=12735, reasoning=5337

## Qualitative Findings

See `data/calibration/evals/vol2-god-knowability-acquisita-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
