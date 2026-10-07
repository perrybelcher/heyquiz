import type {
  FormSchemaType,
  QuizSubmissionResult,
  QuestionGradingResult,
} from "./schema";
import {
  resolvePath,
  displayTypes,
  singleTypes,
  multiTypes,
  strings,
  text,
  record,
  formatAnswer,
  type Answers,
} from "./engine";
export function gradeQuizSubmission(
  form: FormSchemaType,
  answers: Answers,
): QuizSubmissionResult {
  const path = resolvePath(form, answers);
  let totalPointsPossible = 0,
    totalPointsEarned = 0;
  const grading: QuestionGradingResult[] = [];
  for (const q of path.questions) {
    if (displayTypes.has(q.type)) continue;
    const value = answers[q.id];
    let earned = 0,
      correct = false,
      key = "";
    const keyed =
      singleTypes.has(q.type) || multiTypes.has(q.type)
        ? Boolean(q.options?.some((o) => o.isCorrect))
        : ["choice_matrix", "matrix_multiselect"].includes(q.type)
          ? Boolean(q.matrixAnswerKey && Object.keys(q.matrixAnswerKey).length)
          : Boolean(q.correctAnswerText?.trim());
    const max = form.mode === "quiz" && keyed ? q.points || 0 : 0;
    if (singleTypes.has(q.type)) {
      const option = q.options?.find((o) => o.isCorrect);
      correct = Boolean(option && option.id === value);
      key = option?.label || "";
      earned = correct ? max : 0;
    } else if (multiTypes.has(q.type)) {
      const expected =
          q.options?.filter((o) => o.isCorrect).map((o) => o.id) || [],
        selected = [...new Set(strings(value))];
      key =
        q.options
          ?.filter((o) => o.isCorrect)
          .map((o) => o.label)
          .join(", ") || "";
      const good = selected.filter((id) => expected.includes(id)).length,
        bad = selected.length - good;
      earned = expected.length
        ? Math.min(
            max,
            Math.max(0, Math.round(((good - bad) / expected.length) * max)),
          )
        : 0;
      correct = expected.length > 0 && good === expected.length && bad === 0;
    } else if (q.matrixAnswerKey) {
      const rows = Object.keys(q.matrixAnswerKey),
        v = record(value);
      const matches = rows.filter(
        (r) =>
          JSON.stringify(
            [
              ...(Array.isArray(q.matrixAnswerKey?.[r])
                ? strings(q.matrixAnswerKey?.[r])
                : [text(q.matrixAnswerKey?.[r])]),
            ].sort(),
          ) ===
          JSON.stringify(
            [...(Array.isArray(v[r]) ? strings(v[r]) : [text(v[r])])].sort(),
          ),
      ).length;
      earned = rows.length ? Math.round((max * matches) / rows.length) : 0;
      correct = matches === rows.length;
      key = Object.entries(q.matrixAnswerKey)
        .map(([r, a]) => `${r}: ${Array.isArray(a) ? a.join(", ") : a}`)
        .join(" · ");
    } else if (keyed) {
      key = q.correctAnswerText || "";
      correct = text(value).trim().toLowerCase() === key.trim().toLowerCase();
      earned = correct ? max : 0;
    }
    totalPointsPossible += max;
    totalPointsEarned += earned;
    grading.push({
      questionId: q.id,
      questionTitle: q.title,
      type: q.type,
      maxPoints: max,
      earnedPoints: earned,
      isCorrect: max === 0 || correct,
      userAnswer: formatAnswer(q, value),
      correctAnswer: key,
      explanation: q.explanation,
    });
  }
  const percentageScore = totalPointsPossible
    ? Math.min(100, Math.round((totalPointsEarned / totalPointsPossible) * 100))
    : 100;
  const matchedTier =
    form.outcomeTiers.find((t) => t.id === path.tierId) ||
    form.outcomeTiers.find(
      (t) =>
        percentageScore >= t.minScorePercent &&
        percentageScore <= t.maxScorePercent,
    );
  return {
    formId: form.id,
    totalQuestions: grading.length,
    totalPointsPossible,
    totalPointsEarned,
    percentageScore,
    passed: percentageScore >= (form.settings.passingScorePercentage ?? 70),
    matchedTier,
    grading,
    submittedAt: new Date().toISOString(),
  };
}
