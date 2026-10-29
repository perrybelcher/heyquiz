import { personalityTemplates } from "./authored-templates/personality";
import { productFinderTemplates } from "./authored-templates/product-finder";
import { diagnosticTemplates } from "./authored-templates/diagnostic";
import { qualificationTemplates } from "./authored-templates/qualification";
import { knowledgeTemplates } from "./authored-templates/knowledge";
import { scorecardTemplates } from "./authored-templates/scorecard";
import { FormSchema } from "./schema";
import { validateQuizType, type QuizType } from "./quiz-types";

const definitions = [...personalityTemplates, ...productFinderTemplates, ...diagnosticTemplates, ...qualificationTemplates, ...knowledgeTemplates, ...scorecardTemplates];
/** Metadata stays outside participant forms; counts reflect authored content. */
export const authoredTemplates = definitions.map(({build, ...metadata}) => ({
  ...metadata, questionCount: build("catalogue-count").questions.length,
}));

/** Parsing clones nested content. Instances never share mutable template state. */
export function authoredTemplate(templateId: string, id: string) {
  const definition = definitions.find(template => template.id === templateId);
  if (!definition) throw new Error("Unknown authored quiz template");
  const form = FormSchema.parse(definition.build(id));
  form.id = id;
  delete form.publishedAt;
  delete form.revision;
  delete form.createdAt;
  delete form.updatedAt;
  validateQuizType(form);
  return form;
}

export function defaultAuthoredTemplate(type: QuizType, id: string) {
  const definition = definitions.find(template => template.quizType === type && template.length === "short");
  if (!definition) throw new Error("No short template for this quiz type");
  return authoredTemplate(definition.id, id);
}
