import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { Test } from "@nestjs/testing";

import { TranslationWorkflowModule, TranslationWorkflowService } from "@translation-workflow";
import { BamlCalibrationClient } from "@provider-clients";

import {
  ACTUAL_MANIFEST_PATH,
  buildBrokenTranslation,
  buildCleanTranslation,
  buildReviewResult,
  buildStageUsage,
  cleanupTempRoot,
  makeTempCalibrationRoots
} from "./helpers/calibration-fixture";

describe("translation workflow integration", () => {
  async function createService(mockResults: {
    translations: string[];
    repairs?: string[];
    review?: ReturnType<typeof buildReviewResult>;
  }) {
    const mockClient = {
      translate: jest.fn().mockImplementation(async () => {
        const next = mockResults.translations.shift();
        if (!next) {
          throw new Error("No translation mock left.");
        }
        return {
          value: next.trimEnd(),
          messages: [
            { role: "system", content: "translation system" },
            { role: "user", content: "translation user" }
          ],
          prompt: { system: "translation system", user: "translation user" },
          promptFiles: {
            baml_clients: "baml_src/clients.baml",
            baml_function_source: "baml_src/calibration.baml",
            baml_function: "TranslateCalibrationSlice"
          },
          response: { raw_llm_response: next, usage: buildStageUsage() },
          finishReason: "stop",
          usage: buildStageUsage()
        };
      }),
      repair: jest.fn().mockImplementation(async () => {
        const next = mockResults.repairs?.shift();
        if (!next) {
          throw new Error("No repair mock left.");
        }
        return {
          value: next.trimEnd(),
          messages: [
            { role: "system", content: "repair system" },
            { role: "user", content: "repair user" }
          ],
          prompt: { system: "repair system", user: "repair user" },
          promptFiles: {
            baml_clients: "baml_src/clients.baml",
            baml_function_source: "baml_src/calibration.baml",
            baml_function: "RepairCalibrationDraft"
          },
          response: { raw_llm_response: next, usage: buildStageUsage() },
          finishReason: "stop",
          usage: buildStageUsage()
        };
      }),
      review: jest.fn().mockImplementation(async () => {
        if (!mockResults.review) {
          throw new Error("No review mock configured.");
        }
        return {
          value: mockResults.review,
          messages: [
            { role: "system", content: "review system" },
            { role: "user", content: "review user" }
          ],
          prompt: { system: "review system", user: "review user" },
          promptFiles: {
            baml_clients: "baml_src/clients.baml",
            baml_function_source: "baml_src/calibration.baml",
            baml_function: "ReviewCalibrationSlice"
          },
          response: { raw_llm_response: JSON.stringify(mockResults.review), usage: buildStageUsage() },
          finishReason: "stop",
          usage: buildStageUsage()
        };
      }),
      smokeTestStage: jest.fn()
    };

    const moduleRef = await Test.createTestingModule({
      imports: [TranslationWorkflowModule]
    })
      .overrideProvider(BamlCalibrationClient)
      .useValue(mockClient)
      .compile();

    return {
      service: moduleRef.get(TranslationWorkflowService),
      close: () => moduleRef.close(),
      mockClient
    };
  }

  it("routes translate -> lint -> review for a clean actual fixture run", async () => {
    const excerptText = await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/excerpt.txt", "utf8");
    const glossaryText = await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/inputs/glossary.yaml", "utf8");
    const roots = await makeTempCalibrationRoots();
    const { service, close } = await createService({
      translations: [buildCleanTranslation(excerptText, glossaryText)],
      review: buildReviewResult()
    });

    try {
      const result = await service.runCalibration({
        runManifest: ACTUAL_MANIFEST_PATH,
        outputRoot: roots.runs,
        evalRoot: roots.evals,
        allowSourceDrift: false,
        dotenvPath: ".env",
        skipProviderSmokeTest: true,
        smokeTestOnly: false,
        maxRepairRounds: 2,
        streamTranslation: false,
        streamLlm: false
      });

      await expect(access(path.join(result.evalDir, "review-structured.json"))).resolves.toBeUndefined();
      await expect(access(path.join(result.evalDir, "findings.md"))).resolves.toBeUndefined();
      await expect(access(path.join(result.evalDir, "evaluation.json"))).resolves.toBeUndefined();
      const evaluation = JSON.parse(await readFile(path.join(result.evalDir, "evaluation.json"), "utf8"));
      const evalRecord = JSON.parse(await readFile(path.join(result.evalDir, "eval-record.json"), "utf8"));
      expect(JSON.stringify(evaluation)).not.toContain(process.cwd());
      expect(evalRecord.stages.review.finish_reason).toBe("stop");
      expect(evalRecord.stages.review.usage.total_tokens).toBeGreaterThan(0);
      expect(evaluation.token_usage.totals.total_tokens).toBeGreaterThan(0);
      expect(evaluation.token_usage.totals.billable_tokens).toBeGreaterThan(0);
      expect(evalRecord.token_usage.totals.total_tokens).toBe(evaluation.token_usage.totals.total_tokens);
    } finally {
      await close();
      await cleanupTempRoot(roots.root);
    }
  });

  it("routes translate -> lint -> repair -> lint -> review when one repair clears defects", async () => {
    const excerptText = await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/excerpt.txt", "utf8");
    const glossaryText = await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/inputs/glossary.yaml", "utf8");
    const roots = await makeTempCalibrationRoots();
    const { service, close } = await createService({
      translations: [buildBrokenTranslation(excerptText)],
      repairs: [buildCleanTranslation(excerptText, glossaryText)],
      review: buildReviewResult("Review completed after repair.")
    });

    try {
      const result = await service.runCalibration({
        runManifest: ACTUAL_MANIFEST_PATH,
        outputRoot: roots.runs,
        evalRoot: roots.evals,
        allowSourceDrift: false,
        dotenvPath: ".env",
        skipProviderSmokeTest: true,
        smokeTestOnly: false,
        maxRepairRounds: 2,
        streamTranslation: false,
        streamLlm: false
      });

      await expect(access(path.join(result.runDir, "outputs", "translation-round-0.md"))).resolves.toBeUndefined();
      await expect(access(path.join(result.runDir, "outputs", "translation-round-1.md"))).resolves.toBeUndefined();
      await expect(access(path.join(result.runDir, "reports", "lint-round-0.json"))).resolves.toBeUndefined();
      await expect(access(path.join(result.runDir, "reports", "lint-round-1.json"))).resolves.toBeUndefined();
      await expect(access(path.join(result.evalDir, "review-structured.json"))).resolves.toBeUndefined();
    } finally {
      await close();
      await cleanupTempRoot(roots.root);
    }
  });

  it("routes to escalation after exhausting repair rounds", async () => {
    const excerptText = await readFile("data/calibration/slices/vol2-god-incomprehensibility-001/excerpt.txt", "utf8");
    const roots = await makeTempCalibrationRoots();
    const { service, close } = await createService({
      translations: [buildBrokenTranslation(excerptText)],
      repairs: [buildBrokenTranslation(excerptText), buildBrokenTranslation(excerptText)]
    });

    try {
      const result = await service.runCalibration({
        runManifest: ACTUAL_MANIFEST_PATH,
        outputRoot: roots.runs,
        evalRoot: roots.evals,
        allowSourceDrift: false,
        dotenvPath: ".env",
        skipProviderSmokeTest: true,
        smokeTestOnly: false,
        maxRepairRounds: 2,
        streamTranslation: false,
        streamLlm: false
      });

      await expect(access(path.join(result.evalDir, "unresolved-defects.json"))).resolves.toBeUndefined();
      await expect(access(path.join(result.evalDir, "review-structured.json"))).rejects.toThrow();
      await expect(access(path.join(result.evalDir, "findings.md"))).rejects.toThrow();
    } finally {
      await close();
      await cleanupTempRoot(roots.root);
    }
  });
});
