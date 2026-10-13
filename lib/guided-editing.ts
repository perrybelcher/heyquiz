import { nanoid } from "nanoid";
import type { FormSchemaType, LogicRule, Question } from "./schema";
import { orderedQuestions } from "./engine";

// Binary controls have a fixed shape. The full editor remains responsible for
// their settings; these are the choice fields authors can reshape safely here.
export const guidedChoiceTypes = new Set([
  "multiple_choice", "multiselect", "dropdown", "picture_choice",
  "image_multiselect", "checkboxes", "segmented",
]);

export type RemovalReview = { changes: string[]; blockers: string[] };
const plural = (count: number, label: string) => `${count} ${label}${count === 1 ? "" : "s"}`;

function answerBranches(form: FormSchemaType, questionId: string, answerId: string): LogicRule[] {
  const question = form.questions.find(q => q.id === questionId);
  const answer = question?.options?.find(o => o.id === answerId);
  if (!answer) return [];
  // Branch conditions may use an ID, a legacy label, or a substring. Surface
  // and remove every affected rule rather than leave silently changed logic.
  return (form.logicRules || []).filter(rule => {
    if (rule.sourceQuestionId !== questionId || !rule.value?.trim()) return false;
    const expected = rule.value.trim().toLowerCase();
    const values = [answer.id, answer.label].map(value => value.trim().toLowerCase());
    return rule.operator === "contains" ? values.some(value => value.includes(expected))
      : ["equals", "not_equals"].includes(rule.operator) && values.includes(expected);
  });
}

export function reviewGuidedRemoval(form: FormSchemaType, questionId: string, answerId?: string): RemovalReview {
  const changes: string[] = [], blockers: string[] = [];
  const question = form.questions.find(q => q.id === questionId);
  if (!question) return { changes, blockers: ["This question is no longer in the draft."] };
  if (answerId && !question.options?.some(o => o.id === answerId)) return { changes, blockers: ["This answer is no longer in the draft."] };
  if (answerId && (question.options?.length || 0) <= 2) blockers.push("Keep at least two answers for a choice question.");
  const scoring = (form.marketing?.rules || []).filter(r => r.questionId === questionId && (!answerId || r.answerId === answerId));
  if (scoring.length) changes.push(`Remove ${plural(scoring.length, "answer scoring rule")}.`);
  const branches = answerId ? answerBranches(form, questionId, answerId) : (form.logicRules || []).filter(r => r.sourceQuestionId === questionId || r.targetQuestionId === questionId);
  if (branches.length) changes.push(`Remove ${plural(branches.length, "branch rule")}. The remaining questions will follow their remaining rules and order.`);
  if (answerId && question.options?.find(o => o.id === answerId)?.isCorrect) changes.push("Remove a correct answer. Review correct-answer scoring before publishing.");
  if (!answerId) {
    const references = form.questions.filter(q => q.id !== questionId && q.calculationFormula?.includes(`{{${questionId}}}`));
    if (references.length) blockers.push(`First update the calculation in ${references.map(q => `“${q.title || "Untitled question"}”`).join(", ")} using the full editor.`);
    if (form.pages?.some(page => page.questionIds.includes(questionId))) changes.push("Remove this question from its page.");
    if (form.tracking?.questionIds.includes(questionId)) {
      changes.push(form.tracking.questionIds.every(id => id === questionId)
        ? "Remove the last selected tracking step and turn off question-view tracking. Other tracking events stay as configured."
        : "Remove this question from the selected tracking steps.");
    }
    if (form.marketing?.kind === "scorecard") {
      const affected = form.marketing.categories.filter(category => scoring.some(rule => rule.targetId === category.id));
      if (affected.length) changes.push("Review the affected score categories in Results: removing a question can change percentages and minimum-answer coverage.");
    }
  }
  return { changes, blockers };
}

export function removeGuidedQuestion(form: FormSchemaType, questionId: string): FormSchemaType {
  const review = reviewGuidedRemoval(form, questionId);
  if (review.blockers.length) throw new Error(review.blockers.join(" "));
  const tracking = form.tracking;
  const lastTrackingStep = tracking?.questionIds.includes(questionId) && tracking.questionIds.every(id => id === questionId);
  return {
    ...form,
    questions: form.questions.filter(q => q.id !== questionId),
    marketing: form.marketing ? { ...form.marketing, rules: form.marketing.rules.filter(r => r.questionId !== questionId) } : undefined,
    logicRules: form.logicRules?.filter(r => r.sourceQuestionId !== questionId && r.targetQuestionId !== questionId),
    pages: form.pages?.map(page => ({ ...page, questionIds: page.questionIds.filter(id => id !== questionId) })),
    tracking: tracking ? { ...tracking, questionIds: tracking.questionIds.filter(id => id !== questionId), events: lastTrackingStep ? tracking.events.filter(event => event !== "question_view") : tracking.events } : undefined,
  };
}

