import { Injectable, Logger } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";
import { ManifestLoaderService } from "@calibration-config";

import { CalibrationRuntimeState } from "../graph/graph-state";

@Injectable()
export class LoadInputsNode {
  private readonly logger = new Logger(LoadInputsNode.name);

  constructor(
    private readonly manifestLoader: ManifestLoaderService,
    private readonly artifactWriter: ArtifactWriterService
  ) {}

  async execute(state: CalibrationRuntimeState): Promise<Partial<CalibrationRuntimeState>> {
    this.logger.log(`Loading inputs from manifest ${state.runManifestPath}`);
    const bundle = await this.manifestLoader.loadRunManifestBundle(state.runManifestPath);
    const drift = await this.manifestLoader.assertSourceDrift(bundle, state.allowSourceDrift);
    const runDirectories = await this.artifactWriter.prepareRunDirectories(bundle.runManifest.run_id, state.outputRoot);

    await this.artifactWriter.snapshotStableInputs({
      directories: runDirectories,
      runManifestPath: bundle.runManifestPath,
      sliceManifestPath: bundle.sliceManifestPath,
      modelProfilePath: bundle.modelProfilePath,
      promptBundlePath: bundle.promptBundlePath,
      glossaryPath: bundle.glossaryPath,
      styleGuidePath: bundle.styleGuidePath,
      rubricPath: bundle.rubricPath,
      excerptPath: bundle.excerptPath,
      sourceTextPath: bundle.sourceTextPath,
      sourceMetadataPath: bundle.sourceMetadataPath
    });

    this.logger.log(
      `Prepared run ${bundle.runManifest.run_id} for slice ${bundle.runManifest.slice_id}; drift=${drift.drifted ? "yes" : "no"}`
    );

    return {
      runId: bundle.runManifest.run_id,
      runManifestPath: bundle.runManifestPath,
      runManifest: bundle.runManifest,
      sliceManifest: bundle.sliceManifest,
      excerptText: bundle.excerptText,
      translationDrafts: [],
      currentDraft: null,
      lintResults: [],
      repairRound: 0,
      reviewPayload: null,
      terminalStatus: "pending",
      terminalReason: null,
      sourceDrift: drift.drifted,
      currentSourceSha: drift.currentSha,
      promptBundleMetadata: bundle.promptBundleMetadata,
      promptBundle: bundle.promptBundle,
      modelProfile: bundle.modelProfile,
      glossaryDoc: bundle.glossaryDoc,
      rubricDoc: bundle.rubricDoc,
      styleGuideText: bundle.styleGuideText,
      rubricText: bundle.rubricText,
      promptBundlePath: bundle.promptBundlePath,
      modelProfilePath: bundle.modelProfilePath,
      sliceManifestPath: bundle.sliceManifestPath,
      glossaryPath: bundle.glossaryPath,
      styleGuidePath: bundle.styleGuidePath,
      rubricPath: bundle.rubricPath,
      excerptPath: bundle.excerptPath,
      sourceTextPath: bundle.sourceTextPath,
      sourceMetadataPath: bundle.sourceMetadataPath,
      runDirectories
    };
  }
}
