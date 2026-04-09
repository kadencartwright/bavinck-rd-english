import { Module } from "@nestjs/common";

import { LintRunnerService } from "./lint-runner.service";
import { DutchResidueRule } from "./rules/dutch-residue.rule";
import { DutchScriptureRule } from "./rules/dutch-scripture.rule";
import { GlossaryRule } from "./rules/glossary.rule";
import { OutputShapeRule } from "./rules/output-shape.rule";
import { PreservedSpansRule } from "./rules/preserved-spans.rule";

@Module({
  providers: [
    PreservedSpansRule,
    DutchScriptureRule,
    DutchResidueRule,
    GlossaryRule,
    OutputShapeRule,
    LintRunnerService
  ],
  exports: [LintRunnerService]
})
export class DeterministicLintModule {}
