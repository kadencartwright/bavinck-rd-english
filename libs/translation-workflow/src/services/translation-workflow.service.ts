import path from "node:path";

import { Injectable } from "@nestjs/common";

import { ResolvedCalibrationCliOptions } from "@calibration-config";
import { ModelProfile } from "@calibration-domain";

import { CalibrationGraphService } from "../graph/calibration.graph";
import { TranslationService } from "./translation.service";

@Injectable()
export class TranslationWorkflowService {
  constructor(
    private readonly calibrationGraphService: CalibrationGraphService,
    private readonly translationService: TranslationService
  ) {}

  async smokeTest(modelProfile: ModelProfile): Promise<void> {
    await this.translationService.smokeTest(modelProfile);
  }

  async runCalibration(options: ResolvedCalibrationCliOptions): Promise<{
    runDir: string;
    evalDir: string;
    evaluationPath: string;
  }> {
    const result = await this.calibrationGraphService.run(options);
    return {
      runDir: path.join(options.outputRoot, result.runId),
      evalDir: path.join(options.evalRoot, result.runId),
      evaluationPath: path.join(options.evalRoot, result.runId, "evaluation.json")
    };
  }
}
