import { Injectable } from "@nestjs/common";

import {
  ModelProfile,
  PromptBundleMetadata,
  ReviewRequestRecord,
  RunManifest,
  SliceManifest,
  TranslationRequestRecord
} from "@calibration-domain";

import { PathService } from "./path.service";

export interface PromptBundleLoadResult {
  metadata: PromptBundleMetadata;
  translationSystem: string;
  translationUserTemplate: string;
  reviewSystem: string;
  reviewUserTemplate: string;
}

export interface TranslationPromptInput {
  runId: string;
  runManifest: RunManifest;
  sliceManifest: SliceManifest;
  promptBundle: PromptBundleLoadResult;
  modelProfile: ModelProfile;
  excerptText: string;
  glossaryText: string;
  styleGuideText: string;
}

export interface ReviewPromptInput extends TranslationPromptInput {
  rubricText: string;
  translationOutput: string;
}

@Injectable()
export class PromptBundleService {
  constructor(private readonly pathService: PathService) {}

  async load(bundlePath: string, metadata: PromptBundleMetadata): Promise<PromptBundleLoadResult> {
    const files = metadata.prompt_files;
    return {
      metadata,
      translationSystem: await this.pathService.readText(
        this.pathService.resolveRepoPath(`${bundlePath}/${files.translation_system}`)
      ),
      translationUserTemplate: await this.pathService.readText(
        this.pathService.resolveRepoPath(`${bundlePath}/${files.translation_user_template}`)
      ),
      reviewSystem: await this.pathService.readText(
        this.pathService.resolveRepoPath(`${bundlePath}/${files.review_system}`)
      ),
      reviewUserTemplate: await this.pathService.readText(
        this.pathService.resolveRepoPath(`${bundlePath}/${files.review_user_template}`)
      )
    };
  }

  renderTemplate(template: string, context: Record<string, string>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(context)) {
      rendered = rendered.replaceAll(`{{${key}}}`, value);
    }
    return rendered;
  }

  buildTranslationRequestRecord(input: TranslationPromptInput): {
    requestRecord: TranslationRequestRecord;
    messages: { role: "system" | "user"; content: string }[];
  } {
    const stage = input.modelProfile.stages.translation;
    const userPrompt = this.renderTemplate(input.promptBundle.translationUserTemplate, {
      run_id: input.runId,
      slice_id: input.runManifest.slice_id,
      slice_title: input.sliceManifest.title,
      selection_rationale: input.sliceManifest.rationale,
      source_excerpt: input.excerptText.trim(),
      glossary_terms: input.glossaryText.trim(),
      style_guide: input.styleGuideText.trim()
    });
    const messages = [
      { role: "system" as const, content: input.promptBundle.translationSystem.trim() },
      { role: "user" as const, content: userPrompt }
    ];
    return {
      messages,
      requestRecord: {
        run_id: input.runId,
        slice_id: input.runManifest.slice_id,
        prompt_bundle_id: input.runManifest.prompt_bundle_id,
        model_profile_id: input.runManifest.model_profile_id,
        stage: "translation",
        provider: stage.provider,
        model: stage.model,
        temperature: stage.temperature,
        messages,
        prompt_files: input.promptBundle.metadata.prompt_files
      }
    };
  }

  buildReviewRequestRecord(input: ReviewPromptInput): {
    requestRecord: ReviewRequestRecord;
    messages: { role: "system" | "user"; content: string }[];
  } {
    const stage = input.modelProfile.stages.review;
    const userPrompt = this.renderTemplate(input.promptBundle.reviewUserTemplate, {
      run_id: input.runId,
      slice_id: input.runManifest.slice_id,
      slice_title: input.sliceManifest.title,
      source_excerpt: input.excerptText.trim(),
      translation_output: input.translationOutput.trim(),
      glossary_terms: input.glossaryText.trim(),
      style_guide: input.styleGuideText.trim(),
      rubric: input.rubricText.trim()
    });
    const messages = [
      { role: "system" as const, content: input.promptBundle.reviewSystem.trim() },
      { role: "user" as const, content: userPrompt }
    ];
    return {
      messages,
      requestRecord: {
        run_id: input.runId,
        slice_id: input.runManifest.slice_id,
        prompt_bundle_id: input.runManifest.prompt_bundle_id,
        model_profile_id: input.runManifest.model_profile_id,
        stage: "review",
        provider: stage.provider,
        model: stage.model,
        temperature: stage.temperature,
        messages,
        prompt_files: input.promptBundle.metadata.prompt_files
      }
    };
  }
}
