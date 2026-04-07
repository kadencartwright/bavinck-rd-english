# Calibration Report: vol2-god-essential-names-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-essential-names-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output path: data/calibration/runs/vol2-god-essential-names-001-baseline/outputs/translation.md
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **fail** — Missing glossary targets: WEZENSNAMEN GODS -> essential names of God
- `prose-quality`: **fail** — The output contains ungrammatical phrasing such as 'avoided of God' and 'on different manner', which disrupt coherence. Additionally, 'He is from nothing' introduces doctrinal confusion.
- `review-flagging`: **pass** — Findings clearly identify the preservation failures, grammatical errors, and doctrinal ambiguity.

## Qualitative Findings

See `data/calibration/evals/vol2-god-essential-names-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
