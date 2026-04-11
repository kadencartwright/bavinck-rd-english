import { Injectable } from "@nestjs/common";

import {
  ModelProfile,
  PromptBundleMetadata,
  RunManifest,
  SliceManifest,
  translationRequestRecordSchema
} from "@calibration-domain";
import { PromptBundleLoadResult, PromptBundleService } from "@calibration-config";
import { OpenAiCompatibleClient } from "@provider-clients";

export interface TranslationExecutionInput {
  runId: string;
  runManifest: RunManifest;
  sliceManifest: SliceManifest;
  promptBundle: PromptBundleLoadResult;
  promptBundleMetadata: PromptBundleMetadata;
  modelProfile: ModelProfile;
  excerptText: string;
  glossaryText: string;
  styleGuideText: string;
  stream?: boolean;
  onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void;
}

@Injectable()
export class TranslationService {
  constructor(
    private readonly promptBundleService: PromptBundleService,
    private readonly providerClient: OpenAiCompatibleClient
  ) {}

  async execute(input: TranslationExecutionInput) {
    const built = this.promptBundleService.buildTranslationRequestRecord({
      runId: input.runId,
      runManifest: input.runManifest,
      sliceManifest: input.sliceManifest,
      promptBundle: input.promptBundle,
      modelProfile: input.modelProfile,
      excerptText: input.excerptText,
      glossaryText: input.glossaryText,
      styleGuideText: input.styleGuideText
    });
    const requestRecord = translationRequestRecordSchema.parse(built.requestRecord);
    const stage = input.modelProfile.stages.translation;
    const response = await this.providerClient.createChatCompletion({
      providerName: stage.provider,
      stageName: "translation",
      model: stage.model,
      messages: built.messages,
      temperature: stage.temperature,
      maxTokens: stage.max_tokens,
      timeoutSeconds: stage.timeout_seconds,
      stream: input.stream ?? false,
      onStreamDelta: input.onStreamDelta
    });
    const text = `${this.providerClient.extractMessageText(response).trim()}\n`;
    if (!text.trim()) {
      throw new Error(
        `Translation provider returned empty output. Aborting run before review for ${stage.provider}/${stage.model}.`
      );
    }
    return {
      requestRecord,
      response,
      text,
      prompt: {
        system: built.messages[0].content,
        user: built.messages[1].content
      },
      stageRecord: {
        provider: stage.provider,
        model: stage.model,
        temperature: stage.temperature,
        promptFiles: input.promptBundleMetadata.prompt_files,
        finishReason: this.extractFinishReason(response),
        maxTokens: stage.max_tokens,
        timeoutSeconds: stage.timeout_seconds,
        usage: this.extractUsage(response)
      }
    };
  }

  async smokeTest(modelProfile: ModelProfile): Promise<void> {
      await this.providerClient.smokeTestStage("translation", modelProfile.stages.translation);
    await this.providerClient.smokeTestStage("review", modelProfile.stages.review);
  }

  private extractFinishReason(response: Record<string, unknown>): string | undefined {
    const firstChoice = Array.isArray(response.choices) ? response.choices[0] : undefined;
    return firstChoice && typeof firstChoice === "object" && typeof firstChoice.finish_reason === "string"
      ? firstChoice.finish_reason
      : undefined;
  }

  private extractUsage(response: Record<string, unknown>): Record<string, number> | undefined {
    const usage = response.usage;
    if (!usage || typeof usage !== "object") {
      return undefined;
    }
    const normalized: Record<string, number> = {};
    for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"] as const) {
      const value = (usage as Record<string, unknown>)[key];
      if (typeof value === "number") {
        normalized[key] = value;
      }
    }
    const completionDetails = (usage as Record<string, unknown>).completion_tokens_details;
    if (completionDetails && typeof completionDetails === "object") {
      const reasoningTokens = (completionDetails as Record<string, unknown>).reasoning_tokens;
      if (typeof reasoningTokens === "number") {
        normalized.reasoning_tokens = reasoningTokens;
      }
    }
    const promptDetails = (usage as Record<string, unknown>).prompt_tokens_details;
    if (promptDetails && typeof promptDetails === "object") {
      const cachedTokens = (promptDetails as Record<string, unknown>).cached_tokens;
      if (typeof cachedTokens === "number") {
        normalized.cached_tokens = cachedTokens;
      }
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }
}
