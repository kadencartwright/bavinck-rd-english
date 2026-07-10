import { Injectable, Logger } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";
import { PathService } from "@calibration-config";

import { CalibrationRuntimeState } from "../graph/graph-state";
import { TranslationService } from "../services/translation.service";

@Injectable()
export class TranslateNode {
  private readonly logger = new Logger(TranslateNode.name);

  constructor(
    private readonly translationService: TranslationService,
    private readonly artifactWriter: ArtifactWriterService,
    private readonly pathService: PathService
  ) {}

  async execute(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (!state.runManifest || !state.sliceManifest || !state.promptBundle || !state.promptBundleMetadata || !state.modelProfile || !state.runDirectories || !state.glossaryPath) {
      throw new Error("Translate node is missing loaded calibration inputs.");
    }

    this.logger.log(`Starting translation for run ${state.runId}`);
    if (state.streamTranslation) {
      this.logger.log(`Streaming translation output for run ${state.runId}`);
      process.stdout.write("\n[translation stream start]\n");
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
      styleGuideText: state.styleGuideText,
      stream: state.streamTranslation,
      onStreamDelta: state.streamTranslation
        ? (fieldName, text) => {
            if (fieldName === "content") {
              process.stdout.write(text);
            }
          }
        : undefined
    });
    if (state.streamTranslation) {
      process.stdout.write("\n[translation stream end]\n");
    }

    await this.artifactWriter.writeTranslationRequest(state.runDirectories, result.requestRecord);
    await this.artifactWriter.writeTranslationRound(state.runDirectories, 0, result.text, result.response);
    this.logger.log(`Translation complete for run ${state.runId}; chars=${result.text.length}`);

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
