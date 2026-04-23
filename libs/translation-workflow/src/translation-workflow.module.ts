import { Module } from "@nestjs/common";

import { ArtifactStoreModule } from "@artifact-store";
import { CalibrationConfigModule } from "@calibration-config";
import { DeterministicLintModule } from "@deterministic-lint";
import { ProviderModule } from "@provider-clients";

import { CalibrationGraphService } from "./graph/calibration.graph";
import { FinalizeNode } from "./nodes/finalize.node";
import { LintNode } from "./nodes/lint.node";
import { LoadInputsNode } from "./nodes/load-inputs.node";
import { RepairNode } from "./nodes/repair.node";
import { RouteReviewNode } from "./nodes/route-review.node";
import { ReviewNode } from "./nodes/review.node";
import { TranslateNode } from "./nodes/translate.node";
import { RepairService } from "./services/repair.service";
import { RepairTaskService } from "./services/repair-task.service";
import { ReviewService } from "./services/review.service";
import { ReviewRoutingService } from "./services/review-routing.service";
import { TranslationService } from "./services/translation.service";
import { TranslationWorkflowService } from "./services/translation-workflow.service";

@Module({
  imports: [CalibrationConfigModule, ProviderModule, ArtifactStoreModule, DeterministicLintModule],
  providers: [
    TranslationService,
    RepairService,
    RepairTaskService,
    ReviewService,
    ReviewRoutingService,
    TranslationWorkflowService,
    LoadInputsNode,
    TranslateNode,
    LintNode,
    RepairNode,
    ReviewNode,
    RouteReviewNode,
    FinalizeNode,
    CalibrationGraphService
  ],
  exports: [
    CalibrationGraphService,
    TranslationService,
    RepairService,
    RepairTaskService,
    ReviewService,
    ReviewRoutingService,
    TranslationWorkflowService
  ]
})
export class TranslationWorkflowModule {}
