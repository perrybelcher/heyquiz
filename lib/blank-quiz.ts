import { FormSchema } from "./schema";
/** A genuinely empty canvas: no example questions, outcomes, or marketing rules. */
export function blankQuiz(id: string) {
  return FormSchema.parse({ id, title: "Untitled quiz", mode: "quiz", questions: [], outcomeTiers: [], theme: { primaryColor: "#a92335", backgroundColor: "#faf8f4", cardColor: "#ffffff", layout: "step" } });
}
