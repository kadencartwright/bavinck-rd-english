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
import { PathService, PromptBundleService } from "@calibration-config";

describe("domain contracts", () => {
  const pathService = new PathService();
  const promptBundleService = new PromptBundleService(pathService);

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
    expect(modelProfileSchema.parse(modelProfile).model_profile_id).toBe("kimi-k2_5-glm5-baseline");
    expect(sliceManifestSchema.parse(sliceManifest).slice_id).toBe("vol2-god-incomprehensibility-001");
    expect(glossaryDocSchema.parse(glossaryDoc).terms.length).toBeGreaterThan(0);
    expect(rubricDocSchema.parse(rubricDoc).criteria.length).toBeGreaterThan(0);
  });

  it("renders translation prompts with the expected placeholders substituted", async () => {
    const metadata = promptBundleMetadataSchema.parse(
      JSON.parse(await readFile("config/calibration/prompt-bundles/baseline-v1/metadata.json", "utf8"))
    );
    const promptBundle = await promptBundleService.load("config/calibration/prompt-bundles/baseline-v1", metadata);
    const modelProfile = modelProfileSchema.parse(
      JSON.parse(await readFile("config/calibration/model-profiles/kimi-k2_5-glm5-baseline.json", "utf8"))
    );
    const runManifest = runManifestSchema.parse(
      JSON.parse(await readFile("config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json", "utf8"))
    );
    const sliceManifest = sliceManifestSchema.parse(
      JSON.parse(await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/manifest.json", "utf8"))
    );

    const built = promptBundleService.buildTranslationRequestRecord({
      runId: runManifest.run_id,
      runManifest,
      sliceManifest,
      promptBundle,
      modelProfile,
      excerptText: "Excerpt text.",
      glossaryText: "terms:\n- source: dogmatiek\n  target: dogmatics",
      styleGuideText: "Use formal English."
    });

    expect(built.messages[1].content).toContain(runManifest.run_id);
    expect(built.messages[1].content).toContain(sliceManifest.title);
    expect(built.messages[1].content).toContain("Excerpt text.");
    expect(built.messages[1].content).toContain("dogmatiek");
    expect(built.requestRecord.prompt_files.translation_system).toBe("translation-system.txt");
  });
});
