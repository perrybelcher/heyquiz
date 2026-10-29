import { nanoid } from "nanoid";
import { FormSchema, type FormSchemaType } from "./schema";
import { MarketingSchema, validateMarketing } from "./marketing";
import { quizTypeDefinitions, type QuizType } from "./quiz-types";
import { ValidationError } from "./errors";

/** Pure copy operation, also used by guest draft recovery. Never mutates the source. */
export function previewQuizConversion(source: FormSchemaType, targetType: QuizType): { form: FormSchemaType; changes: string[] } {
  if (source.quizType === targetType) throw new ValidationError("Choose a different quiz type for the converted copy.");
  const definition = quizTypeDefinitions[targetType];
  const changes: string[] = ["Create an unpublished copy with a new quiz ID. The original and its responses remain available.", "Review the copied results, answer mappings and retained branching before publishing."];
  const copy = structuredClone(source);
  copy.id = `quiz-${nanoid(12)}`;
  const suffix = " (converted copy)";
  copy.title = `${source.title.slice(0, 200 - suffix.length)}${suffix}`;
  copy.quizType = targetType;
  copy.mode = definition.mode;
  delete copy.createdAt; delete copy.updatedAt; delete copy.publishedAt; delete copy.revision;
  delete copy.meta; delete copy.tracking;
  changes.push("Responses, experiments, delivery jobs, CRM connections and tracking configuration are not copied.");
  copy.conversionReview = { sourceQuizId: source.id, ...(source.revision === undefined ? {} : {sourceRevision: source.revision}), required: true };
  copy.questions = copy.questions.map(q => {
    const updated = {...q, points: 0};
    delete updated.correctAnswerText; delete updated.explanation; delete updated.matrixAnswerKey;
    updated.options = updated.options?.map(o => { const option = {...o}; delete option.isCorrect; delete option.explanation; return option; });
    return updated;
  });
  if (source.mode === "quiz") changes.push("Remove answer keys, grading points and explanations. Define new grading if converting to a knowledge quiz.");
  if (copy.outcomeTiers.length) changes.push("Remove score-based endings and their jump references.");
  copy.outcomeTiers = [];
  const removed = (copy.logicRules ?? []).filter(r => r.action === "jump_to_ending");
  copy.logicRules = copy.logicRules?.filter(r => r.action !== "jump_to_ending");
  if (removed.length) changes.push(`Remove ${removed.length} branches to score-based endings; retain compatible question branching.`);
  copy.settings = {...copy.settings, showAnswerKeyOnFinish: targetType === "knowledge"};
  const compatible = source.marketing && ["segmentation", "product_finder"].includes(source.marketing.kind) && ["personality", "product_finder", "diagnostic"].includes(targetType);
  if (!definition.marketingKind) {
    delete copy.marketing;
    changes.push("Remove marketing outcomes, mappings, exclusions and score bands. Review the knowledge answer key.");
  } else if (compatible && source.marketing) {
    copy.marketing = structuredClone(source.marketing);
    copy.marketing.kind = definition.marketingKind;
    delete copy.marketing.scorecard; delete copy.marketing.qualificationRules;
    copy.marketing.categories = [];
    const exclusions = copy.marketing.rules.filter(r => r.effect === "exclude").length;
    if (targetType !== "product_finder") copy.marketing.rules = copy.marketing.rules.filter(r => r.effect !== "exclude");
    if (exclusions && targetType !== "product_finder") changes.push(`Remove ${exclusions} product exclusion rules.`);
    copy.marketing.resultSections = copy.marketing.resultSections?.filter(s => s.condition?.type !== "score");
    changes.push("Retain compatible outcome content and answer associations for review.");
  } else {
    copy.marketing = MarketingSchema.parse({kind: definition.marketingKind, presentation: source.marketing?.presentation, resultSections: source.marketing?.resultSections?.filter(s => !s.condition)});
    changes.push("Remove incompatible outcome references, answer mappings, exclusions and score bands. Define the new results and their rules.");
  }
  if (targetType === "qualification") changes.push("Define explicit route conditions and next-step buttons. Eligibility is never inferred from old scores.");
  const form = FormSchema.parse(copy);
  validateMarketing(form);
  return {form, changes};
}
