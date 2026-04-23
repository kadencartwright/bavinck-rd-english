import { Injectable } from "@nestjs/common";

import { LintDefect, RepairTask, ReviewFinding } from "@calibration-domain";

@Injectable()
export class RepairTaskService {
  fromLintDefects(defects: LintDefect[]): RepairTask[] {
    return defects
      .filter((defect) => defect.routingTarget === "repair")
      .map((defect, index) => ({
        taskId: `repair-lint-${index + 1}`,
        originStage: "lint" as const,
        findingIds: [defect.id],
        handler: defect.category === "citation" ? "citation-repair" : "mechanical-repair",
        scope: defect.scope,
        repairability: defect.repairability,
        instructions: [defect.suggestedFix ?? defect.message],
        evidence: defect.evidence,
        ...(defect.locationHint ? { locationHint: defect.locationHint } : {}),
        ...(defect.sourceSpan ? { sourceSpan: defect.sourceSpan } : {}),
        ...(defect.foundSpan ? { draftSpan: defect.foundSpan } : {})
      }));
  }

  fromReviewFindings(findings: ReviewFinding[]): RepairTask[] {
    return findings
      .filter((finding) => finding.disposition === "repair")
      .map((finding, index) => ({
        taskId: `repair-review-${index + 1}`,
        originStage: "review" as const,
        findingIds: [finding.id],
        handler: this.mapHandler(finding.category),
        scope: finding.scope,
        repairability: finding.repairability,
        instructions: [finding.repairInstruction ?? finding.detail],
        evidence: finding.evidence,
        ...(finding.locationHint ? { locationHint: finding.locationHint } : {}),
        ...(finding.draftSpan ? { draftSpan: finding.draftSpan } : {})
      }));
  }

  private mapHandler(category: string): string {
    if (category.includes("doctr")) {
      return "semantic-repair";
    }
    if (category.includes("semantic")) {
      return "semantic-repair";
    }
    if (category.includes("prose")) {
      return "prose-repair";
    }
    return "targeted-repair";
  }
}
