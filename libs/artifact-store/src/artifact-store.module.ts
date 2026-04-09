import { Module } from "@nestjs/common";

import { CalibrationConfigModule } from "@calibration-config";

import { ArtifactWriterService } from "./artifact-writer.service";
import { EvalExportService } from "./eval-export.service";

@Module({
  imports: [CalibrationConfigModule],
  providers: [ArtifactWriterService, EvalExportService],
  exports: [ArtifactWriterService, EvalExportService]
})
export class ArtifactStoreModule {}
