import { Module } from "@nestjs/common";

import { ArtifactStoreModule } from "@artifact-store";
import { CalibrationConfigModule } from "@calibration-config";

import { GlossaryMiningService } from "./glossary-mining.service";

@Module({
  imports: [CalibrationConfigModule, ArtifactStoreModule],
  providers: [GlossaryMiningService],
  exports: [GlossaryMiningService]
})
export class GlossaryMiningModule {}
