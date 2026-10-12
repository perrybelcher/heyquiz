import { createHash } from "node:crypto";
import type { Attempt } from "./attempts";
import type { FormSchemaType, Question, QuizSubmissionResult } from "./schema";
import { multiTypes, resolvePath } from "./engine";
import { historicalSelection, questionSignature } from "./answer-history";
import { answerOptionId, answerOptionLimit, answerVersionLimit, contactAnswerTypes, ContactAnswerQueryError, type ContactAnswerCohort, type ContactAnswerCounts, type ContactAnswerPair, type ContactAnswerVersion } from "./contact-answer-cohort";

export const historicalAnswerVersionId = (question: Question) => `answer-version-${createHash("sha256").update(questionSignature(question)).digest("hex").slice(0, 20)}`;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
/** Bounds apply only to this projection. Oversized/malformed history is disclosed,
 * never silently truncated into a different identity or repaired from today's draft. */
function snapshotQuestions(attempt?: Attempt): Question[] | null {
  if (!attempt || !Array.isArray(attempt.form?.questions) || attempt.form.questions.length > 200) return null;
  const ids = new Set<string>();
  for (const q of attempt.form.questions) {
    if (!object(q) || !answerOptionId(q.id) || ids.has(q.id) || typeof q.type !== "string") return null;
    ids.add(q.id);
    if (contactAnswerTypes.includes(q.type) && (typeof q.title !== "string" || q.title.length > 2000 || !Array.isArray(q.options) || !q.options.length || q.options.length > 1000 || q.options.some(o => !object(o) || !answerOptionId(o.id) || typeof o.label !== "string" || o.label.length > 2000) || new Set(q.options.map(o => o.id)).size !== q.options.length)) return null;
  }
  return attempt.form.questions.filter(q => contactAnswerTypes.includes(q.type));
}
function visibleQuestions(form: FormSchemaType, answers: Record<string, unknown>): Set<string> | null {
  const ids = new Set(form.questions.map(q => q.id));
  // resolvePath intentionally tolerates absent targets in live drafts. A malformed
  // saved rule cannot be treated as reliable evidence of historical eligibility.
  if (form.logicRules !== undefined && (!Array.isArray(form.logicRules) || form.logicRules.length > 1000 || form.logicRules.some(rule => !object(rule) || !ids.has(rule.sourceQuestionId) || !["equals", "not_equals", "contains", "greater_than", "less_than", "is_answered", "is_not_answered"].includes(rule.operator) || !["show_question", "hide_question", "jump_to_question", "jump_to_ending"].includes(rule.action) || rule.value !== undefined && (typeof rule.value !== "string" || rule.value.length > 2000) || rule.action !== "jump_to_ending" && (!rule.targetQuestionId || !ids.has(rule.targetQuestionId))))) return null;
  if (form.pages !== undefined && (!Array.isArray(form.pages) || form.pages.length > 200 || form.pages.some(page => !object(page) || !answerOptionId(page.id)) || new Set(form.pages.map(page => page.id)).size !== form.pages.length)) return null;
  try { return new Set(resolvePath(form, answers).questions.map(q => q.id)); } catch { return null; }
}

/** Streaming collector is called inside the existing eight-worker record join.
 * Holds catalog metadata and one selected membership set, never cached responses. */
export function createContactAnswerCollector(selection: ContactAnswerPair | null) {
  const groups = new Map<string, ContactAnswerVersion & { signature: string }>();
  const counts: ContactAnswerCounts = { answered: 0, unanswered: 0, skipped: 0, otherVersion: 0, unavailable: 0, invalid: 0 };
  const matchingIds: string[] = []; let unavailableSnapshots = 0;
  return {
    add(row: QuizSubmissionResult, attempt?: Attempt) {
      const questions = snapshotQuestions(attempt);
      if (!questions) { unavailableSnapshots++; if (selection) counts.unavailable++; return; }
      for (const q of questions) {
        const id = historicalAnswerVersionId(q), signature = questionSignature(q), previous = groups.get(id);
        if (previous && previous.signature !== signature) throw Error("Ambiguous historical answer version.");
        if (previous) previous.contacts++;
        else groups.set(id, { id, signature, title: q.title, type: q.type, multiple: multiTypes.has(q.type), contacts: 1, options: q.options!.map(o => ({ id: o.id, label: o.label })).sort((a, b) => a.id.localeCompare(b.id)), omittedOptions: 0 });
      }
      if (!selection) return;
      const question = questions.find(q => historicalAnswerVersionId(q) === selection.version);
      if (!question) { counts.otherVersion++; return; }
      if (!object(row.answers)) { counts.unavailable++; return; }
      const visible = visibleQuestions(attempt!.form, row.answers);
      if (!visible) { counts.unavailable++; return; }
      if (!visible.has(question.id)) { counts.skipped++; return; }
      const answer = historicalSelection(question, row.answers[question.id]);
      counts[answer.status]++;
      if (answer.status === "answered" && answer.selected.includes(selection.option) && row.id) matchingIds.push(row.id);
    },
    finish(): ContactAnswerCohort {
      const selected = selection && groups.get(selection.version);
      if (selection && (!selected || !selected.options.some(option => option.id === selection.option))) throw new ContactAnswerQueryError("That saved question or answer is no longer available. Choose another answer or clear the filter.");
      const all = [...groups.values()].sort((a, b) => b.contacts - a.contacts || a.id.localeCompare(b.id));
      const shown = all.slice(0, answerVersionLimit);
      if (selected && !shown.includes(selected)) shown[shown.length - 1] = selected;
      const versions = shown.map(group => {
        const options = group.options.slice(0, answerOptionLimit);
        const option = selection?.version === group.id && group.options.find(o => o.id === selection.option);
        if (option && !options.includes(option)) options[options.length - 1] = option;
        return { id: group.id, title: group.title, type: group.type, multiple: group.multiple, contacts: group.contacts, options, omittedOptions: group.options.length - options.length };
      });
      return { versions, omittedVersions: all.length - versions.length, unavailableSnapshots, selection, counts: selection ? counts : null, matchingIds: matchingIds.sort() };
    },
  };
}
