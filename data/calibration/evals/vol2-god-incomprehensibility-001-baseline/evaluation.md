# Calibration Report: vol2-god-incomprehensibility-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-incomprehensibility-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** — All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — Dutch word 'adaequaat' left untranslated; German words 'Thatsachen' and 'Rhetorik' embedded in Dutch prose should be translated; awkward English construction present.
- `review-flagging`: **pass** — Findings explicitly flag untranslated terms and prose quality issues requiring correction.

## Qualitative Findings

See `data/calibration/evals/vol2-god-incomprehensibility-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
