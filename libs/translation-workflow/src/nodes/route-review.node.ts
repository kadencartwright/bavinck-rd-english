import { Injectable, Logger } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";

import { CalibrationRuntimeState } from "../graph/graph-state";
import { ReviewRoutingService } from "../services/review-routing.service";

@Injectable()
export class RouteReviewNode {
  private readonly logger = new Logger(RouteReviewNode.name);

  constructor(
    private readonly reviewRoutingService: ReviewRoutingService,
    private readonly artifactWriter: ArtifactWriterService
  ) {}

  async execute(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (!state.reviewPayload || !state.runDirectories) {
      throw new Error("Route review node is missing review payload or run directories.");
    }

    const routeDecision = this.reviewRoutingService.decide({
      reviewPayload: state.reviewPayload,
      repairRound: state.repairRound,
      maxRepairRounds: state.maxRepairRounds
    });

    await this.artifactWriter.writeRoutingDecision(state.runDirectories, routeDecision);
    if (routeDecision.repairTasks.length > 0) {
      await this.artifactWriter.writeRepairTasks(state.runDirectories, state.repairRound + 1, routeDecision.repairTasks);
    }

    this.logger.log(`Route review decided ${routeDecision.decision} for run ${state.runId}`);

    return {
      routeDecision,
      repairTasks: routeDecision.repairTasks,
      routingHistory: [...state.routingHistory, routeDecision]
    };
  }
}
