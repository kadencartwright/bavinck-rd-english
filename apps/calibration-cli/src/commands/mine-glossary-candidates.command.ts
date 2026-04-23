import { Injectable } from "@nestjs/common";

import {
  DEFAULT_GLOSSARY_MINING_ROOT,
  GlossaryMiningConfig
} from "@calibration-domain";
import { DEFAULT_GLOSSARY_MINING_CONFIG, GlossaryMiningService } from "@glossary-mining";

interface MineGlossaryCandidatesCliOptions {
  sourceText?: string;
  metadata?: string;
  outputRoot?: string;
  minOccurrences?: number;
  minBucketCount?: number;
  bucketLineSpan?: number;
}

@Injectable()
export class MineGlossaryCandidatesCommand {
  constructor(private readonly glossaryMiningService: GlossaryMiningService) {}

  async execute(argv: string[] = process.argv.slice(3)): Promise<number> {
    const options = this.parseArgs(argv);
    if (!options.sourceText) {
      throw new Error("Missing required argument '--source-text'.");
    }

    const configOverrides: Partial<GlossaryMiningConfig> = {
      filters: {
        min_occurrences: options.minOccurrences ?? DEFAULT_GLOSSARY_MINING_CONFIG.filters.min_occurrences,
        min_bucket_count: options.minBucketCount ?? DEFAULT_GLOSSARY_MINING_CONFIG.filters.min_bucket_count,
        emit_excluded_candidates: false
      },
      location_model: {
        line_numbers: "1-based",
        columns: "1-based",
        offsets: "utf16-code-unit",
        bucket_index: "1-based",
        bucket_line_span: options.bucketLineSpan ?? DEFAULT_GLOSSARY_MINING_CONFIG.location_model.bucket_line_span
      }
    };

    const result = await this.glossaryMiningService.mine({
      sourceTextPath: options.sourceText,
      metadataPath: options.metadata,
      outputRoot: options.outputRoot ?? DEFAULT_GLOSSARY_MINING_ROOT,
      configOverrides
    });

    console.log(`source: ${result.source.source_id} (${result.source.text_path})`);
    console.log(`candidate artifact: ${result.candidateTermsPath}`);
    console.log(`usage artifact: ${result.usagesPath}`);
    console.log(`metadata artifact: ${result.metadataOverviewPath}`);
    console.log(
      `candidates: ${result.candidateTerms.candidate_count} | retained: ${result.metadataOverview.summary.retained_count} | excluded: ${result.metadataOverview.summary.excluded_count}`
    );
    return 0;
  }

  private parseArgs(argv: string[]): MineGlossaryCandidatesCliOptions {
    const options: MineGlossaryCandidatesCliOptions = {};

    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg === "--") {
        continue;
      }

      switch (arg) {
        case "--source-text":
          options.sourceText = this.requireValue(arg, argv[++index]);
          break;
        case "--metadata":
          options.metadata = this.requireValue(arg, argv[++index]);
          break;
        case "--output-root":
          options.outputRoot = this.requireValue(arg, argv[++index]);
          break;
        case "--min-occurrences":
          options.minOccurrences = this.requirePositiveInteger(arg, argv[++index]);
          break;
        case "--min-bucket-count":
          options.minBucketCount = this.requirePositiveInteger(arg, argv[++index]);
          break;
        case "--bucket-line-span":
          options.bucketLineSpan = this.requirePositiveInteger(arg, argv[++index]);
          break;
        default:
          if (arg.startsWith("--source-text=")) {
            options.sourceText = arg.slice("--source-text=".length);
            break;
          }
          if (arg.startsWith("--metadata=")) {
            options.metadata = arg.slice("--metadata=".length);
            break;
          }
          if (arg.startsWith("--output-root=")) {
            options.outputRoot = arg.slice("--output-root=".length);
            break;
          }
          if (arg.startsWith("--min-occurrences=")) {
            options.minOccurrences = this.parsePositiveInteger(
              "--min-occurrences",
              arg.slice("--min-occurrences=".length)
            );
            break;
          }
          if (arg.startsWith("--min-bucket-count=")) {
            options.minBucketCount = this.parsePositiveInteger(
              "--min-bucket-count",
              arg.slice("--min-bucket-count=".length)
            );
            break;
          }
          if (arg.startsWith("--bucket-line-span=")) {
            options.bucketLineSpan = this.parsePositiveInteger(
              "--bucket-line-span",
              arg.slice("--bucket-line-span=".length)
            );
            break;
          }
          throw new Error(`Unknown argument '${arg}'.`);
      }
    }

    return options;
  }

  private requireValue(flag: string, value: string | undefined): string {
    if (!value) {
      throw new Error(`Missing value for ${flag}.`);
    }
    return value;
  }

  private requirePositiveInteger(flag: string, value: string | undefined): number {
    return this.parsePositiveInteger(flag, this.requireValue(flag, value));
  }

  private parsePositiveInteger(flag: string, value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Expected ${flag} to be a positive integer.`);
    }
    return parsed;
  }
}
