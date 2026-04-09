import { END, START, StateGraph } from "@langchain/langgraph";
import { Injectable } from "@nestjs/common";

import { ResolvedCalibrationCliOptions } from "@calibration-config";

import { CalibrationRuntimeState, CalibrationRuntimeStateAnnotation } from "./graph-state";
import { FinalizeNode } from "../nodes/finalize.node";
import { LintNode } from "../nodes/lint.node";
import { LoadInputsNode } from "../nodes/load-inputs.node";
import { RepairNode } from "../nodes/repair.node";
import { ReviewNode } from "../nodes/review.node";
import { TranslateNode } from "../nodes/translate.node";

@Injectable()
export class CalibrationGraphService {
  constructor(
    private readonly loadInputsNode: LoadInputsNode,
    private readonly translateNode: TranslateNode,
    private readonly lintNode: LintNode,
    private readonly repairNode: RepairNode,
    private readonly reviewNode: ReviewNode,
    private readonly finalizeNode: FinalizeNode
  ) {}

  async run(options: ResolvedCalibrationCliOptions): Promise<CalibrationRuntimeState> {
    const graph = new StateGraph(CalibrationRuntimeStateAnnotation)
      .addNode("load_inputs", (state) => this.loadInputsNode.execute(state))
      .addNode("translate", (state) => this.translateNode.execute(state))
      .addNode("lint", (state) => this.lintNode.execute(state))
      .addNode("repair", (state) => this.repairNode.execute(state))
      .addNode("review", (state) => this.reviewNode.execute(state))
      .addNode("finalize_reviewed", (state) => this.finalizeNode.finalizeReviewed(state))
      .addNode("finalize_escalated", (state) => this.finalizeNode.finalizeEscalated(state))
      .addEdge(START, "load_inputs")
      .addEdge("load_inputs", "translate")
      .addEdge("translate", "lint")
      .addConditionalEdges("lint", (state) => {
        const latestLint = state.lintResults.at(-1);
        if (latestLint?.pass) {
          return "review";
        }
        if (state.repairRound < state.maxRepairRounds) {
          return "repair";
        }
        return "finalize_escalated";
      })
      .addEdge("repair", "lint")
      .addEdge("review", "finalize_reviewed")
      .addEdge("finalize_reviewed", END)
      .addEdge("finalize_escalated", END)
      .compile();

    return (await graph.invoke({
      runManifestPath: options.runManifest,
      outputRoot: options.outputRoot,
      evalRoot: options.evalRoot,
      allowSourceDrift: options.allowSourceDrift,
      maxRepairRounds: options.maxRepairRounds
    })) as CalibrationRuntimeState;
  }
}
