import { Injectable } from "@nestjs/common";

import { GlossaryDoc, LintDefect, LintResult } from "@calibration-domain";

import { DutchResidueRule } from "./rules/dutch-residue.rule";
import { DutchScriptureRule } from "./rules/dutch-scripture.rule";
import { GlossaryRule } from "./rules/glossary.rule";
import { OutputShapeRule } from "./rules/output-shape.rule";
import { PreservedSpansRule } from "./rules/preserved-spans.rule";

@Injectable()
export class LintRunnerService {
  constructor(
    private readonly preservedSpansRule: PreservedSpansRule,
    private readonly dutchScriptureRule: DutchScriptureRule,
    private readonly dutchResidueRule: DutchResidueRule,
    private readonly glossaryRule: GlossaryRule,
    private readonly outputShapeRule: OutputShapeRule
  ) {}

  run(input: { excerptText: string; draft: string; glossaryDoc: GlossaryDoc }): LintResult {
    const preserved = this.preservedSpansRule.run(input.excerptText, input.draft);
    const scripture = this.dutchScriptureRule.run(input.draft);
    const residue = this.dutchResidueRule.run(input.draft);
    const glossary = this.glossaryRule.run(input.excerptText, input.draft, input.glossaryDoc);
    const shape = this.outputShapeRule.run(input.excerptText, input.draft);

    const allDefects: LintDefect[] = [
      ...preserved.defects,
      ...scripture.defects,
      ...residue.defects,
      ...glossary.defects,
      ...shape.defects
    ];
    const hardDefects = allDefects.filter((defect) => defect.severity === "hard");
    const softDefects = allDefects.filter((defect) => defect.severity === "soft");

    return {
      pass: hardDefects.length === 0,
      hardDefects,
      softDefects,
      checks: {
        preservedLanguageIntegrity: preserved.passed ? "pass" : "fail",
        glossaryAdherence: glossary.passed ? "pass" : "fail",
        scriptureReferenceNormalization: scripture.passed ? "pass" : "fail",
        dutchResidue: residue.passed ? "pass" : "fail",
        outputShape: shape.passed ? "pass" : "fail"
      }
    };
  }
}
