import { Injectable } from "@nestjs/common";

import { LintDefect } from "@calibration-domain";

import { createLintDefect, createLintId } from "./rule-helpers";

const CITATION_SHAPE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\b[A-Z][a-z]{1,12}\.\s+\d+\s+\d+\b/gu,
    message: "Citation appears to be missing a chapter-verse separator."
  },
  {
    pattern: /\b[A-Z][a-z]{1,12}\.\d+:\d+\b/gu,
    message: "Citation is missing the space between book abbreviation and reference."
  }
];

@Injectable()
export class CitationShapeRule {
  run(draft: string): { defects: LintDefect[]; passed: boolean } {
    const defects: LintDefect[] = [];
    const seen = new Set<string>();

    CITATION_SHAPE_PATTERNS.forEach(({ pattern, message }) => {
      for (const match of draft.matchAll(pattern)) {
        const snippet = match[0]?.trim();
        if (!snippet || seen.has(snippet)) {
          continue;
        }
        seen.add(snippet);
        defects.push(
          createLintDefect({
            id: createLintId("citation-shape", defects.length),
            code: "citation_shape_damage",
            category: "citation",
            severity: "hard",
            repairability: "auto",
            routingTarget: "repair",
            scope: "span",
            message,
            evidence: [snippet],
            confidence: 0.95,
            foundSpan: snippet,
            suggestedFix: "Normalize the citation into standard English book + chapter:verse form."
          })
        );
      }
    });

    return { defects, passed: defects.length === 0 };
  }
}
