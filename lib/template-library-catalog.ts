import { templateImages } from "./template-images";
import { authoredTemplates } from "./authored-templates";
import { launchTemplates } from "./launch-templates";
import { createQuizTemplate } from "./template-factory";
import type { FormSchemaType } from "./schema";
import type { QuizType } from "./quiz-types";

export interface TemplateLibraryItem {
  id: string;
  title: string;
  summary: string;
  quizType: QuizType;
  questionCount: number;
  industry: string;
  length: "short" | "comprehensive" | "standard";
  image: string;
  imageAlt: string;
  focalPoint: string;
}
export interface TemplateLibraryFilters {
  quizType?: QuizType;
  query?: string;
  length?: string;
  industry?: string;
}

function formQuizType(form: FormSchemaType): QuizType {
  if (form.quizType) return form.quizType;
  switch (form.marketing?.kind) {
    case "product_finder": return "product_finder";
    case "qualification": return "qualification";
    case "scorecard": return "scorecard";
    case "segmentation": return "personality";
    default: return "knowledge";
  }
}

function authoredIndustry(id: string): string {
  if (/travell/.test(id)) return "Travel & leisure";
  if (/home|renovation/.test(id)) return "Home & interiors";
  if (/coffee/.test(id)) return "Food & drink";
  if (/training|knowledge/.test(id)) return "Education & training";
  return "Business & teams";
}

function imagery(id: string) {
  const image = templateImages[id];
  if (!image) throw new Error(`Missing template image: ${id}`);
  return image;
}

/** Display metadata only: inspecting a template never rewrites or stores a form. */
export const templateLibraryItems: TemplateLibraryItem[] = [
  ...authoredTemplates.map(template => {
    const form = createQuizTemplate(template.id, "library-metadata");
    return {
      id: template.id, title: template.title, summary: template.summary,
      quizType: formQuizType(form), questionCount: form.questions.length,
      industry: authoredIndustry(template.id), length: template.length,
      ...imagery(template.id),
    };
  }),
  ...launchTemplates.map(template => {
    const form = createQuizTemplate(template.id, "library-metadata");
    return {
      id: template.id, title: template.name, summary: template.summary,
      quizType: formQuizType(form), questionCount: form.questions.length,
      industry: template.industry, length: "standard" as const,
      ...imagery(template.id),
    };
  }),
];

/** One predicate for desktop and mobile, with combined filters and literal search. */
export function filterTemplateLibrary(items: readonly TemplateLibraryItem[], filters: TemplateLibraryFilters) {
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  return items.filter(item =>
    (!filters.quizType || item.quizType === filters.quizType) &&
    (!filters.length || filters.length === "all" || item.length === filters.length) &&
    (!filters.industry || filters.industry === "all" || item.industry === filters.industry) &&
    (!query || `${item.title} ${item.summary} ${item.industry} ${item.quizType.replaceAll("_", " ")}`.toLocaleLowerCase().includes(query)),
  );
}
