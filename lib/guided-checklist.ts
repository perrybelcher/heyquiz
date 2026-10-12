import { FormSchema, type FormSchemaType } from "./schema";
import { orderedQuestions } from "./engine";
import { validateLanding } from "./landing";
import { getPublishReadiness, type PublishReadinessTarget } from "./publish-readiness";

export type GuidedChecklistTarget = PublishReadinessTarget
  | { kind: "answer-label"; questionId: string; answerId: string };
export type GuidedReviewSection = "promise" | "questions" | "results" | "capture";
export type GuidedChecklistItem = {
  id: string; message: string; level: "blocker" | "recommendation";
  source: "readiness" | "save" | "publish" | "editorial";
  target?: GuidedChecklistTarget; reviewSection?: GuidedReviewSection;
};
export type GuidedChecklistResolution = { step: 0 | 1 | 2 | 4; target: GuidedChecklistTarget };

/** Tuple keys stay stable as labels, ordering and positions change. Never CSS selectors. */
export function guidedTargetKey(target: GuidedChecklistTarget): string {
  switch (target.kind) {
    case "question-title": return JSON.stringify([target.kind, target.questionId]);
    case "answer-label": return JSON.stringify([target.kind, target.questionId, target.answerId]);
    case "outcome-cta": return JSON.stringify([target.kind, target.outcomeId]);
    default: return JSON.stringify([target.kind]);
  }
}

/** Resolve only an existing unambiguous control; never select a neighbouring item. */
export function resolveGuidedChecklistTarget(form: FormSchemaType, target: GuidedChecklistTarget): GuidedChecklistResolution | null {
  if (target.kind === "quiz-title") return { step: 0, target };
  if (target.kind === "capture-privacy") return form.capture?.enabled ? { step: 4, target } : null;
  if (target.kind === "outcome-cta") return form.marketing && form.marketing.kind !== "scorecard" && form.marketing.outcomes.filter(item => item.id === target.outcomeId).length === 1 ? { step: 2, target } : null;
  const matches = form.questions.filter(question => question.id === target.questionId);
  if (matches.length !== 1) return null;
  if (target.kind === "answer-label" && matches[0].options?.filter(option => option.id === target.answerId).length !== 1) return null;
  return { step: 1, target };
}

function targetMessage(form: FormSchemaType, target: GuidedChecklistTarget, fallback: string): string {
  const questions = orderedQuestions(form);
  if (target.kind === "question-title") return `Add wording to question ${questions.findIndex(question => question.id === target.questionId) + 1}.`;
  if (target.kind === "outcome-cta") {
    const index = form.marketing?.outcomes.findIndex(outcome => outcome.id === target.outcomeId) ?? -1;
    return `Review the destination link for result ${index + 1}: ${form.marketing?.outcomes[index]?.title || "Untitled result"}.`;
  }
  if (target.kind === "capture-privacy") return "Review your privacy-policy link before collecting details.";
  return fallback;
}

function schemaTarget(form: FormSchemaType, path: PropertyKey[]): GuidedChecklistTarget | undefined {
  if (path.length === 1 && path[0] === "title") return { kind: "quiz-title" };
  if (path.length === 2 && path[0] === "capture" && path[1] === "privacyUrl" && form.capture?.enabled) return { kind: "capture-privacy" };
  if (path.length === 4 && path[0] === "marketing" && path[1] === "outcomes" && typeof path[2] === "number" && path[3] === "ctaUrl" && form.marketing?.kind !== "scorecard") {
    const outcome = form.marketing?.outcomes[path[2]];
    if (outcome) return { kind: "outcome-cta", outcomeId: outcome.id };
  }
  if (path[0] === "questions" && typeof path[1] === "number") {
    const question = form.questions[path[1]];
    if (question && path.length === 3 && path[2] === "title") return { kind: "question-title", questionId: question.id };
    const answer = question && path[2] === "options" && typeof path[3] === "number" ? question.options?.[path[3]] : undefined;
    if (answer && path.length === 5 && path[4] === "label") return { kind: "answer-label", questionId: question.id, answerId: answer.id };
  }
}

/** Derived guidance only. Existing dialog, schema and server validators retain policy ownership. */
export function buildGuidedChecklist(form: FormSchemaType): GuidedChecklistItem[] {
  const items: GuidedChecklistItem[] = [], readiness = getPublishReadiness(form, { includeScoringDiagnostics: false });
  for (const [level, findings] of [["blocker", readiness.blockers], ["recommendation", readiness.warnings]] as const) {
    findings.forEach((finding, index) => {
      if (finding.targets?.length) for (const target of finding.targets) items.push({
        id: JSON.stringify(["readiness", finding.code, guidedTargetKey(target)]), level, source: "readiness",
        message: targetMessage(form, target, finding.message),
        ...(resolveGuidedChecklistTarget(form, target) ? { target } : {}),
      });
      else items.push({ id: JSON.stringify(["readiness", finding.code, index]), level, source: "readiness", message: finding.message,
        ...(finding.code === "questions-empty" ? { reviewSection: "questions" as const } : {}),
      });
    });
  }
  orderedQuestions(form).forEach((question, questionIndex) => question.options?.forEach((answer, answerIndex) => {
    if (answer.label.trim()) return;
    const target: GuidedChecklistTarget = { kind: "answer-label", questionId: question.id, answerId: answer.id };
    items.push({ id: JSON.stringify(["editorial", guidedTargetKey(target)]), level: "recommendation", source: "editorial",
      message: `Review answer ${answerIndex + 1} in question ${questionIndex + 1}: add answer wording.`,
      ...(resolveGuidedChecklistTarget(form, target) ? { target } : {}),
    });
  }));
  const parsed = FormSchema.safeParse(form);
  if (!parsed.success) parsed.error.issues.forEach(issue => {
    const target = schemaTarget(form, issue.path);
    items.push({ id: JSON.stringify(["save", target ? guidedTargetKey(target) : issue.path.map(String), issue.code]),
      message: `Review this saved setting: ${issue.message}`, level: "blocker", source: "save",
      ...(target && resolveGuidedChecklistTarget(form, target) ? { target } : issue.path[0] === "coverPage" ? { reviewSection: "promise" as const } : {}),
    });
  });
  try { validateLanding(form.coverPage, true); }
  catch (error) { items.push({ id: JSON.stringify(["publish", "landing"]), level: "blocker", source: "publish", reviewSection: "promise", message: error instanceof Error ? error.message : "Review your landing page before publishing." }); }
  // Invalid duplicate IDs already require advanced review; do not render duplicate
  // keyed actions or invent an exact target for those ambiguous controls.
  return [...new Map(items.map(item => [item.id, item])).values()];
}
