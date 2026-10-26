import type { FormSchemaType } from "./schema";
import { choiceQuestionProblems, validateFormReferences } from "./engine";
import { validateMarketing } from "./marketing";
import { scoringDiagnostics } from "./scoring-diagnostics";

/** Exact controls known without interpreting validator/diagnostic prose. */
export type PublishReadinessTarget =
  | { kind: "quiz-title" }
  | { kind: "question-title"; questionId: string }
  | { kind: "outcome-cta"; outcomeId: string }
  | { kind: "capture-privacy" };

export interface PublishReadinessFinding {
  code:
    | "choice-answers"
    | "questions-empty"
    | "quiz-title"
    | "question-titles"
    | "references"
    | "marketing"
    | "scoring-warning"
    | "outcome-destinations"
    | "capture-privacy";
  message: string;
  targets?: PublishReadinessTarget[];
}

export interface PublishReadinessChecks {
  blockers: PublishReadinessFinding[];
  warnings: PublishReadinessFinding[];
}

export interface PublishReadinessOptions {
  /** Omit bounded path enumeration during typing; the publish dialog keeps it. */
  includeScoringDiagnostics?: boolean;
}

/**
 * The publish dialog's existing client policy, in its original order.
 * This is not the complete save/server-publication validation pipeline. In
 * particular, editorial findings must not silently become publication gates.
 */
export function getPublishReadiness(form: FormSchemaType, options: PublishReadinessOptions = {}): PublishReadinessChecks {
  const blockers: PublishReadinessFinding[] = [];
  if (!form.questions.length) blockers.push({ code: "questions-empty", message: "Add at least one question." });
  if (!form.title.trim()) blockers.push({ code: "quiz-title", message: "Give your quiz a title.", targets: [{ kind: "quiz-title" }] });
  const missingTitles = form.questions.filter(question => !question.title.trim());
  if (missingTitles.length) blockers.push({
    code: "question-titles", message: "Give every question a title.",
    targets: missingTitles.map(question => ({ kind: "question-title", questionId: question.id })),
  });
  for (const problem of choiceQuestionProblems(form)) blockers.push({
    code: "choice-answers", message: problem.message,
    targets: [{ kind: "question-title", questionId: problem.questionId }],
  });
  // Preserve first-failure behavior: a reference error prevents a second
  // marketing validation call. The source is known, never parsed from prose.
  let validator: "references" | "marketing" = "references";
  try {
    validateFormReferences(form);
    validator = "marketing";
    validateMarketing(form, true);
  } catch (error) {
    blockers.push({ code: validator, message: error instanceof Error ? error.message : "Review your scoring and branching rules." });
  }
  const warnings: PublishReadinessFinding[] = options.includeScoringDiagnostics === false ? [] : scoringDiagnostics(form).warnings.map(message => ({ code: "scoring-warning", message }));
  const marketing = form.marketing;
  const missingDestinations = marketing && marketing.kind !== "scorecard" ? marketing.outcomes.filter(outcome => !outcome.ctaUrl) : [];
  if (missingDestinations.length) warnings.push({
    code: "outcome-destinations",
    message: `${missingDestinations.length} results have no destination link. Respondents can read the result but cannot follow an offer button.`,
    targets: missingDestinations.map(outcome => ({ kind: "outcome-cta", outcomeId: outcome.id })),
  });
  if (form.capture?.enabled && !form.capture.privacyUrl) warnings.push({
    code: "capture-privacy",
    message: "Lead capture is enabled without a privacy-policy link. Review this before collecting personal details.",
    targets: [{ kind: "capture-privacy" }],
  });
  return { blockers, warnings };
}
