import { Module } from "@nestjs/common";

import { LintRunnerService } from "./lint-runner.service";
import { DutchResidueRule } from "./rules/dutch-residue.rule";
import { DutchScriptureRule } from "./rules/dutch-scripture.rule";
import { GlossaryRule } from "./rules/glossary.rule";
import { OutputShapeRule } from "./rules/output-shape.rule";
import { PreservedSpansRule } from "./rules/preserved-spans.rule";
import { RepeatedTextRule } from "./rules/repeated-text.rule";
import { CitationShapeRule } from "./rules/citation-shape.rule";
import { UnbalancedDelimiterRule } from "./rules/unbalanced-delimiter.rule";

@Module({
  providers: [
    PreservedSpansRule,
    DutchScriptureRule,
    DutchResidueRule,
    GlossaryRule,
    OutputShapeRule,
    UnbalancedDelimiterRule,
    RepeatedTextRule,
    CitationShapeRule,
    LintRunnerService
  ],
  exports: [LintRunnerService]
})
export class DeterministicLintModule {}
