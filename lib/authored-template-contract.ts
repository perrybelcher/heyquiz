import type { FormSchemaType } from "./schema";
import type { QuizType } from "./quiz-types";

/** Authored examples compile to the ordinary editable form model. */
export interface AuthoredTemplate {
  id: string;
  quizType: QuizType;
  title: string;
  summary: string;
  audience: string;
  length: "short" | "comprehensive";
  featured: boolean;
  build: (id: string) => FormSchemaType;
}

export interface TemplateAnswerFixture {
  templateId: string;
  name: string;
  answers: Record<string, unknown>;
  outcomeId?: string;
  status?: string;
  score?: number;
}
