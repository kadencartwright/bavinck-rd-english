# Calibration Report: vol2-god-incomprehensibility-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-incomprehensibility-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output path: data/calibration/runs/vol2-god-incomprehensibility-001-baseline/outputs/translation.md
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** — All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — A double negative error in paragraph 1 ('cannot be described and named by no name') inverts the source meaning, and Dutch-influenced syntax ('Insofar it is all mystery', 'Also Greek philosophy has') creates awkwardness.
- `review-flagging`: **pass** — Findings explicitly identify the doctrinal ambiguity caused by the prose error and flag specific syntactic issues relative to the style guide.

## Qualitative Findings

See `data/calibration/evals/vol2-god-incomprehensibility-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
