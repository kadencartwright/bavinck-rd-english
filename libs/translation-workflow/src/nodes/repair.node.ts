import { Injectable, Logger } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";

import { CalibrationRuntimeState } from "../graph/graph-state";
import { RepairService } from "../services/repair.service";

@Injectable()
export class RepairNode {
  private readonly logger = new Logger(RepairNode.name);

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
    this.logger.log(
      `Starting repair round ${nextRepairRound} for run ${state.runId}; hard defects=${hardDefects.length}`
    );
    if (state.streamLlm) {
      process.stdout.write(`\n[repair stream start round=${nextRepairRound}]\n`);
    }
    const result = await this.repairService.execute({
      runId: state.runId,
      sliceId: state.runManifest?.slice_id ?? state.runId,
      repairRound: nextRepairRound,
      currentDraft: state.currentDraft,
      hardDefects,
      modelProfile: state.modelProfile,
      promptBundleMetadata: state.promptBundleMetadata,
      stream: state.streamLlm,
      onStreamDelta: state.streamLlm
        ? (fieldName, text) => {
            if (fieldName === "reasoning_content") {
              process.stdout.write(`\n[repair reasoning] ${text}`);
            } else {
              process.stdout.write(text);
            }
          }
        : undefined
    });
    if (state.streamLlm) {
      process.stdout.write(`\n[repair stream end round=${nextRepairRound}]\n`);
    }
    await this.artifactWriter.writeRepairRequest(state.runDirectories, nextRepairRound, result.requestRecord);
    await this.artifactWriter.writeTranslationRound(state.runDirectories, nextRepairRound, result.text, result.response);
    this.logger.log(`Repair round ${nextRepairRound} complete for run ${state.runId}; chars=${result.text.length}`);
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
