import type { Attempt } from "./attempts";
import type { QuizSubmissionResult } from "./schema";
import { analyticsDimensions, analyticsFilterLabel } from "./analytics-filters";

export type ContactActivityKind = "started" | "contact" | "submitted" | "result" | "offer";
export interface ContactContext {
  source: string;
  campaign: string;
  history: "retained" | "unavailable";
  incomplete: boolean;
  activity: { kind: ContactActivityKind; at: string }[];
}
export type ContactContexts = Record<string, ContactContext>;
export const contactActivityLabel: Record<ContactActivityKind, string> = {
  started: "Quiz started", contact: "Contact details recorded", submitted: "Response recorded",
  result: "First recorded result interaction", offer: "First result-action click recorded",
};
export const contactSourceLabel = (value: string) => analyticsFilterLabel("source", value);
export const contactCampaignLabel = (value: string) => analyticsFilterLabel("campaign", value);

// Date.parse alone normalizes impossible dates such as February 30. Accept
// genuine ISO calendar timestamps, including offsets, without inventing a date.
function storedDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, Number((parts[7] || "").padEnd(3, "0")));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const offset = parts[8];
  let offsetMinutes = 0;
  if (offset !== "Z") {
    const hours = Number(offset.slice(1, 3)), minutes = Number(offset.slice(4));
    if (hours > 23 || minutes > 59) return null;
    offsetMinutes = (hours * 60 + minutes) * (offset[0] === "+" ? 1 : -1);
  }
  const stamp = calendar.getTime() - offsetMinutes * 60000;
  return Date.parse(value) === stamp ? stamp : null;
}

/** Only server-recorded facts. No raw answers, form snapshot, bearer link or person profile. */
export function projectContactContext(row: QuizSubmissionResult, attempt?: Attempt, now = Date.now()): ContactContext {
  const dimensions = attempt ? analyticsDimensions(attempt) : { source: "unknown", campaign: "unknown" };
  const context: ContactContext = { source: dimensions.source, campaign: dimensions.campaign, history: attempt ? "retained" : "unavailable", incomplete: false, activity: [] };
  const time = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : storedDate(value);
    return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 && parsed <= now ? parsed : null;
  };
  const submittedValue = typeof row.submittedAt === "string" ? row.submittedAt : "invalid";
  const contactValue = row.contact?.recordedAt === undefined ? undefined : typeof row.contact.recordedAt === "string" ? row.contact.recordedAt : "invalid";
  const completed = time(submittedValue), started = time(attempt?.startedAt);
  const validStart = started !== null && (completed === null || started <= completed) ? started : null;
  const add = (kind: ContactActivityKind, value: unknown, valid: (stamp: number) => boolean = () => true) => {
    if (value === undefined || value === null) return;
    const stamp = time(value);
    if (stamp === null || !valid(stamp)) { context.incomplete = true; return; }
    context.activity.push({ kind, at: new Date(stamp).toISOString() });
  };
  add("started", attempt?.startedAt, stamp => validStart === stamp);
  add("submitted", submittedValue);
  add("contact", contactValue, stamp => (validStart === null || stamp >= validStart) && (completed === null || (row.contact?.placement === "after_results" ? stamp >= completed : stamp <= completed)));
  // offer_click also fills resultViewedAt when a separate view event was not received.
  // The UI therefore says interaction, never a verified separate page view.
  add("result", attempt?.resultViewedAt, stamp => completed !== null && stamp >= completed);
  const resultAt = context.activity.find(event => event.kind === "result");
  add("offer", attempt?.offerClickedAt, stamp => completed !== null && stamp >= completed && (!resultAt || stamp >= Date.parse(resultAt.at)));
  const order: ContactActivityKind[] = ["started", "contact", "submitted", "result", "offer"];
  context.activity.sort((a, b) => a.at.localeCompare(b.at) || order.indexOf(a.kind) - order.indexOf(b.kind));
  return context;
}

export function contactContextFor(row: QuizSubmissionResult, contexts: ContactContexts): ContactContext {
  return row.id && Object.prototype.hasOwnProperty.call(contexts, row.id) ? contexts[row.id] : projectContactContext(row);
}

/** Append-only metadata: callers retain their existing CSV columns and consent proof. */
export function contactContextExport(row: QuizSubmissionResult, contexts: ContactContexts) {
  const context = contactContextFor(row, contexts);
  return { startSource: contactSourceLabel(context.source), startCampaign: contactCampaignLabel(context.campaign), activityHistory: context.history };
}

export function contactContextOptions(rows: QuizSubmissionResult[], contexts: ContactContexts, dimension: "source" | "campaign") {
  const counts = new Map<string, number>();
  for (const row of rows) { const value = contactContextFor(row, contexts)[dimension]; counts.set(value, (counts.get(value) || 0) + 1); }
  const label = dimension === "source" ? contactSourceLabel : contactCampaignLabel;
  return [...counts].map(([value, count]) => ({ value, count, label: label(value) })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Reject incomplete successful payloads instead of silently exporting unknown attribution. */
export function parseContactContexts(rows: QuizSubmissionResult[], value: unknown): ContactContexts {
  const result: ContactContexts = Object.create(null);
  const fail = () => { throw Error("The contact history could not be read. Please refresh."); };
  if (!rows.length && value === undefined) return result;
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  for (const row of rows) {
    if (!row.id || !Object.prototype.hasOwnProperty.call(value, row.id)) return fail();
    const raw = (value as Record<string, unknown>)[row.id];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
    const context = raw as ContactContext;
    const source = context.source, campaign = context.campaign;
    if (typeof source !== "string" || typeof campaign !== "string" || source.length > 320 || campaign.length > 320) return fail();
    const dimensions = analyticsDimensions({ form: {}, attribution: { version: 1, ...(source.startsWith("utm:") ? { source: source.slice(4) } : source.startsWith("ref:") ? { referrerHost: source.slice(4) } : {}), ...(campaign.startsWith("value:") ? { campaign: campaign.slice(6) } : {}) } });
    if (source !== dimensions.source || campaign !== dimensions.campaign || !["retained", "unavailable"].includes(context.history) || typeof context.incomplete !== "boolean" || !Array.isArray(context.activity) || context.activity.length > 5) return fail();
    const activity: ContactContext["activity"] = [], kinds = new Set<string>();
    for (const event of context.activity) {
      if (!event || !Object.prototype.hasOwnProperty.call(contactActivityLabel, event.kind) || kinds.has(event.kind) || typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at)) || new Date(event.at).toISOString() !== event.at) return fail();
      kinds.add(event.kind); activity.push({ kind: event.kind, at: event.at });
    }
    result[row.id] = { source, campaign, history: context.history, incomplete: context.incomplete, activity };
  }
  return result;
}
