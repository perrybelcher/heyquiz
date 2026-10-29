import { z } from "zod";
import { ValidationError } from "./errors";
import type { FormSchemaType } from "./schema";
import { isAnswered, singleTypes, multiTypes, resolvePath, validationError, type Answers } from "./engine";
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const QualificationConditionSchema = z.object({ questionId: id, operator: z.enum(["equals", "not_equals", "greater_than", "less_than"]), value: z.string().max(200) });
export const QualificationRuleSchema = z.object({ id, outcomeId: id, match: z.enum(["all", "any"]), conditions: z.array(QualificationConditionSchema).max(100) });
export type QualificationCondition = z.infer<typeof QualificationConditionSchema>;
export type QualificationRule = z.infer<typeof QualificationRuleSchema>;
export const qualificationNumericTypes = ["number", "currency", "slider", "rating", "opinion_scale", "nps", "emoji_rating"];
export function validateQualification(form: FormSchemaType, publishing = false) {
  const m = form.marketing;
  if (!m || m.kind !== "qualification") return;
  const rules = m.qualificationRules ?? [];
  if (m.rules.length || m.categories.length || m.scorecard) throw new ValidationError("Qualification uses route conditions, not points or score bands.");
  if (new Set(rules.map(r => r.id)).size !== rules.length) throw new ValidationError("Qualification rule IDs must be unique.");
  for (const rule of rules) {
    if (!m.outcomes.some(o => o.id === rule.outcomeId)) throw new ValidationError("A qualification rule refers to a missing route.");
    if (publishing && !rule.conditions.length) throw new ValidationError("Add a condition to each qualification rule.");
    for (const c of rule.conditions) {
      const q = form.questions.find(q => q.id === c.questionId);
      if (!q) throw new ValidationError("A qualification condition refers to a missing question.");
      if (singleTypes.has(q.type) || multiTypes.has(q.type)) {
        if (!["equals", "not_equals"].includes(c.operator) || !q.options?.some(o => o.id === c.value)) throw new ValidationError("Qualification choice conditions must reference an existing answer ID.");
      } else if (!qualificationNumericTypes.includes(q.type) || !c.value.trim() || !Number.isFinite(Number(c.value))) throw new ValidationError("Qualification numeric conditions require a numeric field and finite value.");
    }
  }
  if (publishing) {
    if (!m.outcomes.length || !rules.length) throw new ValidationError("Add routes and conditions before publishing.");
    for (const outcome of m.outcomes) {
      if (!rules.some(r => r.outcomeId === outcome.id)) throw new ValidationError(`Add conditions for ${outcome.title}.`);
      if (!outcome.ctaLabel.trim() || !outcome.ctaUrl.trim()) throw new ValidationError(`Add a next-step button and URL for ${outcome.title}.`);
    }
  }
}
/** Invalid or missing answers fail every operator, including not_equals. */
export function matchingQualificationRules(form: FormSchemaType, answers: Answers): QualificationRule[] {
  const visible = new Set(resolvePath(form, answers).questions.map(q => q.id));
  const satisfies = (c: QualificationCondition) => {
    const q = form.questions.find(q => q.id === c.questionId), value = answers[c.questionId];
    if (!q || !visible.has(q.id) || !isAnswered(value) || validationError(q, value)) return false;
    if (singleTypes.has(q.type) || multiTypes.has(q.type)) {
      if (!q.options?.some(o => o.id === c.value)) return false;
      const values = Array.isArray(value) ? value : [value];
      if (!values.length || values.some(v => typeof v !== "string" || !q.options?.some(o => o.id === v))) return false;
      return c.operator === "equals" ? values.includes(c.value) : c.operator === "not_equals" && !values.includes(c.value);
    }
    if (!qualificationNumericTypes.includes(q.type) || !["string", "number"].includes(typeof value) || !String(value).trim() || !c.value.trim()) return false;
    const actual = Number(value), expected = Number(c.value);
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    switch(c.operator) { case "equals": return actual === expected; case "not_equals": return actual !== expected; case "greater_than": return actual > expected; case "less_than": return actual < expected; }
  };
  return (form.marketing?.qualificationRules ?? []).filter(r => r.conditions.length > 0 && form.marketing?.outcomes.some(o => o.id === r.outcomeId) && (r.match === "all" ? r.conditions.every(satisfies) : r.conditions.some(satisfies)));
}
