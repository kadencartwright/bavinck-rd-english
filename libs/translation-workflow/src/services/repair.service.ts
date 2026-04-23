import { Injectable } from "@nestjs/common";

import { ModelProfile, PromptBundleMetadata, RepairTask } from "@calibration-domain";
import { BamlCalibrationClient } from "@provider-clients";
import type { RepairTask as ProviderRepairTask } from "@provider-clients";

interface RepairExecutionInput {
  runId: string;
  sliceId: string;
  repairRound: number;
  currentDraft: string;
  repairTasks: RepairTask[];
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
      repairTasks: input.repairTasks.map((task) => this.toProviderRepairTask(task)),
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

  private toProviderRepairTask(task: RepairTask): ProviderRepairTask {
    return {
      taskId: task.taskId,
      originStage: task.originStage,
      findingIds: task.findingIds,
      handler: task.handler,
      scope: task.scope,
      repairability: task.repairability,
      instructions: task.instructions,
      evidence: task.evidence,
      ...(task.sourceSpan ? { sourceSpan: task.sourceSpan } : {}),
      ...(task.draftSpan ? { draftSpan: task.draftSpan } : {}),
      ...(task.locationHint ? { locationHint: task.locationHint } : {})
    };
  }
}
