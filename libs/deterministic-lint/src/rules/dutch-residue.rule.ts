import { Injectable } from "@nestjs/common";

import { DUTCH_ABBREVIATION_PATTERNS, LintDefect } from "@calibration-domain";

import { createLintDefect, createLintId } from "./rule-helpers";

@Injectable()
export class DutchResidueRule {
  private readonly abbreviationPatterns = DUTCH_ABBREVIATION_PATTERNS.map((pattern) => new RegExp(pattern, "giu"));

  run(draft: string): { defects: LintDefect[]; passed: boolean } {
    const defects: LintDefect[] = [];
    const seen = new Set<string>();

    for (const pattern of this.abbreviationPatterns) {
      for (const match of draft.matchAll(pattern)) {
        const snippet = match[0]?.trim();
        if (!snippet || seen.has(snippet)) {
          continue;
        }
        seen.add(snippet);
        defects.push(createLintDefect({
          id: createLintId("dutch-residue", defects.length),
          code: "untranslated_dutch_abbreviation",
          category: "residue",
          severity: "hard",
          repairability: "auto",
          routingTarget: "repair",
          scope: "span",
          message: `Dutch abbreviation '${snippet}' remains in translation output.`,
          evidence: [snippet],
          confidence: 0.99,
          foundSpan: snippet,
          suggestedFix: "Translate or normalize the Dutch abbreviation into English prose."
        }));
      }
    }

    return { defects, passed: defects.length === 0 };
  }
}
