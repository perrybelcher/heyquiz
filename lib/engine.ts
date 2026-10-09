import type { FormSchemaType, Question, LogicOperator } from "./schema";

export type Answers = Record<string, unknown>;
export const displayTypes = new Set([
  "heading",
  "subheading",
  "banner",
  "divider",
  "image_display",
  "rich_text",
  "accordion",
  "hidden",
  "video_embed",
  "calculation",
]);
export const singleTypes = new Set([
  "multiple_choice",
  "picture_choice",
  "dropdown",
  "segmented",
  "switch",
  "like_dislike",
  "thumbs",
]);
export const multiTypes = new Set([
  "multiselect",
  "checkboxes",
  "image_multiselect",
]);
export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
export const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
export function isAnswered(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0 && value.some(isAnswered);
  if (value && typeof value === "object")
    return Object.values(value).some(isAnswered);
  return false;
}
export function orderedQuestions(form: FormSchemaType): Question[] {
  const pages = form.pages || [];
  if (!pages.length) return form.questions;
  return [...form.questions].sort(
    (a, b) =>
      Math.max(
        0,
        pages.findIndex((p) => p.id === (a.pageId || pages[0].id)),
      ) -
      Math.max(
        0,
        pages.findIndex((p) => p.id === (b.pageId || pages[0].id)),
      ),
  );
}
export function evaluateCondition(
  operator: LogicOperator,
  actual: unknown,
  target = "",
  question?: Question,
): boolean {
  if (operator === "is_answered") return isAnswered(actual);
  if (operator === "is_not_answered") return !isAnswered(actual);
  if (!isAnswered(actual)) return false;
  const values = (Array.isArray(actual) ? strings(actual) : [text(actual)])
    .map((v) => [v, question?.options?.find((o) => o.id === v)?.label || v])
    .flat()
    .map((v) => v.trim().toLowerCase());
  const expected = target.trim().toLowerCase();
  if (operator === "equals") return values.includes(expected);
  if (operator === "not_equals") return !values.includes(expected);
  if (operator === "contains") return values.some((v) => v.includes(expected));
  const a = Number(actual),
    b = Number(target);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return operator === "greater_than" ? a > b : a < b;
}
export function resolvePath(
  form: FormSchemaType,
  answers: Answers,
): { questions: Question[]; tierId?: string } {
  const all = orderedQuestions(form),
    path: Question[] = [],
    seen = new Set<string>(),
    known: Answers = {};
  let index = 0;
  while (index < all.length) {
    const q = all[index];
    if (seen.has(q.id))
      throw new Error("A logic rule creates a loop. Choose a later question.");
    seen.add(q.id);
    const visibility = (form.logicRules || []).filter(
      (r) =>
        r.targetQuestionId === q.id &&
        ["show_question", "hide_question"].includes(r.action),
    );
    const matches = (r: (typeof visibility)[number]) =>
      evaluateCondition(
        r.operator,
        known[r.sourceQuestionId],
        r.value,
        all.find((x) => x.id === r.sourceQuestionId),
      );
    const hidden =
      visibility.some((r) => r.action === "hide_question" && matches(r)) ||
      (visibility.some((r) => r.action === "show_question") &&
        !visibility.some((r) => r.action === "show_question" && matches(r)));
    if (hidden) {
      index++;
      continue;
    }
    path.push(q);
    known[q.id] = answers[q.id];
    const rule = (form.logicRules || []).find(
      (r) =>
        r.sourceQuestionId === q.id &&
        ["jump_to_question", "jump_to_ending"].includes(r.action) &&
        evaluateCondition(r.operator, known[q.id], r.value, q),
    );
    if (rule?.action === "jump_to_ending")
      return { questions: path, tierId: rule.targetOutcomeTierId };
    if (rule?.targetQuestionId) {
      const target = all.findIndex((x) => x.id === rule.targetQuestionId);
      if (target >= 0) {
        index = target;
        continue;
      }
    }
    index++;
  }
  return { questions: path };
}
export function validationError(q: Question, value: unknown): string | null {
  if (displayTypes.has(q.type)) return null;
  if (!isAnswered(value))
    return q.required ? "Please answer this question." : null;
  const v = text(value),
    obj = record(value);
  if (["terms", "checkbox"].includes(q.type) && q.required && value !== true)
    return "Please confirm to continue.";
  if (singleTypes.has(q.type) && !q.options?.some((o) => o.id === v))
    return "Choose an available option.";
  if (
    multiTypes.has(q.type) &&
    (!Array.isArray(value) ||
      strings(value).some((id) => !q.options?.some((o) => o.id === id)))
  )
    return "Choose available options.";
  if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return "Enter a valid email address.";
  if (q.type === "website" && !/^https?:\/\/[^\s/]+/i.test(v))
    return "Enter a full https:// address.";
  if (
    [
      "number",
      "currency",
      "slider",
      "rating",
      "opinion_scale",
      "nps",
      "emoji_rating",
    ].includes(q.type)
  ) {
    const n = Number(value),
      min = q.minVal ?? q.minRating,
      max = q.maxVal ?? q.maxRating;
    if (
      !Number.isFinite(n) ||
      (min !== undefined && n < min) ||
      (max !== undefined && n > max)
    )
      return "Enter a number within the allowed range.";
  }
  if (
    q.type === "full_name" &&
    (!text(obj.firstName).trim() || !text(obj.lastName).trim())
  )
    return "Enter your first and last name.";
  if (
    q.type === "address" &&
    ["street", "city", "state", "zip"].some((k) => !text(obj[k]).trim())
  )
    return "Complete each address field.";
  if (q.type === "datetime" && (!obj.date || !obj.time))
    return "Choose both a date and a time.";
  if (
    q.type === "date_range" &&
    (!obj.start || !obj.end || text(obj.start) > text(obj.end))
  )
    return "Choose a valid start and end date.";
  if (["choice_matrix", "matrix_multiselect"].includes(q.type)) {
    if ((q.rows || []).some((row) => !isAnswered(obj[row])))
      return "Answer every row.";
    if (
      Object.values(obj).some((v) =>
        (Array.isArray(v) ? strings(v) : [text(v)]).some(
          (c) => !q.columns?.includes(c),
        ),
      )
    )
      return "Choose an available column.";
  }
  if (
    q.type === "ranking" &&
    ((q.items || []).length !== strings(value).length ||
      new Set(strings(value)).size !== strings(value).length ||
      strings(value).some((x) => !q.items?.includes(x)))
  )
    return "Rank all items once.";
  if (
    ["file_upload", "image_upload", "audio_recorder"].includes(q.type) &&
    (!text(obj.id) || !text(obj.name))
  )
    return "Attach a file before continuing.";
  return null;
}
export function formatAnswer(q: Question, value: unknown): string {
  if (!isAnswered(value)) return "(No answer)";
  if (q.type === "password") return "••••••••";
  if (singleTypes.has(q.type))
    return q.options?.find((o) => o.id === value)?.label || text(value);
  if (multiTypes.has(q.type))
    return strings(value)
      .map((id) => q.options?.find((o) => o.id === id)?.label || id)
      .join(", ");
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = record(value);
    if (obj.name && obj.id) return text(obj.name);
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : text(v)}`)
      .join(" · ");
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}
export function publicForm(form: FormSchemaType): FormSchemaType {
  return {
    ...form,
    marketing: form.marketing
      ? { ...form.marketing, scorecard: undefined, rules: [], outcomes: [], categories: [] }
      : undefined,
    questions: form.questions.map((q) => {
      const {
        correctAnswerText: _key,
        explanation: _explanation,
        matrixAnswerKey: _matrix,
        ...rest
      } = q;
      return {
        ...rest,
        options: q.options?.map(
          ({ isCorrect: _correct, explanation: _why, ...option }) => option,
        ),
      };
    }),
  };
}
export function validateFormReferences(form: FormSchemaType): void {
  const ids = new Set(form.questions.map((q) => q.id));
  if (ids.size !== form.questions.length)
    throw new Error("Question IDs must be unique.");
  const ordered = orderedQuestions(form);
  for (const q of form.questions) {
    if (
      q.options &&
      new Set(q.options.map((o) => o.id)).size !== q.options.length
    )
      throw new Error("Option IDs must be unique within a question.");
    if (
      singleTypes.has(q.type) &&
      (q.options?.filter((o) => o.isCorrect).length || 0) > 1
    )
      throw new Error(
        "Single-choice questions can only have one correct answer.",
      );
  }
  for (const r of form.logicRules || []) {
    if (
      !ids.has(r.sourceQuestionId) ||
      (r.targetQuestionId && !ids.has(r.targetQuestionId))
    )
      throw new Error("A logic rule refers to a deleted question.");
    if (
      r.action === "jump_to_question" &&
      ordered.findIndex((q) => q.id === r.targetQuestionId) <=
        ordered.findIndex((q) => q.id === r.sourceQuestionId)
    )
      throw new Error("Jump rules must move forward to avoid loops.");
  }
}
