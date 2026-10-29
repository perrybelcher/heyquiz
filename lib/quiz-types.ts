import { z } from "zod";
import { ValidationError } from "./errors";
import type { FormSchemaType } from "./schema";
export const QuizTypeSchema = z.enum(["personality", "product_finder", "diagnostic", "qualification", "knowledge", "scorecard"]);
export type QuizType = z.infer<typeof QuizTypeSchema>;
export const quizTypes = QuizTypeSchema.options;
export const quizTypeDefinitions = {
  personality: { label: "Discover your type", outcomeLabel: "Profile", mode: "survey", marketingKind: "segmentation", scored: false },
  product_finder: { label: "Find your best match", outcomeLabel: "Offer", mode: "survey", marketingKind: "product_finder", scored: false },
  diagnostic: { label: "Identify your biggest challenge", outcomeLabel: "Challenge", mode: "survey", marketingKind: "segmentation", scored: false },
  qualification: { label: "Check your fit", outcomeLabel: "Route", mode: "survey", marketingKind: "qualification", scored: false },
  knowledge: { label: "Test your knowledge", outcomeLabel: "Grade", mode: "quiz", marketingKind: undefined, scored: true },
  scorecard: { label: "Get your scorecard", outcomeLabel: "Score band", mode: "survey", marketingKind: "scorecard", scored: true },
} as const;
export function isQuizType(value: unknown): value is QuizType { return QuizTypeSchema.safeParse(value).success; }
export function validateQuizType(form: FormSchemaType, publishing = false) {
  if (publishing && form.conversionReview?.required) throw new ValidationError("Review the converted results and rules before publishing.");
  if (!form.quizType) return;
  const definition = quizTypeDefinitions[form.quizType];
  if (form.mode !== definition.mode || form.marketing?.kind !== definition.marketingKind) throw new ValidationError(`${definition.label} requires ${definition.mode} mode and ${definition.marketingKind ?? "no"} marketing configuration.`);
  if (["personality", "diagnostic"].includes(form.quizType) && form.marketing?.rules.some(r => r.effect === "exclude")) throw new ValidationError("Profile and challenge results use associations, not exclusions.");
}
