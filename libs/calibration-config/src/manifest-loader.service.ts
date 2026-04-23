import { promises as fs } from "node:fs";

import { Injectable } from "@nestjs/common";
import yaml from "js-yaml";
import { z } from "zod";

import {
  GlossaryDoc,
  ModelProfile,
  PromptBundleMetadata,
  RubricDoc,
  RunManifest,
  SliceManifest,
  SourceMetadata,
  glossaryDocSchema,
  modelProfileSchema,
  promptBundleMetadataSchema,
  rubricDocSchema,
  runManifestSchema,
  sliceManifestSchema,
  sourceMetadataSchema
} from "@calibration-domain";

import { PathService } from "./path.service";

class CalibrationValidationError extends Error {
  constructor(
    readonly documentType: string,
    readonly documentPath: string | null,
    readonly details: string[]
  ) {
    super(
      [documentPath ? `${documentType}: ${documentPath}` : documentType, ...details.map((detail) => `  - ${detail}`)]
        .filter(Boolean)
        .join("\n")
    );
  }
}

interface RunManifestBundle {
  runManifestPath: string;
  runManifest: RunManifest;
  sliceManifestPath: string;
  sliceManifest: SliceManifest;
  promptBundlePath: string;
  promptBundleMetadata: PromptBundleMetadata;
  modelProfilePath: string;
  modelProfile: ModelProfile;
  sourceMetadata: SourceMetadata;
  sourceMetadataPath: string;
  glossaryPath: string;
  glossaryDoc: GlossaryDoc;
  styleGuidePath: string;
  styleGuideText: string;
  rubricPath: string;
  rubricDoc: RubricDoc;
  rubricText: string;
  excerptPath: string;
  excerptText: string;
  sourceTextPath: string;
}

@Injectable()
export class ManifestLoaderService {
  constructor(private readonly pathService: PathService) {}

  async loadRunManifestBundle(runManifestPathInput: string): Promise<RunManifestBundle> {
    const runManifestPath = this.pathService.resolveRepoPath(runManifestPathInput);
    const runManifest = await this.loadJson(runManifestPath, runManifestSchema, "run_manifest");

    const sliceManifestPath = this.pathService.resolveRepoPath(runManifest.slice_manifest_path);
    const sliceManifest = await this.loadJson(sliceManifestPath, sliceManifestSchema, "slice_manifest");
    if (sliceManifest.slice_id !== runManifest.slice_id) {
      throw new CalibrationValidationError("run_manifest", this.pathService.relativeToRepo(runManifestPath), [
        `slice_id: expected '${runManifest.slice_id}' to match referenced slice manifest '${sliceManifest.slice_id}'`
      ]);
    }

    const sourceMetadataPath = this.pathService.resolveRepoPath(sliceManifest.source.metadata_path);
    const sourceMetadata = await this.loadJson(sourceMetadataPath, sourceMetadataSchema, "source_metadata");
    for (const key of ["title", "author", "ebook_id", "language"] as const) {
      if (sliceManifest.source[key] !== sourceMetadata[key]) {
        throw new CalibrationValidationError("slice_manifest", this.pathService.relativeToRepo(sliceManifestPath), [
          `source.${key}: expected '${sourceMetadata[key]}' to match source metadata`
        ]);
      }
    }

    const sourceTextPath = this.pathService.resolveRepoPath(sliceManifest.source.text_path);
    const sourceText = await this.pathService.readText(sourceTextPath);
    if (this.pathService.sha256Text(sourceText) !== sliceManifest.source_identity.clean_sha256) {
      throw new CalibrationValidationError("slice_manifest", this.pathService.relativeToRepo(sliceManifestPath), [
        "source_identity.clean_sha256: must match the content of source.text_path"
      ]);
    }
    if (sourceText.length !== sliceManifest.source_identity.clean_char_count) {
      throw new CalibrationValidationError("slice_manifest", this.pathService.relativeToRepo(sliceManifestPath), [
        "source_identity.clean_char_count: must match the content length of source.text_path"
      ]);
    }

    const excerptPath = this.pathService.resolveRepoPath(sliceManifest.excerpt.path);
    const excerptText = await this.pathService.readText(excerptPath);
    if (this.pathService.sha256Text(excerptText) !== sliceManifest.excerpt.sha256) {
      throw new CalibrationValidationError("slice_manifest", this.pathService.relativeToRepo(sliceManifestPath), [
        "excerpt.sha256: must match the content of excerpt.path"
      ]);
    }

    const promptBundlePath = this.pathService.resolveRepoPath(runManifest.prompt_bundle_path);
    const promptBundleMetadata = await this.loadJson(
      this.pathService.resolveRepoPath(`${runManifest.prompt_bundle_path}/metadata.json`),
      promptBundleMetadataSchema,
      "prompt_bundle_metadata"
    );
    if (promptBundleMetadata.prompt_bundle_id !== runManifest.prompt_bundle_id) {
      throw new CalibrationValidationError("run_manifest", this.pathService.relativeToRepo(runManifestPath), [
        `prompt_bundle_id: expected '${runManifest.prompt_bundle_id}' to match referenced prompt bundle '${promptBundleMetadata.prompt_bundle_id}'`
      ]);
    }

    const modelProfilePath = this.pathService.resolveRepoPath(runManifest.model_profile_path);
    const modelProfile = await this.loadJson(modelProfilePath, modelProfileSchema, "model_profile");
    if (modelProfile.model_profile_id !== runManifest.model_profile_id) {
      throw new CalibrationValidationError("run_manifest", this.pathService.relativeToRepo(runManifestPath), [
        `model_profile_id: expected '${runManifest.model_profile_id}' to match referenced model profile '${modelProfile.model_profile_id}'`
      ]);
    }

    const glossaryPath = this.pathService.resolveRepoPath(runManifest.glossary_path);
    const styleGuidePath = this.pathService.resolveRepoPath(runManifest.style_guide_path);
    const rubricPath = this.pathService.resolveRepoPath(runManifest.rubric_path);
    this.assertExpectedInputPath("glossary_path", glossaryPath, sliceManifest.expected_inputs.glossary_path, sliceManifestPath);
    this.assertExpectedInputPath(
      "style_guide_path",
      styleGuidePath,
      sliceManifest.expected_inputs.style_guide_path,
      sliceManifestPath
    );
    this.assertExpectedInputPath("rubric_path", rubricPath, sliceManifest.expected_inputs.rubric_path, sliceManifestPath);

    const glossaryDoc = await this.loadYaml(glossaryPath, glossaryDocSchema, "slice_glossary");
    if (glossaryDoc.slice_id !== runManifest.slice_id) {
      throw new CalibrationValidationError("slice_glossary", this.pathService.relativeToRepo(glossaryPath), [
        `slice_id: expected '${runManifest.slice_id}'`
      ]);
    }

    const rubricDoc = await this.loadYaml(rubricPath, rubricDocSchema, "slice_rubric");
    if (rubricDoc.slice_id !== runManifest.slice_id) {
      throw new CalibrationValidationError("slice_rubric", this.pathService.relativeToRepo(rubricPath), [
        `slice_id: expected '${runManifest.slice_id}'`
      ]);
    }

    return {
      runManifestPath,
      runManifest,
      sliceManifestPath,
      sliceManifest,
      promptBundlePath,
      promptBundleMetadata,
      modelProfilePath,
      modelProfile,
      sourceMetadata,
      sourceMetadataPath,
      glossaryPath,
      glossaryDoc,
      styleGuidePath,
      styleGuideText: await this.pathService.readText(styleGuidePath),
      rubricPath,
      rubricDoc,
      rubricText: await this.pathService.readText(rubricPath),
      excerptPath,
      excerptText,
      sourceTextPath
    };
  }

