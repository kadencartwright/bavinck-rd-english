# Glossary Candidate Mining

The glossary candidate miner builds a deterministic term inventory from a cleaned Dutch source text without calling a model. It is intended as the first pass before manual or model-assisted glossary curation.

## Command

Run the miner against a cleaned source file:

```bash
pnpm glossary:candidates:mine -- --source-text data/clean/pg51052.txt
```

Optional overrides:

```bash
pnpm glossary:candidates:mine -- \
  --source-text data/clean/pg51052.txt \
  --min-occurrences 3 \
  --min-bucket-count 2 \
  --bucket-line-span 50
```

The command infers `data/metadata/<source_id>.json` when it exists and writes outputs under `data/calibration/glossary-candidates/<source_id>/`.

## Artifact Set

Each run emits three durable JSON artifacts:

1. `candidate-terms.json`
Contains the unique mined candidates for the source text. Each candidate includes a stable `candidate_id`, the normalized term, token count, first-seen location, and the observed surface forms.

2. `usage-locations.json`
Contains one row per emitted candidate occurrence. By default, emitted candidates are the retained candidates only. Each row includes `candidate_id`, the occurrence index for that candidate, and a location record with:
- `line`: 1-based line number
- `column_start`: 1-based inclusive start column
- `column_end`: 1-based inclusive end column
- `absolute_start_offset`: 0-based UTF-16 start offset in the full source text
- `absolute_end_offset`: 0-based UTF-16 exclusive end offset in the full source text
- `bucket_index`: 1-based fixed-width bucket derived from `bucket_line_span`

3. `metadata-overview.json`
Contains the per-candidate summary used for triage: occurrence count, line count, bucket count, spread ratio, and `retained` / `exclusion_reasons`. By default, the `candidates` array includes retained candidates only, while `summary.excluded_count` reports how many candidates were filtered out.

All artifacts embed the mining configuration and source identity so identical reruns can be compared byte-for-byte.

## Initial Extraction Rules

The initial deterministic rule set is `dutch-ngram-core-v1`:

- tokenize alphabetic words plus internal apostrophes and hyphens
- mine contiguous unigrams and bigrams
- keep unigrams only when they are at least 8 characters and are not in the Dutch stopword set
- keep n-grams only when the first and last token are not stopwords and both boundary tokens are at least 4 characters
- skip obvious preserved non-Dutch spans using deterministic heuristics for Greek/Hebrew script, German orthography, and common Latin/German scholarly tokens
- emit retained candidates by default and report excluded counts in the metadata summary

The default filters are:

- `min_occurrences = 3`
- `min_bucket_count = 3`
- `bucket_line_span = 40`

## How To Use The Artifacts

Use the artifacts in this order during glossary curation:

1. Start with `metadata-overview.json`.
Sort or search by `retained`, `occurrence_count`, and `bucket_count` to identify candidates that recur and spread beyond one local passage.

2. Open `candidate-terms.json`.
Use `surface_forms` and `first_seen` to inspect the canonical spelling and early context for each candidate you are considering.

3. Open `usage-locations.json`.
Use the occurrence rows to confirm whether a term is concentrated, diffuse, title-like, or structurally noisy before promoting it into a curated glossary.

The current repository contains a sample mined run at `data/calibration/glossary-candidates/pg51052/`, generated from `data/clean/pg51052.txt`.
