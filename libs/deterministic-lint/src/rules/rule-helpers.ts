import { LintDefect } from "@calibration-domain";

export function createLintId(prefix: string, ordinal: number): string {
  return `lint-${prefix}-${ordinal + 1}`;
}

export function createLintDefect(
  defect: Omit<LintDefect, "id"> & { id?: string }
): LintDefect {
  return {
    id: defect.id ?? createLintId(defect.code, 0),
    ...defect
  };
}
