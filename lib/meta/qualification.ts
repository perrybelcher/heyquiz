import { createHash } from "node:crypto";
import { HttpError } from "../errors";
import type { FormSchemaType, QuizSubmissionResult } from "../schema";
import { contactScore } from "../contact-filters";
import { MetaSchema, type MetaConfig, type MetaDecision } from "./schema";
export const metaRuleVersion = (config: MetaConfig) => createHash("sha256").update(JSON.stringify({ rules: config.rules, mappings: config.mappings })).digest("hex").slice(0, 24);
export function validateMeta(form: FormSchemaType) {
  if (!form.meta?.enabled) return;
  const config = MetaSchema.parse(form.meta);
  if (!form.capture?.enabled) throw new HttpError(422, "Enable contact capture before Meta qualification.");
  if (!config.rules.length) throw new HttpError(422, "Choose at least one qualification condition.");
  if (!config.connectionId || !config.datasetId || !config.privacyUrl) throw new HttpError(422, "Connect Meta and add your privacy policy before enabling it.");
  for (const rule of config.rules) {
    if (rule.kind === "answer") {
      const question = form.questions.find(q => q.id === rule.questionId);
      if (!question?.options?.some(o => o.id === rule.optionId)) throw new HttpError(422, "A qualification answer was removed. Review the Meta rules.");
    }
    if (rule.kind === "outcome" && !(form.marketing ? form.marketing.outcomes : form.outcomeTiers).some(o => o.id === rule.outcomeId)) throw new HttpError(422, "A qualification outcome was removed. Review the Meta rules.");
    if (rule.kind === "score" && form.marketing && form.marketing.kind !== "scorecard") throw new HttpError(422, "This quiz does not produce a qualification score. Choose answers or an outcome.");
  }
  for (const mapping of config.mappings) if (!form.questions.some(q => q.id === mapping.questionId && ["short_answer", "paragraph", "dropdown", "multiple_choice"].includes(q.type))) throw new HttpError(422, "Choose a supported text or choice field for Meta matching.");
  if (new Set(config.mappings.map(m => m.field)).size !== config.mappings.length) throw new HttpError(422, "Map each Meta contact field once.");
}
export function qualify(config: MetaConfig, result: QuizSubmissionResult, now = Date.now()): MetaDecision {
  const checks = config.rules.map(rule => {
    if (rule.kind === "score") { const score = contactScore(result).value; return score === null ? undefined : score >= rule.min && score <= rule.max; }
    if (rule.kind === "outcome") { const id = result.marketing ? result.marketing.outcomeId : result.matchedTier?.id; return id ? id === rule.outcomeId : result.marketing?.status === "no_match" ? false : undefined; }
    const answer = result.answers?.[rule.questionId];
    if (answer === undefined || answer === null || answer === "" || Array.isArray(answer) && !answer.length) return undefined;
    return Array.isArray(answer) ? answer.includes(rule.optionId) : answer === rule.optionId;
  });
  return { status: !checks.length || checks.some(c => c === undefined) ? "unclassified" : checks.every(Boolean) ? "qualified" : "disqualified", ruleVersion: metaRuleVersion(config), decidedAt: now };
}
