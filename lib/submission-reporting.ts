import type { QuizSubmissionResult } from "./schema";

/** Raw grading defaults are not meaningful for ungraded or marketing results. */
export function reportScore(result: Pick<QuizSubmissionResult, "marketing" | "totalPointsPossible" | "percentageScore">): number | null {
  return result.marketing || result.totalPointsPossible <= 0 ? null : result.percentageScore;
}
export function reportOutcome(result: Pick<QuizSubmissionResult, "marketing" | "matchedTier">): string {
  return result.marketing?.title || result.matchedTier?.title || "";
}
