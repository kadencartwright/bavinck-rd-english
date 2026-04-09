# Calibration Report: vol2-god-knowability-insita-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-knowability-insita-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **fail** — Missing preserved spans: νους, ἀθεος, ἀντιθεος, κοιναι, ἐννοιαι, φυσικαι, ἐμφυτοι, προληψεις, δοξα
- `glossary-adherence`: **pass** — All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — Dutch book titles 'Afst. des menschen,' 'Afst. v. d. mensch,' and 'Proeve van de leer der aangeb. begrippen' remain untranslated, violating the style guide requirement to translate Dutch book names into standard English forms.
- `review-flagging`: **pass** — Findings explicitly identify preservation risks (Greek accent modifications), unresolved quality issues (inconsistent Dutch title translation), and prose quality concerns.

## Qualitative Findings

See `data/calibration/evals/vol2-god-knowability-insita-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
