# Bavinck Reformed Dogmatics — LLM Translation Architecture

## Project Goal

Produce a public domain English translation of Herman Bavinck's *Gereformeerde Dogmatiek* (4 volumes, ~3M words) from the public domain Dutch source, preserving interpolated Latin, Greek, Hebrew, and German in original form.

---

## Core Constraints

- **Source**: Plain text UTF-8, no formatting markup
- **Languages**: Dutch (translated), Latin/Greek/Hebrew/German (preserved)
- **Target**: English, formal theological register
- **Budget**: <$50 total compute cost
- **Quality**: Expert human review required; LLM pipeline aims for "first scholarly draft" standard

---

## Cost-Optimized Model Selection

Validated on Dutch theological prose samples. Tiered by task complexity:

| Task | Model | Pricing Mode | Rationale |
|------|-------|--------------|-----------|
| Structure detection, language tagging, editorial review, consistency checking | GLM-5 | Batch (50% discount) | Classification and pattern tasks; tested adequate |
| Primary translation | Kimi K2.5 | Batch | Tested winner for Dutch theological nuance and register |
| Fallback for flagged passages | Kimi K2.5 | Standard (immediate) | Uncertainty heuristics trigger re-translation |
| Reserved for edge cases | Claude Opus 4.6 | Standard | Not used in main pipeline; available for human-identified crises |

**Estimated total cost**: ~$7–15 for full 4-volume pipeline.

---

## Pipeline Stages

### Stage 1: Structure Detection
- **Input**: Raw plain text
- **Output**: Text with structural tags: `[chapter]`, `[section]`, `[footnote]`, `[blockquote]`, `[scripture]`
- **Chunking**: Semantic boundaries (paragraphs, subsections), not token limits
- **Model**: GLM-5 batch

### Stage 2: Language Tagging
- **Input**: Structured text
- **Output**: Text with language tags: `[nl]`, `[la]`, `[grc]`, `[heb]`, `[de]`
- **Detection methods**:
 - Unicode range: Hebrew (`\u0590–\u05FF`), Greek (`\u0370–\u03FF`)
 - LLM classification: Dutch/Latin/German discrimination
 - Heuristic: Known Latin theological phrases
- **Validation**: Automated regex check for Hebrew/Greek preservation
- **Model**: GLM-5 batch

### Stage 3: Translation
- **Input**: Tagged text, global context document, rolling chapter summary, adjacent chunks
- **Context payload**:
 - Book metadata (author, era, tradition)
 - Curated theological glossary (locked terms with approved mappings)
 - Style guide (formal register, archaism policy, gender language decisions)
 - Previous 1–2 translated chunks
 - Current chunk with non-Dutch spans marked `[preserve]`
- **Output**: English text with original Latin/Greek/Hebrew/German in place
- **Model**: Kimi K2.5 batch

### Stage 4: Editorial Review
- **Input**: Translated chunks
- **Checks**:
 - Naturalness in English theological prose
 - Consistency with glossary and style guide
 - Preservation verification (no hallucinated translations of preserved languages)
 - Flagging of doctrinal or terminological anomalies
- **Output**: Annotated translation with confidence scores and flagged passages
- **Model**: GLM-5 batch

### Stage 5: Consistency Checking
- **Automated checks** (no API cost):
 - Glossary term frequency and deviation detection
 - Scripture reference integrity (match to target-language canon)
 - Embedding similarity sampling for drift detection
 - Back-translation spot checks on random samples
- **Output**: Report of inconsistencies for human review

### Stage 6: Assembly and Export
- Reconstruct document hierarchy
- Re-insert footnotes and cross-references
- Export to EPUB, PDF, DOCX
- Generate auxiliary files: glossary, translator's preface, citation mapping notes

---

## Critical Glossary (Sample)

| Dutch | English | Notes |
|-------|---------|-------|
| genadeverbond | covenant of grace | |
| werkverbond | covenant of works | |
| rechtvaardigmaking | justification | Not "righteousness" |
| heiligmaking | sanctification | Distinguish from *heiligheid* |
| wedergeboorte | regeneration | |
| raad Gods | counsel of God / decree of God | Context-dependent |
| Schriftbewijs | scriptural proof / proof from Scripture | |
| gemene gratie | common grace | |
| organisch | organic | Bavinck's signature concept; do not modernize |
| zelfstandigheid | subsistence / independence / personality | Context-dependent; flag for review |

Full glossary maintained in `glossary.yaml` with decision rationale and attestation citations.

---

## Quality Safeguards

| Layer | Implementation |
|-------|----------------|
| Automated preservation check | Regex validation: all Hebrew/Greek/Latin/German spans in input must appear unchanged in output |
| Glossary enforcement | Post-hoc term frequency analysis; deviations flagged |
| Scripture integrity | Detect reference patterns, verify against target-language canon (e.g., ESV, KJV, or public domain equivalent) |
| Drift detection | Embedding similarity between source and back-translation on 5% random sample |
| Human review | Per-chapter review by Dutch-English theological reader; full volume review by domain expert |

---

## Operational Workflow

| Phase | Activity | Deliverable |
|-------|----------|-------------|
| 1. Calibration | 10–15 page subsection through full pipeline; human evaluation | Validated prompts, locked glossary, quality baseline |
| 2. Volume 1 (Prolegomena) | Full pipeline; community review draft | Published draft for feedback |
| 3. Volumes 2–4 | Stable pipeline execution | Draft translations |
| 4. Editorial polish | Human review integration, preface, apparatus | Final public domain texts |
| 5. Publication | Multi-format release, source archive | Git repository, Project Gutenberg, print-ready PDF |

---

## Risk Acknowledgments

- **Long-range coherence**: Argument threads spanning chapters may drift. Mitigated by rolling chapter summaries and human review.
- **Footnote density**: Bibliographic citations with minimal Dutch connective tissue. Strategy: translate connectives, preserve citations, optional future enrichment to modern English editions.
- **Terminological controversy**: Some Dutch terms lack consensus English equivalents. Strategy: document decisions transparently in glossary; prefer consistency over novelty.
- **Model availability**: Batch API pricing and availability subject to change. Strategy: pipeline model-agnostic; swap equivalents if pricing shifts.

---

## Repository Structure (Planned)

bavinck-translation/

├── src/

│   ├── preprocessing/

│   │   ├── structure_detect.py

│   │   └── language_tag.py

│   ├── translation/

│   │   ├── translate_chunk.py

│   │   └── context_manager.py

│   ├── postprocessing/

│   │   ├── consistency_check.py

│   │   └── assemble_output.py

│   └── shared/

│       ├── glossary.yaml

│       ├── style_guide.md

│       └── models.yaml

├── data/

│   ├── raw/                 # Source Dutch text

│   ├── tagged/              # Intermediate representations

│   ├── translated/          # English drafts

│   └── reviewed/            # Human-reviewed finals

├── prompts/

│   ├── structure_detection.txt

│   ├── language_tagging.txt

│   ├── translation.txt

│   └── editorial_review.txt

├── tests/

│   └── calibration/         # Evaluation samples and results

├── docs/

│   ├── glossary_decisions.md

│   └── translation_principles.md

└── outputs/

├── volume_01_prolegomena/

├── volume_02_god_and_creation/

├── volume_03_sin_and_salvation/

└── volume_04_holy_spirit_church_new_creation/


---

## License

Source code: MIT License

Translated text: Dedicated to the public domain (CC0 1.0 Universal)

---
