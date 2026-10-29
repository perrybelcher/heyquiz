import { FormSchema } from "./schema";
import { quizTypeDefinitions, type QuizType } from "./quiz-types";
/** Omitting type preserves the legacy empty knowledge canvas. */
export function blankQuiz(id: string, quizType?: QuizType) {
  const definition = quizType ? quizTypeDefinitions[quizType] : undefined;
  return FormSchema.parse({ id, title: "Untitled quiz", ...(quizType ? {quizType} : {}), mode: definition?.mode ?? "quiz", ...(definition?.marketingKind ? {marketing:{kind:definition.marketingKind}} : {}), questions: [], outcomeTiers: [], theme: { primaryColor: "#a92335", backgroundColor: "#faf8f4", cardColor: "#ffffff", layout: "step" } });
}
