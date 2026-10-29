import { isQuizType, quizTypeDefinitions } from "./quiz-types";

/** Presentation reads only frozen identity; it never evaluates answers or today's draft. */
export function outcomePresentation(result: { quizType?: unknown; status?: unknown }) {
  if (!isQuizType(result.quizType) || quizTypeDefinitions[result.quizType].scored) return null;
  const copy = {
    personality: { heading: "Your profile", reasons: "What your answers reveal", advice: "Your next step" },
    product_finder: { heading: "Your best match", reasons: "Why this matches your needs", advice: "Make the most of your match" },
    diagnostic: { heading: "Your biggest challenge", reasons: "What points to this challenge", advice: "Your action plan" },
    qualification: { heading: "Your recommended route", reasons: "Why this route fits", advice: "What happens next" },
  };
  const selected = copy[result.quizType as keyof typeof copy];
  return { ...selected, heading: result.status === "no_match" ? "More information needed" : selected.heading };
}
