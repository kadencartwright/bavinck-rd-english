import path from "node:path";

import { Injectable, Logger } from "@nestjs/common";

import { ArtifactWriterService, EvalExportService } from "@artifact-store";
import { PathService } from "@calibration-config";
import { EvaluationReport, LintResult } from "@calibration-domain";

import { CalibrationRuntimeState } from "../graph/graph-state";

@Injectable()
export class FinalizeNode {
  private readonly logger = new Logger(FinalizeNode.name);

  constructor(
    private readonly artifactWriter: ArtifactWriterService,
    private readonly evalExportService: EvalExportService,
    private readonly pathService: PathService
  ) {}

  async finalizeReviewed(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (
      !state.runManifest ||
      !state.currentDraft ||
      !state.reviewPayload ||
      !state.runDirectories ||
      !state.promptBundlePath ||
      !state.modelProfilePath ||
      !state.sliceManifestPath ||
      !state.glossaryPath ||
      !state.styleGuidePath ||
      !state.rubricPath ||
      !state.translationPromptSystem ||
      !state.translationPromptUser ||
      !state.reviewPromptSystem ||
      !state.reviewPromptUser
    ) {
      throw new Error("Finalize reviewed node is missing required run artifacts.");
    }

    this.logger.log(`Finalizing reviewed run ${state.runId}`);
    const findingsMarkdown = this.evalExportService.renderFindingsMarkdown(state.reviewPayload);
    const report = this.buildEvaluationReport(state, "reviewed");
    await this.evalExportService.writeTransientEvaluationArtifacts(state.runDirectories, report, findingsMarkdown);
    const durableEvalDir = await this.evalExportService.exportDurableEvalBundle({
      evalRoot: state.evalRoot,
      runId: state.runId,
      runManifestPath: state.runManifestPath,
      sliceManifestPath: state.sliceManifestPath,
      promptBundlePath: state.promptBundlePath,
      modelProfilePath: state.modelProfilePath,
      glossaryPath: state.glossaryPath,
      styleGuidePath: state.styleGuidePath,
      rubricPath: state.rubricPath,
      translationOutput: state.currentDraft,
      translationPrompt: {
        system: state.translationPromptSystem,
        user: state.translationPromptUser
      },
      reviewPrompt: {
        system: state.reviewPromptSystem,
        user: state.reviewPromptUser
      },
      reviewPayload: state.reviewPayload,
      findingsMarkdown,
      evaluationReport: report,
      routingSummary: report.routing_summary,
      stageRecords: state.stageRecords
    });
    await this.artifactWriter.removeTransientPublishableArtifacts(state.runDirectories);
    this.logger.log(`Reviewed run ${state.runId} exported to ${durableEvalDir}`);
    return {
      terminalStatus: "reviewed",
      terminalReason: null,
      durableEvalDir
    };
  }

  async finalizeEscalated(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (
      !state.runManifest ||
      !state.currentDraft ||
      !state.runDirectories ||
      !state.promptBundlePath ||
      !state.modelProfilePath ||
      !state.sliceManifestPath ||
      !state.glossaryPath ||
      !state.styleGuidePath ||
      !state.rubricPath ||
      !state.translationPromptSystem ||
      !state.translationPromptUser
    ) {
      throw new Error("Finalize escalated node is missing required run artifacts.");
    }
    this.logger.warn(`Finalizing escalated run ${state.runId}`);
    const unresolvedDefects = state.lintResults.at(-1)?.hardDefects ?? [];
    await this.artifactWriter.writeUnresolvedDefects(state.runDirectories, unresolvedDefects);

    const report = this.buildEvaluationReport(state, "escalated");
    await this.evalExportService.writeTransientEvaluationArtifacts(state.runDirectories, report);
    const durableEvalDir = await this.evalExportService.exportDurableEvalBundle({
      evalRoot: state.evalRoot,
      runId: state.runId,
      runManifestPath: state.runManifestPath,
      sliceManifestPath: state.sliceManifestPath,
      promptBundlePath: state.promptBundlePath,
      modelProfilePath: state.modelProfilePath,
      glossaryPath: state.glossaryPath,
      styleGuidePath: state.styleGuidePath,
      rubricPath: state.rubricPath,
      translationOutput: state.currentDraft,
      translationPrompt: {
        system: state.translationPromptSystem,
        user: state.translationPromptUser
      },
      evaluationReport: report,
      unresolvedDefects,
      routingSummary: report.routing_summary,
      stageRecords: state.stageRecords
    });
    await this.artifactWriter.removeTransientPublishableArtifacts(state.runDirectories);
    this.logger.warn(
      `Escalated run ${state.runId} exported to ${durableEvalDir}; unresolved defects=${unresolvedDefects.length}`
    );
    return {
      terminalStatus: "escalated",
      terminalReason:
        unresolvedDefects.length > 0
          ? `Hard defects remained after ${state.repairRound} repair rounds.`
          : "Run escalated without a clean lint result.",
      durableEvalDir
    };
  }

