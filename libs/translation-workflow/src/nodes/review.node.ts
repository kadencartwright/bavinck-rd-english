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
      !state.promptBundle ||
      !state.promptBundleMetadata ||
      !state.modelProfile ||
      !state.glossaryPath ||
      !state.runDirectories
    ) {
      throw new Error("Review node is missing loaded calibration inputs.");
    }
    this.logger.log(`Starting review for run ${state.runId}`);
    const glossaryText = await this.pathService.readText(state.glossaryPath);
    const result = await this.reviewService.execute({
      runId: state.runId,
      runManifest: state.runManifest,
      sliceManifest: state.sliceManifest,
      promptBundle: state.promptBundle,
      promptBundleMetadata: state.promptBundleMetadata,
      modelProfile: state.modelProfile,
      excerptText: state.excerptText,
      translationText: state.currentDraft,
      glossaryText,
      styleGuideText: state.styleGuideText,
      rubricText: state.rubricText
    });

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
