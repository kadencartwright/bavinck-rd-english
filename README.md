# Bavinck `Reformed Dogmatics` in English

This repository exists to create a public domain English copy of Herman Bavinck's *Reformed Dogmatics* from the public domain Dutch text of *Gereformeerde Dogmatiek*.

The code and data here support that goal by:

- downloading and normalizing the Dutch source text
- carving the source into calibration slices
- running translation and review prompts against those slices
- preserving evaluation artifacts so the translation process can be improved and audited

## Purpose

The project is not a general translation sandbox. Its purpose is specific:

- produce a faithful English rendering of Bavinck's *Reformed Dogmatics*
- work from public domain Dutch source texts
- preserve scholarly traceability through manifests, prompts, and evaluation bundles
- move toward an English text that can be published as a public domain edition

## Current State

The repository is currently focused on pipeline calibration rather than final publication output.

At the moment, it contains tooling for:

- fetching Project Gutenberg source files for the four Dutch volumes
- extracting clean source text and metadata
- defining calibration slices and run manifests
- defining BAML-backed translation, repair, and review prompts under `baml_src/`
- executing translation and review runs with model-backed prompts
- storing commit-safe evaluation bundles under `data/calibration/evals/`

## Repository Layout

- `src/preprocessing/`: source download and ingestion utilities
- `src/calibration/`: slice construction, run execution, validation, and eval bundling
- `config/calibration/`: model profiles, schemas, and run manifests
- `data/raw/`: raw Project Gutenberg source files
- `data/clean/`: cleaned Dutch source text
- `data/metadata/`: extracted metadata for each source volume
- `data/calibration/`: slices, transient runs, and durable eval bundles
- `plan.md`: working architecture notes for the larger translation effort

## Basic Workflow

1. Download the Dutch source volumes into `data/raw/`.
2. Ingest them into cleaned text plus metadata under `data/clean/` and `data/metadata/`.
3. Build or refine calibration slices.
4. Run calibration manifests to test translation and review behavior.
5. Compare eval bundles and improve prompts, glossary decisions, and model configuration.

## Running Calibration

Provider keys are read from `.env`. Start from `.env.example`.

The calibration runtime now uses BAML-generated TypeScript clients for translation, repair, and review stages. Prompt source-of-truth lives in `baml_src/`; the prompt-bundle directory now carries bundle metadata only. Generated client code is built from `baml_src/`, and the repo scripts run `pnpm baml:generate` automatically before `build`, `test`, and `typecheck`.

Prompt-level BAML tests live beside the functions in `baml_src/calibration.baml`. Run them directly with:

```bash
pnpm baml:test
```

`pnpm test` now runs both `pnpm baml:test` and the Jest suite. The default BAML test client uses the Moonshot-compatible `MOONSHOT_API_KEY`, so prompt tests need that key present in `.env`.

The default runner entrypoint is:

```bash
./run-calibration
```

To target a specific manifest:

```bash
./run-calibration --run-manifest config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json
```

## Mining Glossary Candidates

The repository also includes a deterministic glossary candidate miner over cleaned source texts.

To mine one cleaned source volume with the default rules and thresholds:

```bash
pnpm glossary:candidates:mine -- --source-text data/clean/pg51052.txt
```

Artifacts are written under `data/calibration/glossary-candidates/<source_id>/`:

- `candidate-terms.json`: unique mined candidates with stable candidate ids, first-seen location, and observed surface forms
- `usage-locations.json`: one row for every emitted candidate occurrence with line, column, absolute offsets, and line excerpt
- `metadata-overview.json`: per-candidate frequency/spread summary for emitted candidates plus counts for retained and excluded candidates

Operator guidance for mining and glossary triage lives in [docs/glossary-candidate-mining.md](docs/glossary-candidate-mining.md).

## License

Code in this repository is licensed under the terms in [LICENSE](LICENSE).

The project goal is to publish the resulting English text as a public domain edition.
