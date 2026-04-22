class ReviewCheck {
  status "pass" | "fail" | "incomplete"
  details string
}

class ReviewChecks {
  proseQuality ReviewCheck @alias("prose-quality")
  reviewFlagging ReviewCheck @alias("review-flagging")
}

class ReviewFinding {
  severity "high" | "medium" | "low"
  category string
  detail string
}

class CalibrationReview {
  summary string
  checks ReviewChecks
  findings ReviewFinding[]
  recommendedFollowUp string[] @alias("recommended_follow_up")
}

class RepairDefect {
  code "preserved_span_missing" | "preserved_span_changed" | "untranslated_dutch_scripture_reference" | "untranslated_dutch_abbreviation" | "glossary_target_missing" | "output_shape_violation" | "dutch_residue" | "suspicious_calque"
  severity "hard" | "soft"
  message string
  evidence string[]
  sourceSpan string?
  foundSpan string?
  locationHint string?
  suggestedFix string?
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

template_string RepairDefectContext(hardDefects: RepairDefect[]) #"
Hard defects:
{{ hardDefects|format(type="yaml") }}
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
  hardDefects: RepairDefect[]
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

    {{ RepairDefectContext(hardDefects) }}
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
    {{ CalibrationHeader(runId, sliceId, sliceTitle) }}

    Rubric:
    {{ rubric }}

    {{ SharedReferenceContext(glossaryTerms, styleGuide, sourceExcerpt) }}

    Translation output:
    {{ translationOutput }}

    Review the translation against the source, glossary, style guide, and rubric.
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
    hardDefects [
      {
        code "untranslated_dutch_scripture_reference"
        severity "hard"
        message "Dutch Scripture abbreviation should be normalized to standard English."
        evidence ["Hd. 17:28", "Acts 17:28"]
        foundSpan "Hd. 17:28"
        suggestedFix "Acts 17:28"
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
    rubric #"- prose-quality: pass|fail|incomplete
- review-flagging: pass|fail|incomplete"#
  }
  @@assert( {{ this.summary|length > 0 }} )
  @@assert( {{ this.findings|length <= 3 }} )
  @@assert( {{ this.recommendedFollowUp|length <= 3 }} )
}
