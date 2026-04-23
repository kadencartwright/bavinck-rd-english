import { Injectable } from "@nestjs/common";

import { LintDefect } from "@calibration-domain";

import { createLintDefect, createLintId } from "./rule-helpers";

function stripCombiningMarks(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
}

function extractPreservedSpans(text: string): string[] {
  const matches = text.match(/[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]+/gu) ?? [];
  return [...new Set(matches)];
}

@Injectable()
export class PreservedSpansRule {
  run(excerptText: string, draft: string): { defects: LintDefect[]; passed: boolean } {
    const sourceSpans = extractPreservedSpans(excerptText);
    const translatedSpans = extractPreservedSpans(draft);
    const defects: LintDefect[] = [];

    for (const sourceSpan of sourceSpans) {
      if (translatedSpans.includes(sourceSpan)) {
        continue;
      }

      const normalizedSource = stripCombiningMarks(sourceSpan);
      const foundSpan = translatedSpans.find((candidate) => stripCombiningMarks(candidate) === normalizedSource);
      if (foundSpan) {
        defects.push(createLintDefect({
          id: createLintId("preserved-span", defects.length),
          code: "preserved_span_changed",
          category: "preservation",
          severity: "hard",
          repairability: "auto",
          routingTarget: "repair",
          scope: "span",
          message: `Preserved span '${sourceSpan}' was altered in translation output.`,
          evidence: [sourceSpan, foundSpan],
          confidence: 1,
          sourceSpan,
          foundSpan,
          suggestedFix: "Restore the preserved Greek or Hebrew span exactly as it appears in the source excerpt."
        }));
        continue;
      }

      defects.push(createLintDefect({
        id: createLintId("preserved-span", defects.length),
        code: "preserved_span_missing",
        category: "preservation",
        severity: "hard",
        repairability: "auto",
        routingTarget: "repair",
        scope: "span",
        message: `Preserved span '${sourceSpan}' is missing from translation output.`,
        evidence: [sourceSpan],
        confidence: 1,
        sourceSpan,
        suggestedFix: "Reinsert the preserved Greek or Hebrew span unchanged."
      }));
    }

    return { defects, passed: defects.length === 0 };
  }
}
