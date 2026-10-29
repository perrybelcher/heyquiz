import type { QuizSubmissionResult } from "./schema";

/** Fixed UTC display avoids server/WebKit Intl punctuation differences during hydration. */
export function responseTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour = date.getUTCHours();
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
import { reportOutcome, reportResponseMatches, reportScore } from "./submission-reporting";

export const RESPONSE_PAGE_SIZE = 25;
export type ResponseFilters = { query: string; from: string; to: string };

function utcDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function responseFilterError(filters: ResponseFilters): string {
  if (filters.from && !Number.isFinite(utcDay(filters.from)) || filters.to && !Number.isFinite(utcDay(filters.to))) return "Choose valid response dates.";
  if (filters.from && filters.to && filters.from > filters.to) return "The end date must be on or after the start date.";
  return "";
}

export function filterResponses(rows: QuizSubmissionResult[], filters: ResponseFilters) {
  if (responseFilterError(filters)) return [];
  const from = filters.from ? utcDay(filters.from) : -Infinity;
  const until = filters.to ? utcDay(filters.to) + 86400000 : Infinity;
  return rows.filter(row => {
    if (!reportResponseMatches(row, filters.query)) return false;
    if (!filters.from && !filters.to) return true;
    const time = Date.parse(row.submittedAt);
    return Number.isFinite(time) && time >= from && time < until;
  });
}

export function responsePage(rows: QuizSubmissionResult[], requested: number) {
  const pages = Math.max(1, Math.ceil(rows.length / RESPONSE_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, Math.trunc(requested) || 1));
  const offset = (page - 1) * RESPONSE_PAGE_SIZE;
  return { page, pages, rows: rows.slice(offset, offset + RESPONSE_PAGE_SIZE), start: rows.length ? offset + 1 : 0, end: Math.min(offset + RESPONSE_PAGE_SIZE, rows.length) };
}

function cell(value: unknown) {
  let text = value === undefined || value === null ? "" : Array.isArray(value) ? value.map(item => item && typeof item === "object" ? JSON.stringify(item) : String(item ?? "")).join("; ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Export saved answer snapshots; renamed/deleted questions retain their wording. */
export function responsesCsv(rows: QuizSubmissionResult[]) {
  const columns = new Map<string, { id: string; title?: string }>();
  for (const row of rows) {
    for (const answer of row.grading || []) columns.set(JSON.stringify([answer.questionId, answer.questionTitle]), { id: answer.questionId, title: answer.questionTitle });
    for (const id of Object.keys(row.answers || {})) if (!(row.grading || []).some(answer => answer.questionId === id)) columns.set(JSON.stringify([id]), { id });
  }
  const questions = [...columns.values()];
  const headers = ["Submission ID", "Submitted at (UTC)", "Name", "Email", "Phone", "Marketing consent", "Score %", "Points earned", "Total possible", "Status", "Result", "Category scores", "Quiz type", "Outcome ID", ...questions.map(question => question.title === undefined ? `Answer [${question.id}] (saved wording unavailable)` : `${question.title} [${question.id}]`)];
  const records = rows.map(row => {
    const score = reportScore(row);
    return [row.id, Number.isFinite(Date.parse(row.submittedAt)) ? new Date(row.submittedAt).toISOString() : row.submittedAt, row.contact?.name || row.respondentName, row.contact?.email, row.contact?.phone,
      row.contact ? row.contact.marketingConsent === true ? "Opted in" : "Not opted in" : "",
      score ?? "", score === null ? "" : row.totalPointsEarned, score === null ? "" : row.totalPointsPossible,
      score === null ? "Recorded" : row.passed ? "Passed" : "Needs Review", reportOutcome(row),
      row.marketing?.categories?.map(category => `${category.title}: ${category.score === null ? "Not enough information" : `${category.score}%`}`).join("; "),
      row.quizType || row.marketing?.quizType || "", row.marketing?.outcomeId || "",
      ...questions.map(question => question.title === undefined
        ? (row.grading || []).some(answer => answer.questionId === question.id) ? "" : row.answers?.[question.id]
        : (row.grading || []).find(answer => answer.questionId === question.id && answer.questionTitle === question.title)?.userAnswer)];
  });
  return [headers, ...records].map(record => record.map(cell).join(",")).join("\r\n");
}
