import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  glossaryCandidateMetadataOverviewSchema,
  glossaryCandidateTermsArtifactSchema,
  glossaryCandidateUsagesArtifactSchema
} from "@calibration-domain";
import { PathService } from "@calibration-config";
import { ArtifactWriterService } from "@artifact-store";
import {
  DEFAULT_GLOSSARY_MINING_CONFIG,
  GlossaryMiningService
} from "@glossary-mining";

describe("glossary mining service", () => {
  const pathService = new PathService();
  const artifactWriter = new ArtifactWriterService(pathService);
  const miningService = new GlossaryMiningService(pathService, artifactWriter);

  it("produces stable artifacts with complete usage accounting and retain/exclude metadata", async () => {
    const tempRoot = await mkdtemp(path.join(process.cwd(), ".tmp-glossary-mining-"));

    try {
      const sourcePath = path.join(tempRoot, "fixture.txt");
      const outputRoot = path.join(tempRoot, "artifacts");
      await writeFile(
        sourcePath,
        [
          "De Raad Gods is groot.",
          "De raad Gods blijft wijs.",
          "De kenbaarheid Gods en de raad Gods komen terug.",
          "Een enkel begrip blijft lokaal.",
          "Contra Celsum en das Wesen blijven onvertaald.",
          "Het grieksche δογμα en het hebreeuwsche אֱלֹהִים blijven ook onvertaald."
        ].join("\n"),
        "utf8"
      );

      const request = {
        sourceTextPath: pathService.relativeToRepo(sourcePath),
        outputRoot: pathService.relativeToRepo(outputRoot),
        configOverrides: {
          ...DEFAULT_GLOSSARY_MINING_CONFIG,
          location_model: {
            ...DEFAULT_GLOSSARY_MINING_CONFIG.location_model,
            bucket_line_span: 2
          },
          filters: {
            ...DEFAULT_GLOSSARY_MINING_CONFIG.filters,
            min_occurrences: 2,
            min_bucket_count: 2,
            emit_excluded_candidates: false
          }
        }
      };

      const firstRun = await miningService.mine(request);
      const secondRun = await miningService.mine(request);

      const firstCandidateText = await readFile(path.join(process.cwd(), firstRun.candidateTermsPath), "utf8");
      const secondCandidateText = await readFile(path.join(process.cwd(), secondRun.candidateTermsPath), "utf8");
      const firstUsageText = await readFile(path.join(process.cwd(), firstRun.usagesPath), "utf8");
      const secondUsageText = await readFile(path.join(process.cwd(), secondRun.usagesPath), "utf8");
      const firstMetadataText = await readFile(path.join(process.cwd(), firstRun.metadataOverviewPath), "utf8");
      const secondMetadataText = await readFile(path.join(process.cwd(), secondRun.metadataOverviewPath), "utf8");

      expect(firstCandidateText).toBe(secondCandidateText);
      expect(firstUsageText).toBe(secondUsageText);
      expect(firstMetadataText).toBe(secondMetadataText);

      const candidateTerms = glossaryCandidateTermsArtifactSchema.parse(JSON.parse(firstCandidateText));
      const usages = glossaryCandidateUsagesArtifactSchema.parse(JSON.parse(firstUsageText));
      const metadata = glossaryCandidateMetadataOverviewSchema.parse(JSON.parse(firstMetadataText));

      expect(candidateTerms.candidate_count).toBe(metadata.summary.emitted_candidate_count);
      expect(usages.usage_count).toBe(
        metadata.candidates.reduce((total, candidate) => total + candidate.occurrence_count, 0)
      );
      expect(metadata.summary.excluded_count).toBeGreaterThan(0);

      const retained = metadata.candidates.find((candidate) => candidate.normalized_term === "raad gods");
      expect(retained).toMatchObject({
        occurrence_count: 3,
        bucket_count: 2,
        retained: true,
        exclusion_reasons: []
      });

      const excluded = metadata.candidates.find((candidate) => candidate.normalized_term === "kenbaarheid gods");
      expect(excluded).toBeUndefined();

      const retainedUsages = usages.usages.filter((usage) => usage.normalized_term === "raad gods");
      expect(retainedUsages).toHaveLength(3);
      expect(retainedUsages.map((usage) => usage.location.line)).toEqual([1, 2, 3]);

      expect(candidateTerms.candidates.some((candidate) => candidate.normalized_term === "contra celsum")).toBe(false);
      expect(candidateTerms.candidates.some((candidate) => candidate.normalized_term === "das wesen")).toBe(false);
      expect(candidateTerms.candidates.some((candidate) => candidate.normalized_term === "δογμα")).toBe(false);
      expect(candidateTerms.candidates.some((candidate) => candidate.normalized_term === "אֱלֹהִים")).toBe(false);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
