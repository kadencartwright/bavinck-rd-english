import path from "node:path";

import { Injectable } from "@nestjs/common";

import {
  CommitSafeEvalRecord,
  EvaluationReport,
  ReviewPayload,
  commitSafeEvalRecordSchema,
  evaluationReportSchema
} from "@calibration-domain";
import { PathService } from "@calibration-config";

import { ArtifactWriterService, RunDirectorySet } from "./artifact-writer.service";

interface StageRecordInput {
  provider: "moonshot" | "z-ai";
  model: string;
  temperature: number;
  promptFiles: Record<string, string>;
  finishReason?: string;
  maxTokens?: number;
  timeoutSeconds?: number;
  usage?: Record<string, number>;
}

interface ExportEvalBundleInput {
  evalRoot: string;
  runId: string;
  runManifestPath: string;
  sliceManifestPath: string;
  promptBundlePath: string;
  modelProfilePath: string;
  glossaryPath: string;
  styleGuidePath: string;
  rubricPath: string;
  translationOutput: string;
  translationPrompt: { system: string; user: string };
  reviewPrompt?: { system: string; user: string };
  reviewPayload?: ReviewPayload;
  evaluationReport: EvaluationReport;
  findingsMarkdown?: string;
  unresolvedDefects?: unknown;
  stageRecords: Record<string, StageRecordInput>;
}

@Injectable()
export class EvalExportService {
  constructor(
    private readonly pathService: PathService,
    private readonly artifactWriter: ArtifactWriterService
  ) {}

  renderFindingsMarkdown(reviewPayload: ReviewPayload): string {
    const lines = ["# Reviewer Findings", ""];
    if (reviewPayload.summary.trim()) {
      lines.push("## Summary", "", reviewPayload.summary.trim(), "");
    }
    if (reviewPayload.findings.length > 0) {
      lines.push("## Findings", "");
      for (const finding of reviewPayload.findings) {
        lines.push(`- [${finding.severity}] ${finding.category}: ${finding.detail}`);
      }
      lines.push("");
    }
    if (reviewPayload.recommended_follow_up.length > 0) {
      lines.push("## Recommended Follow-Up", "");
      for (const item of reviewPayload.recommended_follow_up) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }
    return `${lines.join("\n").trimEnd()}\n`;
  }

