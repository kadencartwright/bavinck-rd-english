class ReviewCheck {
  status "pass" | "fail" | "incomplete"
  details string
}

class ReviewChecks {
  semanticFaithfulness ReviewCheck @alias("semantic-faithfulness")
  doctrinalAmbiguity ReviewCheck @alias("doctrinal-ambiguity")
  reviewCoverage ReviewCheck @alias("review-coverage")
}

class ReviewFinding {
  id string
  severity "high" | "medium" | "low" | "info"
  category string
  detail string
  evidence string[]
  repairability "auto" | "needs_judge" | "manual"
  disposition "accept" | "repair" | "re_review" | "escalate"
  scope "document" | "paragraph" | "sentence" | "span"
  confidence float
  locationHint string?
  draftSpan string?
  repairInstruction string?
}

class CalibrationReview {
  summary string
  checks ReviewChecks
  findings ReviewFinding[]
  recommendedFollowUp string[] @alias("recommended_follow_up")
}

class RepairTask {
  taskId string
  originStage "lint" | "review"
  findingIds string[]
  handler string
  scope "document" | "paragraph" | "sentence" | "span"
  repairability "auto" | "needs_judge" | "manual"
  instructions string[]
  evidence string[]
  sourceSpan string?
  draftSpan string?
  locationHint string?
}

template_string CalibrationHeader(runId: string, sliceId: string, sliceTitle: string) #"
Run ID: {{ runId }}
Slice ID: {{ sliceId }}
Slice Title: {{ sliceTitle }}
"#

template_string SharedReferenceContext(glossaryTerms: string, styleGuide: string, sourceExcerpt: string) #"
Excerpt-scoped glossary:
{{ glossaryTerms }}

Style guide:
{{ styleGuide }}

Source excerpt:
{{ sourceExcerpt }}
"#

template_string RepairTaskContext(repairTasks: RepairTask[]) #"
Repair tasks:
{{ repairTasks|format(type="yaml") }}
"#

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
    {{ CalibrationHeader(runId, sliceId, sliceTitle) }}

    Selection rationale:
    {{ selectionRationale }}

    {{ SharedReferenceContext(glossaryTerms, styleGuide, sourceExcerpt) }}

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
  repairTasks: RepairTask[]
) -> string {
  client RuntimePrimary
  prompt #"
    {{ _.role("system") }}
    You repair an English translation draft.
    Apply the smallest possible edits that fix the listed repair tasks.
    Return only the corrected translated passage with the original paragraph structure preserved.

    {{ _.role("user") }}
    Run ID: {{ runId }}
    Slice ID: {{ sliceId }}
    Repair round: {{ repairRound }}

    Current draft:
    {{ currentDraft }}

    {{ RepairTaskContext(repairTasks) }}
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
    Focus on semantic faithfulness, doctrinal ambiguity, and residual prose concerns that deterministic lint may miss.
    Do not spend findings on simple mechanical issues unless they create a meaning-level problem.
    Every finding must include evidence, repairability, confidence, scope, and a routing disposition.
    Keep the response concise: one summary paragraph, at most 3 findings, and at most 3 follow-up actions.

    {{ _.role("user") }}
    {{ CalibrationHeader(runId, sliceId, sliceTitle) }}

    Rubric:
    {{ rubric }}

    {{ SharedReferenceContext(glossaryTerms, styleGuide, sourceExcerpt) }}

    Translation output:
    {{ translationOutput }}

    Review the translation against the source, glossary, style guide, and rubric.
    Use `repair` only for bounded issues safe for automated remediation.
    Use `escalate` for unresolved doctrinal ambiguity or low-confidence meaning concerns.
    Use `accept` only when a finding is informational and does not require further action.
    Return exactly one structured response and no extra commentary.
    {{ ctx.output_format }}
  "#
}

test TranslateCalibrationSliceSmoke {
  functions [TranslateCalibrationSlice]
  args {
    runId "test-run"
    sliceId "slice-1"
    sliceTitle "Tiny theological sentence"
    selectionRationale "Smoke-test prompt behavior on a compact excerpt."
    sourceExcerpt #"In den beginne was het Woord, en ἐν Hem was leven."#
    glossaryTerms #"- Woord -> Word"#
    styleGuide #"- Keep the register formal and suitable for theological prose."#
  }
  @@assert( {{ this|length > 0 }} )
  @@assert( {{ "ἐν" in this }} )
}

test RepairCalibrationDraftSmoke {
  functions [RepairCalibrationDraft]
  args {
    runId "test-run"
    sliceId "slice-1"
    repairRound 1
    currentDraft #"In den beginne was het Woord. Hd. 17:28 blijft staan."#
    repairTasks [
      {
        taskId "task-1"
        originStage "lint"
        findingIds ["lint-1"]
        handler "mechanical-repair"
        scope "span"
        repairability "auto"
        instructions ["Normalize 'Hd. 17:28' to standard English Scripture form."]
        evidence ["Hd. 17:28", "Acts 17:28"]
        draftSpan "Hd. 17:28"
      }
    ]
  }
  @@assert( {{ this|length > 0 }} )
  @@assert( {{ "Hd. 17:28" not in this }} )
}

test ReviewCalibrationSliceSmoke {
  functions [ReviewCalibrationSlice]
  args {
    runId "test-run"
    sliceId "slice-1"
    sliceTitle "Tiny theological sentence"
    sourceExcerpt #"In den beginne was het Woord."#
    translationOutput #"In the beginning was the Word. Hd. 17:28 remains untranslated."#
    glossaryTerms #"- Woord -> Word"#
    styleGuide #"- Keep the register formal and suitable for theological prose."#
    rubric #"- semantic-faithfulness: pass|fail|incomplete
- doctrinal-ambiguity: pass|fail|incomplete
- review-coverage: pass|fail|incomplete"#
  }
  @@assert( {{ this.summary|length > 0 }} )
  @@assert( {{ this.findings|length <= 3 }} )
  @@assert( {{ this.recommendedFollowUp|length <= 3 }} )
  @@assert( {{ this.checks.semanticFaithfulness.status in ["pass", "fail", "incomplete"] }} )
}
