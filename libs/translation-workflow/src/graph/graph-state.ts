import { Annotation } from "@langchain/langgraph";

import {
  CalibrationGraphState,
  GlossaryDoc,
  LintResult,
  ModelProfile,
  PromptBundleMetadata,
  ReviewPayload,
  ReviewRequestRecord,
  RubricDoc,
  RunManifest,
  SliceManifest,
  TranslationRequestRecord
} from "@calibration-domain";
import { PromptBundleLoadResult } from "@calibration-config";
import { RunDirectorySet } from "@artifact-store";

type StageRecord = {
  provider: "moonshot" | "z-ai";
  model: string;
  temperature: number;
  promptFiles: Record<string, string>;
  finishReason?: string;
  maxTokens?: number;
  timeoutSeconds?: number;
  usage?: Record<string, number>;
};

function replaceField<T>(defaultFactory: () => T) {
  return Annotation<T>({
    reducer: (_left, right) => right,
    default: defaultFactory
  });
}

export interface CalibrationRuntimeState
  extends Omit<CalibrationGraphState, "runManifest" | "sliceManifest" | "reviewPayload"> {
  runManifest: RunManifest | null;
  sliceManifest: SliceManifest | null;
  reviewPayload: ReviewPayload | null;
  outputRoot: string;
  evalRoot: string;
  allowSourceDrift: boolean;
  sourceDrift: boolean;
  currentSourceSha: string | null;
  promptBundleMetadata: PromptBundleMetadata | null;
  promptBundle: PromptBundleLoadResult | null;
  modelProfile: ModelProfile | null;
  glossaryDoc: GlossaryDoc | null;
  rubricDoc: RubricDoc | null;
  styleGuideText: string;
  rubricText: string;
  promptBundlePath: string | null;
  modelProfilePath: string | null;
  sliceManifestPath: string | null;
  glossaryPath: string | null;
  styleGuidePath: string | null;
  rubricPath: string | null;
  excerptPath: string | null;
  sourceTextPath: string | null;
  sourceMetadataPath: string | null;
  runDirectories: RunDirectorySet | null;
  translationRequestRecord: TranslationRequestRecord | null;
  translationResponse: Record<string, unknown> | null;
  reviewRequestRecord: ReviewRequestRecord | null;
  reviewResponse: Record<string, unknown> | null;
  translationPromptSystem: string | null;
  translationPromptUser: string | null;
  reviewPromptSystem: string | null;
  reviewPromptUser: string | null;
  stageRecords: Record<string, StageRecord>;
  durableEvalDir: string | null;
  streamTranslation: boolean;
  streamLlm: boolean;
}

export const CalibrationRuntimeStateAnnotation = Annotation.Root({
  runId: replaceField(() => "pending-run"),
  runManifestPath: replaceField(() => ""),
  runManifest: replaceField<RunManifest | null>(() => null),
  sliceManifest: replaceField<SliceManifest | null>(() => null),
  excerptText: replaceField(() => ""),
  translationDrafts: replaceField<string[]>(() => []),
  currentDraft: replaceField<string | null>(() => null),
  lintResults: replaceField<LintResult[]>(() => []),
  repairRound: replaceField(() => 0),
  maxRepairRounds: replaceField(() => 2),
  reviewPayload: replaceField<ReviewPayload | null>(() => null),
  terminalStatus: replaceField<CalibrationGraphState["terminalStatus"]>(() => "pending"),
  terminalReason: replaceField<string | null>(() => null),
  outputRoot: replaceField(() => "data/calibration/runs"),
  evalRoot: replaceField(() => "data/calibration/evals"),
  allowSourceDrift: replaceField(() => false),
  sourceDrift: replaceField(() => false),
  currentSourceSha: replaceField<string | null>(() => null),
  promptBundleMetadata: replaceField<PromptBundleMetadata | null>(() => null),
  promptBundle: replaceField<PromptBundleLoadResult | null>(() => null),
  modelProfile: replaceField<ModelProfile | null>(() => null),
  glossaryDoc: replaceField<GlossaryDoc | null>(() => null),
  rubricDoc: replaceField<RubricDoc | null>(() => null),
  styleGuideText: replaceField(() => ""),
  rubricText: replaceField(() => ""),
  promptBundlePath: replaceField<string | null>(() => null),
  modelProfilePath: replaceField<string | null>(() => null),
  sliceManifestPath: replaceField<string | null>(() => null),
  glossaryPath: replaceField<string | null>(() => null),
  styleGuidePath: replaceField<string | null>(() => null),
  rubricPath: replaceField<string | null>(() => null),
  excerptPath: replaceField<string | null>(() => null),
  sourceTextPath: replaceField<string | null>(() => null),
  sourceMetadataPath: replaceField<string | null>(() => null),
  runDirectories: replaceField<RunDirectorySet | null>(() => null),
  translationRequestRecord: replaceField<TranslationRequestRecord | null>(() => null),
  translationResponse: replaceField<Record<string, unknown> | null>(() => null),
  reviewRequestRecord: replaceField<ReviewRequestRecord | null>(() => null),
  reviewResponse: replaceField<Record<string, unknown> | null>(() => null),
  translationPromptSystem: replaceField<string | null>(() => null),
  translationPromptUser: replaceField<string | null>(() => null),
  reviewPromptSystem: replaceField<string | null>(() => null),
  reviewPromptUser: replaceField<string | null>(() => null),
  stageRecords: replaceField<Record<string, StageRecord>>(() => ({})),
  durableEvalDir: replaceField<string | null>(() => null),
  streamTranslation: replaceField(() => false),
  streamLlm: replaceField(() => false)
});
