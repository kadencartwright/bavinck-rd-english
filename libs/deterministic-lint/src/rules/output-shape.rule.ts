import { Injectable } from "@nestjs/common";

import { OUTPUT_COMMENTARY_PATTERNS, LintDefect } from "@calibration-domain";

function splitParagraphs(value: string): string[] {
  return value
    .trim()
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

@Injectable()
export class OutputShapeRule {
  run(excerptText: string, draft: string): { defects: LintDefect[]; passed: boolean } {
    const defects: LintDefect[] = [];
    const trimmed = draft.trim();

    if (!trimmed) {
      defects.push({
        code: "output_shape_violation",
        severity: "hard",
        message: "Translation output is empty.",
        evidence: ["empty output"],
        suggestedFix: "Return only the translated passage."
      });
      return { defects, passed: false };
    }

    if (trimmed.includes("```")) {
      defects.push({
        code: "output_shape_violation",
        severity: "hard",
        message: "Translation output contains markdown fences.",
        evidence: ["```"],
        suggestedFix: "Remove markdown fences and return only the translated passage."
      });
    }

    for (const pattern of OUTPUT_COMMENTARY_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        defects.push({
          code: "output_shape_violation",
          severity: "hard",
          message: "Translation output contains prefatory notes or reviewer commentary.",
          evidence: [match[0]],
          suggestedFix: "Remove commentary and return only the translated passage."
        });
      }
    }

    const sourceParagraphs = splitParagraphs(excerptText);
    const draftParagraphs = splitParagraphs(draft);
    if (sourceParagraphs.length !== draftParagraphs.length) {
      defects.push({
        code: "output_shape_violation",
        severity: "hard",
        message: "Translation output does not preserve paragraph structure.",
        evidence: [`source=${sourceParagraphs.length}`, `draft=${draftParagraphs.length}`],
        suggestedFix: "Preserve the source excerpt paragraph structure in the translation."
      });
    }

    return { defects, passed: defects.length === 0 };
  }
}
