import { z } from "zod";

import { FIXED_TEMPERATURE_MODELS } from "../constants/runtime.constants";

const slugRegex = /^[a-z0-9][a-z0-9._-]*$/;
const sha256Regex = /^[0-9a-f]{64}$/;

const nonEmptyString = z.string().trim().min(1);
const optionalNullableString = nonEmptyString.nullish();
const slugString = nonEmptyString.regex(slugRegex, "must be filesystem-safe slug characters");
const sha256String = nonEmptyString.regex(sha256Regex, "must be a SHA-256 hex digest");
const unitIntervalNumber = z.number().min(0).max(1);
const findingScopeSchema = z.enum(["document", "paragraph", "sentence", "span"]);
const repairabilitySchema = z.enum(["auto", "needs_judge", "manual"]);
const routingTargetSchema = z.enum(["repair", "review", "log"]);
const routeDecisionValueSchema = z.enum(["accept", "repair", "re_review", "escalate"]);
const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: nonEmptyString
});

export const sourceMetadataSchema = z
  .object({
    source_file: nonEmptyString,
    source_format: z.literal("project_gutenberg_txt"),
    title: nonEmptyString,
    author: nonEmptyString,
    language: nonEmptyString,
    ebook_id: nonEmptyString,
    raw_char_count: z.number().int().positive(),
    clean_char_count: z.number().int().positive(),
    raw_sha256: sha256String,
    clean_sha256: sha256String,
    preserves_editor_notes: z.boolean(),
    release_date: optionalNullableString,
    updated_date: optionalNullableString,
    gutenberg_url: optionalNullableString,
    original_publication: optionalNullableString,
    credits: optionalNullableString
  })
  .superRefine((value, ctx) => {
    if (value.raw_char_count < value.clean_char_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["raw_char_count"],
        message: "must be greater than or equal to clean_char_count"
      });
    }
  });

export const sliceManifestSchema = z
  .object({
    schema_version: z.literal("1.0"),
    slice_id: slugString,
    title: nonEmptyString,
    rationale: nonEmptyString,
    stressors: z.array(nonEmptyString).min(1),
    source: z.object({
      text_path: nonEmptyString,
      metadata_path: nonEmptyString,
      title: nonEmptyString,
      author: nonEmptyString,
      ebook_id: nonEmptyString,
      language: nonEmptyString
    }),
    selection: z
      .object({
        section_number: z.number().int().positive(),
        section_title: nonEmptyString,
        start_subsection: z.number().int().positive().nullable(),
        end_subsection: z.number().int().positive().nullable(),
        start_line: z.number().int().positive(),
        end_line: z.number().int().positive()
      })
      .superRefine((value, ctx) => {
        if (value.start_line > value.end_line) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["start_line"],
            message: "must be less than or equal to end_line"
          });
        }
        if ((value.start_subsection === null) !== (value.end_subsection === null)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["start_subsection"],
            message:
              "must be null when end_subsection is null, and vice versa"
          });
        }
        if (
          value.start_subsection !== null &&
          value.end_subsection !== null &&
          value.start_subsection > value.end_subsection
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["start_subsection"],
            message: "must be less than or equal to end_subsection"
          });
        }
      }),
    source_identity: z.object({
      clean_sha256: sha256String,
      clean_char_count: z.number().int().positive()
    }),
    excerpt: z.object({
      path: nonEmptyString,
      line_count: z.number().int().positive(),
      word_count: z.number().int().positive(),
      sha256: sha256String
    }),
    expected_inputs: z.object({
      glossary_path: nonEmptyString,
      style_guide_path: nonEmptyString,
      rubric_path: nonEmptyString
    }),
    report_root: nonEmptyString
  })
  .superRefine((value, ctx) => {
    if (value.report_root !== `data/calibration/runs/${value.slice_id}`) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["report_root"],
        message: `expected 'data/calibration/runs/${value.slice_id}'`
      });
    }
  });

