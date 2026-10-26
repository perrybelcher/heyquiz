import type { QuizSubmissionResult } from "./schema";

/** Raw grading defaults are not meaningful for ungraded or marketing results. */
export function reportScore(result: Pick<QuizSubmissionResult, "marketing" | "totalPointsPossible" | "percentageScore">): number | null {
  return result.marketing || result.totalPointsPossible <= 0 ? null : result.percentageScore;
}
export function reportOutcome(result: Pick<QuizSubmissionResult, "marketing" | "matchedTier">): string {
  return result.marketing?.title || result.matchedTier?.title || "";
}

export function reportIdentity(result: Pick<QuizSubmissionResult, "contact" | "respondentName">) {
  const email = result.contact?.email?.trim() || "";
  const label = result.contact?.name?.trim() || result.respondentName?.trim() || email || "Response";
  return { label, email };
}

export function reportResponseMatches(result: QuizSubmissionResult, query: string): boolean {
  const search = [result.contact?.name, result.contact?.email, result.respondentName, reportOutcome(result), ...(result.grading || []).flatMap(answer => [answer.questionTitle, answer.userAnswer])];
  return search.filter(Boolean).join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
