import { promises as fs } from "node:fs";

import { Injectable } from "@nestjs/common";

import {
  DEFAULT_DOTENV_PATH,
  DEFAULT_EVAL_ROOT,
  DEFAULT_MAX_REPAIR_ROUNDS,
  DEFAULT_OUTPUT_ROOT,
  DEFAULT_RUN_MANIFEST
} from "@calibration-domain";

export interface ResolvedCalibrationCliOptions {
  runManifest: string;
  outputRoot: string;
  evalRoot: string;
  allowSourceDrift: boolean;
  dotenvPath: string;
  skipProviderSmokeTest: boolean;
  smokeTestOnly: boolean;
  maxRepairRounds: number;
  streamTranslation: boolean;
  streamLlm: boolean;
}

export type CalibrationCliOptionsInput = Partial<ResolvedCalibrationCliOptions>;

@Injectable()
export class CalibrationConfigService {
  resolveCliOptions(options: CalibrationCliOptionsInput): ResolvedCalibrationCliOptions {
    return {
      runManifest: options.runManifest ?? DEFAULT_RUN_MANIFEST,
      outputRoot: options.outputRoot ?? DEFAULT_OUTPUT_ROOT,
      evalRoot: options.evalRoot ?? DEFAULT_EVAL_ROOT,
      allowSourceDrift: options.allowSourceDrift ?? false,
      dotenvPath: options.dotenvPath ?? DEFAULT_DOTENV_PATH,
      skipProviderSmokeTest: options.skipProviderSmokeTest ?? false,
      smokeTestOnly: options.smokeTestOnly ?? false,
      maxRepairRounds: options.maxRepairRounds ?? DEFAULT_MAX_REPAIR_ROUNDS,
      streamTranslation: options.streamTranslation ?? false,
      streamLlm: options.streamLlm ?? false
    };
  }

  async loadDotenv(dotenvPath: string): Promise<void> {
    try {
      const text = await fs.readFile(dotenvPath, "utf8");
      for (const rawLine of text.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) {
          continue;
        }
        const [key, ...rest] = line.split("=");
        if (!key.trim()) {
          continue;
        }
        const value = rest.join("=").trim().replace(/^['"]|['"]$/gu, "");
        if (!(key.trim() in process.env)) {
          process.env[key.trim()] = value;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
