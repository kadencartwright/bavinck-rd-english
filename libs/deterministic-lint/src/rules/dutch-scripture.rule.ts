import { Injectable } from "@nestjs/common";

import {
  DUTCH_SCRIPTURE_REFERENCE_FORMS,
  SCRIPTURE_REFERENCE_SUFFIX,
  LintDefect
} from "@calibration-domain";

@Injectable()
export class DutchScriptureRule {
  private readonly patterns = DUTCH_SCRIPTURE_REFERENCE_FORMS.map(
    (form) => new RegExp(`${form}${SCRIPTURE_REFERENCE_SUFFIX}`, "gu")
  );

  run(draft: string): { defects: LintDefect[]; passed: boolean } {
    const defects: LintDefect[] = [];
    const seen = new Set<string>();
    for (const pattern of this.patterns) {
      for (const match of draft.matchAll(pattern)) {
        const snippet = match[0]?.trim();
        if (!snippet || seen.has(snippet)) {
          continue;
        }
        seen.add(snippet);
        defects.push({
          code: "untranslated_dutch_scripture_reference",
          severity: "hard",
          message: `Untranslated Dutch Scripture reference '${snippet}' remains in translation output.`,
          evidence: [snippet],
          foundSpan: snippet,
          suggestedFix: "Normalize Dutch Scripture references into standard English forms."
        });
      }
    }
    return { defects, passed: defects.length === 0 };
  }
}
