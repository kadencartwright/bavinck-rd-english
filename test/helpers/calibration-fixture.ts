import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import yaml from "js-yaml";

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

export function extractPreservedSpans(text: string): string[] {
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

export function buildReviewResult(summary = "Review completed.") {
  return {
    summary,
    checks: {
      proseQuality: { status: "pass" as const, details: "Readable formal prose." },
      reviewFlagging: { status: "pass" as const, details: "Risks called out appropriately." }
    },
    findings: [{ severity: "low" as const, category: "style", detail: "Minor note." }],
    recommendedFollowUp: ["Keep comparing runs."]
  };
}
