import type { FormSchemaType } from "./schema";
export function outcomeRemovalImpact(form: FormSchemaType, id: string) {
  const m = form.marketing;
  return { answerRules: m?.rules.filter(r => r.targetId === id).length ?? 0, routes: m?.qualificationRules?.filter(r => r.outcomeId === id).length ?? 0, sections: m?.resultSections?.filter(s => s.condition?.type === "outcome" && s.condition.outcomeId === id).length ?? 0 };
}
export function removeOutcome(form: FormSchemaType, id: string): FormSchemaType {
  const m = form.marketing;
  if (!m) return form;
  return {...form, marketing: {...m, outcomes: m.outcomes.filter(o => o.id !== id), rules: m.rules.filter(r => r.targetId !== id), ...(m.qualificationRules ? {qualificationRules:m.qualificationRules.filter(r => r.outcomeId !== id)} : {}), ...(m.resultSections ? {resultSections:m.resultSections.filter(s => !(s.condition?.type === "outcome" && s.condition.outcomeId === id))} : {})}};
}
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const to = index + direction;
  if (index < 0 || to < 0 || index >= items.length || to >= items.length) return items;
  const next = [...items]; [next[index], next[to]] = [next[to], next[index]]; return next;
}
