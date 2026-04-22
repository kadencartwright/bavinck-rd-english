import { Module } from "@nestjs/common";

import { CalibrationConfigService } from "./config.service";
import { ManifestLoaderService } from "./manifest-loader.service";
import { PathService } from "./path.service";

@Module({
  providers: [CalibrationConfigService, PathService, ManifestLoaderService],
  exports: [CalibrationConfigService, PathService, ManifestLoaderService]
})
export class CalibrationConfigModule {}

export * from "./config.service";
export * from "./manifest-loader.service";
export * from "./path.service";
