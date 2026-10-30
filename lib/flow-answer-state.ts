import type { FormSchemaType } from "./schema";
import { resolvePath, type Answers } from "./engine";

/** Drop abandoned-route answers before they can affect later routing or persistence.
 * Legacy quizzes retain their established resume behavior. The server still resolves
 * and validates the frozen attempt independently; this is never an authorization gate.
 */
export function retainFlowAnswers(form: FormSchemaType, answers: Answers): Answers {
  if (!form.routing) return answers;
  const reachable = new Set(resolvePath(form, answers).questions.map(question => question.id));
  const entries = Object.entries(answers);
  return entries.every(([id]) => reachable.has(id))
    ? answers
    : Object.fromEntries(entries.filter(([id]) => reachable.has(id)));
}
