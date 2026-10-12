import { z } from "zod";

/** Client-safe copy only. This module never reads a recipient, creates a link or sends mail. */
export const RESULT_EMAIL_COPY_LIMITS = { subject: 120, introduction: 1200, signOff: 160, resolvedBytes: 4096 } as const;
const keys = ["subject", "introduction", "signOff"] as const;
function forbiddenCharacters(text: string, paragraphs: boolean) {
  return Array.from(text).some(char => {
    const code = char.charCodeAt(0);
    return (code < 32 && !(paragraphs && code === 10)) || (code >= 127 && code <= 159) || (char.length === 1 && code >= 0xd800 && code <= 0xdfff) ||
      code === 0x2028 || code === 0x2029 || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  });
}
function copyField(key: typeof keys[number], tokens: boolean) {
  const paragraphs = key !== "subject";
  return z.string().max(RESULT_EMAIL_COPY_LIMITS[key], `Use at most ${RESULT_EMAIL_COPY_LIMITS[key]} characters.`).superRefine((raw, ctx) => {
    const text = paragraphs ? raw.replace(/\r\n/g, "\n") : raw;
    if (forbiddenCharacters(text, paragraphs)) ctx.addIssue({ code: "custom", message: paragraphs ? "Remove control or direction-changing characters. Use normal paragraph breaks." : "Use one subject line without line breaks or control characters." });
    if (key !== "signOff" && !text.trim()) ctx.addIssue({ code: "custom", message: "Enter some text for this field." });
    if (tokens && /[{}]/.test(text.replace(/\{(?:quiz_title|brand_name)\}/g, ""))) ctx.addIssue({ code: "custom", message: "Use only {quiz_title} and {brand_name}; remove other or incomplete braces." });
  }).transform(text => paragraphs ? text.replace(/\r\n/g, "\n").trim() : text.replace(/ +/g, " ").trim());
}
export const ResultEmailCopySchema = z.object({ version: z.literal(1), subject: copyField("subject", true), introduction: copyField("introduction", true), signOff: copyField("signOff", true) }).strict();
export type ResultEmailCopy = z.infer<typeof ResultEmailCopySchema>;
export const DEFAULT_RESULT_EMAIL_COPY: Readonly<ResultEmailCopy> = Object.freeze({ version: 1, subject: "Your requested quiz result", introduction: "You requested a private result link for {quiz_title}.", signOff: "" });

// Stored substitutions are plain text: braces inside a quiz/brand name must never
// be interpreted a second time, including when a queued job is retried.
const ResolvedResultEmailCopySchema = z.object({ version: z.literal(1), subject: copyField("subject", false), introduction: copyField("introduction", false), signOff: copyField("signOff", false) }).strict().superRefine((copy, ctx) => {
  if (new TextEncoder().encode(keys.map(key => copy[key]).join("\n")).length > RESULT_EMAIL_COPY_LIMITS.resolvedBytes) ctx.addIssue({ code: "custom", path: ["introduction"], message: "The combined resolved copy is too long. Shorten the introduction." });
});
export type ResolvedResultEmailCopy = z.infer<typeof ResolvedResultEmailCopySchema>;
export function validateResolvedResultEmailCopy(value: unknown): ResolvedResultEmailCopy { return ResolvedResultEmailCopySchema.parse(value); }
function contextText(value: string | undefined, fallback: string, limit: number) {
  // Titles are content, never headers or templates. Strip unsafe controls and
  // bound the fields before one-pass substitution, without reading other data.
  const text = Array.from((value || "").slice(0, limit * 2)).slice(0, limit).map(char => forbiddenCharacters(char, false) ? " " : char).join("").replace(/\s+/g, " ").trim();
  return Array.from(text || fallback).slice(0, limit).join("");
}
export function resolveResultEmailCopy(value: unknown, context: { quizTitle?: string; brandName?: string }): ResolvedResultEmailCopy {
  const copy = ResultEmailCopySchema.parse(value), values = { quiz_title: contextText(context.quizTitle, "your quiz", 160), brand_name: contextText(context.brandName, "Pippi", 100) };
  return validateResolvedResultEmailCopy({ version: 1, ...Object.fromEntries(keys.map(key => [key, copy[key].replace(/\{(quiz_title|brand_name)\}/g, (_, token: keyof typeof values) => values[token])])) });
}
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const paragraphs = (text: string) => text ? text.split(/\n{2,}/).map(part => `<p>${escape(part).replace(/\n/g, "<br>")}</p>`).join("") : "";
export interface ResultEmailCopyMessage { subject: string; text: string; html: string }
/** Server callers must supply their validated canonical result URL. Omitting it
 * gives an inert example; previews cannot generate or mutate a live capability. */
export function renderResultEmailCopy(value: ResolvedResultEmailCopy, options: { expiresOn: string; privateUrl?: string; mode?: "synthetic" | "resend" }): ResultEmailCopyMessage {
  const copy = validateResolvedResultEmailCopy(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.expiresOn)) throw new Error("Use a valid result expiry date.");
  if (options.privateUrl !== undefined) {
    // Origin binding remains the server's responsibility; this pure renderer
    // also refuses active schemes, credentials and anything except result paths.
    let url: URL;
    try { url = new URL(options.privateUrl); } catch { throw new Error("The private result address is unavailable."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !/^\/result\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash) throw new Error("The private result address is unavailable.");
  }
  const link = options.privateUrl || "[Example private result link — preview only, does not open]";
  const linkHtml = options.privateUrl ? `<a href="${escape(link)}">Open your saved result</a>` : escape(link);
  const expiry = `This link expires on ${options.expiresOn} (UTC). Anyone with the link can view the saved result.`;
  const consent = "This request does not subscribe you to marketing emails.";
  const synthetic = options.mode !== "resend";
  return {
    subject: synthetic ? `${copy.subject} — local test` : copy.subject,
    text: [synthetic ? "LOCAL TEST ONLY — no email was sent." : "", copy.introduction, link, copy.signOff, `${expiry} ${consent}`].filter(Boolean).join("\n\n"),
    html: `${synthetic ? "<p><strong>LOCAL TEST ONLY — no email was sent.</strong></p>" : ""}${paragraphs(copy.introduction)}<p>${linkHtml}</p>${paragraphs(copy.signOff)}<p>${expiry}</p><p>${consent}</p>`,
  };
}
export function previewResultEmailCopy(value: unknown, mode: "synthetic" | "resend" = "synthetic"): ResultEmailCopyMessage {
  return renderResultEmailCopy(resolveResultEmailCopy(value, { quizTitle: "Your sample quiz", brandName: "Your brand" }), { expiresOn: "2030-01-31", mode });
}