export const promptBundleMetadataSchema = z.object({
  schema_version: z.literal("1.0"),
  prompt_bundle_id: slugString,
  description: nonEmptyString,
  stages: z.tuple([z.literal("translation"), z.literal("review")]),
  baml_files: z.object({
    clients: nonEmptyString,
    calibration: nonEmptyString
  }),
  notes: z.array(nonEmptyString).optional()
});

const stageProfileSchema = z
  .object({
    provider: z.enum(["moonshot", "z-ai"]),
    model: nonEmptyString,
    mode: z.enum(["batch", "standard"]),
    temperature: z.number().min(0).max(2),
    notes: nonEmptyString.optional(),
    max_tokens: z.number().int().positive().optional(),
    timeout_seconds: z.number().int().positive().optional()
  })
  .superRefine((value, ctx) => {
    const fixedTemperature = FIXED_TEMPERATURE_MODELS[`${value.provider}:${value.model}`];
    if (fixedTemperature !== undefined && value.temperature !== fixedTemperature) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["temperature"],
        message: `must equal ${fixedTemperature} for ${value.provider} model '${value.model}'`
      });
    }
  });

export const modelProfileSchema = z.object({
  schema_version: z.literal("1.0"),
  model_profile_id: slugString,
  description: nonEmptyString,
  stages: z.object({
    translation: stageProfileSchema,
    review: stageProfileSchema
  })
});

export const runManifestSchema = z
  .object({
    schema_version: z.literal("1.0"),
    run_id: slugString,
    slice_id: slugString,
    slice_manifest_path: nonEmptyString,
    prompt_bundle_id: slugString,
    prompt_bundle_path: nonEmptyString,
    model_profile_id: slugString,
    model_profile_path: nonEmptyString,
    glossary_path: nonEmptyString,
    style_guide_path: nonEmptyString,
    rubric_path: nonEmptyString
  })
  .passthrough()
  .superRefine((value, ctx) => {
    for (const legacyField of ["seed_translation_path", "seed_findings_path", "manual_checks"]) {
      if (legacyField in (value as Record<string, unknown>)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [legacyField],
          message: "legacy placeholder field is not allowed in the live workflow"
        });
      }
    }
  });

export const glossaryDocSchema = z
  .object({
    schema_version: z.literal("1.0"),
    slice_id: nonEmptyString,
    terms: z
      .array(
        z.object({
          source: nonEmptyString,
          target: nonEmptyString,
          notes: nonEmptyString.optional()
        })
      )
      .min(1)
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.terms.forEach((term, index) => {
      if (seen.has(term.source)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["terms", index, "source"],
          message: `duplicate source term '${term.source}'`
        });
      }
      seen.add(term.source);
    });
  });

export const rubricDocSchema = z
  .object({
    schema_version: z.literal("1.0"),
    slice_id: nonEmptyString,
    criteria: z
      .array(
        z.object({
          id: nonEmptyString,
          requirement: nonEmptyString,
          status_values: nonEmptyString
        })
      )
      .min(1)
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.criteria.forEach((criterion, index) => {
      if (seen.has(criterion.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria", index, "id"],
          message: `duplicate criterion id '${criterion.id}'`
        });
      }
      seen.add(criterion.id);
      const allowed = new Set(criterion.status_values.split("|").map((part) => part.trim()));
      for (const required of ["pass", "fail", "incomplete"]) {
        if (!allowed.has(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["criteria", index, "status_values"],
            message: `must contain '${required}'`
          });
        }
      }
    });
    for (const requiredCriterion of [
      "preserved-language-integrity",
      "glossary-adherence",
      "prose-quality",
      "review-flagging"
    ]) {
      if (!seen.has(requiredCriterion)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria"],
          message: `missing required criterion '${requiredCriterion}'`
        });
      }
    }
  });

const requestRecordSchema = z.object({
  run_id: slugString,
  slice_id: nonEmptyString,
  prompt_bundle_id: nonEmptyString,
  model_profile_id: nonEmptyString,
  stage: z.enum(["translation", "review", "repair"]),
  provider: z.enum(["moonshot", "z-ai"]),
  model: nonEmptyString,
  temperature: z.number().min(0).max(2),
  messages: z.array(messageSchema).min(1),
  prompt_files: z.record(nonEmptyString, nonEmptyString)
});

