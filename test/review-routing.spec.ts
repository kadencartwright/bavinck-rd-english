import { reviewPayloadSchema } from "@calibration-domain";
import { ReviewRoutingService } from "@translation-workflow/services/review-routing.service";
import { RepairTaskService } from "@translation-workflow/services/repair-task.service";

describe("review routing", () => {
  const service = new ReviewRoutingService(new RepairTaskService());

  it("returns re_review instead of accepting re_review findings", () => {
    const payload = reviewPayloadSchema.parse({
      summary: "Review wants another pass.",
      checks: {
        "semantic-faithfulness": { status: "incomplete", details: "Another review is needed." },
        "doctrinal-ambiguity": { status: "pass", details: "No doctrinal issue detected." },
        "review-coverage": { status: "pass", details: "The finding includes a routed disposition." }
      },
      findings: [
        {
          id: "review-rereview-1",
          severity: "medium",
          category: "semantic-faithfulness",
          detail: "The finding requests another review pass.",
          evidence: ["Need another review."],
          repairability: "needs_judge",
          disposition: "re_review",
          scope: "sentence",
          confidence: 0.7
        }
      ],
      recommended_follow_up: ["Review the sentence again."]
    });

    const decision = service.decide({
      reviewPayload: payload,
      repairRound: 0,
      maxRepairRounds: 2
    });

    expect(decision.decision).toBe("re_review");
    expect(decision.findingIds).toEqual(["review-rereview-1"]);
  });
});
