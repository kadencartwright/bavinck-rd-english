import { LintRunnerService } from "@deterministic-lint";
import { glossaryDocSchema } from "@calibration-domain";
import { DutchResidueRule } from "@deterministic-lint/rules/dutch-residue.rule";
import { DutchScriptureRule } from "@deterministic-lint/rules/dutch-scripture.rule";
import { GlossaryRule } from "@deterministic-lint/rules/glossary.rule";
import { OutputShapeRule } from "@deterministic-lint/rules/output-shape.rule";
import { PreservedSpansRule } from "@deterministic-lint/rules/preserved-spans.rule";
import { RepeatedTextRule } from "@deterministic-lint/rules/repeated-text.rule";
import { CitationShapeRule } from "@deterministic-lint/rules/citation-shape.rule";
import { UnbalancedDelimiterRule } from "@deterministic-lint/rules/unbalanced-delimiter.rule";

describe("deterministic lint", () => {
  const preservedRule = new PreservedSpansRule();
  const scriptureRule = new DutchScriptureRule();
  const residueRule = new DutchResidueRule();
  const glossaryRule = new GlossaryRule();
  const outputShapeRule = new OutputShapeRule();
  const unbalancedDelimiterRule = new UnbalancedDelimiterRule();
  const repeatedTextRule = new RepeatedTextRule();
  const citationShapeRule = new CitationShapeRule();
  const runner = new LintRunnerService(
    preservedRule,
    scriptureRule,
    residueRule,
    glossaryRule,
    outputShapeRule,
    unbalancedDelimiterRule,
    repeatedTextRule,
    citationShapeRule
  );

  it("detects exact preserved-span changes", () => {
    const result = preservedRule.run("Greek ἐν and Hebrew אֱלֹהִים.", "Greek εν and Hebrew אֱלֹהִים.");
    expect(result.passed).toBe(false);
    expect(result.defects[0]?.code).toBe("preserved_span_changed");
  });

  it("accepts glossary targets case-insensitively", () => {
    const glossary = glossaryDocSchema.parse({
      schema_version: "1.0",
      slice_id: "slice",
      terms: [{ source: "dogmatiek", target: "dogmatics" }]
    });
    const result = glossaryRule.run("dogmatiek appears here.", "DOGMATICS remains formal.", glossary);
    expect(result.passed).toBe(true);
  });

  it("detects untranslated Dutch Scripture references", () => {
    const result = scriptureRule.run("Acts 17:23, but Hd. 17:28 and Op. 22:4 remain.");
    expect(result.defects.map((defect) => defect.foundSpan)).toEqual(["Hd. 17:28", "Op. 22:4"]);
  });

  it("detects output-shape violations", () => {
    const result = outputShapeRule.run("Paragraph one.\n\nParagraph two.", "```markdown\ntext\n```");
    expect(result.passed).toBe(false);
    expect(result.defects.some((defect) => defect.code === "output_shape_violation")).toBe(true);
  });

  it("detects unbalanced delimiters as hard prose-structure defects", () => {
    const result = unbalancedDelimiterRule.run('Formal text with an unmatched " quote.');
    expect(result.passed).toBe(false);
    expect(result.defects[0]?.code).toBe("unbalanced_delimiter");
    expect(result.defects[0]?.severity).toBe("hard");
  });

  it("detects repeated paragraphs as soft prose findings", () => {
    const result = repeatedTextRule.run("Same paragraph.\n\nSame paragraph.");
    expect(result.passed).toBe(false);
    expect(result.defects[0]?.code).toBe("repeated_text");
    expect(result.defects[0]?.severity).toBe("soft");
  });

  it("detects malformed citation shape", () => {
    const result = citationShapeRule.run("Formal prose with Acts.17:28 still malformed.");
    expect(result.passed).toBe(false);
    expect(result.defects[0]?.code).toBe("citation_shape_damage");
  });

  it("serializes lint results with hard defects", () => {
    const glossary = glossaryDocSchema.parse({
      schema_version: "1.0",
      slice_id: "slice",
      terms: [{ source: "dogmatiek", target: "dogmatics" }]
    });
    const result = runner.run({
      excerptText: "dogmatiek ἐν",
      draft: "Hd. 17:28",
      glossaryDoc: glossary
    });
    const serialized = JSON.parse(JSON.stringify(result));
    expect(serialized.pass).toBe(false);
    expect(serialized.hardDefects.length).toBeGreaterThan(0);
    expect(serialized.routingSummary.autoRepair).toBeGreaterThan(0);
  });
});
