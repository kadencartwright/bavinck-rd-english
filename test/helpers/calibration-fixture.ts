import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import yaml from "js-yaml";
import type { CalibrationReview } from "@provider-clients";

export const ACTUAL_MANIFEST_PATH =
  "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json";

export async function makeTempCalibrationRoots(): Promise<{ root: string; runs: string; evals: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "calibration-ts-"));
  return {
    root,
    runs: path.join(root, "runs"),
    evals: path.join(root, "evals")
  };
}

export async function cleanupTempRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

function extractPreservedSpans(text: string): string[] {
  return [...new Set(text.match(/[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]+/gu) ?? [])];
}

export function buildCleanTranslation(excerptText: string, glossaryText: string): string {
  const preserved = extractPreservedSpans(excerptText);
  const glossaryTargets = ((yaml.load(glossaryText) as { terms?: Array<{ target: string }> })?.terms ?? []).map(
    (term) => term.target
  );
  const paragraphs = excerptText.trim().split(/\n\s*\n/gu);
  return (
    paragraphs
      .map((_, index) => {
        if (index === 0) {
          return [
            "Formal dogmatics translation with knowledge of God, the Incomprehensible, revelation, and Being.",
            ...glossaryTargets,
            ...preserved
          ]
            .filter(Boolean)
            .join(" ");
        }
        return `Formal theological English paragraph ${index + 1}.`;
      })
      .join("\n\n") + "\n"
  );
}

export function buildBrokenTranslation(excerptText: string): string {
  const paragraphs = excerptText.trim().split(/\n\s*\n/gu);
  return (
    paragraphs
      .map((_, index) =>
        index === 0
          ? "Hd. 17:28 remains blz. and Joh. while commentary survives."
          : `Another broken paragraph ${index + 1} with bl. and Joh.`
      )
      .join("\n\n") + "\n"
  );
}

export function buildStageUsage() {
  return {
    prompt_tokens: 44,
    completion_tokens: 55,
    total_tokens: 99,
    reasoning_tokens: 7,
    cached_tokens: 3
  };
}

export function buildReviewResult(summary = "Review completed."): CalibrationReview {
  return {
    summary,
    checks: {
      semanticFaithfulness: { status: "pass" as const, details: "Meaning tracks the source." },
      doctrinalAmbiguity: { status: "pass" as const, details: "No unresolved doctrinal ambiguity detected." },
      reviewCoverage: { status: "pass" as const, details: "Findings include routing metadata when needed." }
    },
    findings: [
      {
        id: "review-1",
        severity: "info" as const,
        category: "style",
        detail: "Minor note.",
        evidence: ["Readability is acceptable."],
        repairability: "auto" as const,
        disposition: "accept" as const,
        scope: "sentence" as const,
        confidence: 0.8,
        repairInstruction: "No repair required."
      }
    ],
    recommendedFollowUp: ["Keep comparing runs."]
  };
}
