import type { Question } from "./schema";
import { multiTypes, singleTypes, validationError, type Answers } from "./engine";

const prefix = "⟦answer:";
const pattern = () => /⟦answer:([A-Za-z0-9_-]{1,128})\|([^⟦⟧\r\n]+)⟧/g;

export function supportsResultAnswer(question: Question) {
  return (singleTypes.has(question.type) || multiTypes.has(question.type)) && Boolean(question.options?.length);
}

export function answerVariable(questionId: string, fallback: string) {
  return `${prefix}${questionId}|${fallback.trim()}⟧`;
}

export function resultVariableIssue(value: string, questions: readonly Question[]) {
  for (const [, id, fallback] of value.matchAll(pattern())) {
    if (!fallback.trim()) return "Add fallback wording to each answer variable.";
    if (!questions.some(question => question.id === id && supportsResultAnswer(question))) {
      return "Replace or remove the answer variable for a deleted or unsupported question.";
    }
  }
  if (value.replace(pattern(), "").includes(prefix)) return "Replace or remove the incomplete answer variable.";
}

export function resolveResultText(value: string, questions: readonly Question[], answers: Answers) {
  return value.replace(pattern(), (_, id: string, fallback: string) => {
    const question = questions.find(item => item.id === id);
    const answer = Object.hasOwn(answers, id) ? answers[id] : undefined;
    if (!question || !supportsResultAnswer(question) || validationError(question, answer)) return fallback;
    const ids = multiTypes.has(question.type) ? answer : [answer];
    if (!Array.isArray(ids) || !ids.length || ids.some(item => typeof item !== "string")) return fallback;
    const labels = question.options!.filter(option => ids.includes(option.id)).map(option => option.label.trim());
    if (!labels.length || labels.some(label => !label) || labels.length !== new Set(ids).size) return fallback;
    return new Intl.ListFormat("en", { type: "conjunction" }).format(labels);
  });
}
