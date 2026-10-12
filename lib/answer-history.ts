import type { Question } from "./schema";
import { multiTypes, singleTypes } from "./engine";

export const supportedAnswers = (question: Question) => singleTypes.has(question.type) || multiTypes.has(question.type) || ["terms", "checkbox"].includes(question.type);
export const snapshotChoices = (question: Question) => ["terms", "checkbox"].includes(question.type)
  ? [{ id: "true", label: "Checked / confirmed" }, { id: "false", label: "Not checked" }]
  : (question.options || []).map(option => ({ id: option.id, label: option.label }));
/** Preserve the analytics signature exactly: ordering is not a wording change. */
export const questionSignature = (question: Question) => JSON.stringify([question.id, question.type, question.title, snapshotChoices(question).sort((a, b) => a.id.localeCompare(b.id))]);
export type HistoricalSelection = { status: "unanswered" | "invalid"; selected: [] } | { status: "answered"; selected: string[] };
/** Deliberately stricter than display formatting: never salvage a partial malformed answer. */
export function historicalSelection(question: Question, value: unknown): HistoricalSelection {
  if (value === undefined || value === null || value === "" || Array.isArray(value) && !value.length) return { status: "unanswered", selected: [] };
  let selected: string[];
  if (["terms", "checkbox"].includes(question.type)) selected = typeof value === "boolean" ? [String(value)] : [];
  else if (multiTypes.has(question.type)) selected = Array.isArray(value) && value.every(id => typeof id === "string") ? [...new Set(value)] : [];
  else selected = typeof value === "string" || typeof value === "number" && Number.isFinite(value) ? [String(value)] : [];
  if (!selected.length || selected.some(id => !snapshotChoices(question).some(option => option.id === id))) return { status: "invalid", selected: [] };
  return { status: "answered", selected };
}
