import { MineGlossaryCandidatesCommand } from "../apps/calibration-cli/src/commands/mine-glossary-candidates.command";
import { RunCalibrationCommand } from "../apps/calibration-cli/src/commands/run-calibration.command";

describe("run calibration command", () => {
  it("supports smoke-test-only mode", async () => {
    const configService = {
      resolveCliOptions: jest.fn().mockReturnValue({
        runManifest: "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json",
        outputRoot: "data/calibration/runs",
        evalRoot: "data/calibration/evals",
        allowSourceDrift: false,
        dotenvPath: ".env",
        skipProviderSmokeTest: true,
        smokeTestOnly: true,
        maxRepairRounds: 2,
        streamTranslation: false
      }),
      loadDotenv: jest.fn().mockResolvedValue(undefined)
    };
    const manifestLoader = {
      loadRunManifestBundle: jest.fn().mockResolvedValue({
        runManifestPath: "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json",
        runManifest: {
          run_id: "vol2-god-incomprehensibility-001-baseline",
          slice_id: "vol2-god-incomprehensibility-001"
        },
        modelProfile: {}
      })
    };
    const workflowService = {
      smokeTest: jest.fn(),
      runCalibration: jest.fn()
    };

    const command = new RunCalibrationCommand(
      configService as never,
      manifestLoader as never,
      workflowService as never
    );

    await expect(command.execute(["--skip-provider-smoke-test", "--smoke-test-only"])).resolves.toBe(0);
    expect(manifestLoader.loadRunManifestBundle).toHaveBeenCalled();
    expect(workflowService.smokeTest).not.toHaveBeenCalled();
    expect(workflowService.runCalibration).not.toHaveBeenCalled();
  });
});

describe("mine glossary candidates command", () => {
  it("parses CLI flags and passes config overrides to the mining service", async () => {
    const miningService = {
      mine: jest.fn().mockResolvedValue({
        source: {
          source_id: "pg67966",
          text_path: "data/clean/pg67966.txt"
        },
        candidateTermsPath: "data/calibration/glossary-candidates/pg67966/candidate-terms.json",
        usagesPath: "data/calibration/glossary-candidates/pg67966/usage-locations.json",
        metadataOverviewPath: "data/calibration/glossary-candidates/pg67966/metadata-overview.json",
        candidateTerms: {
          candidate_count: 12
        },
        metadataOverview: {
          summary: {
            retained_count: 7,
            excluded_count: 5
          }
        }
      })
    };

    const command = new MineGlossaryCandidatesCommand(miningService as never);

    await expect(
      command.execute([
        "--source-text",
        "data/clean/pg67966.txt",
        "--min-occurrences",
        "3",
        "--min-bucket-count",
        "2",
        "--bucket-line-span",
        "50"
      ])
    ).resolves.toBe(0);

    expect(miningService.mine).toHaveBeenCalledWith({
      sourceTextPath: "data/clean/pg67966.txt",
      metadataPath: undefined,
      outputRoot: "data/calibration/glossary-candidates",
      configOverrides: {
        filters: {
          min_occurrences: 3,
          min_bucket_count: 2,
          emit_excluded_candidates: false
        },
        location_model: {
          line_numbers: "1-based",
          columns: "1-based",
          offsets: "utf16-code-unit",
          bucket_index: "1-based",
          bucket_line_span: 50
        }
      }
    });
  });
});
