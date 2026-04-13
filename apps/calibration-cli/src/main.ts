import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { MineGlossaryCandidatesCommand } from "./commands/mine-glossary-candidates.command";
import { RunCalibrationCommand } from "./commands/run-calibration.command";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });

  try {
    const argv = process.argv.slice(2);
    const [command, ...commandArgv] = argv;

    let exitCode: number;
    switch (command) {
      case "run":
        exitCode = await app.get(RunCalibrationCommand).execute(commandArgv);
        break;
      case "mine-glossary-candidates":
        exitCode = await app.get(MineGlossaryCandidatesCommand).execute(commandArgv);
        break;
      default:
        throw new Error("Expected command 'run' or 'mine-glossary-candidates'.");
    }
    process.exitCode = exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
