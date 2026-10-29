import type { FormSchemaType } from "../schema";

/** The editor and publication gate must offer the same result identities. */
export function metaOutcomeOptions(form: FormSchemaType) {
  if (form.marketing?.kind === "scorecard") return form.marketing.scorecard?.bands || [];
  return form.marketing ? form.marketing.outcomes : form.outcomeTiers;
}
export function metaScoreOptions(form: FormSchemaType) {
  if (form.marketing?.kind === "scorecard") return [
    ...(form.marketing.scorecard ? [{ id: "", title: "Overall score" }] : []),
    ...form.marketing.categories.map(category => ({ id: category.id, title: category.title })),
  ];
  return !form.marketing && form.mode === "quiz" ? [{ id: "", title: "Knowledge score" }] : [];
}
