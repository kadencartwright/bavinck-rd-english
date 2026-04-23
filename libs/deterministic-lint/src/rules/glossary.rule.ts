import { Injectable } from "@nestjs/common";

import { GlossaryDoc, LintDefect } from "@calibration-domain";

import { createLintDefect, createLintId } from "./rule-helpers";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

@Injectable()
export class GlossaryRule {
  run(excerptText: string, draft: string, glossaryDoc: GlossaryDoc): { defects: LintDefect[]; passed: boolean } {
    const defects: LintDefect[] = [];
    for (const term of glossaryDoc.terms) {
      if (!excerptText.includes(term.source)) {
        continue;
      }
      const rawTarget = term.target.trim();
      const titleCaseTarget = rawTarget.length > 0 ? `${rawTarget[0].toUpperCase()}${rawTarget.slice(1)}` : rawTarget;
      const targetPattern = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(rawTarget)}|${escapeRegExp(titleCaseTarget)})([^\\p{L}]|$)`, "iu");
      if (targetPattern.test(draft)) {
        continue;
      }
      defects.push(createLintDefect({
        id: createLintId("glossary", defects.length),
        code: "glossary_target_missing",
        category: "glossary",
        severity: "hard",
        repairability: "auto",
        routingTarget: "repair",
        scope: "document",
        message: `Glossary target '${term.target}' is missing for source term '${term.source}'.`,
        evidence: [term.source, term.target],
        confidence: 0.99,
        suggestedFix: "Restore the expected glossary target in the translated passage."
      }));
    }
    return { defects, passed: defects.length === 0 };
  }
}
