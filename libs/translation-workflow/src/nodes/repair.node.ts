import { Injectable } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";

import { CalibrationRuntimeState } from "../graph/graph-state";
import { RepairService } from "../services/repair.service";

@Injectable()
export class RepairNode {
  constructor(
    private readonly repairService: RepairService,
    private readonly artifactWriter: ArtifactWriterService
  ) {}

  async execute(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (!state.currentDraft || !state.promptBundleMetadata || !state.modelProfile || !state.runDirectories) {
      throw new Error("Repair node is missing runtime state.");
    }
    const hardDefects = state.lintResults.at(-1)?.hardDefects ?? [];
    const nextRepairRound = state.repairRound + 1;
    const result = await this.repairService.execute({
      runId: state.runId,
      sliceId: state.runManifest?.slice_id ?? state.runId,
      repairRound: nextRepairRound,
      currentDraft: state.currentDraft,
      hardDefects,
      modelProfile: state.modelProfile,
      promptBundleMetadata: state.promptBundleMetadata
    });
    await this.artifactWriter.writeRepairRequest(state.runDirectories, nextRepairRound, result.requestRecord);
    await this.artifactWriter.writeTranslationRound(state.runDirectories, nextRepairRound, result.text, result.response);
    return {
      repairRound: nextRepairRound,
      currentDraft: result.text,
      translationDrafts: [...state.translationDrafts, result.text],
      stageRecords: {
        ...state.stageRecords,
        [`repair_${nextRepairRound}`]: result.stageRecord
      }
    };
  }
}
