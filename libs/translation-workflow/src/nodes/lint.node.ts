import { Injectable } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";
import { LintRunnerService } from "@deterministic-lint";

import { CalibrationRuntimeState } from "../graph/graph-state";

@Injectable()
export class LintNode {
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
    return {
      lintResults: [...state.lintResults, lintResult]
    };
  }
}
