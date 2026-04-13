import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { ArtifactStoreModule } from "@artifact-store";
import { CalibrationConfigModule } from "@calibration-config";
import { DeterministicLintModule } from "@deterministic-lint";
import { GlossaryMiningModule } from "@glossary-mining";
import { ProviderModule } from "@provider-clients";
import { TranslationWorkflowModule } from "@translation-workflow";

import { MineGlossaryCandidatesCommand } from "./commands/mine-glossary-candidates.command";
import { RunCalibrationCommand } from "./commands/run-calibration.command";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CalibrationConfigModule,
    ProviderModule,
    ArtifactStoreModule,
    DeterministicLintModule,
    GlossaryMiningModule,
    TranslationWorkflowModule
  ],
  providers: [RunCalibrationCommand, MineGlossaryCandidatesCommand]
})
export class AppModule {}
