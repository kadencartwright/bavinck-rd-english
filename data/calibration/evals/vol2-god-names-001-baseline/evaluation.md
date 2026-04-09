# Calibration Report: vol2-god-names-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-names-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **pass** — All Greek/Hebrew spans found in translation output.
- `glossary-adherence`: **pass** — All required glossary targets were found in the translation output.
- `scripture-reference-normalization`: **fail** — Untranslated Dutch Scripture reference forms found in translation output: 1 K. 8:33, 2 K. 21:13
- `prose-quality`: **fail** — The output contains unnatural English phrasing derived from Dutch syntax, such as 'There is spoken of His face,' and fails to correctly translate the idiom 'er is geen... of...,' resulting in the confusing 'there is no human affection or it is also present in God.'
- `review-flagging`: **pass** — The review identifies and flags the specific prose defects, including the mistranslated idiom and the deviation in the preserved Latin span.

## Qualitative Findings

See `data/calibration/evals/vol2-god-names-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
