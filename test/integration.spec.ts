import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { Test } from "@nestjs/testing";

import { TranslationWorkflowModule, TranslationWorkflowService } from "@translation-workflow";
import { OpenAiCompatibleClient } from "@provider-clients";

import {
  ACTUAL_MANIFEST_PATH,
  buildBrokenTranslation,
  buildCleanTranslation,
  buildReviewResponse,
  cleanupTempRoot,
  makeTempCalibrationRoots
} from "./helpers/calibration-fixture";

describe("translation workflow integration", () => {
  async function createService(mockResponses: Array<Record<string, unknown>>) {
    const mockClient = {
      createChatCompletion: jest.fn().mockImplementation(async () => {
        const response = mockResponses.shift();
        if (!response) {
          throw new Error("No mock response left.");
        }
        return response;
      }),
      extractMessageText: jest.fn((response: Record<string, unknown>) => {
        const choices = response.choices as Array<{ message: { content: string } }>;
        return choices[0].message.content;
      }),
      smokeTestStage: jest.fn()
    };

    const moduleRef = await Test.createTestingModule({
      imports: [TranslationWorkflowModule]
    })
      .overrideProvider(OpenAiCompatibleClient)
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
    const { service, close } = await createService([
      { choices: [{ message: { content: buildCleanTranslation(excerptText, glossaryText) }, finish_reason: "stop" }] },
      buildReviewResponse()
    ]);

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
        streamTranslation: false
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
    const { service, close } = await createService([
      { choices: [{ message: { content: buildBrokenTranslation(excerptText) }, finish_reason: "stop" }] },
      { choices: [{ message: { content: buildCleanTranslation(excerptText, glossaryText) }, finish_reason: "stop" }] },
      buildReviewResponse("Review completed after repair.")
    ]);

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
        streamTranslation: false
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
    const { service, close } = await createService([
      { choices: [{ message: { content: buildBrokenTranslation(excerptText) }, finish_reason: "stop" }] },
      { choices: [{ message: { content: buildBrokenTranslation(excerptText) }, finish_reason: "stop" }] },
      { choices: [{ message: { content: buildBrokenTranslation(excerptText) }, finish_reason: "stop" }] }
    ]);

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
        streamTranslation: false
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
