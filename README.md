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

The default runner entrypoint is:

```bash
./run-calibration
```

To target a specific manifest:

```bash
./run-calibration --run-manifest config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json
```

## License

Code in this repository is licensed under the terms in [LICENSE](LICENSE).

The project goal is to publish the resulting English text as a public domain edition.
