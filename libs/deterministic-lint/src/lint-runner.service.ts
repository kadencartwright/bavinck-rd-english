import { Injectable } from "@nestjs/common";

import { GlossaryDoc, LintDefect, LintResult } from "@calibration-domain";

import { DutchResidueRule } from "./rules/dutch-residue.rule";
import { DutchScriptureRule } from "./rules/dutch-scripture.rule";
import { GlossaryRule } from "./rules/glossary.rule";
import { OutputShapeRule } from "./rules/output-shape.rule";
import { PreservedSpansRule } from "./rules/preserved-spans.rule";
import { RepeatedTextRule } from "./rules/repeated-text.rule";
import { CitationShapeRule } from "./rules/citation-shape.rule";
import { UnbalancedDelimiterRule } from "./rules/unbalanced-delimiter.rule";

@Injectable()
export class LintRunnerService {
  constructor(
    private readonly preservedSpansRule: PreservedSpansRule,
    private readonly dutchScriptureRule: DutchScriptureRule,
    private readonly dutchResidueRule: DutchResidueRule,
    private readonly glossaryRule: GlossaryRule,
    private readonly outputShapeRule: OutputShapeRule,
    private readonly unbalancedDelimiterRule: UnbalancedDelimiterRule,
    private readonly repeatedTextRule: RepeatedTextRule,
    private readonly citationShapeRule: CitationShapeRule
  ) {}

  run(input: { excerptText: string; draft: string; glossaryDoc: GlossaryDoc }): LintResult {
    const preserved = this.preservedSpansRule.run(input.excerptText, input.draft);
    const scripture = this.dutchScriptureRule.run(input.draft);
    const residue = this.dutchResidueRule.run(input.draft);
    const glossary = this.glossaryRule.run(input.excerptText, input.draft, input.glossaryDoc);
    const shape = this.outputShapeRule.run(input.excerptText, input.draft);
    const delimiters = this.unbalancedDelimiterRule.run(input.draft);
    const repeatedText = this.repeatedTextRule.run(input.draft);
    const citationShape = this.citationShapeRule.run(input.draft);

    const allDefects: LintDefect[] = [
      ...preserved.defects,
      ...scripture.defects,
      ...residue.defects,
      ...glossary.defects,
      ...shape.defects,
      ...delimiters.defects,
      ...repeatedText.defects,
      ...citationShape.defects
    ];
    const hardDefects = allDefects.filter((defect) => defect.severity === "hard");
    const softDefects = allDefects.filter((defect) => defect.severity === "soft");

    return {
      pass: hardDefects.length === 0,
      hardDefects,
      softDefects,
      routingSummary: {
        autoRepair: allDefects.filter((defect) => defect.routingTarget === "repair").length,
        judgeReview: allDefects.filter((defect) => defect.routingTarget === "review").length,
        logOnly: allDefects.filter((defect) => defect.routingTarget === "log").length
      },
      checks: {
        preservedLanguageIntegrity: preserved.passed ? "pass" : "fail",
        glossaryAdherence: glossary.passed ? "pass" : "fail",
        scriptureReferenceNormalization: scripture.passed ? "pass" : "fail",
        dutchResidue: residue.passed ? "pass" : "fail",
        outputShape: shape.passed ? "pass" : "fail",
        proseStructure: delimiters.passed && citationShape.passed ? "pass" : "fail"
      }
    };
  }
}
