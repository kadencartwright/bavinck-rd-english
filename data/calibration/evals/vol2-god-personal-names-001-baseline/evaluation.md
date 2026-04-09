# Calibration Report: vol2-god-personal-names-001-baseline

## Pass-Fail Checks

- `source-identity`: **pass** — Expected source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a; current cleaned source SHA 4f00d83d178a2892e0becc8fac5c8dc50305399b7740f678f07b91c94c884b0a.
- `rubric-present`: **pass** — Rubric path: data/calibration/slices/vol2-god-personal-names-001/inputs/rubric.yaml
- `translation-output`: **pass** — Translation output captured successfully for eval export.
- `preserved-language-integrity`: **fail** — Missing preserved spans: δοξα, ἐπιστημη, δημιουργος, παραδειγματα, αἰτιαι, λογος, σπερματικος, λογοι, σπερματικοι, ενδιαθετος, προφορικος, νους, αποιος, κοσμος, νοητος, δυναμεις, δευτερος, θεος, μεταθρονος, εικων, απαυγασμα, υἱος, κοινη, διαλεκτος, σαρξ
- `glossary-adherence`: **fail** — Missing glossary targets: PERSONEELE NAMEN GODS -> personal names of God
- `scripture-reference-normalization`: **fail** — Untranslated Dutch Scripture reference forms found in translation output: Joh. 6
- `prose-quality`: **pass** — The English reads as coherent formal theological prose, Dutch Scripture references are correctly converted to English forms (Spr. → Prov., Jes. → Isa., Richt. → Judg., etc.), and the argument structure is preserved without flattening.
- `review-flagging`: **pass** — The review findings call out preservation risks (Greek form change), potential reader confusion (verse numbering conventions), and unresolved quality issues (Dutch scholarly citations left untranslated).

## Qualitative Findings

See `data/calibration/evals/vol2-god-personal-names-001-baseline/findings.md` for reviewer commentary kept separate from the checks.
