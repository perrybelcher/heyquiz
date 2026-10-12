import { sanitizeStartAttribution } from "./attribution";

export type AnalyticsRange = "7" | "30" | "90" | "all";
export type AnalyticsFilters = { source: string; campaign: string; version: string };
export type AnalyticsFilterName = keyof AnalyticsFilters;
export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = { source: "", campaign: "", version: "" };
export type AnalyticsFilterOption = { value: string; label: string };
export type AnalyticsFilterOptions = Record<AnalyticsFilterName, AnalyticsFilterOption[]>;
export class AnalyticsQueryError extends Error {}

/** Empty means all; typed values keep real labels named “all” or “unknown” distinct. */
export function analyticsFilterLabel(name: AnalyticsFilterName, value: string): string {
    if (!value) return name === "version" ? "All published versions" : `All ${name === "source" ? "sources" : "campaigns"}`;
    if (value === "unknown") return name === "version" ? "Unknown publication / older history" : `Unknown ${name} / not recorded`;
    if (name === "version") return `Published ${value.slice(10)} (UTC)`;
    if (name === "campaign") return `${value.slice(6)} · UTM campaign`;
    return value.startsWith("utm:") ? `${value.slice(4)} · UTM source` : `${value.slice(4)} · Referrer host`;
}

function canonicalPublication(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

/** Dimensions describe the retained start snapshot, not today's draft or a inferred direct source. */
export function analyticsDimensions(attempt: { attribution?: unknown; form: { publishedAt?: unknown } }): AnalyticsFilters {
    const attribution = sanitizeStartAttribution(attempt.attribution);
    return {
        source: attribution?.source ? `utm:${attribution.source}` : attribution?.referrerHost ? `ref:${attribution.referrerHost}` : "unknown",
        campaign: attribution?.campaign ? `value:${attribution.campaign}` : "unknown",
        version: canonicalPublication(attempt.form.publishedAt) ? `published:${attempt.form.publishedAt}` : "unknown",
    };
}
export function matchesAnalyticsFilters(dimensions: AnalyticsFilters, filters: AnalyticsFilters) {
    return (Object.keys(filters) as AnalyticsFilterName[]).every(name => !filters[name] || filters[name] === dimensions[name]);
}
export function hasAnalyticsFilters(filters: AnalyticsFilters) {
    return Boolean(filters.source || filters.campaign || filters.version);
}
export function analyticsFilterLabels(filters: AnalyticsFilters) {
    return { source: analyticsFilterLabel("source", filters.source), campaign: analyticsFilterLabel("campaign", filters.campaign), version: analyticsFilterLabel("version", filters.version) };
}
export function analyticsOptions(dimensions: AnalyticsFilters[]): AnalyticsFilterOptions {
    const options = (name: AnalyticsFilterName) => [...new Set(dimensions.map(d => d[name]))]
        .filter(value => value !== "unknown")
        .sort((a, b) => name === "version" ? b.localeCompare(a) : analyticsFilterLabel(name, a).localeCompare(analyticsFilterLabel(name, b)))
        .map(value => ({ value, label: analyticsFilterLabel(name, value) }));
    return Object.fromEntries((["source", "campaign", "version"] as const).map(name => [name, [
        { value: "", label: analyticsFilterLabel(name, "") },
        { value: "unknown", label: analyticsFilterLabel(name, "unknown") },
        ...options(name),
    ]])) as AnalyticsFilterOptions;
}

function validFilter(name: AnalyticsFilterName, value: string) {
    if (value === "" || value === "unknown") return true;
    if (name === "version") return value.startsWith("published:") && canonicalPublication(value.slice(10));
    if (name === "campaign") return value.startsWith("value:") && sanitizeStartAttribution({ version: 1, campaign: value.slice(6) })?.campaign === value.slice(6);
    if (value.startsWith("utm:")) return sanitizeStartAttribution({ version: 1, source: value.slice(4) })?.source === value.slice(4);
    return value.startsWith("ref:") && sanitizeStartAttribution({ version: 1, referrerHost: value.slice(4) })?.referrerHost === value.slice(4);
}
export function parseAnalyticsQuery(params: URLSearchParams): { range: AnalyticsRange; filters: AnalyticsFilters } {
    for (const key of params.keys()) {
        if (!["range", "source", "campaign", "version"].includes(key) || params.getAll(key).length !== 1) throw new AnalyticsQueryError("Choose one supported value for each analytics filter.");
    }
    const range = params.get("range") ?? "30";
    if (!["7", "30", "90", "all"].includes(range)) throw new AnalyticsQueryError("Choose a supported date range.");
    const filters = { ...EMPTY_ANALYTICS_FILTERS };
    for (const name of Object.keys(filters) as AnalyticsFilterName[]) {
        const value = params.get(name) ?? "";
        if (value.length > 320 || !validFilter(name, value)) throw new AnalyticsQueryError("Choose a supported analytics cohort.");
        filters[name] = value;
    }
    return { range: range as AnalyticsRange, filters };
}
export function analyticsQuery(range: AnalyticsRange, filters: AnalyticsFilters) {
    const params = new URLSearchParams({ range });
    for (const name of Object.keys(filters) as AnalyticsFilterName[]) if (filters[name]) params.set(name, filters[name]);
    return params.toString();
}

/** Export the exact visible cohort with its labels; no response/contact fields enter this file. */
export function questionPerformanceCsv(data: { range: string; cohort: { labels: AnalyticsFilters }; questions: { title: string; reached: number; completed: number; quiet: number; measured: number }[] }) {
    const rows = [["Question", "Reached", "Completed quiz", "Quiet at this step", "Measured sessions", "Date range", "Source cohort", "Campaign cohort", "Published version cohort"],
        ...data.questions.map(q => [q.title, q.reached, q.completed, q.quiet, q.measured, data.range, data.cohort.labels.source, data.cohort.labels.campaign, data.cohort.labels.version])];
    return rows.map(row => row.map(value => '"' + String(value).replace(/^[\s=+@-]/, "'$&").replaceAll('"', '""') + '"').join(",")).join("\r\n");
}
