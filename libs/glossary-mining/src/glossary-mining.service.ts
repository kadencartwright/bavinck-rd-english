import path from "node:path";

import { Injectable } from "@nestjs/common";

import { ArtifactWriterService } from "@artifact-store";
import { PathService } from "@calibration-config";
import {
  GlossaryCandidateMetadataOverview,
  GlossaryCandidateTermsArtifact,
  GlossaryCandidateUsagesArtifact,
  GlossaryMiningConfig,
  GlossaryMiningSource,
  sourceMetadataSchema,
  SourceMetadata
} from "@calibration-domain";

import { DEFAULT_GLOSSARY_MINING_CONFIG, DUTCH_STOPWORDS } from "./constants/mining.constants";
import { PRESERVED_WORD_HINTS, PRESERVED_WORD_STEMS } from "./constants/mining.constants";

interface TokenRecord {
  surface: string;
  normalized: string;
  start: number;
  end: number;
}

interface UsageRecord {
  line: number;
  column_start: number;
  column_end: number;
  absolute_start_offset: number;
  absolute_end_offset: number;
  bucket_index: number;
  line_excerpt: string;
}

interface CandidateAccumulator {
  term: string;
  normalizedTerm: string;
  tokenCount: number;
  extractionRule: "unigram" | "ngram";
  firstSeen: UsageRecord;
  lastSeen: UsageRecord;
  usages: UsageRecord[];
  surfaceForms: Map<string, number>;
}

interface GlossaryMiningRequest {
  sourceTextPath: string;
  metadataPath?: string;
  outputRoot: string;
  configOverrides?: Partial<GlossaryMiningConfig>;
}

interface GlossaryMiningResult {
  source: GlossaryMiningSource;
  outputDir: string;
  candidateTermsPath: string;
  usagesPath: string;
  metadataOverviewPath: string;
  candidateTerms: GlossaryCandidateTermsArtifact;
  usages: GlossaryCandidateUsagesArtifact;
  metadataOverview: GlossaryCandidateMetadataOverview;
}

