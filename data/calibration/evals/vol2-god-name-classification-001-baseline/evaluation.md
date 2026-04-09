# Calibration Report: vol2-god-name-classification-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-name-classification-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **fail** — Missing glossary targets: INDEELING DER NAMEN GODS -> classification of the names of God
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — Multiple grammatical and stylistic defects: agreement errors, missing articles, unidiomatic constructions, and awkward word order.
- `review-flagging`: **pass** — Findings identify specific prose quality issues requiring correction.

## Qualitative Findings

See `data/calibration/evals/vol2-god-name-classification-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
