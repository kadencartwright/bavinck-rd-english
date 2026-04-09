# Calibration CLI

This repository now runs calibration through a standalone NestJS application with LangGraph orchestration. The canonical inputs and outputs remain under `config/` and `data/calibration/`; no database or external checkpoint store is involved.

## Install

Use `pnpm` from the repository root:

```bash
pnpm install
```

Provider credentials are still read from environment variables or `.env`:

- `MOONSHOT_API_KEY`
- `ZAI_API_KEY`
- `MOONSHOT_BASE_URL` and `ZAI_BASE_URL` are optional overrides

## Run

The primary command surface is the Nest CLI application:

```bash
pnpm run calibration -- --run-manifest config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json
```

The legacy shell wrapper now forwards to the same NestJS runtime:

```bash
./run-calibration --run-manifest config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json
```

Supported flags:

- `--run-manifest <path>`
- `--output-root <path>`
- `--eval-root <path>`
- `--allow-source-drift`
- `--dotenv-path <path>`
- `--skip-provider-smoke-test`
- `--smoke-test-only`

For a cheap preflight against an existing fixture:

```bash
pnpm run calibration -- --skip-provider-smoke-test --smoke-test-only
```

## Architecture

The runtime is organized as a NestJS monorepo:

- `apps/calibration-cli`: standalone bootstrap and CLI command parsing
- `libs/calibration-domain`: Zod contracts for manifests, prompt metadata, review payloads, lint results, and graph state
- `libs/calibration-config`: repo path resolution, prompt rendering, dotenv loading, and manifest loading/validation
- `libs/provider-clients`: OpenAI-compatible Moonshot and Z-AI access with retry handling
- `libs/deterministic-lint`: preserved-span, Dutch residue, glossary, and output-shape checks
- `libs/artifact-store`: transient run artifacts and durable eval bundle export
- `libs/translation-workflow`: LangGraph state machine plus translation, repair, review, and finalize services

## LangGraph Flow

The v1 execution graph is fixed to:

```text
load_inputs -> translate -> lint
lint(pass) -> review -> finalize_reviewed
lint(fail && repairRound < maxRepairRounds) -> repair -> lint
lint(fail && repairRound >= maxRepairRounds) -> finalize_escalated
```

`config/` and `data/calibration/` remain the system of record. LangGraph state is in-memory for the current run only; inspectable artifacts are written to the repository-backed run and eval directories.

## Repair Semantics

- `repairRound` starts at `0`
- `maxRepairRounds` defaults to `2`
- only hard deterministic defects are sent to the repair prompt
- review does not run unless lint passes
- if hard defects remain after the final repair attempt, the run stops in `escalated` state and writes `unresolved-defects.json`

## Status

Python calibration files are retained for historical reference during the migration, but the primary and documented runtime is now the TypeScript/NestJS CLI described above.
