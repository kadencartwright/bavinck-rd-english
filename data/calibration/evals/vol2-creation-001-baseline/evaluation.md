# Calibration Report: vol2-creation-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-creation-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output path: data/calibration/runs/vol2-creation-001-baseline/outputs/translation.md
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** — All required glossary targets were found in the translation output.
- `prose-quality`: **fail** — Untranslated Dutch terms 'Jonische School' and 'Urstof' disrupt the English prose and violate the requirement to translate source text not explicitly marked for preservation.
- `review-flagging`: **pass** — Findings clearly identify the untranslated source terms and the specific location of the prose issue.

## Qualitative Findings

See `data/calibration/evals/vol2-creation-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
