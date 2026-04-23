import { Injectable } from "@nestjs/common";

import { LintDefect } from "@calibration-domain";

import { createLintDefect, createLintId } from "./rule-helpers";

@Injectable()
export class RepeatedTextRule {
  run(draft: string): { defects: LintDefect[]; passed: boolean } {
    const defects: LintDefect[] = [];
    const paragraphs = draft
      .trim()
      .split(/\n\s*\n/gu)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    const seen = new Map<string, number>();

    paragraphs.forEach((paragraph, index) => {
      const normalized = paragraph.replace(/\s+/gu, " ").trim();
      const previous = seen.get(normalized);
      if (previous !== undefined) {
        defects.push(
          createLintDefect({
            id: createLintId("repeated-text", defects.length),
            code: "repeated_text",
            category: "style",
            severity: "soft",
            repairability: "auto",
            routingTarget: "log",
            scope: "paragraph",
            message: `Paragraph ${index + 1} repeats paragraph ${previous + 1} verbatim.`,
            evidence: [normalized],
            confidence: 0.9,
            locationHint: `paragraph:${index + 1}`,
            suggestedFix: "Remove accidental repeated text if it was introduced during generation."
          })
        );
        return;
      }
      seen.set(normalized, index);
    });

    return { defects, passed: defects.length === 0 };
  }
}