@Injectable()
export class GlossaryMiningService {
  private readonly wordPattern = /[\p{L}]+(?:[-'’][\p{L}]+)*/gu;
  private readonly stopwords = new Set<string>(DUTCH_STOPWORDS);
  private readonly preservedWordHints = new Set<string>(PRESERVED_WORD_HINTS);
  private readonly preservedWordStems = PRESERVED_WORD_STEMS;
  private readonly greekOrHebrewPattern = /[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]/u;
  private readonly germanOrthographyPattern = /[äöüß]/iu;

  constructor(
    private readonly pathService: PathService,
    private readonly artifactWriter: ArtifactWriterService
  ) {}

  async mine(request: GlossaryMiningRequest): Promise<GlossaryMiningResult> {
    const sourceTextPath = this.pathService.resolveRepoPath(request.sourceTextPath);
    const metadataPath = request.metadataPath
      ? this.pathService.resolveRepoPath(request.metadataPath)
      : await this.inferMetadataPath(sourceTextPath);
    const outputRoot = this.pathService.resolveRepoPath(request.outputRoot);

    const sourceText = await this.pathService.readText(sourceTextPath);
    const config = this.resolveConfig(request.configOverrides);
    const metadata = metadataPath ? await this.loadMetadata(metadataPath) : undefined;
    const source = this.buildSourceDescriptor(sourceTextPath, sourceText, metadataPath, metadata);
    this.assertMetadataMatchesSource(source, metadata);

    const { candidateTerms, usages, metadataOverview } = this.buildArtifacts({
      source,
      sourceText,
      config
    });

    const outputDir = path.join(outputRoot, source.source_id);
    const candidateTermsPath = path.join(outputDir, "candidate-terms.json");
    const usagesPath = path.join(outputDir, "usage-locations.json");
    const metadataOverviewPath = path.join(outputDir, "metadata-overview.json");

    await this.pathService.ensureDir(outputDir);
    await this.artifactWriter.writeJson(candidateTermsPath, candidateTerms);
    await this.artifactWriter.writeJson(usagesPath, usages);
    await this.artifactWriter.writeJson(metadataOverviewPath, metadataOverview);

    return {
      source,
      outputDir,
      candidateTermsPath: this.pathService.relativeToRepo(candidateTermsPath),
      usagesPath: this.pathService.relativeToRepo(usagesPath),
      metadataOverviewPath: this.pathService.relativeToRepo(metadataOverviewPath),
      candidateTerms,
      usages,
      metadataOverview
    };
  }

  private async inferMetadataPath(sourceTextPath: string): Promise<string | undefined> {
    const basename = path.basename(sourceTextPath, path.extname(sourceTextPath));
    const inferred = this.pathService.resolveRepoPath(path.join("data/metadata", `${basename}.json`));
    return (await this.pathService.exists(inferred)) ? inferred : undefined;
  }

  private async loadMetadata(metadataPath: string): Promise<SourceMetadata> {
    return sourceMetadataSchema.parse(await this.pathService.readJson(metadataPath));
  }

  private buildSourceDescriptor(
    sourceTextPath: string,
    sourceText: string,
    metadataPath?: string,
    metadata?: SourceMetadata
  ): GlossaryMiningSource {
    const sourceId = path.basename(sourceTextPath, path.extname(sourceTextPath));
    return {
      source_id: sourceId,
      text_path: this.pathService.relativeToRepo(sourceTextPath),
      metadata_path: metadataPath ? this.pathService.relativeToRepo(metadataPath) : undefined,
      title: metadata?.title,
      author: metadata?.author,
      ebook_id: metadata?.ebook_id,
      clean_sha256: this.pathService.sha256Text(sourceText),
      clean_char_count: sourceText.length
    };
  }

  private assertMetadataMatchesSource(source: GlossaryMiningSource, metadata?: SourceMetadata): void {
    if (!metadata) {
      return;
    }
    if (metadata.clean_sha256 !== source.clean_sha256) {
      throw new Error(
        `Metadata clean_sha256 for '${source.source_id}' does not match the supplied source text.`
      );
    }
    if (metadata.clean_char_count !== source.clean_char_count) {
      throw new Error(
        `Metadata clean_char_count for '${source.source_id}' does not match the supplied source text.`
      );
    }
  }

  private resolveConfig(overrides?: Partial<GlossaryMiningConfig>): GlossaryMiningConfig {
    return {
      ...DEFAULT_GLOSSARY_MINING_CONFIG,
      ...overrides,
      candidate_rules: {
        ...DEFAULT_GLOSSARY_MINING_CONFIG.candidate_rules,
        ...overrides?.candidate_rules
      },
      location_model: {
        ...DEFAULT_GLOSSARY_MINING_CONFIG.location_model,
        ...overrides?.location_model
      },
      filters: {
        ...DEFAULT_GLOSSARY_MINING_CONFIG.filters,
        ...overrides?.filters
      }
    };
  }

  private buildArtifacts(input: {
    source: GlossaryMiningSource;
    sourceText: string;
    config: GlossaryMiningConfig;
  }): {
    candidateTerms: GlossaryCandidateTermsArtifact;
    usages: GlossaryCandidateUsagesArtifact;
    metadataOverview: GlossaryCandidateMetadataOverview;
  } {
    const candidateMap = this.extractCandidates(input.sourceText, input.config);
    const sortedCandidates = [...candidateMap.values()].sort((left, right) =>
      left.normalizedTerm.localeCompare(right.normalizedTerm)
    );

    const totalBucketCount = Math.max(
      1,
      Math.ceil(this.countLines(input.sourceText) / input.config.location_model.bucket_line_span)
    );
    let totalOccurrences = 0;
    let emittedOccurrences = 0;

    const metadataRows = sortedCandidates.map((candidate) => {
      const candidateId = this.buildCandidateId(candidate.normalizedTerm);
      const bucketCount = new Set(candidate.usages.map((usage) => usage.bucket_index)).size;
      const lineCount = new Set(candidate.usages.map((usage) => usage.line)).size;
      const exclusionReasons: Array<"min_occurrences" | "min_bucket_count"> = [];
      if (candidate.usages.length < input.config.filters.min_occurrences) {
        exclusionReasons.push("min_occurrences");
      }
      if (bucketCount < input.config.filters.min_bucket_count) {
        exclusionReasons.push("min_bucket_count");
      }
      totalOccurrences += candidate.usages.length;
      return {
        candidate_id: candidateId,
        normalized_term: candidate.normalizedTerm,
        term: candidate.term,
        token_count: candidate.tokenCount,
        occurrence_count: candidate.usages.length,
        line_count: lineCount,
        bucket_count: bucketCount,
        spread_ratio: Number((bucketCount / totalBucketCount).toFixed(6)),
        first_seen: this.toLocation(candidate.firstSeen),
        last_seen: this.toLocation(candidate.lastSeen),
        retained: exclusionReasons.length === 0,
        exclusion_reasons: exclusionReasons
      };
    });

    const emittedCandidateIdSet = new Set(
      metadataRows
        .filter((candidate) => input.config.filters.emit_excluded_candidates || candidate.retained)
        .map((candidate) => candidate.candidate_id)
    );

    const candidateTermsEntries = sortedCandidates
      .filter((candidate) => emittedCandidateIdSet.has(this.buildCandidateId(candidate.normalizedTerm)))
      .map((candidate) => {
        emittedOccurrences += candidate.usages.length;
        return {
          candidate_id: this.buildCandidateId(candidate.normalizedTerm),
          term: candidate.term,
          normalized_term: candidate.normalizedTerm,
          token_count: candidate.tokenCount,
          extraction_rule: candidate.extractionRule,
          first_seen: this.toLocation(candidate.firstSeen),
          surface_forms: [...candidate.surfaceForms.entries()]
            .sort(([leftForm], [rightForm]) => leftForm.localeCompare(rightForm))
            .map(([form, occurrences]) => ({ form, occurrences }))
        };
      });

    const usageRows = sortedCandidates
      .filter((candidate) => emittedCandidateIdSet.has(this.buildCandidateId(candidate.normalizedTerm)))
      .flatMap((candidate) => {
        const candidateId = this.buildCandidateId(candidate.normalizedTerm);
        return candidate.usages.map((usage, index) => ({
          candidate_id: candidateId,
          normalized_term: candidate.normalizedTerm,
          term: candidate.term,
          occurrence_index: index + 1,
          location: this.toLocation(usage),
          line_excerpt: usage.line_excerpt
        }));
      });

    const retainedCount = metadataRows.filter((candidate) => candidate.retained).length;
    const emittedMetadataRows = metadataRows.filter(
      (candidate) => input.config.filters.emit_excluded_candidates || candidate.retained
    );

    return {
      candidateTerms: {
        schema_version: "1.0",
        artifact_type: "glossary_candidate_terms",
        source: input.source,
        mining_config: input.config,
        candidate_count: candidateTermsEntries.length,
        candidates: candidateTermsEntries
      },
      usages: {
        schema_version: "1.0",
        artifact_type: "glossary_candidate_usages",
        source: input.source,
        mining_config: input.config,
        usage_count: usageRows.length,
        usages: usageRows
      },
      metadataOverview: {
        schema_version: "1.0",
        artifact_type: "glossary_candidate_metadata_overview",
        source: input.source,
        mining_config: input.config,
        summary: {
          candidate_count: metadataRows.length,
          emitted_candidate_count: emittedMetadataRows.length,
          retained_count: retainedCount,
          excluded_count: metadataRows.length - retainedCount,
          total_occurrences: totalOccurrences,
          emitted_occurrence_count: emittedOccurrences,
          total_bucket_count: totalBucketCount
        },
        candidates: emittedMetadataRows
      }
    };
  }

  private extractCandidates(sourceText: string, config: GlossaryMiningConfig): Map<string, CandidateAccumulator> {
    const candidateMap = new Map<string, CandidateAccumulator>();
    const lines = sourceText.split("\n");
    let absoluteOffset = 0;

    lines.forEach((rawLine, lineIndex) => {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      const tokens = this.tokenizeLine(line);
      for (let start = 0; start < tokens.length; start += 1) {
        for (let length = 1; length <= config.candidate_rules.max_ngram; length += 1) {
          const end = start + length;
          if (end > tokens.length) {
            break;
          }

          const windowTokens = tokens.slice(start, end);
          if (!this.tokensAreContiguous(windowTokens, line)) {
            break;
          }

          const extractionRule = length === 1 ? "unigram" : "ngram";
          if (!this.isCandidate(windowTokens, extractionRule, config)) {
            continue;
          }

          const term = windowTokens.map((token) => token.surface).join(" ");
          const normalizedTerm = windowTokens.map((token) => token.normalized).join(" ");
          const firstToken = windowTokens[0];
          const lastToken = windowTokens[windowTokens.length - 1];
          const usage: UsageRecord = {
            line: lineIndex + 1,
            column_start: firstToken.start + 1,
            column_end: lastToken.end,
            absolute_start_offset: absoluteOffset + firstToken.start,
            absolute_end_offset: absoluteOffset + lastToken.end,
            bucket_index:
              Math.floor(lineIndex / config.location_model.bucket_line_span) + 1,
            line_excerpt: this.buildLineExcerpt(line, firstToken.start, lastToken.end)
          };

          const existing = candidateMap.get(normalizedTerm);
          if (existing) {
            existing.usages.push(usage);
            existing.lastSeen = usage;
            existing.surfaceForms.set(term, (existing.surfaceForms.get(term) ?? 0) + 1);
            continue;
          }

          candidateMap.set(normalizedTerm, {
            term,
            normalizedTerm,
            tokenCount: windowTokens.length,
            extractionRule,
            firstSeen: usage,
            lastSeen: usage,
            usages: [usage],
            surfaceForms: new Map([[term, 1]])
          });
        }
      }

      absoluteOffset += rawLine.length;
      if (lineIndex < lines.length - 1) {
        absoluteOffset += 1;
      }
    });

    return candidateMap;
  }

  private tokenizeLine(line: string): TokenRecord[] {
    const tokens: TokenRecord[] = [];
    for (const match of line.matchAll(this.wordPattern)) {
      const surface = match[0];
      const start = match.index ?? 0;
      tokens.push({
        surface,
        normalized: surface.toLocaleLowerCase("nl-NL"),
        start,
        end: start + surface.length
      });
    }
    return tokens;
  }

  private tokensAreContiguous(tokens: TokenRecord[], line: string): boolean {
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const gap = line.slice(tokens[index].end, tokens[index + 1].start);
      if (gap.trim().length > 0) {
        return false;
      }
    }
    return true;
  }

  private isCandidate(
    tokens: TokenRecord[],
    extractionRule: "unigram" | "ngram",
    config: GlossaryMiningConfig
  ): boolean {
    if (tokens.length === 0) {
      return false;
    }

    if (tokens.some((token) => this.isLikelyPreservedToken(token))) {
      return false;
    }

    if (extractionRule === "unigram") {
      return (
        tokens[0].normalized.length >= config.candidate_rules.min_unigram_length &&
        !this.stopwords.has(tokens[0].normalized)
      );
    }

    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    if (this.stopwords.has(first.normalized) || this.stopwords.has(last.normalized)) {
      return false;
    }
    if (
      first.normalized.length < config.candidate_rules.min_ngram_boundary_length ||
      last.normalized.length < config.candidate_rules.min_ngram_boundary_length
    ) {
      return false;
    }
    return tokens.some((token) => !this.stopwords.has(token.normalized));
  }

  private isLikelyPreservedToken(token: TokenRecord): boolean {
    if (this.greekOrHebrewPattern.test(token.surface)) {
      return true;
    }
    if (this.germanOrthographyPattern.test(token.surface)) {
      return true;
    }
    if (this.preservedWordHints.has(token.normalized)) {
      return true;
    }
    if (this.preservedWordStems.some((stem) => token.normalized.startsWith(stem))) {
      return true;
    }
    return false;
  }

  private buildLineExcerpt(line: string, start: number, end: number): string {
    const excerptStart = Math.max(0, start - 40);
    const excerptEnd = Math.min(line.length, end + 40);
    return line.slice(excerptStart, excerptEnd).trim();
  }

  private buildCandidateId(normalizedTerm: string): string {
    return `cand-${this.pathService.sha256Text(normalizedTerm).slice(0, 12)}`;
  }

  private toLocation(usage: UsageRecord) {
    return {
      line: usage.line,
      column_start: usage.column_start,
      column_end: usage.column_end,
      absolute_start_offset: usage.absolute_start_offset,
      absolute_end_offset: usage.absolute_end_offset,
      bucket_index: usage.bucket_index
    };
  }

  private countLines(sourceText: string): number {
    return sourceText.length === 0 ? 1 : sourceText.split("\n").length;
  }
}
