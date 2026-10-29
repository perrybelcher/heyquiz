import { nanoid } from "nanoid";
import type { FormSchemaType } from "./schema";

/** Blank removes evidence; a literal zero remains a scored answer. */
export function setBasicAssociation(form: FormSchemaType, questionId: string, answerId: string, targetId: string, value: string, ruleId?: string): FormSchemaType {
  const m = form.marketing;
  if (!m || m.kind === "qualification") return form;
  const targets = m.kind === "scorecard" ? m.categories : m.outcomes;
  if (!targets.some(t => t.id === targetId) || !form.questions.find(q => q.id === questionId)?.options?.some(a => a.id === answerId)) throw new Error("This answer or result no longer exists.");
  if (value === "exclude" && (m.kind === "scorecard" || (form.quizType && form.quizType !== "product_finder"))) throw new Error("Exclusions are available for product matching.");
  const points = Number(value);
  if (value !== "" && value !== "exclude" && (!Number.isFinite(points) || points < 0 || points > 100)) throw new Error("Use points between 0 and 100.");
  const matches = m.rules.filter(r => r.questionId === questionId && r.answerId === answerId && r.targetId === targetId);
  const existing = ruleId ? matches.find(r => r.id === ruleId) : matches[0];
  if (ruleId && !existing) throw new Error("This association changed. Select its current row before editing it.");
  const effect = value === "exclude" ? "exclude" : "add";
  if (value !== "" && matches.some(r => r !== existing && r.effect === effect)) throw new Error(`This answer already has a ${effect === "exclude" ? "matching exclusion" : "points association"} for this result. Edit that row instead.`);
  const rules = m.rules.filter(r => r !== existing);
  if (value !== "") rules.push({ ...existing, id: existing?.id || `rule-${nanoid(10)}`, questionId, answerId, targetId, effect: value === "exclude" ? "exclude" : "add", points: value === "exclude" ? 0 : points, reason: existing?.reason || "" });
  return { ...form, marketing: { ...m, rules } };
}

export function removeBasicCategory(form: FormSchemaType, id: string): FormSchemaType {
  const m = form.marketing;
  if (!m || m.kind !== "scorecard") return form;
  return { ...form, marketing: { ...m, categories: m.categories.filter(c => c.id !== id), rules: m.rules.filter(r => r.targetId !== id), resultSections: m.resultSections?.filter(s => !(s.condition?.type === "score" && s.condition.categoryId === id)) } };
}
