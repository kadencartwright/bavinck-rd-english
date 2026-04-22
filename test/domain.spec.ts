import { readFile } from "node:fs/promises";

import yaml from "js-yaml";

import {
  glossaryDocSchema,
  modelProfileSchema,
  promptBundleMetadataSchema,
  rubricDocSchema,
  runManifestSchema,
  sliceManifestSchema
} from "@calibration-domain";

describe("domain contracts", () => {
  it("parses the existing manifest and metadata fixtures with Zod", async () => {
    const runManifest = JSON.parse(await readFile("config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json", "utf8"));
    const promptBundleMetadata = JSON.parse(await readFile("config/calibration/prompt-bundles/baseline-v1/metadata.json", "utf8"));
    const modelProfile = JSON.parse(await readFile("config/calibration/model-profiles/kimi-k2_5-glm5-baseline.json", "utf8"));
    const sliceManifest = JSON.parse(await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/manifest.json", "utf8"));
    const glossaryDoc = yaml.load(
      await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/inputs/glossary.yaml", "utf8")
    );
    const rubricDoc = yaml.load(
      await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/inputs/rubric.yaml", "utf8")
    );

    expect(runManifestSchema.parse(runManifest).run_id).toBe("vol2-god-incomprehensibility-001-baseline");
    expect(promptBundleMetadataSchema.parse(promptBundleMetadata).prompt_bundle_id).toBe("baseline-v1");
    expect(promptBundleMetadataSchema.parse(promptBundleMetadata).baml_files.calibration).toBe("baml_src/calibration.baml");
    expect(modelProfileSchema.parse(modelProfile).model_profile_id).toBe("kimi-k2_5-glm5-baseline");
    expect(sliceManifestSchema.parse(sliceManifest).slice_id).toBe("vol2-god-incomprehensibility-001");
    expect(glossaryDocSchema.parse(glossaryDoc).terms.length).toBeGreaterThan(0);
    expect(rubricDocSchema.parse(rubricDoc).criteria.length).toBeGreaterThan(0);
  });

  it("keeps BAML calibration prompts and generator config in repo-backed sources", async () => {
    const generatorConfig = await readFile("baml_src/generators.baml", "utf8");
    const calibrationPrompt = await readFile("baml_src/calibration.baml", "utf8");

    expect(generatorConfig).toContain('output_type "typescript"');
    expect(generatorConfig).toContain('module_format "cjs"');
    expect(calibrationPrompt).toContain("function TranslateCalibrationSlice");
    expect(calibrationPrompt).toContain("function ReviewCalibrationSlice");
    expect(calibrationPrompt).toContain("function RepairCalibrationDraft");
    expect(calibrationPrompt).toContain("template_string SharedReferenceContext");
    expect(calibrationPrompt).toContain("test TranslateCalibrationSliceSmoke");
  });
});
