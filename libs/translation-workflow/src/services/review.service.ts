import { Injectable } from "@nestjs/common";

import {
  ModelProfile,
  PromptBundleMetadata,
  ReviewPayload,
  RunManifest,
  SliceManifest,
  reviewPayloadSchema,
  reviewRequestRecordSchema
} from "@calibration-domain";
import { PromptBundleLoadResult, PromptBundleService } from "@calibration-config";
import { OpenAiCompatibleClient } from "@provider-clients";

export interface ReviewExecutionInput {
  runId: string;
  runManifest: RunManifest;
  sliceManifest: SliceManifest;
  promptBundle: PromptBundleLoadResult;
  promptBundleMetadata: PromptBundleMetadata;
  modelProfile: ModelProfile;
  excerptText: string;
  translationText: string;
  glossaryText: string;
  styleGuideText: string;
  rubricText: string;
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly promptBundleService: PromptBundleService,
    private readonly providerClient: OpenAiCompatibleClient
  ) {}

  async execute(input: ReviewExecutionInput) {
    const built = this.promptBundleService.buildReviewRequestRecord({
      runId: input.runId,
      runManifest: input.runManifest,
      sliceManifest: input.sliceManifest,
      promptBundle: input.promptBundle,
      modelProfile: input.modelProfile,
      excerptText: input.excerptText,
      glossaryText: input.glossaryText,
      styleGuideText: input.styleGuideText,
      rubricText: input.rubricText,
      translationOutput: input.translationText
    });
    const requestRecord = reviewRequestRecordSchema.parse(built.requestRecord);
    const stage = input.modelProfile.stages.review;
    const response = await this.providerClient.createChatCompletion({
      providerName: stage.provider,
      model: stage.model,
      messages: built.messages,
      temperature: stage.temperature,
      maxTokens: stage.max_tokens,
      timeoutSeconds: stage.timeout_seconds,
      stream: false
    });
    const rawText = this.providerClient.extractMessageText(response);
    const rawPayload = await this.extractReviewPayload(stage.provider, stage.model, rawText);
    const normalized = this.normalizeReviewPayload(rawPayload);
    const reviewPayload = reviewPayloadSchema.parse(normalized);
    return {
      requestRecord,
      response,
      reviewPayload,
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

  private async extractReviewPayload(providerName: "moonshot" | "z-ai", model: string, reviewText: string): Promise<Record<string, unknown>> {
    try {
      return this.extractJsonObject(reviewText);
    } catch {
      const repairResponse = await this.providerClient.createChatCompletion({
        providerName,
        model,
        temperature: 0,
        maxTokens: 2000,
        timeoutSeconds: 120,
        messages: [
          {
            role: "system",
            content:
              "You repair malformed review outputs. Return exactly one valid JSON object matching the review schema. " +
              "Do not include markdown, code fences, or commentary. Use severity values high, medium, low, or info."
          },
          {
            role: "user",
            content:
              "Reformat the following review output into valid JSON with keys summary, checks, findings, and recommended_follow_up.\n\n" +
              reviewText
          }
        ]
      });
      return this.extractJsonObject(this.providerClient.extractMessageText(repairResponse));
    }
  }

  private extractJsonObject(text: string): Record<string, unknown> {
    const stripped = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
    try {
      return JSON.parse(stripped) as Record<string, unknown>;
    } catch {
      const start = stripped.indexOf("{");
      if (start === -1) {
        throw new Error("Could not locate JSON object in review output.");
      }
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let index = start; index < stripped.length; index += 1) {
        const char = stripped[index];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (char === "\\") {
            escape = true;
          } else if (char === "\"") {
            inString = false;
          }
          continue;
        }
        if (char === "\"") {
          inString = true;
          continue;
        }
        if (char === "{") {
          depth += 1;
        }
        if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            return JSON.parse(stripped.slice(start, index + 1)) as Record<string, unknown>;
          }
        }
      }
      throw new Error("Could not parse review JSON output.");
    }
  }

  private normalizeReviewPayload(payload: Record<string, unknown>): ReviewPayload {
    if (Array.isArray(payload.findings)) {
      for (const finding of payload.findings) {
        if (
          finding &&
          typeof finding === "object" &&
          typeof (finding as Record<string, unknown>).severity === "string" &&
          ((finding as Record<string, unknown>).severity as string).toLowerCase() === "info"
        ) {
          (finding as Record<string, unknown>).severity = "low";
        }
      }
    }
    return payload as unknown as ReviewPayload;
  }
}
