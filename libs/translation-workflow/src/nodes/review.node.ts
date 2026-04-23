import { Injectable, Logger } from "@nestjs/common";

import { ArtifactWriterService, EvalExportService } from "@artifact-store";
import { PathService } from "@calibration-config";

import { CalibrationRuntimeState } from "../graph/graph-state";
import { ReviewService } from "../services/review.service";

@Injectable()
export class ReviewNode {
  private readonly logger = new Logger(ReviewNode.name);

  constructor(
    private readonly reviewService: ReviewService,
    private readonly artifactWriter: ArtifactWriterService,
    private readonly evalExportService: EvalExportService,
    private readonly pathService: PathService
  ) {}

  async execute(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (
      !state.currentDraft ||
      !state.runManifest ||
      !state.sliceManifest ||
      !state.promptBundleMetadata ||
      !state.modelProfile ||
      !state.glossaryPath ||
      !state.runDirectories
    ) {
      throw new Error("Review node is missing loaded calibration inputs.");
    }
    this.logger.log(`Starting review for run ${state.runId}`);
    if (state.streamLlm) {
      process.stdout.write("\n[review stream start]\n");
    }
    const glossaryText = await this.pathService.readText(state.glossaryPath);
    const result = await this.reviewService.execute({
      runId: state.runId,
      runManifest: state.runManifest,
      sliceManifest: state.sliceManifest,
      promptBundleMetadata: state.promptBundleMetadata,
      modelProfile: state.modelProfile,
      excerptText: state.excerptText,
      translationText: state.currentDraft,
      glossaryText,
      styleGuideText: state.styleGuideText,
      rubricText: state.rubricText,
      stream: state.streamLlm,
      onStreamDelta: state.streamLlm
        ? (fieldName, text) => {
            if (fieldName === "reasoning_content") {
              process.stdout.write(`\n[review reasoning] ${text}`);
            } else {
              process.stdout.write(text);
            }
          }
        : undefined
    });
    if (state.streamLlm) {
      process.stdout.write("\n[review stream end]\n");
    }

    await this.artifactWriter.writeReviewRequest(state.runDirectories, result.requestRecord);
    await this.artifactWriter.writeReviewResponse(state.runDirectories, result.response);
    await this.artifactWriter.writeReviewPayload(state.runDirectories, result.reviewPayload);
    await this.artifactWriter.writeText(
      `${state.runDirectories.reviewDir}/findings.md`,
      this.evalExportService.renderFindingsMarkdown(result.reviewPayload)
    );
    this.logger.log(
      `Review complete for run ${state.runId}; findings=${result.reviewPayload.findings.length} follow_up=${result.reviewPayload.recommended_follow_up.length}`
    );

    return {
      reviewPayload: result.reviewPayload,
      reviewFindingHistory: [...state.reviewFindingHistory, ...result.reviewPayload.findings],
      reviewRequestRecord: result.requestRecord,
      reviewResponse: result.response,
      reviewPromptSystem: result.prompt.system,
      reviewPromptUser: result.prompt.user,
      stageRecords: {
        ...state.stageRecords,
        review: result.stageRecord
      }
    };
  }
}
