import type { QuizSubmissionResult } from "./schema";
import { sameAnswerPair, type ContactAnswerCohort } from "./contact-answer-cohort";
import { contactContextFor, type ContactContexts } from "./contact-context";

export const CONTACT_PAGE_SIZE = 25;
export interface ContactFilters {
  query: string;
  consent: "all" | "yes" | "no";
  from: string;
  to: string;
  result: string;
  score: "all" | "scored" | "unscored";
  minScore: string;
  maxScore: string;
  source: string;
  campaign: string;
  category: string;
  categoryScore: "all" | "scored" | "unscored" | "missing";
  categoryMin: string;
  categoryMax: string;
  answerVersion: string;
  answerOption: string;
}
export const emptyContactFilters: ContactFilters = {
  query: "", consent: "all", from: "", to: "", result: "", score: "all", minScore: "", maxScore: "",
  source: "", campaign: "", category: "", categoryScore: "all", categoryMin: "", categoryMax: "", answerVersion: "", answerOption: "",
};

const percentage = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
/** Use the frozen response, never the current quiz's mode or renamed results. */
export function contactScore(row: QuizSubmissionResult): { kind: "knowledge" | "scorecard" | "none"; value: number | null; label: string } {
  if (row.marketing) {
    if (row.marketing.kind !== "scorecard") return { kind: "none", value: null, label: "No percentage score" };
    return percentage(row.marketing.overallScore)
      ? { kind: "scorecard", value: row.marketing.overallScore, label: "Overall score" }
      : { kind: "scorecard", value: null, label: "No overall score" };
  }
  return row.totalPointsPossible > 0 && percentage(row.percentageScore)
    ? { kind: "knowledge", value: row.percentageScore, label: "Knowledge score" }
    : { kind: "none", value: null, label: "Not scored" };
}

export const contactResultTitle = (row: QuizSubmissionResult) => row.marketing?.title || row.matchedTier?.title || "Completed";
// Include both identity and saved wording: a renamed outcome stays a distinct historical choice.
export function contactResultKey(row: QuizSubmissionResult) {
  return JSON.stringify([row.marketing?.kind || "knowledge", row.marketing?.outcomeId || row.matchedTier?.id || "", contactResultTitle(row)]);
}
export function contactResultOptions(rows: QuizSubmissionResult[]) {
  const options = new Map<string, { value: string; title: string; count: number }>();
  for (const row of rows) {
    const value = contactResultKey(row), existing = options.get(value);
    if (existing) existing.count++;
    else options.set(value, { value, title: contactResultTitle(row), count: 1 });
  }
  const sorted = [...options.values()].sort((a, b) => a.title.localeCompare(b.title) || a.value.localeCompare(b.value));
  return sorted.map(option => {
    const siblings = sorted.filter(other => other.title === option.title);
    return { ...option, label: siblings.length > 1 ? `${option.title} · Saved result ${siblings.findIndex(other => other.value === option.value) + 1}` : option.title };
  });
}

type SavedCategory = NonNullable<QuizSubmissionResult["marketing"]>["categories"][number];
export const contactCategoryKey = (category: Pick<SavedCategory, "id" | "title">) => JSON.stringify([category.id, category.title]);
export function contactCategories(row: QuizSubmissionResult) {
  return row.marketing?.kind === "scorecard" && Array.isArray(row.marketing.categories)
    ? row.marketing.categories.filter(category => typeof category.id === "string" && typeof category.title === "string") : [];
}
export function contactCategoryOptions(rows: QuizSubmissionResult[]) {
  const options = new Map<string, { value: string; title: string; count: number }>();
  for (const row of rows) for (const category of contactCategories(row)) {
    const value = contactCategoryKey(category), existing = options.get(value);
    if (existing) existing.count++; else options.set(value, { value, title: category.title, count: 1 });
  }
  const sorted = [...options.values()].sort((a, b) => a.title.localeCompare(b.title) || a.value.localeCompare(b.value));
  return sorted.map(option => { const siblings = sorted.filter(other => other.title === option.title); return { ...option, label: siblings.length > 1 ? `${option.title} · Saved category ${siblings.findIndex(other => other.value === option.value) + 1}` : option.title }; });
}

