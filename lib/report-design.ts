import { z } from "zod";

export const REPORT_SECTIONS = ["priorities", "reasons", "advice", "details", "action"] as const;
export type ReportSection = typeof REPORT_SECTIONS[number];
export const REPORT_SECTION_LABELS: Record<ReportSection, string> = {
  priorities: "Next priorities", reasons: "Why this fits", advice: "First-step advice",
  details: "Additional result sections", action: "Main next-step button",
};

/** Annotation only: callers never fetch this address or accept a result capability. */
export function safeReportUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 2000 || /[\u0000-\u0020\u007f-\u009f\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    const decoded = decodeURIComponent(url.pathname + url.search + url.hash);
    if (/[\u0000-\u001f\u007f-\u009f\\]/u.test(decoded)) return null;
    if (/\/result\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:[/?#]|$)/u.test(decoded)) return null;
    return url.href;
  } catch { return null; }
}

function plain(limit: number, multiline = false) {
  return z.string().max(limit).refine(value => {
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/u.test(value) || (!multiline && /[\r\n\t]/u.test(value))) return false;
    return ![...value].some(character => { const n = character.codePointAt(0)!; return n >= 0xd800 && n <= 0xdfff; });
  }, "Use plain text without hidden control characters.");
}

export const ReportDesignSchema = z.object({
  version: z.literal(1), style: z.enum(["editorial", "executive"]), cover: z.boolean(),
  title: plain(140), subtitle: plain(240), introduction: plain(2000, true), footer: plain(160),
  sections: z.array(z.enum(REPORT_SECTIONS)).max(5).refine(values => new Set(values).size === values.length, "Choose each section only once."),
  cta: z.object({ label: plain(80).refine(value => !!value.trim(), "Add a button label."), url: z.string().max(2000).refine(value => !!safeReportUrl(value), "Use a full http or https link without credentials or private result tokens.") }).strict().optional(),
}).strict();
export type ReportDesign = z.infer<typeof ReportDesignSchema>;
export const DEFAULT_REPORT_DESIGN: ReportDesign = {
  version: 1, style: "editorial", cover: false, title: "", subtitle: "", introduction: "", footer: "", sections: [...REPORT_SECTIONS],
};

export function readableReportAccent(value: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return "#8A1C2B";
  const channels = [0, 2, 4].map(offset => {
    const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) >= 4.5 ? value : "#8A1C2B";
}
