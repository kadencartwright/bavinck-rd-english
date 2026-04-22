import { Module } from "@nestjs/common";

import { BamlCalibrationClient } from "./baml-calibration.client";

@Module({
  providers: [BamlCalibrationClient],
  exports: [BamlCalibrationClient]
})
export class ProviderModule {}