/** Local calendar dates match the device-timezone dates shown in the contact list, including DST. */
function dayBoundary(value: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return NaN;
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.getTime();
}
export function contactFilterError(filters: ContactFilters): string {
  if ((filters.from && !Number.isFinite(dayBoundary(filters.from))) || (filters.to && !Number.isFinite(dayBoundary(filters.to)))) return "Choose valid start and end dates.";
  if (filters.from && filters.to && filters.from > filters.to) return "The end date must be on or after the start date.";
  for (const value of [filters.minScore, filters.maxScore]) {
    if (value !== "" && (!/^\d+(\.\d+)?$/.test(value) || !percentage(Number(value)))) return "Enter score limits between 0 and 100.";
  }
  if (filters.minScore !== "" && filters.maxScore !== "" && Number(filters.minScore) > Number(filters.maxScore)) return "The maximum score must be at least the minimum score.";
  for (const value of [filters.categoryMin || "", filters.categoryMax || ""]) {
    if (value !== "" && (!/^\d+(\.\d+)?$/.test(value) || !percentage(Number(value)))) return "Enter category score limits between 0 and 100.";
  }
  if (filters.categoryMin && filters.categoryMax && Number(filters.categoryMin) > Number(filters.categoryMax)) return "The maximum category score must be at least the minimum category score.";
  if (!filters.category && (filters.categoryMin || filters.categoryMax || filters.categoryScore && filters.categoryScore !== "all")) return "Choose a saved category before filtering its score.";
  if (["unscored", "missing"].includes(filters.categoryScore) && (filters.categoryMin || filters.categoryMax)) return "Clear the category score range when looking for missing scores or categories.";
  return "";
}
export function filterContacts(rows: QuizSubmissionResult[], filters: ContactFilters, contexts: ContactContexts = {}, answerCohort?: ContactAnswerCohort | null) {
  if (contactFilterError(filters)) return [];
  const answerPair = filters.answerVersion && filters.answerOption ? { version: filters.answerVersion, option: filters.answerOption } : null;
  if (answerPair && !sameAnswerPair(answerPair, answerCohort?.selection)) return [];
  const answerMatches = answerPair ? new Set(answerCohort?.matchingIds) : null;
  const query = filters.query.trim().toLocaleLowerCase();
  const from = filters.from ? dayBoundary(filters.from) : -Infinity;
  const to = filters.to ? dayBoundary(filters.to, true) : Infinity;
  return rows.filter(row => {
    if (!row.contact || answerMatches && (!row.id || !answerMatches.has(row.id))) return false;
    const search = [row.contact.name, row.contact.email, row.contact.phone, row.marketing?.title, row.matchedTier?.title].filter(Boolean).join(" ").toLocaleLowerCase();
    if (query && !search.includes(query)) return false;
    // Legacy contacts without an affirmative flag must never be treated as opted in.
    if (filters.consent !== "all" && (row.contact.marketingConsent === true) !== (filters.consent === "yes")) return false;
    if (filters.from || filters.to) {
      const submitted = Date.parse(row.submittedAt);
      if (!Number.isFinite(submitted) || submitted < from || submitted >= to) return false;
    }
    if (filters.result && contactResultKey(row) !== filters.result) return false;
    const context = contactContextFor(row, contexts);
    if (filters.source && context.source !== filters.source) return false;
    if (filters.campaign && context.campaign !== filters.campaign) return false;
    if (filters.category) {
      const category = contactCategories(row).find(value => contactCategoryKey(value) === filters.category);
      const value = category && percentage(category.score) ? category.score : null;
      if (filters.categoryScore === "missing") { if (category) return false; }
      else {
        if (!category) return false;
        if (filters.categoryScore === "scored" && value === null || filters.categoryScore === "unscored" && value !== null) return false;
        if (filters.categoryMin && (value === null || value < Number(filters.categoryMin))) return false;
        if (filters.categoryMax && (value === null || value > Number(filters.categoryMax))) return false;
      }
    }
    const score = contactScore(row).value;
    if (filters.score === "scored" && score === null) return false;
    if (filters.score === "unscored") return score === null;
    if (filters.minScore !== "" && (score === null || score < Number(filters.minScore))) return false;
    if (filters.maxScore !== "" && (score === null || score > Number(filters.maxScore))) return false;
    return true;
  });
}
export function contactPage(rows: QuizSubmissionResult[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(rows.length / CONTACT_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, Math.trunc(requestedPage) || 1));
  const offset = (page - 1) * CONTACT_PAGE_SIZE;
  return { page, pages, rows: rows.slice(offset, offset + CONTACT_PAGE_SIZE), start: rows.length ? offset + 1 : 0, end: Math.min(offset + CONTACT_PAGE_SIZE, rows.length) };
}
