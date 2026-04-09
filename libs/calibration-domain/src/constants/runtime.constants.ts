export const DEFAULT_RUN_MANIFEST =
  "config/calibration/run-manifests/vol2-god-incomprehensibility-001-baseline.json";

export const DEFAULT_OUTPUT_ROOT = "data/calibration/runs";
export const DEFAULT_EVAL_ROOT = "data/calibration/evals";
export const DEFAULT_DOTENV_PATH = ".env";
export const DEFAULT_MAX_REPAIR_ROUNDS = 2;

export const FIXED_TEMPERATURE_MODELS: Record<string, number> = {
  "moonshot:kimi-k2.5": 1.0
};

export const SCRIPTURE_REFERENCE_SUFFIX =
  String.raw`\s*\d+(?:(?::|\s+vs?\.\s+|\s+vv?\.\s+)\d+(?:[-–]\d+)?)?`;

export const DUTCH_SCRIPTURE_REFERENCE_FORMS = [
  String.raw`\bHd\.`,
  String.raw`\bHand\.`,
  String.raw`\bJes\.`,
  String.raw`\bJesaia\b`,
  String.raw`\bEf\.`,
  String.raw`\bHebr\.`,
  String.raw`\bRicht\.`,
  String.raw`\bOp\.`,
  String.raw`\bOpenb\.`,
  String.raw`\bSpr\.`,
  String.raw`\bPred\.`,
  String.raw`\bEzech\.`,
  String.raw`\bJoz\.`,
  String.raw`\bJak\.`,
  String.raw`\bJoh\.`,
  String.raw`\bLuk\.`,
  String.raw`\bMatth\.`,
  String.raw`\b1\s*Petr\.`,
  String.raw`\b2\s*Petr\.`,
  String.raw`\b1\s*Kon\.`,
  String.raw`\b2\s*Kon\.`,
  String.raw`\b1\s*S\.`,
  String.raw`\b2\s*S\.`,
  String.raw`\b1\s*K\.`,
  String.raw`\b2\s*K\.`
];

export const DUTCH_ABBREVIATION_PATTERNS = [
  String.raw`\bblz\.`,
  String.raw`\bbl\.`,
  String.raw`\bd\.\s*i\.`,
  String.raw`\benz\.`,
  String.raw`\bv\.`,
  String.raw`\bJoh\.`,
  String.raw`\b1\s*K\.`,
  String.raw`\b2\s*K\.`,
  String.raw`\bbĳ\b`
];

export const OUTPUT_COMMENTARY_PATTERNS = [
  /^translation\s*:/i,
  /^note\s*:/i,
  /^review\s*:/i,
  /^here(?:'s| is)\b/i
];
