import { Injectable } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";
import { PathService } from "@calibration-config";

import { CalibrationRuntimeState } from "../graph/graph-state";
import { TranslationService } from "../services/translation.service";

@Injectable()
export class TranslateNode {
  constructor(
    private readonly translationService: TranslationService,
    private readonly artifactWriter: ArtifactWriterService,
    private readonly pathService: PathService
  ) {}

  async execute(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (!state.runManifest || !state.sliceManifest || !state.promptBundle || !state.promptBundleMetadata || !state.modelProfile || !state.runDirectories || !state.glossaryPath) {
      throw new Error("Translate node is missing loaded calibration inputs.");
    }

    const glossaryText = await this.pathService.readText(state.glossaryPath);
    const result = await this.translationService.execute({
      runId: state.runId,
      runManifest: state.runManifest,
      sliceManifest: state.sliceManifest,
      promptBundle: state.promptBundle,
      promptBundleMetadata: state.promptBundleMetadata,
      modelProfile: state.modelProfile,
      excerptText: state.excerptText,
      glossaryText,
      styleGuideText: state.styleGuideText
    });

    await this.artifactWriter.writeTranslationRequest(state.runDirectories, result.requestRecord);
    await this.artifactWriter.writeTranslationRound(state.runDirectories, 0, result.text, result.response);

    return {
      translationDrafts: [...state.translationDrafts, result.text],
      currentDraft: result.text,
      translationRequestRecord: result.requestRecord,
      translationResponse: result.response,
      translationPromptSystem: result.prompt.system,
      translationPromptUser: result.prompt.user,
      stageRecords: {
        ...state.stageRecords,
        translation: result.stageRecord
      }
    };
  }
}