export const translationRequestRecordSchema = requestRecordSchema.extend({
  stage: z.literal("translation")
});

export const reviewRequestRecordSchema = requestRecordSchema.extend({
  stage: z.literal("review")
});

const reviewCheckSchema = z.object({
  status: z.enum(["pass", "fail", "incomplete"]),
  details: nonEmptyString
});

const reviewFindingSchema = z.object({
  id: nonEmptyString,
  severity: z.enum(["high", "medium", "low", "info"]),
  category: nonEmptyString,
  detail: nonEmptyString,
  evidence: z.array(nonEmptyString).min(1),
  repairability: repairabilitySchema,
  disposition: routeDecisionValueSchema,
  scope: findingScopeSchema,
  confidence: unitIntervalNumber,
  locationHint: nonEmptyString.optional(),
  draftSpan: nonEmptyString.optional(),
  repairInstruction: nonEmptyString.optional()
});

export const reviewPayloadSchema = z.object({
  summary: nonEmptyString,
  checks: z.object({
    "semantic-faithfulness": reviewCheckSchema,
    "doctrinal-ambiguity": reviewCheckSchema,
    "review-coverage": reviewCheckSchema
  }),
  findings: z.array(reviewFindingSchema),
  recommended_follow_up: z.array(nonEmptyString)
});

const evaluationCheckSchema = z.object({
  id: nonEmptyString,
  status: z.enum(["pass", "fail", "incomplete"]),
  details: nonEmptyString
});

const tokenUsageSummarySchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  cached_tokens: z.number().int().nonnegative(),
  uncached_prompt_tokens: z.number().int().nonnegative(),
  billable_tokens: z.number().int().nonnegative(),
  reasoning_tokens: z.number().int().nonnegative()
});

export const evaluationReportSchema = z
  .object({
    schema_version: z.literal("1.0"),
    run_id: slugString,
    generated_at: nonEmptyString,
    slice_id: nonEmptyString,
    prompt_bundle_id: nonEmptyString,
    model_profile_id: nonEmptyString,
    checks: z.array(evaluationCheckSchema),
    summary: z.object({
      pass: z.number().int().nonnegative(),
      fail: z.number().int().nonnegative(),
      incomplete: z.number().int().nonnegative()
    }),
    artifacts: z.record(nonEmptyString, nonEmptyString),
    qualitative_findings: z.object({
      path: nonEmptyString,
      separate_from_checks: z.literal(true)
    }),
    token_usage: z
      .object({
        totals: tokenUsageSummarySchema,
        by_stage: z.record(nonEmptyString, tokenUsageSummarySchema)
      })
      .optional(),
    review_summary: z.string(),
    glossary_hits: z.array(nonEmptyString),
    glossary_misses: z.array(nonEmptyString),
    routing_summary: z
      .object({
        lint_detected: z.array(nonEmptyString),
        judge_detected: z.array(nonEmptyString),
        auto_repair_task_ids: z.array(nonEmptyString),
        decisions: z.array(routeDecisionValueSchema),
        escalated: z.boolean()
      })
      .optional(),
    terminal_status: z.enum(["reviewed", "escalated", "failed"]).optional()
  })
  .superRefine((value, ctx) => {
    const summary = {
      pass: value.checks.filter((check) => check.status === "pass").length,
      fail: value.checks.filter((check) => check.status === "fail").length,
      incomplete: value.checks.filter((check) => check.status === "incomplete").length
    };
    for (const [key, expected] of Object.entries(summary)) {
      if (value.summary[key as keyof typeof summary] !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["summary", key],
          message: `expected ${expected} to match checks`
        });
      }
    }
    for (const [key, artifactPath] of Object.entries(value.artifacts)) {
      if (artifactPath.includes("data/calibration/runs/")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["artifacts", key],
          message: "must not reference transient data/calibration/runs/ paths"
        });
      }
    }
  });

