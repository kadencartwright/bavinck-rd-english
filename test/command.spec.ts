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
