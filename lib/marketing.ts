import { z } from "zod";
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
export const MarketingSchema = z.object({
  kind: z.enum(["product_finder", "segmentation", "scorecard"]),
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
  kind: MarketingConfig["kind"];
  status: "matched" | "no_match" | "scored";
  title: string;
  message: string;
  outcomeId?: string;
  advice?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  reasons: string[];
  categories: {
    id: string;
    title: string;
    description: string;
    score: number | null;
    answered: number;
    applicable: number;
    minAnswers: number;
  }[];
}
export function validateMarketing(form: FormSchemaType, publishing = false) {
  const m = form.marketing;
  if (!m) return;
  const targets = m.kind === "scorecard" ? m.categories : m.outcomes;
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (!unique(targets.map((t) => t.id)) || !unique(m.rules.map((r) => r.id)))
    throw Error("Marketing IDs must be unique.");
  if (publishing && (!targets.length || !m.rules.length))
    throw Error(
      "Add a result and at least one answer rule before publishing this marketing quiz.",
    );
  const pairs = new Set<string>();
  for (const rule of m.rules) {
    const q = form.questions.find((q) => q.id === rule.questionId);
    if (!q || !q.options?.some((o) => o.id === rule.answerId))
      throw Error(
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
      throw Error("Marketing rules require a choice field.");
    if (!targets.some((t) => t.id === rule.targetId))
      throw Error("A marketing rule refers to a missing result.");
    if (m.kind === "scorecard" && rule.effect === "exclude")
      throw Error("Scorecard rules use points, not product exclusions.");
    const key = [
      rule.questionId,
      rule.answerId,
      rule.targetId,
      rule.effect,
    ].join(":");
    if (pairs.has(key)) throw Error("This answer rule is duplicated.");
    pairs.add(key);
  }
  if (publishing)
    for (const target of targets)
      if (
        !m.rules.some(
          (r) => r.targetId === target.id && r.effect === "add" && r.points > 0,
        )
      )
        throw Error(`Add a positive points rule for ${target.title}.`);
}
export function evaluateMarketing(
  form: FormSchemaType,
  answers: Answers,
): MarketingResult | undefined {
  const m = form.marketing;
  if (!m) return;
  const visible = new Set(
    resolvePath(form, answers).questions.map((q) => q.id),
  );
  const selected = (qid: string, aid: string) =>
    visible.has(qid) &&
    (Array.isArray(answers[qid])
      ? (answers[qid] as unknown[]).includes(aid)
      : answers[qid] === aid);
  const matches = m.rules.filter((r) => selected(r.questionId, r.answerId));
  const base: MarketingResult = {
    kind: m.kind,
    status: "no_match",
    title: m.fallbackTitle,
    message: m.fallbackMessage,
    reasons: [],
    categories: [],
  };
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
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        score:
          answered >= c.minAnswers && possible > 0
            ? Math.round((100 * earned) / possible)
            : null,
        answered,
        applicable: ids.length,
        minAnswers: c.minAnswers,
      };
    });
    const hasScore = categories.some((c) => c.score !== null);
    return {
      ...base,
      status: hasScore ? "scored" : "no_match",
      title: hasScore ? "Your scorecard" : base.title,
      message: hasScore
        ? "A snapshot of the practices you reported, with a practical next step for each area."
        : base.message,
      categories,
    };
  }
  const ranked = m.outcomes
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
