import { outcomeCreationEnabled } from "./outcome-availability";
import { isQuizType, type QuizType } from "./quiz-types";
export function creationQuizType(value: unknown): QuizType | undefined { return isQuizType(value) && (outcomeCreationEnabled || value === "knowledge" || value === "scorecard") ? value : undefined; }
export function creationTypeHref(path: string, quizType?: QuizType) { return quizType ? `${path}?quizType=${quizType}` : path; }
