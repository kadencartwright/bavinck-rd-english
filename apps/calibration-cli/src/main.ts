import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { RunCalibrationCommand } from "./commands/run-calibration.command";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });

  try {
    const argv = process.argv.slice(2);
    const [command] = argv;
    if (command !== "run") {
      throw new Error("Expected command 'run'.");
    }

    const runner = app.get(RunCalibrationCommand);
    const exitCode = await runner.execute(argv.slice(1));
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
