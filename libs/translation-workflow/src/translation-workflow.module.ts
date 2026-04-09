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
import { ReviewNode } from "./nodes/review.node";
import { TranslateNode } from "./nodes/translate.node";
import { RepairService } from "./services/repair.service";
import { ReviewService } from "./services/review.service";
import { TranslationService } from "./services/translation.service";
import { TranslationWorkflowService } from "./services/translation-workflow.service";

@Module({
  imports: [CalibrationConfigModule, ProviderModule, ArtifactStoreModule, DeterministicLintModule],
  providers: [
    TranslationService,
    RepairService,
    ReviewService,
    TranslationWorkflowService,
    LoadInputsNode,
    TranslateNode,
    LintNode,
    RepairNode,
    ReviewNode,
    FinalizeNode,
    CalibrationGraphService
  ],
  exports: [
    CalibrationGraphService,
    TranslationService,
    RepairService,
    ReviewService,
    TranslationWorkflowService
  ]
})
export class TranslationWorkflowModule {}