export const lintDefectSchema = z.object({
  id: nonEmptyString,
  code: z.enum([
    "preserved_span_missing",
    "preserved_span_changed",
    "untranslated_dutch_scripture_reference",
    "untranslated_dutch_abbreviation",
    "glossary_target_missing",
    "output_shape_violation",
    "dutch_residue",
    "suspicious_calque",
    "unbalanced_delimiter",
    "repeated_text",
    "citation_shape_damage"
  ]),
  category: nonEmptyString,
  severity: z.enum(["hard", "soft"]),
  repairability: repairabilitySchema,
  routingTarget: routingTargetSchema,
  scope: findingScopeSchema,
  message: nonEmptyString,
  evidence: z.array(nonEmptyString),
  confidence: unitIntervalNumber.optional(),
  sourceSpan: nonEmptyString.optional(),
  foundSpan: nonEmptyString.optional(),
  locationHint: nonEmptyString.optional(),
  suggestedFix: nonEmptyString.optional()
});

export const lintResultSchema = z.object({
  pass: z.boolean(),
  hardDefects: z.array(lintDefectSchema),
  softDefects: z.array(lintDefectSchema),
  routingSummary: z.object({
    autoRepair: z.number().int().nonnegative(),
    judgeReview: z.number().int().nonnegative(),
    logOnly: z.number().int().nonnegative()
  }),
  checks: z.object({
    preservedLanguageIntegrity: z.enum(["pass", "fail"]),
    glossaryAdherence: z.enum(["pass", "fail"]),
    scriptureReferenceNormalization: z.enum(["pass", "fail"]),
    dutchResidue: z.enum(["pass", "fail"]),
    outputShape: z.enum(["pass", "fail"]),
    proseStructure: z.enum(["pass", "fail", "incomplete"])
  })
});

export const repairTaskSchema = z.object({
  taskId: nonEmptyString,
  originStage: z.enum(["lint", "review"]),
  findingIds: z.array(nonEmptyString).min(1),
  handler: nonEmptyString,
  scope: findingScopeSchema,
  repairability: repairabilitySchema,
  instructions: z.array(nonEmptyString).min(1),
  evidence: z.array(nonEmptyString),
  locationHint: nonEmptyString.optional(),
  sourceSpan: nonEmptyString.optional(),
  draftSpan: nonEmptyString.optional()
});

export const routeDecisionSchema = z.object({
  decision: routeDecisionValueSchema,
  reasons: z.array(nonEmptyString).min(1),
  findingIds: z.array(nonEmptyString),
  repairTasks: z.array(repairTaskSchema),
  followUpReviewRequired: z.boolean()
});

export const calibrationGraphStateSchema = z.object({
  runId: slugString,
  runManifestPath: nonEmptyString,
  runManifest: runManifestSchema,
  sliceManifest: sliceManifestSchema,
  excerptText: z.string(),
  translationDrafts: z.array(z.string()),
  currentDraft: z.string().nullable(),
  lintResults: z.array(lintResultSchema),
  repairRound: z.number().int().nonnegative(),
  maxRepairRounds: z.number().int().nonnegative(),
  reviewPayload: reviewPayloadSchema.nullable(),
  reviewFindingHistory: z.array(reviewFindingSchema),
  routeDecision: routeDecisionSchema.nullable(),
  repairTasks: z.array(repairTaskSchema),
  routingHistory: z.array(routeDecisionSchema),
  repairTaskHistory: z.array(repairTaskSchema),
  terminalStatus: z.enum(["pending", "reviewed", "escalated", "failed"]),
  terminalReason: z.string().nullable()
});

const glossaryMiningSourceSchema = z.object({
  source_id: slugString,
  text_path: nonEmptyString,
  metadata_path: nonEmptyString.optional(),
  title: nonEmptyString.optional(),
  author: nonEmptyString.optional(),
  ebook_id: nonEmptyString.optional(),
  clean_sha256: sha256String,
  clean_char_count: z.number().int().positive()
});

