import { Injectable } from "@nestjs/common";

import { LintDefect, ModelProfile, PromptBundleMetadata } from "@calibration-domain";
import { BamlCalibrationClient } from "@provider-clients";
import type { RepairDefect } from "@provider-clients";

export interface RepairExecutionInput {
  runId: string;
  sliceId: string;
  repairRound: number;
  currentDraft: string;
  hardDefects: LintDefect[];
  modelProfile: ModelProfile;
  promptBundleMetadata: PromptBundleMetadata;
  stream?: boolean;
  onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void;
}

@Injectable()
export class RepairService {
  constructor(private readonly providerClient: BamlCalibrationClient) {}

  async execute(input: RepairExecutionInput) {
    const stage = input.modelProfile.stages.translation;
    const result = await this.providerClient.repair({
      stage,
      runId: input.runId,
      sliceId: input.sliceId,
      repairRound: input.repairRound,
      currentDraft: input.currentDraft,
      hardDefects: input.hardDefects.map((defect) => this.toRepairDefect(defect)),
      stream: input.stream ?? false,
      onStreamDelta: input.onStreamDelta
    });

    const text = `${result.value.trim()}\n`;
    if (!text.trim()) {
      throw new Error("Repair provider returned empty output.");
    }

    const requestRecord = {
      run_id: input.runId,
      slice_id: input.sliceId,
      prompt_bundle_id: input.promptBundleMetadata.prompt_bundle_id,
      model_profile_id: input.modelProfile.model_profile_id,
      stage: "repair",
      provider: stage.provider,
      model: stage.model,
      temperature: stage.temperature,
      messages: result.messages,
      prompt_files: result.promptFiles
    };

    return {
      requestRecord,
      response: result.response,
      text,
      prompt: result.prompt,
      stageRecord: {
        provider: stage.provider,
        model: stage.model,
        temperature: stage.temperature,
        promptFiles: result.promptFiles,
        finishReason: result.finishReason,
        maxTokens: stage.max_tokens,
        timeoutSeconds: stage.timeout_seconds,
        usage: result.usage
      }
    };
  }

  private toRepairDefect(defect: LintDefect): RepairDefect {
    return {
      code: defect.code,
      severity: defect.severity,
      message: defect.message,
      evidence: defect.evidence,
      ...(defect.sourceSpan ? { sourceSpan: defect.sourceSpan } : {}),
      ...(defect.foundSpan ? { foundSpan: defect.foundSpan } : {}),
      ...(defect.locationHint ? { locationHint: defect.locationHint } : {}),
      ...(defect.suggestedFix ? { suggestedFix: defect.suggestedFix } : {})
    };
  }
}