export function removeGuidedAnswer(form: FormSchemaType, questionId: string, answerId: string): FormSchemaType {
  const review = reviewGuidedRemoval(form, questionId, answerId);
  if (review.blockers.length) throw new Error(review.blockers.join(" "));
  const branches = new Set(answerBranches(form, questionId, answerId).map(rule => rule.id));
  return {
    ...form,
    questions: form.questions.map(q => q.id === questionId ? { ...q, options: q.options?.filter(o => o.id !== answerId) } : q),
    marketing: form.marketing ? { ...form.marketing, rules: form.marketing.rules.filter(r => r.questionId !== questionId || r.answerId !== answerId) } : undefined,
    logicRules: form.logicRules?.filter(rule => !branches.has(rule.id)),
  };
}

export function renameGuidedAnswer(form: FormSchemaType, questionId: string, answerId: string, label: string): FormSchemaType {
  const question = form.questions.find(q => q.id === questionId);
  const previous = question?.options?.find(o => o.id === answerId)?.label;
  const uniqueLabel = previous?.trim() && question?.options?.filter(o => o.label.trim().toLowerCase() === previous.trim().toLowerCase()).length === 1 && !question.options.some(o => o.id !== answerId && o.id.toLowerCase() === previous.trim().toLowerCase());
  return {
    ...form,
    questions: form.questions.map(q => q.id === questionId ? { ...q, options: q.options?.map(o => o.id === answerId ? { ...o, label } : o) } : q),
    marketing: form.marketing ? { ...form.marketing, rules: form.marketing.rules.map(r => r.questionId === questionId && r.answerId === answerId ? { ...r, reason: "" } : r) } : undefined,
    // Convert unambiguous exact label conditions to the stable ID before the
    // label changes. Substring rules require the author's journey review.
    logicRules: form.logicRules?.map(r => uniqueLabel && r.sourceQuestionId === questionId && ["equals", "not_equals"].includes(r.operator) && r.value?.trim().toLowerCase() === previous!.trim().toLowerCase() ? { ...r, value: answerId } : r),
  };
}

export function addGuidedQuestion(form: FormSchemaType, type: "multiple_choice" | "multiselect" | "short_answer" | "paragraph" | "email", afterId?: string): { form: FormSchemaType; questionId: string } {
  if (form.questions.length >= 200) throw new Error("A quiz can have up to 200 questions.");
  const questions = orderedQuestions(form);
  const after = questions.findIndex(q => q.id === afterId);
  const pageId = after >= 0 ? questions[after].pageId || form.pages?.[0]?.id : form.pages?.[0]?.id;
  const question: Question = {
    id: `q-${nanoid(10)}`, type, title: "", required: true, points: form.marketing || !guidedChoiceTypes.has(type) ? 0 : 1,
    ...(guidedChoiceTypes.has(type) ? { options: [1, 2].map(() => ({ id: `a-${nanoid(10)}`, label: "", isCorrect: false })) } : {}),
    ...(pageId ? { pageId } : {}),
  };
  const insertAt = after >= 0 ? after + 1 : questions.length;
  const updated = [...questions.slice(0, insertAt), question, ...questions.slice(insertAt)];
  return { questionId: question.id, form: { ...form, questions: updated, pages: form.pages?.map(page => ({ ...page, questionIds: updated.filter(q => (q.pageId || form.pages?.[0]?.id) === page.id).map(q => q.id) })) } };
}

export function moveGuidedQuestion(form: FormSchemaType, questionId: string, direction: -1 | 1): FormSchemaType {
  const questions = orderedQuestions(form);
  const index = questions.findIndex(q => q.id === questionId), target = index + direction;
  if (index < 0 || target < 0 || target >= questions.length) return form;
  const page = (q: Question) => q.pageId || form.pages?.[0]?.id;
  if (page(questions[index]) !== page(questions[target])) throw new Error("Use the full editor to move a question between pages.");
  const updated = [...questions];
  [updated[index], updated[target]] = [updated[target], updated[index]];
  // Showing/hiding an earlier question is as misleading as a backward jump.
  // Reject the move instead of silently deleting the author's branching.
  const reversed = (form.logicRules || []).some(rule => rule.targetQuestionId && ["jump_to_question", "show_question", "hide_question"].includes(rule.action) && updated.findIndex(q => q.id === rule.targetQuestionId) <= updated.findIndex(q => q.id === rule.sourceQuestionId));
  if (reversed) throw new Error("This move would put a branch destination before its question. Adjust the branching in the full editor first.");
  return { ...form, questions: updated, pages: form.pages?.map(p => ({ ...p, questionIds: updated.filter(q => page(q) === p.id).map(q => q.id) })) };
}

export function addGuidedAnswer(form: FormSchemaType, questionId: string): FormSchemaType {
  return { ...form, questions: form.questions.map(q => q.id === questionId && guidedChoiceTypes.has(q.type) ? { ...q, options: [...(q.options || []), { id: `a-${nanoid(10)}`, label: "", isCorrect: false }] } : q) };
}

export function moveGuidedAnswer(form: FormSchemaType, questionId: string, answerId: string, direction: -1 | 1): FormSchemaType {
  return { ...form, questions: form.questions.map(q => {
    if (q.id !== questionId || !q.options) return q;
    const index = q.options.findIndex(o => o.id === answerId), target = index + direction;
    if (index < 0 || target < 0 || target >= q.options.length) return q;
    const options = [...q.options];
    [options[index], options[target]] = [options[target], options[index]];
    return { ...q, options };
  }) };
}