export const glossaryMiningConfigSchema = z.object({
  schema_version: z.literal("1.0"),
  candidate_rules: z.object({
    rule_set: z.literal("dutch-ngram-core-v1"),
    max_ngram: z.number().int().min(1).max(3),
    min_unigram_length: z.number().int().positive(),
    min_ngram_boundary_length: z.number().int().positive(),
    require_boundary_non_stopwords: z.literal(true),
    stopword_set: z.literal("dutch-core-v1"),
    preserved_span_filter: z.literal("obvious-preserved-v1")
  }),
  location_model: z.object({
    line_numbers: z.literal("1-based"),
    columns: z.literal("1-based"),
    offsets: z.literal("utf16-code-unit"),
    bucket_index: z.literal("1-based"),
    bucket_line_span: z.number().int().positive()
  }),
  filters: z.object({
    min_occurrences: z.number().int().positive(),
    min_bucket_count: z.number().int().positive(),
    emit_excluded_candidates: z.boolean()
  })
});

const glossaryCandidateLocationSchema = z
  .object({
    line: z.number().int().positive(),
    column_start: z.number().int().positive(),
    column_end: z.number().int().positive(),
    absolute_start_offset: z.number().int().nonnegative(),
    absolute_end_offset: z.number().int().positive(),
    bucket_index: z.number().int().positive()
  })
  .superRefine((value, ctx) => {
    if (value.column_end < value.column_start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["column_end"],
        message: "must be greater than or equal to column_start"
      });
    }
    if (value.absolute_end_offset < value.absolute_start_offset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["absolute_end_offset"],
        message: "must be greater than or equal to absolute_start_offset"
      });
    }
  });

const glossaryCandidateSurfaceFormSchema = z.object({
  form: nonEmptyString,
  occurrences: z.number().int().positive()
});

const glossaryCandidateTermSchema = z.object({
  candidate_id: slugString,
  term: nonEmptyString,
  normalized_term: nonEmptyString,
  token_count: z.number().int().positive(),
  extraction_rule: z.enum(["unigram", "ngram"]),
  first_seen: glossaryCandidateLocationSchema,
  surface_forms: z.array(glossaryCandidateSurfaceFormSchema).min(1)
});

export const glossaryCandidateTermsArtifactSchema = z.object({
  schema_version: z.literal("1.0"),
  artifact_type: z.literal("glossary_candidate_terms"),
  source: glossaryMiningSourceSchema,
  mining_config: glossaryMiningConfigSchema,
  candidate_count: z.number().int().nonnegative(),
  candidates: z.array(glossaryCandidateTermSchema)
});

export const glossaryCandidateUsageSchema = z.object({
  candidate_id: slugString,
  normalized_term: nonEmptyString,
  term: nonEmptyString,
  occurrence_index: z.number().int().positive(),
  location: glossaryCandidateLocationSchema,
  line_excerpt: nonEmptyString
});

export const glossaryCandidateUsagesArtifactSchema = z.object({
  schema_version: z.literal("1.0"),
  artifact_type: z.literal("glossary_candidate_usages"),
  source: glossaryMiningSourceSchema,
  mining_config: glossaryMiningConfigSchema,
  usage_count: z.number().int().nonnegative(),
  usages: z.array(glossaryCandidateUsageSchema)
});

export const glossaryCandidateMetadataEntrySchema = z.object({
  candidate_id: slugString,
  normalized_term: nonEmptyString,
  term: nonEmptyString,
  token_count: z.number().int().positive(),
  occurrence_count: z.number().int().positive(),
  line_count: z.number().int().positive(),
  bucket_count: z.number().int().positive(),
  spread_ratio: z.number().min(0).max(1),
  first_seen: glossaryCandidateLocationSchema,
  last_seen: glossaryCandidateLocationSchema,
  retained: z.boolean(),
  exclusion_reasons: z.array(z.enum(["min_occurrences", "min_bucket_count"]))
});

export const glossaryCandidateMetadataOverviewSchema = z.object({
  schema_version: z.literal("1.0"),
  artifact_type: z.literal("glossary_candidate_metadata_overview"),
  source: glossaryMiningSourceSchema,
  mining_config: glossaryMiningConfigSchema,
  summary: z.object({
    candidate_count: z.number().int().nonnegative(),
    emitted_candidate_count: z.number().int().nonnegative(),
    retained_count: z.number().int().nonnegative(),
    excluded_count: z.number().int().nonnegative(),
    total_occurrences: z.number().int().nonnegative(),
    emitted_occurrence_count: z.number().int().nonnegative(),
    total_bucket_count: z.number().int().positive()
  }),
  candidates: z.array(glossaryCandidateMetadataEntrySchema)
});

