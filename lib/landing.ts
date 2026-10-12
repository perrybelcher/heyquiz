import { z } from "zod";
import type { CoverPageConfig } from "./schema";
import { resultVideoEmbed } from "./result-video";

export const landingSectionLimit = 8;
export function safeLandingImageUrl(value: string): boolean {
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export const LandingSectionSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  type: z.enum(["text", "benefits", "testimonial", "faq", "video", "start"]),
  title: z.string().max(200).default(""),
  body: z.string().max(4000).default(""),
  // Only the video renderer reads this value. It applies the provider allowlist
  // again at runtime; no arbitrary iframe markup or external start links exist.
  url: z.string().max(2000).refine(value => !value || /^https:\/\//i.test(value), "Use an HTTPS video URL.").default(""),
  label: z.string().max(200).default(""),
  items: z.array(z.string().max(240)).max(6).default([]),
});
export type LandingSection = z.infer<typeof LandingSectionSchema>;

export function validateLanding(cover?: CoverPageConfig, publishing = false): void {
  if (!cover) return;
  const sections = cover.sections || [];
  if (sections.length > landingSectionLimit) throw Error(`Use no more than ${landingSectionLimit} landing sections.`);
  if (new Set(sections.map(section => section.id)).size !== sections.length) throw Error("Landing section IDs must be unique.");
  if (!publishing || !cover.enabled) return;
  if (!cover.title.trim()) throw Error("Add a landing-page title before publishing.");
  if (!cover.buttonText.trim()) throw Error("Add a start-button label before publishing.");
  if (cover.imageUrl && !safeLandingImageUrl(cover.imageUrl)) throw Error("Use a safe image URL for the landing cover.");
  for (const [index, section] of sections.entries()) {
    const name = `Landing section ${index + 1}`;
    if (["text", "testimonial", "faq"].includes(section.type) && !section.body.trim()) throw Error(`${name}: add the content.`);
    if (section.type === "faq" && !section.title.trim()) throw Error(`${name}: add a question.`);
    if (section.type === "benefits" && (!section.items.length || section.items.some(item => !item.trim()))) throw Error(`${name}: complete the benefit list.`);
    if (section.type === "video" && !resultVideoEmbed(section.url)) throw Error(`${name}: use a supported HTTPS YouTube or Vimeo URL.`);
    if (section.type === "start" && !section.label.trim()) throw Error(`${name}: add a start-button label.`);
  }
}
