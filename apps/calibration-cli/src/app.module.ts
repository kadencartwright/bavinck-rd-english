import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { ArtifactStoreModule } from "@artifact-store";
import { CalibrationConfigModule } from "@calibration-config";
import { DeterministicLintModule } from "@deterministic-lint";
import { ProviderModule } from "@provider-clients";
import { TranslationWorkflowModule } from "@translation-workflow";

import { RunCalibrationCommand } from "./commands/run-calibration.command";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CalibrationConfigModule,
    ProviderModule,
    ArtifactStoreModule,
    DeterministicLintModule,
    TranslationWorkflowModule
  ],
  providers: [RunCalibrationCommand]
})
export class AppModule {}
