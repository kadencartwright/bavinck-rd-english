import { Injectable } from "@nestjs/common";

import { LintDefect, ModelProfile, PromptBundleMetadata } from "@calibration-domain";
import { OpenAiCompatibleClient } from "@provider-clients";

export interface RepairExecutionInput {
  runId: string;
  sliceId: string;
  repairRound: number;
  currentDraft: string;
  hardDefects: LintDefect[];
  modelProfile: ModelProfile;
  promptBundleMetadata: PromptBundleMetadata;
}

@Injectable()
export class RepairService {
  constructor(private readonly providerClient: OpenAiCompatibleClient) {}

  async execute(input: RepairExecutionInput) {
    const stage = input.modelProfile.stages.translation;
    const messages = [
      {
        role: "system" as const,
        content:
          "You repair an English translation draft. Apply the smallest possible edits that fix the listed hard defects. " +
          "Return only the corrected translated passage with the original paragraph structure preserved."
      },
      {
        role: "user" as const,
        content: [
          `Run ID: ${input.runId}`,
          `Slice ID: ${input.sliceId}`,
          `Repair round: ${input.repairRound}`,
          "",
          "Current draft:",
          input.currentDraft.trim(),
          "",
          "Hard defects:",
          JSON.stringify(input.hardDefects, null, 2)
        ].join("\n")
      }
    ];
    const requestRecord = {
      run_id: input.runId,
      slice_id: input.sliceId,
      prompt_bundle_id: input.promptBundleMetadata.prompt_bundle_id,
      model_profile_id: input.modelProfile.model_profile_id,
      stage: "repair",
      provider: stage.provider,
      model: stage.model,
      temperature: stage.temperature,
      messages,
      prompt_files: {
        ...input.promptBundleMetadata.prompt_files,
        repair_prompt: "inline"
      }
    };
    const response = await this.providerClient.createChatCompletion({
      providerName: stage.provider,
      stageName: "repair",
      model: stage.model,
      messages,
      temperature: stage.temperature,
      maxTokens: stage.max_tokens,
      timeoutSeconds: stage.timeout_seconds,
      stream: false
    });
    const text = `${this.providerClient.extractMessageText(response).trim()}\n`;
    if (!text.trim()) {
      throw new Error("Repair provider returned empty output.");
    }
    return {
      requestRecord,
      response,
      text,
      prompt: {
        system: messages[0].content,
        user: messages[1].content
      },
      stageRecord: {
        provider: stage.provider,
        model: stage.model,
        temperature: stage.temperature,
        promptFiles: requestRecord.prompt_files
      }
    };
  }
}
