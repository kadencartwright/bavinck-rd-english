# Calibration Report: vol2-god-incomprehensibility-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-incomprehensibility-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output path: data/calibration/runs/vol2-god-incomprehensibility-001-baseline/outputs/translation.md
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **fail** — Missing glossary targets: dogmatiek -> dogmatics; kennisse Gods -> knowledge of God; Onbegrĳpelĳke -> the Incomprehensible; openbaring -> revelation
- `prose-quality`: **fail** — The seed run uses a source-mirroring placeholder translation to validate repository plumbing, so English prose quality is not yet acceptable.
- `review-flagging`: **pass** — Reviewer findings were captured in a separate narrative file for follow-up.

## Qualitative Findings

See `data/calibration/runs/vol2-god-incomprehensibility-001-baseline/review/findings.md` for reviewer commentary kept separate from the checks.
