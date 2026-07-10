import { Module } from "@nestjs/common";

import { CalibrationConfigService } from "./config.service";
import { ManifestLoaderService } from "./manifest-loader.service";
import { PathService } from "./path.service";
import { PromptBundleService } from "./prompt-bundle.service";

@Module({
  providers: [CalibrationConfigService, PathService, PromptBundleService, ManifestLoaderService],
  exports: [CalibrationConfigService, PathService, PromptBundleService, ManifestLoaderService]
})
export class CalibrationConfigModule {}

export * from "./config.service";
export * from "./manifest-loader.service";
export * from "./path.service";
export * from "./prompt-bundle.service";
