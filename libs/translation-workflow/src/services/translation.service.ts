import { Injectable } from "@nestjs/common";

import {
  ModelProfile,
  PromptBundleMetadata,
  RunManifest,
  SliceManifest,
  translationRequestRecordSchema
} from "@calibration-domain";
import { BamlCalibrationClient } from "@provider-clients";

interface TranslationExecutionInput {
  runId: string;
  runManifest: RunManifest;
  sliceManifest: SliceManifest;
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
  constructor(private readonly providerClient: BamlCalibrationClient) {}

  async execute(input: TranslationExecutionInput) {
    const stage = input.modelProfile.stages.translation;
    const result = await this.providerClient.translate({
      stage,
      runId: input.runId,
      sliceId: input.runManifest.slice_id,
      sliceTitle: input.sliceManifest.title,
      selectionRationale: input.sliceManifest.rationale,
      sourceExcerpt: input.excerptText,
      glossaryTerms: input.glossaryText,
      styleGuide: input.styleGuideText,
      stream: input.stream ?? false,
      onStreamDelta: input.onStreamDelta
    });

    const text = `${result.value.trim()}\n`;
    if (!text.trim()) {
      throw new Error(
        `Translation provider returned empty output. Aborting run before review for ${stage.provider}/${stage.model}.`
      );
    }

    const requestRecord = translationRequestRecordSchema.parse({
      run_id: input.runId,
      slice_id: input.runManifest.slice_id,
      prompt_bundle_id: input.runManifest.prompt_bundle_id,
      model_profile_id: input.runManifest.model_profile_id,
      stage: "translation",
      provider: stage.provider,
      model: stage.model,
      temperature: stage.temperature,
      messages: result.messages,
      prompt_files: result.promptFiles
    });

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

  async smokeTest(modelProfile: ModelProfile): Promise<void> {
    await this.providerClient.smokeTestStage("translation", modelProfile.stages.translation);
    await this.providerClient.smokeTestStage("review", modelProfile.stages.review);
  }
}
