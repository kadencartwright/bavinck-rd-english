import { Injectable, Logger } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";
import { LintRunnerService } from "@deterministic-lint";

import { CalibrationRuntimeState } from "../graph/graph-state";

@Injectable()
export class LintNode {
  private readonly logger = new Logger(LintNode.name);

  constructor(
    private readonly lintRunner: LintRunnerService,
    private readonly artifactWriter: ArtifactWriterService
  ) {}

  async execute(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    if (!state.currentDraft || !state.glossaryDoc || !state.runDirectories) {
      throw new Error("Lint node is missing a draft or glossary document.");
    }
    const lintResult = this.lintRunner.run({
      excerptText: state.excerptText,
      draft: state.currentDraft,
      glossaryDoc: state.glossaryDoc
    });
    const round = state.lintResults.length;
    await this.artifactWriter.writeLintRound(state.runDirectories, round, lintResult);
    this.logger.log(
      `Lint round ${round} for run ${state.runId}: pass=${lintResult.pass ? "yes" : "no"} hard=${lintResult.hardDefects.length} soft=${lintResult.softDefects.length} repair=${lintResult.routingSummary.autoRepair} review=${lintResult.routingSummary.judgeReview} log=${lintResult.routingSummary.logOnly}`
    );
    return {
      lintResults: [...state.lintResults, lintResult]
    };
  }
}
