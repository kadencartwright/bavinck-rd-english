# Calibration Report: vol2-god-name-classification-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-name-classification-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output path: data/calibration/runs/vol2-god-name-classification-001-baseline/outputs/translation.md
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **fail** — Missing glossary targets: INDEELING DER NAMEN GODS -> classification of the names of God
- `prose-quality`: **pass** — Formal theological prose maintained throughout; argument structure preserved. Minor syntactic awkwardness noted but does not flatten meaning.
- `review-flagging`: **pass** — Findings below identify specific prose quality issues for follow-up.

## Qualitative Findings

See `data/calibration/evals/vol2-god-name-classification-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
