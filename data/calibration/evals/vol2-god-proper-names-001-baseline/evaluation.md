# Calibration Report: vol2-god-proper-names-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-proper-names-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **fail** — Missing preserved spans: אלי, אל, אלהים, אול, אלה, מים, שׁמים, קדשׁים, עשׂים, בראים, האדון, אדון, אדונים, כל, הארץ, שׁ, אשׁר, שׁדד, שׁדה, אשׁד, αιδιος, יהוה, אני, הוא
- `glossary-adherence`: **fail** — Missing glossary targets: EIGENNAMEN GODS -> proper names of God
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — Dutch bibliographic abbreviations (e.g., 'Wijs. Godsd.', 'G. v. I.') were left untranslated, and the opening sentence uses the awkward calque 'distinguish themselves' for 'zonderen zich af', flattening the argument structure.
- `review-flagging`: **pass** — Findings explicitly identify the preservation corruption, the drift in handling Dutch abbreviations, and the prose quality issue.

## Qualitative Findings

See `data/calibration/evals/vol2-god-proper-names-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
