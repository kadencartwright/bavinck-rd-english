# Calibration Report: vol2-god-counsel-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-counsel-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** — All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — Dutch abbreviations 'd. i.' (dat is) and 'blz.' (bladzijde) were left untranslated instead of being converted to standard English forms 'i.e.' and 'p.'/'pp.', violating the requirement to translate Dutch abbreviations.
- `review-flagging`: **pass** — Findings explicitly identify the untranslated Dutch abbreviations and the inconsistency in rendering them.

## Qualitative Findings

See `data/calibration/evals/vol2-god-counsel-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
