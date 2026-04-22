class ReviewCheck {
  status "pass" | "fail" | "incomplete"
  details string
}

class ReviewChecks {
  proseQuality ReviewCheck @alias("prose-quality")
  reviewFlagging ReviewCheck @alias("review-flagging")
}

class ReviewFinding {
  severity "high" | "medium" | "low" | "info"
  category string
  detail string
}

class CalibrationReview {
  summary string
  checks ReviewChecks
  findings ReviewFinding[]
  recommendedFollowUp string[] @alias("recommended_follow_up")
}

function SmokeTestCalibrationStage(stageName: string) -> string {
  client RuntimePrimary
  prompt #"
    {{ _.role("user") }}
    Reply with exactly OK for {{ stageName }}.
  "#
}

function TranslateCalibrationSlice(
  runId: string,
  sliceId: string,
  sliceTitle: string,
  selectionRationale: string,
  sourceExcerpt: string,
  glossaryTerms: string,
  styleGuide: string
) -> string {
  client RuntimePrimary
  prompt #"
    {{ _.role("system") }}
    Translate Dutch theological prose into formal English suitable for a scholarly first draft.
    Preserve Greek, Hebrew, Latin, and German spans exactly as they appear in the source.
    Translate Dutch Scripture references, book names, and abbreviations into standard English forms.
    Retain citations and paragraph structure.
    Prefer glossary-approved terminology when the glossary supplies a required target phrase.
    Do not add explanations, headings, or notes outside the translated passage.

    {{ _.role("user") }}
    Run ID: {{ runId }}
    Slice ID: {{ sliceId }}
    Slice Title: {{ sliceTitle }}

    Selection rationale:
    {{ selectionRationale }}

    Excerpt-scoped glossary:
    {{ glossaryTerms }}

    Style guide:
    {{ styleGuide }}

    Source excerpt:
    {{ sourceExcerpt }}

    Translate the source excerpt into formal English theological prose.
    Preserve all non-Dutch spans in their original language exactly as written.
    Render any Dutch Scripture references, book names, and abbreviations in standard English forms.
    Return only the translated passage with paragraph structure intact and no prefatory commentary.
  "#
}

function RepairCalibrationDraft(
  runId: string,
  sliceId: string,
  repairRound: int,
  currentDraft: string,
  hardDefectsJson: string
) -> string {
  client RuntimePrimary
  prompt #"
    {{ _.role("system") }}
    You repair an English translation draft.
    Apply the smallest possible edits that fix the listed hard defects.
    Return only the corrected translated passage with the original paragraph structure preserved.

    {{ _.role("user") }}
    Run ID: {{ runId }}
    Slice ID: {{ sliceId }}
    Repair round: {{ repairRound }}

    Current draft:
    {{ currentDraft }}

    Hard defects:
    {{ hardDefectsJson }}
  "#
}

function ReviewCalibrationSlice(
  runId: string,
  sliceId: string,
  sliceTitle: string,
  sourceExcerpt: string,
  translationOutput: string,
  glossaryTerms: string,
  styleGuide: string,
  rubric: string
) -> CalibrationReview {
  client RuntimePrimary
  prompt #"
    {{ _.role("system") }}
    Review the generated translation against the source excerpt, glossary, and style guide.
    Separate pass-fail checks from narrative findings.
    Flag preserved-language corruption, glossary drift, doctrinal ambiguity, and unnatural English prose.
    Treat Dutch Scripture references, book names, and abbreviations left untranslated in the English output as defects.
    Keep the response concise: one summary paragraph, at most 3 findings, and at most 3 follow-up actions.

    {{ _.role("user") }}
    Run ID: {{ runId }}
    Slice ID: {{ sliceId }}
    Slice Title: {{ sliceTitle }}

    Rubric:
    {{ rubric }}

    Excerpt-scoped glossary:
    {{ glossaryTerms }}

    Style guide:
    {{ styleGuide }}

    Source excerpt:
    {{ sourceExcerpt }}

    Translation output:
    {{ translationOutput }}

    Review the translation against the source, glossary, style guide, and rubric.
    {{ ctx.output_format }}
  "#
}
