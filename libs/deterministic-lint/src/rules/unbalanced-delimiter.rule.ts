import { Injectable } from "@nestjs/common";

import { LintDefect } from "@calibration-domain";

import { createLintDefect, createLintId } from "./rule-helpers";

const DELIMITER_PAIRS: Array<{ open: string; close: string; label: string }> = [
  { open: "(", close: ")", label: "parentheses" },
  { open: "[", close: "]", label: "brackets" },
  { open: '"', close: '"', label: "double quotes" }
];

@Injectable()
export class UnbalancedDelimiterRule {
  run(draft: string): { defects: LintDefect[]; passed: boolean } {
    const defects: LintDefect[] = [];

    DELIMITER_PAIRS.forEach((pair, index) => {
      const openCount = draft.split(pair.open).length - 1;
      const closeCount = draft.split(pair.close).length - 1;
      if (openCount === closeCount) {
        return;
      }

      defects.push(
        createLintDefect({
          id: createLintId("unbalanced-delimiter", index),
          code: "unbalanced_delimiter",
          category: "structure",
          severity: "hard",
          repairability: "auto",
          routingTarget: "repair",
          scope: "document",
          message: `Draft contains unbalanced ${pair.label}.`,
          evidence: [`open=${openCount}`, `close=${closeCount}`],
          confidence: 0.99,
          suggestedFix: `Balance ${pair.label} without changing translation meaning.`
        })
      );
    });

    return { defects, passed: defects.length === 0 };
  }
}
