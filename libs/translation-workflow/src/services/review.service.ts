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
import { BamlCalibrationClient } from "@provider-clients";

export interface ReviewExecutionInput {
  runId: string;
  runManifest: RunManifest;
  sliceManifest: SliceManifest;
  promptBundleMetadata: PromptBundleMetadata;
  modelProfile: ModelProfile;
  excerptText: string;
  translationText: string;
  glossaryText: string;
  styleGuideText: string;
  rubricText: string;
  stream?: boolean;
  onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void;
}

@Injectable()
export class ReviewService {
  constructor(private readonly providerClient: BamlCalibrationClient) {}

  async execute(input: ReviewExecutionInput) {
    const stage = input.modelProfile.stages.review;
    const result = await this.providerClient.review({
      stage,
      runId: input.runId,
      sliceId: input.runManifest.slice_id,
      sliceTitle: input.sliceManifest.title,
      sourceExcerpt: input.excerptText,
      translationOutput: input.translationText,
      glossaryTerms: input.glossaryText,
      styleGuide: input.styleGuideText,
      rubric: input.rubricText,
      stream: input.stream ?? false,
      onStreamDelta: input.onStreamDelta
    });

    const requestRecord = reviewRequestRecordSchema.parse({
      run_id: input.runId,
      slice_id: input.runManifest.slice_id,
      prompt_bundle_id: input.runManifest.prompt_bundle_id,
      model_profile_id: input.runManifest.model_profile_id,
      stage: "review",
      provider: stage.provider,
      model: stage.model,
      temperature: stage.temperature,
      messages: result.messages,
      prompt_files: result.promptFiles
    });

    const reviewPayload = reviewPayloadSchema.parse(this.normalizeReviewPayload(result.value));

    return {
      requestRecord,
      response: result.response,
      reviewPayload,
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

  private normalizeReviewPayload(payload: {
    summary: string;
    checks: {
      proseQuality: { status: "pass" | "fail" | "incomplete"; details: string };
      reviewFlagging: { status: "pass" | "fail" | "incomplete"; details: string };
    };
    findings: Array<{ severity: "high" | "medium" | "low"; category: string; detail: string }>;
    recommendedFollowUp: string[];
  }): ReviewPayload {
    return {
      summary: payload.summary,
      checks: {
        "prose-quality": payload.checks.proseQuality,
        "review-flagging": payload.checks.reviewFlagging
      },
      findings: payload.findings,
      recommended_follow_up: payload.recommendedFollowUp
    };
  }
}
