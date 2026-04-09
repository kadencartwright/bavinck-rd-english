import { Injectable } from "@nestjs/common";

import { CalibrationConfigService, ManifestLoaderService } from "@calibration-config";
import { TranslationWorkflowService } from "@translation-workflow";

export interface RunCalibrationCliOptions {
  runManifest?: string;
  outputRoot?: string;
  evalRoot?: string;
  allowSourceDrift?: boolean;
  dotenvPath?: string;
  skipProviderSmokeTest?: boolean;
  smokeTestOnly?: boolean;
}

@Injectable()
export class RunCalibrationCommand {
  constructor(
    private readonly configService: CalibrationConfigService,
    private readonly manifestLoader: ManifestLoaderService,
    private readonly translationWorkflowService: TranslationWorkflowService
  ) {}

  async execute(argv: string[] = process.argv.slice(3)): Promise<number> {
    const options = this.parseArgs(argv);
    const resolved = this.configService.resolveCliOptions(options);
    await this.configService.loadDotenv(resolved.dotenvPath);

    const bundle = await this.manifestLoader.loadRunManifestBundle(resolved.runManifest);
    console.log(`validated run manifest bundle: ${bundle.runManifestPath.replace(`${process.cwd()}/`, "")}`);

    if (!resolved.skipProviderSmokeTest) {
      await this.translationWorkflowService.smokeTest(bundle.modelProfile);
      if (resolved.smokeTestOnly) {
        console.log("Provider smoke tests passed.");
        return 0;
      }
    } else if (resolved.smokeTestOnly) {
      console.log("Smoke-test-only requested and provider smoke test skipped.");
      return 0;
    }

    const result = await this.translationWorkflowService.runCalibration(resolved);
    console.log(`Transient raw run data: ${result.runDir}`);
    console.log(`Commit-safe eval bundle: ${result.evalDir}`);
    console.log(`Durable evaluation report: ${result.evaluationPath}`);
    return 0;
  }

  private parseArgs(argv: string[]): RunCalibrationCliOptions {
    const options: RunCalibrationCliOptions = {};
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg === "--") {
        continue;
      }
      switch (arg) {
        case "--run-manifest":
          options.runManifest = this.requireValue(arg, argv[++index]);
          break;
        case "--output-root":
          options.outputRoot = this.requireValue(arg, argv[++index]);
          break;
        case "--eval-root":
          options.evalRoot = this.requireValue(arg, argv[++index]);
          break;
        case "--dotenv-path":
          options.dotenvPath = this.requireValue(arg, argv[++index]);
          break;
        case "--allow-source-drift":
          options.allowSourceDrift = true;
          break;
        case "--skip-provider-smoke-test":
          options.skipProviderSmokeTest = true;
          break;
        case "--smoke-test-only":
          options.smokeTestOnly = true;
          break;
        default:
          if (arg.startsWith("--run-manifest=")) {
            options.runManifest = arg.slice("--run-manifest=".length);
            break;
          }
          if (arg.startsWith("--output-root=")) {
            options.outputRoot = arg.slice("--output-root=".length);
            break;
          }
          if (arg.startsWith("--eval-root=")) {
            options.evalRoot = arg.slice("--eval-root=".length);
            break;
          }
          if (arg.startsWith("--dotenv-path=")) {
            options.dotenvPath = arg.slice("--dotenv-path=".length);
            break;
          }
          throw new Error(`Unknown argument '${arg}'.`);
      }
    }
    return options;
  }

  private requireValue(flag: string, value: string | undefined): string {
    if (!value) {
      throw new Error(`Missing value for ${flag}.`);
    }
    return value;
  }
}
