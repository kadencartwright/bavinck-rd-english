# Calibration Report: vol2-creation-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-creation-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** — All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — The rendering 'The Romans' for 'De Roomschen' creates confusion with ancient Romans; 'Urstof' is retained as a Dutch spelling of a German concept; syntax in the first paragraph is awkward.
- `review-flagging`: **fail** — The translation fails to flag the ambiguity in 'De Roomschen' and smooths over the term with a misleading translation, violating the requirement to flag ambiguous doctrinal phrasing.

## Qualitative Findings

See `data/calibration/evals/vol2-creation-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
