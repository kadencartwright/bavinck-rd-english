import { Injectable } from "@nestjs/common";

import { ReviewPayload, RouteDecision, routeDecisionSchema } from "@calibration-domain";

import { RepairTaskService } from "./repair-task.service";

@Injectable()
export class ReviewRoutingService {
  constructor(private readonly repairTaskService: RepairTaskService) {}

  decide(input: { reviewPayload: ReviewPayload; repairRound: number; maxRepairRounds: number }): RouteDecision {
    const findings = input.reviewPayload.findings;
    const escalateFindings = findings.filter((finding) => finding.disposition === "escalate");
    if (escalateFindings.length > 0) {
      return routeDecisionSchema.parse({
        decision: "escalate",
        reasons: escalateFindings.map((finding) => `${finding.category}: ${finding.detail}`),
        findingIds: escalateFindings.map((finding) => finding.id),
        repairTasks: [],
        followUpReviewRequired: false
      });
    }

    const repairTasks = this.repairTaskService.fromReviewFindings(findings);
    if (repairTasks.length > 0) {
      if (input.repairRound >= input.maxRepairRounds) {
        return routeDecisionSchema.parse({
          decision: "escalate",
          reasons: ["Repair limit exhausted after review-directed repair requests."],
          findingIds: repairTasks.flatMap((task) => task.findingIds),
          repairTasks: [],
          followUpReviewRequired: false
        });
      }

      return routeDecisionSchema.parse({
        decision: "repair",
        reasons: [`${repairTasks.length} review finding(s) were marked for automated repair.`],
        findingIds: repairTasks.flatMap((task) => task.findingIds),
        repairTasks,
        followUpReviewRequired: true
      });
    }

    return routeDecisionSchema.parse({
      decision: "accept",
      reasons: ["Review returned no actionable repair or escalation findings."],
      findingIds: findings.map((finding) => finding.id),
      repairTasks: [],
      followUpReviewRequired: false
    });
  }
}
