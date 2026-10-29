import { defaultAuthoredTemplate } from "./authored-templates";
import type { QuizType } from "./quiz-types";
/** Keep guided creation's public entry point, using an eight-question example. */
export function outcomeTemplate(type: QuizType, id: string) {
  return defaultAuthoredTemplate(type, id);
}
