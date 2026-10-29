import { authoredTemplate, authoredTemplates } from "./authored-templates";
import { launchTemplate, launchTemplates } from "./launch-templates";
import { FormSchema } from "./schema";

/** One selection entry point for the new collection and historical templates. */
export function createQuizTemplate(templateId: string, id: string) {
  if (authoredTemplates.some(template => template.id === templateId)) return authoredTemplate(templateId,id);
  const legacy = launchTemplates.find(template => template.id === templateId);
  if (!legacy) throw new Error("Unknown quiz template");
  return FormSchema.parse(launchTemplate(legacy.id,id));
}