  private buildEvaluationReport(
    state: CalibrationRuntimeState,
    terminalStatus: "reviewed" | "escalated"
  ): EvaluationReport {
    const latestLint = state.lintResults.at(-1) ?? this.emptyLintResult();
    const checks = [
      {
        id: "source-identity",
        status: state.sourceDrift ? ("fail" as const) : ("pass" as const),
        details: state.sourceDrift
          ? `Expected source SHA ${state.sliceManifest?.source_identity.clean_sha256}; current cleaned source SHA ${state.currentSourceSha}.`
          : "Current cleaned source matches the stored slice manifest identity."
      },
      {
        id: "rubric-present",
        status: state.rubricPath ? ("pass" as const) : ("incomplete" as const),
        details: `Rubric path: ${state.rubricPath ? this.pathService.relativeToRepo(state.rubricPath) : "missing"}`
      },
      {
        id: "translation-output",
        status: state.currentDraft?.trim() ? ("pass" as const) : ("incomplete" as const),
        details: "Translation output captured successfully for eval export."
      },
      {
        id: "preserved-language-integrity",
        status: latestLint.checks.preservedLanguageIntegrity,
        details:
          latestLint.hardDefects.filter((defect) => defect.code.startsWith("preserved_span")).length === 0
            ? "All Greek/Hebrew spans found in translation output."
            : `Preserved span issues: ${latestLint.hardDefects
                .filter((defect) => defect.code.startsWith("preserved_span"))
                .map((defect) => defect.sourceSpan ?? defect.message)
                .join(", ")}`
      },
      {
        id: "glossary-adherence",
        status: latestLint.checks.glossaryAdherence,
        details:
          latestLint.hardDefects.filter((defect) => defect.code === "glossary_target_missing").length === 0
            ? "All required glossary targets were found in the translation output."
            : `Missing glossary targets: ${latestLint.hardDefects
                .filter((defect) => defect.code === "glossary_target_missing")
                .map((defect) => defect.evidence.join(" -> "))
                .join("; ")}`
      },
      {
        id: "scripture-reference-normalization",
        status: latestLint.checks.scriptureReferenceNormalization,
        details:
          latestLint.hardDefects.filter((defect) => defect.code === "untranslated_dutch_scripture_reference").length === 0
            ? "Dutch Scripture references were normalized to standard English forms."
            : `Untranslated Dutch Scripture reference forms found in translation output: ${latestLint.hardDefects
                .filter((defect) => defect.code === "untranslated_dutch_scripture_reference")
                .map((defect) => defect.foundSpan ?? defect.message)
                .join(", ")}`
      },
      {
        id: "dutch-residue",
        status: latestLint.checks.dutchResidue,
        details:
          latestLint.hardDefects.filter((defect) => defect.code === "untranslated_dutch_abbreviation").length === 0
            ? "No tracked Dutch abbreviations or residue remained in the translated output."
            : `Dutch residue found: ${latestLint.hardDefects
                .filter((defect) => defect.code === "untranslated_dutch_abbreviation")
                .map((defect) => defect.foundSpan ?? defect.message)
                .join(", ")}`
      },
      {
        id: "output-shape",
        status: latestLint.checks.outputShape,
        details:
          latestLint.hardDefects.filter((defect) => defect.code === "output_shape_violation").length === 0
            ? "Translation output contains only the translated passage with preserved structure."
            : latestLint.hardDefects
                .filter((defect) => defect.code === "output_shape_violation")
                .map((defect) => defect.message)
                .join("; ")
      },
      {
        id: "prose-structure",
        status: latestLint.checks.proseStructure,
        details:
          latestLint.hardDefects.filter((defect) =>
            ["unbalanced_delimiter", "citation_shape_damage"].includes(defect.code)
          ).length === 0
            ? "No hard prose-structure defects were found in the translation output."
            : latestLint.hardDefects
                .filter((defect) => ["unbalanced_delimiter", "citation_shape_damage"].includes(defect.code))
                .map((defect) => defect.message)
                .join("; ")
      }
    ];

    if (terminalStatus === "reviewed" && state.reviewPayload) {
      for (const [checkId, payload] of Object.entries(state.reviewPayload.checks)) {
        checks.push({
          id: checkId,
          status: payload.status,
          details: payload.details
        });
      }
    }

    const summary = {
      pass: checks.filter((check) => check.status === "pass").length,
      fail: checks.filter((check) => check.status === "fail").length,
      incomplete: checks.filter((check) => check.status === "incomplete").length
    };

    return {
      schema_version: "1.0",
      run_id: state.runId,
      generated_at: new Date().toISOString(),
      slice_id: state.runManifest!.slice_id,
      prompt_bundle_id: state.runManifest!.prompt_bundle_id,
      model_profile_id: state.runManifest!.model_profile_id,
      checks,
      summary,
      artifacts: {
        translation_output_path: `data/calibration/evals/${state.runId}/translation.md`
      },
      qualitative_findings: {
        path:
          terminalStatus === "reviewed"
            ? `data/calibration/evals/${state.runId}/findings.md`
            : `data/calibration/evals/${state.runId}/unresolved-defects.json`,
        separate_from_checks: true
      },
      token_usage: this.evalExportService.summarizeTokenUsage(state.stageRecords),
      review_summary: terminalStatus === "reviewed" ? state.reviewPayload?.summary ?? "" : "",
      glossary_hits: [],
      glossary_misses: latestLint.hardDefects
        .filter((defect) => defect.code === "glossary_target_missing")
        .map((defect) => defect.evidence.join(" -> ")),
      routing_summary: {
        lint_detected: state.lintResults.flatMap((result) => [...result.hardDefects, ...result.softDefects]).map((defect) => defect.id),
        judge_detected: state.reviewFindingHistory.map((finding) => finding.id),
        auto_repair_task_ids: state.repairTaskHistory.map((task) => task.taskId),
        decisions: state.routingHistory.map((entry) => entry.decision),
        escalated: terminalStatus === "escalated"
      },
      terminal_status: terminalStatus
    };
  }

  private emptyLintResult(): LintResult {
    return {
      pass: true,
      hardDefects: [],
      softDefects: [],
      routingSummary: {
        autoRepair: 0,
        judgeReview: 0,
        logOnly: 0
      },
      checks: {
        preservedLanguageIntegrity: "pass",
        glossaryAdherence: "pass",
        scriptureReferenceNormalization: "pass",
        dutchResidue: "pass",
        outputShape: "pass",
        proseStructure: "pass"
      }
    };
  }
}