  async assertSourceDrift(bundle: RunManifestBundle, allowSourceDrift: boolean): Promise<{ drifted: boolean; currentSha: string }> {
    const sourceText = await this.pathService.readText(bundle.sourceTextPath);
    const currentSha = this.pathService.sha256Text(sourceText);
    const drifted = currentSha !== bundle.sliceManifest.source_identity.clean_sha256;
    if (drifted && !allowSourceDrift) {
      throw new Error(
        "Source drift detected between the current cleaned source and the stored slice manifest. " +
          "Rerun with --allow-source-drift only if you are intentionally auditing drift."
      );
    }
    return { drifted, currentSha };
  }

  async loadJson<T>(targetPath: string, schema: z.ZodType<T>, documentType: string): Promise<T> {
    let payload: unknown;
    try {
      payload = JSON.parse(await fs.readFile(targetPath, "utf8"));
    } catch (error) {
      const parseError = error as Error & { message?: string };
      throw new CalibrationValidationError(documentType, this.pathService.relativeToRepo(targetPath), [
        `invalid JSON: ${parseError.message ?? "unknown parse error"}`
      ]);
    }
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw this.toValidationError(documentType, targetPath, result.error);
    }
    return result.data;
  }

  async loadYaml<T>(targetPath: string, schema: z.ZodType<T>, documentType: string): Promise<T> {
    let payload: unknown;
    try {
      payload = yaml.load(await fs.readFile(targetPath, "utf8"));
    } catch (error) {
      const parseError = error as Error & { message?: string };
      throw new CalibrationValidationError(documentType, this.pathService.relativeToRepo(targetPath), [
        `invalid YAML: ${parseError.message ?? "unknown parse error"}`
      ]);
    }
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw this.toValidationError(documentType, targetPath, result.error);
    }
    return result.data;
  }

  private assertExpectedInputPath(
    fieldName: string,
    actualPath: string,
    expectedRelativePath: string,
    sliceManifestPath: string
  ): void {
    const expectedPath = this.pathService.resolveRepoPath(expectedRelativePath);
    if (actualPath !== expectedPath) {
      throw new CalibrationValidationError("run_manifest", this.pathService.relativeToRepo(sliceManifestPath), [
        `${fieldName}: expected ${this.pathService.relativeToRepo(expectedPath)} to match slice manifest expected input`
      ]);
    }
  }

  private toValidationError(documentType: string, targetPath: string, error: z.ZodError): CalibrationValidationError {
    return new CalibrationValidationError(
      documentType,
      this.pathService.relativeToRepo(targetPath),
      error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    );
  }
}