export const commitSafeEvalRecordSchema = z.object({
  schema_version: z.enum(["1.0", "1.1"]),
  sanitization_version: z.enum(["1.0", "1.1"]),
  run_id: slugString,
  slice_id: nonEmptyString,
  prompt_bundle_id: nonEmptyString,
  model_profile_id: nonEmptyString,
  generated_at: nonEmptyString,
  source_refs: z.record(nonEmptyString, nonEmptyString),
  token_usage: z
    .object({
      totals: tokenUsageSummarySchema,
      by_stage: z.record(nonEmptyString, tokenUsageSummarySchema)
    })
    .optional(),
  routing_summary: z
    .object({
      lint_detected: z.array(nonEmptyString),
      judge_detected: z.array(nonEmptyString),
      auto_repair_task_ids: z.array(nonEmptyString),
      decisions: z.array(routeDecisionValueSchema),
      escalated: z.boolean()
    })
    .optional(),
  stages: z.record(
    nonEmptyString,
    z.object({
      provider: z.enum(["moonshot", "z-ai"]),
      model: nonEmptyString,
      temperature: z.number().min(0).max(2),
      prompt_files: z.record(nonEmptyString, nonEmptyString),
      finish_reason: nonEmptyString.optional(),
      max_tokens: z.number().int().positive().optional(),
      timeout_seconds: z.number().int().positive().optional(),
      usage: z.record(nonEmptyString, z.number().int().nonnegative()).optional()
    })
  ),
  artifacts: z.record(nonEmptyString, nonEmptyString),
  hashes: z.record(nonEmptyString, sha256String)
});

export type SourceMetadata = z.infer<typeof sourceMetadataSchema>;
export type RunManifest = z.infer<typeof runManifestSchema>;
export type PromptBundleMetadata = z.infer<typeof promptBundleMetadataSchema>;
export type ModelProfile = z.infer<typeof modelProfileSchema>;
export type SliceManifest = z.infer<typeof sliceManifestSchema>;
export type GlossaryDoc = z.infer<typeof glossaryDocSchema>;
export type RubricDoc = z.infer<typeof rubricDocSchema>;
export type TranslationRequestRecord = z.infer<typeof translationRequestRecordSchema>;
export type ReviewRequestRecord = z.infer<typeof reviewRequestRecordSchema>;
export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type EvaluationReport = z.infer<typeof evaluationReportSchema>;
export type LintDefect = z.infer<typeof lintDefectSchema>;
export type LintResult = z.infer<typeof lintResultSchema>;
export type RepairTask = z.infer<typeof repairTaskSchema>;
export type RouteDecision = z.infer<typeof routeDecisionSchema>;
export type CalibrationGraphState = z.infer<typeof calibrationGraphStateSchema>;
export type GlossaryMiningSource = z.infer<typeof glossaryMiningSourceSchema>;
export type GlossaryMiningConfig = z.infer<typeof glossaryMiningConfigSchema>;
export type GlossaryCandidateTermsArtifact = z.infer<typeof glossaryCandidateTermsArtifactSchema>;
export type GlossaryCandidateUsage = z.infer<typeof glossaryCandidateUsageSchema>;
export type GlossaryCandidateUsagesArtifact = z.infer<typeof glossaryCandidateUsagesArtifactSchema>;
export type GlossaryCandidateMetadataEntry = z.infer<typeof glossaryCandidateMetadataEntrySchema>;
export type GlossaryCandidateMetadataOverview = z.infer<typeof glossaryCandidateMetadataOverviewSchema>;
export type CommitSafeEvalRecord = z.infer<typeof commitSafeEvalRecordSchema>;
export type CalibrationMessage = z.infer<typeof messageSchema>;
