import { flowUsesAutomaticResults } from './flow-routing';
import { validateQuizType, type QuizType } from "./quiz-types";
import { QualificationRuleSchema, validateQualification, matchingQualificationRules } from "./qualification";
import { ValidationError } from "./errors";
import { z } from "zod";
import { resultVideoEmbed } from "./result-video";
import type { FormSchemaType } from "./schema";
import { resolvePath, type Answers } from "./engine";
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const webUrl = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Use a complete http or https URL.",
  );
// Bands use inclusive integer percentages. Publication requires full coverage,
// so a boundary score can never silently lose its recommendation.
export const ScoreBandSchema = z.object({
  id,
  min: z.number().int().min(0).max(100),
  max: z.number().int().min(0).max(100),
  title: z.string().trim().min(1).max(200),
  advice: z.string().max(4000).default(""),
  action: z.string().max(1000).default(""),
  ctaLabel: z.string().max(100).default("Continue"),
  ctaUrl: webUrl.default(""),
});
export type ScoreBand = z.infer<typeof ScoreBandSchema>;
export const ScorecardPresentationSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Your scorecard"),
  message: z.string().max(4000).default("Your results are based on the answers you shared."),
  bands: z.array(ScoreBandSchema).max(10).default([]),
});
// Structured content only: no arbitrary HTML or executable embeds in result pages.
export const ResultSectionConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("outcome"), outcomeId: id }),
  z.object({ type: z.literal("score"), categoryId: id.optional(), min: z.number().int().min(0).max(100), max: z.number().int().min(0).max(100) }),
]);
export const ResultSectionSchema = z.object({
  condition: ResultSectionConditionSchema.optional(),
  id,
  type: z.enum(["text", "image", "testimonial", "faq", "cta", "video"]),
  title: z.string().max(200).default(""),
  body: z.string().max(4000).default(""),
  url: webUrl.default(""),
  label: z.string().max(200).default(""),
});
export type ResultSection = z.infer<typeof ResultSectionSchema>;
export const ResultPresentationSchema = z.object({
  layout: z.enum(["stacked", "score_overview", "action_plan"]).default("stacked"),
});
export type ResultPresentation = z.infer<typeof ResultPresentationSchema>;
export const MarketingSchema = z.object({
  kind: z.enum(["product_finder", "segmentation", "scorecard", "qualification"]),
  qualificationRules: z.array(QualificationRuleSchema).max(100).optional(),
  presentation: ResultPresentationSchema.optional(),
  scorecard: ScorecardPresentationSchema.optional(),
  resultSections: z.array(ResultSectionSchema).max(12).optional(),
  fallbackTitle: z
    .string()
    .min(1)
    .max(200)
    .default("Let’s explore your options"),
  fallbackMessage: z
    .string()
    .max(4000)
    .default(
      "We don’t have enough information for a specific recommendation. Review your answers or explore the options.",
    ),
  outcomes: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(200),
        description: z.string().max(4000).default(""),
        advice: z.string().max(4000).default(""),
        ctaLabel: z.string().max(100).default("Explore this option"),
        ctaUrl: webUrl.default(""),
        minPoints: z.number().min(0).max(10000).default(1),
      }),
    )
    .max(30)
    .default([]),
  categories: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(200),
        description: z.string().max(2000).default(""),
        minAnswers: z.number().int().min(1).max(200).default(1),
        bands: z.array(ScoreBandSchema).max(10).optional(),
      }),
    )
    .max(20)
    .default([]),
  rules: z
    .array(
      z.object({
        id,
        questionId: id,
        answerId: id,
        targetId: id,
        effect: z.enum(["add", "exclude"]).default("add"),
        points: z.number().min(0).max(100).default(1),
        reason: z.string().max(1000).default(""),
      }),
    )
    .max(1000)
    .default([]),
});
export type MarketingConfig = z.infer<typeof MarketingSchema>;
export interface MarketingResult {
  quizType?: QuizType;
  // Frozen alongside the computed score, rather than looked up from a later draft.
  // Older saved results omit this and retain the original stacked presentation.
  presentation?: ResultPresentation;
  resultSections?: ResultSection[];
  kind: MarketingConfig["kind"];
  status: "matched" | "no_match" | "scored";
  title: string;
  message: string;
  outcomeId?: string;
  advice?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  overallScore?: number | null;
  priorities?: { categoryId: string; title: string; action: string }[];
  reasons: string[];
  categories: {
    id: string;
    title: string;
    description: string;
    score: number | null;
    answered: number;
    applicable: number;
    minAnswers: number;
    bandTitle?: string;
    advice?: string;
    action?: string;
  }[];
}
export function validateMarketing(form: FormSchemaType, publishing = false) {
  validateQuizType(form, publishing);
  const m = form.marketing;
  if (!m) return;
  const requiresAutomaticRules = flowUsesAutomaticResults(form);
  validateQualification(form, publishing && requiresAutomaticRules);
  const targets = m.kind === "scorecard" ? m.categories : m.outcomes;
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (!unique(targets.map((t) => t.id)) || !unique(m.rules.map((r) => r.id)))
    throw new ValidationError("Marketing IDs must be unique.");
  if (!unique((m.resultSections ?? []).map(s => s.id))) throw new ValidationError("Result section IDs must be unique.");
  if (publishing) for (const [index, section] of (m.resultSections ?? []).entries()) {
    const name = `Result section ${index + 1}`;
    if (["image", "cta", "video"].includes(section.type) && !section.url.trim()) throw new ValidationError(`${name}: add a URL.`);
    if (section.type === "video" && !resultVideoEmbed(section.url)) throw new ValidationError(`${name}: use an HTTPS YouTube or Vimeo video link.`);
    const condition = section.condition;
    if (condition?.type === "outcome" && (m.kind === "scorecard" || !m.outcomes.some(o => o.id === condition.outcomeId))) throw new ValidationError(`${name}: choose an existing result.`);
    if (condition?.type === "score") {
      if (m.kind !== "scorecard") throw new ValidationError(`${name}: score conditions require a scorecard.`);
      if (condition.min > condition.max) throw new ValidationError(`${name}: minimum score exceeds maximum.`);
      if (condition.categoryId ? !m.categories.some(c => c.id === condition.categoryId) : !m.scorecard) throw new ValidationError(`${name}: choose an available score category or enable overall score results.`);
    }
    if (section.type === "cta" && !section.label.trim()) throw new ValidationError(`${name}: add a button label.`);
    if (section.type === "faq" && !section.title.trim()) throw new ValidationError(`${name}: add a question.`);
    if (["text", "faq", "testimonial"].includes(section.type) && !section.body.trim()) throw new ValidationError(`${name}: add content.`);
  }
  if (publishing && requiresAutomaticRules && m.kind !== "qualification" && (!targets.length || !m.rules.length))
    throw new ValidationError(
      "Add a result and at least one answer rule before publishing this marketing quiz.",
    );
  if (m.kind === "scorecard") {
    const groups = [{ title: "Overall result", bands: m.scorecard?.bands }, ...m.categories];
    for (const group of groups) {
      const bands = [...(group.bands || [])].sort((a, b) => a.min - b.min);
      if (!unique(bands.map(b => b.id))) throw new ValidationError(`${group.title}: band IDs must be unique.`);
      for (let i = 0; i < bands.length; i++) {
        if (bands[i].min > bands[i].max) throw new ValidationError(`${group.title}: minimum score exceeds maximum.`);
        if (i && bands[i].min <= bands[i - 1].max) throw new ValidationError(`${group.title}: score bands overlap.`);
        if (publishing && bands[i].min !== (i ? bands[i - 1].max + 1 : 0))
          throw new ValidationError(`${group.title}: score bands must cover every percentage from 0 to 100.`);
        if (bands[i].ctaUrl && !bands[i].ctaLabel.trim()) throw new ValidationError(`${group.title}: add a button label.`);
      }
      if (publishing && bands.length && bands[bands.length - 1].max !== 100)
        throw new ValidationError(`${group.title}: score bands must end at 100.`);
    }
  }
  const pairs = new Set<string>();
  for (const rule of m.rules) {
    const q = form.questions.find((q) => q.id === rule.questionId);
    if (!q || !q.options?.some((o) => o.id === rule.answerId))
      throw new ValidationError(
        "A marketing rule refers to a missing question or answer. Update it in Marketing.",
      );
    if (
      ![
        "multiple_choice",
        "multiselect",
        "dropdown",
        "picture_choice",
        "image_multiselect",
        "checkboxes",
        "segmented",
        "switch",
        "thumbs",
        "like_dislike",
      ].includes(q.type)
    )
      throw new ValidationError("Marketing rules require a choice field.");
    if (!targets.some((t) => t.id === rule.targetId))
      throw new ValidationError("A marketing rule refers to a missing result.");
    if (m.kind === "scorecard" && rule.effect === "exclude")
      throw new ValidationError("Scorecard rules use points, not product exclusions.");
    const key = [
      rule.questionId,
      rule.answerId,
      rule.targetId,
      rule.effect,
    ].join(":");
    if (pairs.has(key)) throw new ValidationError("This answer rule is duplicated.");
    pairs.add(key);
  }
  if (publishing && requiresAutomaticRules && m.kind !== "qualification")
    for (const target of targets)
      if (
        !m.rules.some(
          (r) => r.targetId === target.id && r.effect === "add" && r.points > 0,
        )
      )
        throw new ValidationError(`Add a positive points rule for ${target.title}.`);
}
// Resolve visibility on the server, and retain the selected content in saved results.
// Insufficient coverage is never treated as a zero score.
export function evaluateMarketing(form: FormSchemaType, answers: Answers): MarketingResult | undefined {
  const result = evaluateMarketingCore(form, answers);
  if (!result) return;
  if (result.resultSections) result.resultSections = result.resultSections.filter(section => {
    const condition = section.condition;
    if (!condition) return true;
    if (condition.type === "outcome") return result.status === "matched" && result.outcomeId === condition.outcomeId;
    const score = condition.categoryId ? result.categories.find(c => c.id === condition.categoryId)?.score : result.overallScore;
    return typeof score === "number" && score >= condition.min && score <= condition.max;
  }).map(({ condition: _condition, ...section }) => section);
  return result;
}
function selectedMarketingRules(form: FormSchemaType, answers: Answers) {
  const visible = new Set(
    resolvePath(form, answers).questions.map((q) => q.id),
  );
  const selected = (qid: string, aid: string) =>
    visible.has(qid) &&
    (Array.isArray(answers[qid])
      ? (answers[qid] as unknown[]).includes(aid)
      : answers[qid] === aid);
  return { visible, selected, matches: form.marketing?.rules.filter((r) => selected(r.questionId, r.answerId)) ?? [] };
}

