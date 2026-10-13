import { type HelpArticle } from "./help-content";

/** Public documentation fallback: useful instructions without pretending AI ran. */
export function guideAnswer(articles: HelpArticle[], notice: string) {
  const primary = articles[0];
  if (!primary) return `${notice}\n\nTell me which Pippi screen you are on and what you want to accomplish. For example: put name and email on one page, assign points, or publish a quiz. Leave out passwords and customer information.`;
  return `${notice}\n\n${primary.title}\n\n${primary.sections.map((s, i) => `${i + 1}. ${s.title}\n${s.body}`).join("\n\n")}\n\nIf this does not match your screen, tell me the step and visible button label where you are stuck.`;
}
