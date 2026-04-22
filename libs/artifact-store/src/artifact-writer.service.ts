import { promises as fs } from "node:fs";
import path from "node:path";

import { Injectable } from "@nestjs/common";

import { LintDefect, LintResult, ReviewPayload } from "@calibration-domain";
import { PathService } from "@calibration-config";

export interface RunDirectorySet {
  runDir: string;
  inputsDir: string;
  outputsDir: string;
  reviewDir: string;
  reportsDir: string;
}

@Injectable()
export class ArtifactWriterService {
  constructor(private readonly pathService: PathService) {}

  async prepareRunDirectories(runId: string, outputRoot: string): Promise<RunDirectorySet> {
    const runDir = this.pathService.resolveRepoPath(path.join(outputRoot, runId));
    const paths: RunDirectorySet = {
      runDir,
      inputsDir: path.join(runDir, "inputs"),
      outputsDir: path.join(runDir, "outputs"),
      reviewDir: path.join(runDir, "review"),
      reportsDir: path.join(runDir, "reports")
    };
    await Promise.all(Object.values(paths).map((value) => this.pathService.ensureDir(value)));
    return paths;
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await this.pathService.ensureDir(path.dirname(destinationPath));
    await fs.copyFile(sourcePath, destinationPath);
  }

  async writeJson(targetPath: string, payload: unknown): Promise<void> {
    await this.pathService.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  async writeText(targetPath: string, payload: string): Promise<void> {
    await this.pathService.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, payload, "utf8");
  }

  async snapshotStableInputs(input: {
    directories: RunDirectorySet;
    runManifestPath: string;
    sliceManifestPath: string;
    modelProfilePath: string;
    promptBundlePath: string;
    glossaryPath: string;
    styleGuidePath: string;
    rubricPath: string;
    excerptPath: string;
    sourceTextPath: string;
    sourceMetadataPath: string;
  }): Promise<void> {
    const copies: Array<[string, string]> = [
      [input.sourceTextPath, path.join(input.directories.inputsDir, "source.txt")],
      [input.sourceMetadataPath, path.join(input.directories.inputsDir, "source-metadata.json")],
      [input.excerptPath, path.join(input.directories.inputsDir, "excerpt.txt")],
      [input.glossaryPath, path.join(input.directories.inputsDir, "glossary.yaml")],
      [input.styleGuidePath, path.join(input.directories.inputsDir, "style-guide.md")],
      [input.rubricPath, path.join(input.directories.inputsDir, "rubric.yaml")],
      [input.runManifestPath, path.join(input.directories.inputsDir, "run-manifest.json")],
      [input.sliceManifestPath, path.join(input.directories.inputsDir, "slice-manifest.json")],
      [input.modelProfilePath, path.join(input.directories.inputsDir, "model-profile.json")],
      [path.join(input.promptBundlePath, "metadata.json"), path.join(input.directories.inputsDir, "prompt-bundle-metadata.json")]
    ];
    await Promise.all(copies.map(([source, destination]) => this.copyFile(source, destination)));

    const bamlSourceDir = this.pathService.resolveRepoPath("baml_src");
    if (await this.pathService.exists(bamlSourceDir)) {
      const entries = await fs.readdir(bamlSourceDir, { withFileTypes: true });
      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".baml"))
          .map((entry) =>
            this.copyFile(
              path.join(bamlSourceDir, entry.name),
              path.join(input.directories.inputsDir, "baml_src", entry.name)
            )
          )
      );
    }
  }

  async writeTranslationRound(directories: RunDirectorySet, round: number, translation: string, response?: unknown): Promise<void> {
    await this.writeText(path.join(directories.outputsDir, `translation-round-${round}.md`), `${translation.trimEnd()}\n`);
    if (response !== undefined) {
      await this.writeJson(path.join(directories.outputsDir, `translation-response-round-${round}.json`), response);
    }
  }

  async writeLintRound(directories: RunDirectorySet, round: number, lintResult: LintResult): Promise<void> {
    await this.writeJson(path.join(directories.reportsDir, `lint-round-${round}.json`), lintResult);
  }

  async writeTranslationRequest(directories: RunDirectorySet, payload: unknown): Promise<void> {
    await this.writeJson(path.join(directories.inputsDir, "translation-request.json"), payload);
  }

  async writeRepairRequest(directories: RunDirectorySet, round: number, payload: unknown): Promise<void> {
    await this.writeJson(path.join(directories.outputsDir, `repair-request-round-${round}.json`), payload);
  }

  async writeReviewRequest(directories: RunDirectorySet, payload: unknown): Promise<void> {
    await this.writeJson(path.join(directories.reviewDir, "review-request.json"), payload);
  }

  async writeReviewResponse(directories: RunDirectorySet, payload: unknown): Promise<void> {
    await this.writeJson(path.join(directories.reviewDir, "review-response.json"), payload);
  }

  async writeReviewPayload(directories: RunDirectorySet, payload: ReviewPayload): Promise<void> {
    await this.writeJson(path.join(directories.reviewDir, "review-structured.json"), payload);
  }

  async writeUnresolvedDefects(directories: RunDirectorySet, defects: LintDefect[]): Promise<void> {
    await this.writeJson(path.join(directories.reportsDir, "unresolved-defects.json"), defects);
  }

  async removeTransientPublishableArtifacts(directories: RunDirectorySet): Promise<void> {
    for (const targetPath of [
      path.join(directories.outputsDir, "translation.md"),
      path.join(directories.reviewDir, "findings.md"),
      path.join(directories.reportsDir, "evaluation.json"),
      path.join(directories.reportsDir, "evaluation.md")
    ]) {
      try {
        await fs.unlink(targetPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }
  }
}
