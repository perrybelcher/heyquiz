import { z } from "zod";
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const metaFields = ["fn", "ln", "ct", "st", "zp", "country"] as const;
export const QualificationRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), questionId: identifier, optionId: identifier }),
  z.object({ kind: z.literal("score"), categoryId: identifier.optional(), min: z.number().min(0).max(100), max: z.number().min(0).max(100) }).refine(v => v.min <= v.max, "Minimum score must not exceed maximum."),
  z.object({ kind: z.literal("outcome"), outcomeId: identifier }),
]);
export const MetaSchema = z.object({
  enabled: z.boolean().default(false),
  connectionId: z.string().max(128).default(""),
  datasetId: z.string().regex(/^\d{5,30}$/).or(z.literal("")).default(""),
  rules: z.array(QualificationRuleSchema).max(30).default([]),
  mappings: z.array(z.object({ field: z.enum(metaFields), questionId: identifier })).max(6).default([]),
  privacyUrl: z.string().max(2000).refine(v => !v || /^https:\/\//i.test(v), "Use an HTTPS privacy policy URL.").default(""),
});
export type MetaConfig = z.infer<typeof MetaSchema>;
export type QualificationRule = z.infer<typeof QualificationRuleSchema>;
export const defaultMeta: MetaConfig = { enabled: false, connectionId: "", datasetId: "", rules: [], mappings: [], privacyUrl: "" };
export type MetaEventName = "PageView" | "Qualified" | "Disqualified";
export interface MetaDecision { status: "qualified" | "disqualified" | "unclassified"; ruleVersion: string; decidedAt: number }
export interface MetaBrowserContext {
  url: string; fbp?: string; fbc?: string; fbclid?: string;
  screen_width?: number; screen_height?: number; viewport_width?: number; viewport_height?: number; pixel_ratio?: number; language?: string;
}
export interface MetaEvent {
  event_name: MetaEventName; event_time: number; event_id: string; action_source: "website"; event_source_url: string;
  user_data: Record<string, string | string[]>; custom_data: Record<string, string | number>;
}