  renderEvaluationMarkdown(report: EvaluationReport): string {
    const lines = [`# Calibration Report: ${report.run_id}`, "", "## Pass-Fail Checks", ""];
    for (const check of report.checks) {
      lines.push(`- \`${check.id}\`: **${check.status}** - ${check.details}`);
    }
    lines.push("", "## Qualitative Findings", "");
    lines.push(`See \`${report.qualitative_findings.path}\` for reviewer commentary kept separate from the checks.`, "");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  async exportDurableEvalBundle(input: ExportEvalBundleInput): Promise<string> {
    const evalDir = this.pathService.resolveRepoPath(path.join(input.evalRoot, input.runId));
    const promptsDir = path.join(evalDir, "prompts");
    await this.pathService.ensureDir(promptsDir);

    await this.artifactWriter.writeText(path.join(evalDir, "translation.md"), `${input.translationOutput.trimEnd()}\n`);
    await this.artifactWriter.writeText(path.join(promptsDir, "translation-system.txt"), `${input.translationPrompt.system.trimEnd()}\n`);
    await this.artifactWriter.writeText(path.join(promptsDir, "translation-user.txt"), `${input.translationPrompt.user.trimEnd()}\n`);

    if (input.reviewPrompt) {
      await this.artifactWriter.writeText(path.join(promptsDir, "review-system.txt"), `${input.reviewPrompt.system.trimEnd()}\n`);
      await this.artifactWriter.writeText(path.join(promptsDir, "review-user.txt"), `${input.reviewPrompt.user.trimEnd()}\n`);
    }

    if (input.reviewPayload) {
      await this.artifactWriter.writeJson(path.join(evalDir, "review-structured.json"), input.reviewPayload);
      await this.artifactWriter.writeText(path.join(evalDir, "findings.md"), input.findingsMarkdown ?? this.renderFindingsMarkdown(input.reviewPayload));
    }

    if (input.unresolvedDefects !== undefined) {
      await this.artifactWriter.writeJson(path.join(evalDir, "unresolved-defects.json"), input.unresolvedDefects);
    }

    const safeReport = evaluationReportSchema.parse(this.buildSafeEvaluationReport(evalDir, input.evaluationReport));
    await this.artifactWriter.writeJson(path.join(evalDir, "evaluation.json"), safeReport);
    await this.artifactWriter.writeText(path.join(evalDir, "evaluation.md"), this.renderEvaluationMarkdown(safeReport));

    const evalRecord = commitSafeEvalRecordSchema.parse(
      await this.buildCommitSafeEvalRecord({
        input,
        evalDir
      })
    );
    await this.artifactWriter.writeJson(path.join(evalDir, "eval-record.json"), evalRecord);
    return evalDir;
  }

  async writeTransientEvaluationArtifacts(
    directories: RunDirectorySet,
    report: EvaluationReport,
    findingsMarkdown?: string
  ): Promise<void> {
    await this.artifactWriter.writeJson(path.join(directories.reportsDir, "evaluation.json"), report);
    await this.artifactWriter.writeText(path.join(directories.reportsDir, "evaluation.md"), this.renderEvaluationMarkdown(report));
    if (findingsMarkdown !== undefined) {
      await this.artifactWriter.writeText(path.join(directories.reviewDir, "findings.md"), findingsMarkdown);
    }
  }

  private buildSafeEvaluationReport(evalDir: string, report: EvaluationReport): EvaluationReport {
    const safeArtifacts: Record<string, string> = {
      translation_output_path: this.pathService.relativeToRepo(path.join(evalDir, "translation.md")),
      evaluation_markdown_path: this.pathService.relativeToRepo(path.join(evalDir, "evaluation.md")),
      evaluation_report_path: this.pathService.relativeToRepo(path.join(evalDir, "evaluation.json")),
      eval_record_path: this.pathService.relativeToRepo(path.join(evalDir, "eval-record.json"))
    };
    if (report.terminal_status === "reviewed") {
      safeArtifacts.review_structured_path = this.pathService.relativeToRepo(path.join(evalDir, "review-structured.json"));
      safeArtifacts.findings_path = this.pathService.relativeToRepo(path.join(evalDir, "findings.md"));
      safeArtifacts.translation_system_prompt_path = this.pathService.relativeToRepo(path.join(evalDir, "prompts/translation-system.txt"));
      safeArtifacts.translation_user_prompt_path = this.pathService.relativeToRepo(path.join(evalDir, "prompts/translation-user.txt"));
      safeArtifacts.review_system_prompt_path = this.pathService.relativeToRepo(path.join(evalDir, "prompts/review-system.txt"));
      safeArtifacts.review_user_prompt_path = this.pathService.relativeToRepo(path.join(evalDir, "prompts/review-user.txt"));
    } else {
      safeArtifacts.unresolved_defects_path = this.pathService.relativeToRepo(path.join(evalDir, "unresolved-defects.json"));
      safeArtifacts.translation_system_prompt_path = this.pathService.relativeToRepo(path.join(evalDir, "prompts/translation-system.txt"));
      safeArtifacts.translation_user_prompt_path = this.pathService.relativeToRepo(path.join(evalDir, "prompts/translation-user.txt"));
    }

    return {
      ...report,
      checks: report.checks.map((check) => ({
        ...check,
        details: this.sanitizeReportText(check.details, report.run_id, evalDir)
      })),
      artifacts: safeArtifacts,
      qualitative_findings: {
        path:
          report.terminal_status === "reviewed"
            ? this.pathService.relativeToRepo(path.join(evalDir, "findings.md"))
            : this.pathService.relativeToRepo(path.join(evalDir, "unresolved-defects.json")),
        separate_from_checks: true
      }
    };
  }

  private sanitizeReportText(text: string, runId: string, evalDir: string): string {
    return text
      .replaceAll(`data/calibration/runs/${runId}`, this.pathService.relativeToRepo(evalDir))
      .replaceAll(`${this.pathService.repoRoot}/`, "");
  }

  private async buildCommitSafeEvalRecord(args: { input: ExportEvalBundleInput; evalDir: string }): Promise<CommitSafeEvalRecord> {
    const { input, evalDir } = args;
    const hashes: Record<string, string> = {
      run_manifest_sha256: this.pathService.sha256Text(await this.pathService.readText(input.runManifestPath)),
      slice_manifest_sha256: this.pathService.sha256Text(await this.pathService.readText(input.sliceManifestPath)),
      prompt_bundle_metadata_sha256: this.pathService.sha256Text(
        await this.pathService.readText(path.join(input.promptBundlePath, "metadata.json"))
      ),
      model_profile_sha256: this.pathService.sha256Text(await this.pathService.readText(input.modelProfilePath)),
      glossary_sha256: this.pathService.sha256Text(await this.pathService.readText(input.glossaryPath)),
      style_guide_sha256: this.pathService.sha256Text(await this.pathService.readText(input.styleGuidePath)),
      rubric_sha256: this.pathService.sha256Text(await this.pathService.readText(input.rubricPath)),
      translation_output_sha256: this.pathService.sha256Text(input.translationOutput.trimEnd() + "\n"),
      evaluation_report_sha256: this.pathService.sha256Text(
        await this.pathService.readText(path.join(evalDir, "evaluation.json"))
      ),
      evaluation_markdown_sha256: this.pathService.sha256Text(
        await this.pathService.readText(path.join(evalDir, "evaluation.md"))
      ),
      translation_system_prompt_sha256: this.pathService.sha256Text(input.translationPrompt.system.trimEnd() + "\n"),
      translation_user_prompt_sha256: this.pathService.sha256Text(input.translationPrompt.user.trimEnd() + "\n")
    };
    if (input.reviewPayload) {
      hashes.review_structured_sha256 = this.pathService.sha256Text(JSON.stringify(input.reviewPayload, null, 2) + "\n");
      hashes.findings_sha256 = this.pathService.sha256Text(
        (input.findingsMarkdown ?? this.renderFindingsMarkdown(input.reviewPayload)).trimEnd() + "\n"
      );
    }
    if (input.reviewPrompt) {
      hashes.review_system_prompt_sha256 = this.pathService.sha256Text(input.reviewPrompt.system.trimEnd() + "\n");
      hashes.review_user_prompt_sha256 = this.pathService.sha256Text(input.reviewPrompt.user.trimEnd() + "\n");
    }

    return {
      schema_version: "1.1",
      sanitization_version: "1.1",
      run_id: input.runId,
      slice_id: input.evaluationReport.slice_id,
      prompt_bundle_id: input.evaluationReport.prompt_bundle_id,
      model_profile_id: input.evaluationReport.model_profile_id,
      generated_at: new Date().toISOString(),
      source_refs: {
        run_manifest_path: this.pathService.relativeToRepo(input.runManifestPath),
        slice_manifest_path: this.pathService.relativeToRepo(input.sliceManifestPath),
        prompt_bundle_path: this.pathService.relativeToRepo(input.promptBundlePath),
        model_profile_path: this.pathService.relativeToRepo(input.modelProfilePath),
        glossary_path: this.pathService.relativeToRepo(input.glossaryPath),
        style_guide_path: this.pathService.relativeToRepo(input.styleGuidePath),
        rubric_path: this.pathService.relativeToRepo(input.rubricPath)
      },
      stages: Object.fromEntries(
        Object.entries(input.stageRecords).map(([key, value]) => [
          key,
          {
            provider: value.provider,
            model: value.model,
            temperature: value.temperature,
            prompt_files: value.promptFiles,
            ...(value.finishReason ? { finish_reason: value.finishReason } : {}),
            ...(value.maxTokens ? { max_tokens: value.maxTokens } : {}),
            ...(value.timeoutSeconds ? { timeout_seconds: value.timeoutSeconds } : {}),
            ...(value.usage ? { usage: value.usage } : {})
          }
        ])
      ),
      artifacts: this.buildSafeEvaluationReport(evalDir, input.evaluationReport).artifacts,
      hashes
    };
  }
}
