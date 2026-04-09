import { LintRunnerService } from "@deterministic-lint";
import { glossaryDocSchema } from "@calibration-domain";
import { DutchResidueRule } from "@deterministic-lint/rules/dutch-residue.rule";
import { DutchScriptureRule } from "@deterministic-lint/rules/dutch-scripture.rule";
import { GlossaryRule } from "@deterministic-lint/rules/glossary.rule";
import { OutputShapeRule } from "@deterministic-lint/rules/output-shape.rule";
import { PreservedSpansRule } from "@deterministic-lint/rules/preserved-spans.rule";

describe("deterministic lint", () => {
  const preservedRule = new PreservedSpansRule();
  const scriptureRule = new DutchScriptureRule();
  const residueRule = new DutchResidueRule();
  const glossaryRule = new GlossaryRule();
  const outputShapeRule = new OutputShapeRule();
  const runner = new LintRunnerService(
    preservedRule,
    scriptureRule,
    residueRule,
    glossaryRule,
    outputShapeRule
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
  });
});
