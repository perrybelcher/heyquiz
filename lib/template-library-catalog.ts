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

function imagery(id: string, title: string, coverImage?: string) {
  if (coverImage) return { image: coverImage, imageAlt: `${title} template cover`, focalPoint: "50% 50%" };
  const topic = `${id} ${title}`.toLowerCase();
  if (/coffee|tea|meal/.test(topic)) return { image: "/templates/lifestyle/coffee.webp", imageAlt: "Coffee prepared for a relaxed daily ritual", focalPoint: "50% 50%" };
  if (/travel|travell|hotel|event|wedding/.test(topic)) return { image: "/templates/lifestyle/travel.webp", imageAlt: "A traveller overlooking a Mediterranean coastal town", focalPoint: "64% 50%" };
  if (/home|renovation|garden|interior|desk/.test(topic)) return { image: "/templates/lifestyle/home.webp", imageAlt: "A warm living room with natural textures and thoughtful details", focalPoint: "50% 50%" };
  return { image: "/templates/lifestyle/workspace.webp", imageAlt: "A person reflecting and planning at a sunlit workspace", focalPoint: "70% 50%" };
}

/** Display metadata only: inspecting a template never rewrites or stores a form. */
export const templateLibraryItems: TemplateLibraryItem[] = [
  ...authoredTemplates.map(template => {
    const form = createQuizTemplate(template.id, "library-metadata");
    return {
      id: template.id, title: template.title, summary: template.summary,
      quizType: formQuizType(form), questionCount: form.questions.length,
      industry: authoredIndustry(template.id), length: template.length,
      ...imagery(template.id, template.title, form.coverPage?.imageUrl),
    };
  }),
  ...launchTemplates.map(template => {
    const form = createQuizTemplate(template.id, "library-metadata");
    return {
      id: template.id, title: template.name, summary: template.summary,
      quizType: formQuizType(form), questionCount: form.questions.length,
      industry: template.industry, length: "standard" as const,
      ...imagery(template.id, template.name, form.coverPage?.imageUrl),
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