/** Shared weighted ordering for evaluation and observed journey diagnostics. */
export function rankMarketingOutcomes(form: FormSchemaType, answers: Answers) {
  const { matches } = selectedMarketingRules(form, answers);
  return (form.marketing?.outcomes ?? [])
    .map((o, index) => ({
      o,
      index,
      points: matches
        .filter((r) => r.targetId === o.id && r.effect === "add")
        .reduce((n, r) => n + r.points, 0),
    }))
    .filter(
      ({ o, points }) =>
        points > 0 &&
        points >= o.minPoints &&
        !matches.some((r) => r.targetId === o.id && r.effect === "exclude"),
    )
    .sort((a, b) => b.points - a.points || a.index - b.index);
}

function evaluateMarketingCore(
  form: FormSchemaType,
  answers: Answers,
): MarketingResult | undefined {
  const m = form.marketing;
  if (!m) return;
  const { matches, visible, selected } = selectedMarketingRules(form, answers);
  const base: MarketingResult = {
    ...(form.quizType ? { quizType: form.quizType } : {}),
    presentation: { layout: m.presentation?.layout ?? "stacked" },
    resultSections: m.resultSections,
    kind: m.kind,
    status: "no_match",
    title: m.fallbackTitle,
    message: m.fallbackMessage,
    reasons: [],
    categories: [],
  };
  const directId = form.routing ? resolvePath(form, answers).outcomeId : undefined;
  const direct = m.kind !== "scorecard" ? m.outcomes.find(o => o.id === directId) : undefined;
  if (direct) return { ...base, status: "matched", outcomeId: direct.id, title: direct.title, message: direct.description, advice: direct.advice, ctaLabel: direct.ctaLabel, ctaUrl: direct.ctaUrl };
  if (m.kind === "qualification") {
    const rule = matchingQualificationRules(form, answers)[0];
    const outcome = m.outcomes.find(o => o.id === rule?.outcomeId);
    return outcome ? { ...base, status: "matched", outcomeId: outcome.id, title: outcome.title, message: outcome.description, advice: outcome.advice, ctaLabel: outcome.ctaLabel, ctaUrl: outcome.ctaUrl } : base;
  }
  if (m.kind === "scorecard") {
    const categories = m.categories.map((c) => {
      const rules = m.rules.filter(
        (r) => r.targetId === c.id && visible.has(r.questionId),
      );
      const ids = [...new Set(rules.map((r) => r.questionId))];
      let earned = 0,
        possible = 0,
        answered = 0;
      for (const qid of ids) {
        const question = form.questions.find((q) => q.id === qid)!;
        const qr = rules.filter((r) => r.questionId === qid);
        const picked = qr.filter((r) => selected(qid, r.answerId));
        // A mapped zero-point answer is answered; an unmapped/unknown answer is not a zero.
        if (!picked.length) continue;
        const multi = [
          "multiselect",
          "image_multiselect",
          "checkboxes",
        ].includes(question.type);
        const max = multi
          ? qr.reduce((n, r) => n + r.points, 0)
          : Math.max(...qr.map((r) => r.points));
        if (max <= 0) continue;
        answered++;
        possible += max;
        earned += Math.min(
          max,
          picked.reduce((n, r) => n + r.points, 0),
        );
      }
      const score = answered >= c.minAnswers && possible > 0
        ? Math.round((100 * earned) / possible) : null;
      const band = score === null ? undefined : c.bands?.find(b => score >= b.min && score <= b.max);
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        score,
        ...(band ? { bandTitle: band.title, advice: band.advice, action: band.action } : {}),
        answered,
        applicable: ids.length,
        minAnswers: c.minAnswers,
      };
    });
    const hasScore = categories.some((c) => c.score !== null);
    // Equal category weighting; withhold overall advice until all categories
    // meet their configured coverage, rather than treating missing data as zero.
    const overallScore = categories.length && categories.every(c => c.score !== null)
      ? Math.round(categories.reduce((n, c) => n + c.score!, 0) / categories.length) : null;
    const band = overallScore === null ? undefined : m.scorecard?.bands.find(b => overallScore >= b.min && overallScore <= b.max);
    const priorities = categories.filter(c => c.score !== null && c.action)
      .sort((a, b) => a.score! - b.score!).slice(0, 3)
      .map(c => ({ categoryId: c.id, title: c.title, action: c.action! }));
    return {
      ...base,
      status: hasScore ? "scored" : "no_match",
      title: hasScore ? band?.title || m.scorecard?.title || "Your scorecard" : base.title,
      message: hasScore
        ? "A snapshot of the practices you reported, with a practical next step for each area."
        : base.message,
      ...(hasScore && m.scorecard ? { message: m.scorecard.message } : {}),
      ...(m.scorecard ? { overallScore, priorities } : {}),
      ...(band ? { outcomeId: band.id, advice: band.advice, ctaLabel: band.ctaLabel, ctaUrl: band.ctaUrl } : {}),
      categories,
    };
  }
  const ranked = rankMarketingOutcomes(form, answers);
  const best = ranked[0];
  if (!best) return base;
  return {
    ...base,
    status: "matched",
    outcomeId: best.o.id,
    title: best.o.title,
    message: best.o.description,
    advice: best.o.advice,
    ctaLabel: best.o.ctaLabel,
    ctaUrl: best.o.ctaUrl,
    reasons: [
      ...new Set(
        matches
          .filter(
            (r) => r.targetId === best.o.id && r.effect === "add" && r.reason,
          )
          .map((r) => r.reason),
      ),
    ],
  };
}
