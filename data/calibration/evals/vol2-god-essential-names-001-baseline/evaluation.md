# Calibration Report: vol2-god-essential-names-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-essential-names-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **fail** — Missing preserved spans: οὐκ, ἐνι, παραλλαγη, ἢ, τροπης, ἀποσκιασμα, πεπερασμενος, ὁρος, οἰκ, ἀπειρος, אֵין, טוֹף, ἀπειρον, ζων, και, μενων
- `glossary-adherence`: **fail** — Missing glossary targets: WEZENSNAMEN GODS -> essential names of God
- `scripture-reference-normalization`: **pass** — Dutch Scripture references were normalized to standard English forms.
- `prose-quality`: **fail** — Dutch text remains untranslated in multiple instances, including full sentences ('Aan alle redelĳk schepsel is het...'), phrases ('niet in negatieven maar in positieven zin'), and abbreviations ('enz.', 'bl.', 'bĳ'), failing the requirement for coherent English prose and standard English Scripture references.
- `review-flagging`: **pass** — Findings explicitly identify the preservation of Dutch text as a defect and flag the specific locations and nature of the untranslated material.

## Qualitative Findings

See `data/calibration/evals/vol2-god-essential-names-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
