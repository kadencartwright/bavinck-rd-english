# Calibration Report: vol2-god-personal-names-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-personal-names-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output path: data/calibration/runs/vol2-god-personal-names-001-baseline/outputs/translation.md
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **fail** — Missing glossary targets: PERSONEELE NAMEN GODS -> personal names of God
- `prose-quality`: **pass** — The English output is coherent and formal, successfully conveying complex theological arguments without flattening the source's structure, though minor literalisms exist.
- `review-flagging`: **pass** — Findings explicitly identify the preservation of Dutch orthography and grammatical literalism as quality issues requiring attention.

## Qualitative Findings

See `data/calibration/evals/vol2-god-personal-names-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
