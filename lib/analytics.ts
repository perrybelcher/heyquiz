import { summarizeLandingVisits } from "./landing-analytics";
import type { LandingVisit } from "./landing-visit";
import { createHash } from "node:crypto";
import type { Attempt } from "./attempts";
import type { FormSchemaType, Question, QuizSubmissionResult } from "./schema";
import { multiTypes, resolvePath } from "./engine";
import { supportedAnswers, snapshotChoices, questionSignature, historicalSelection } from "./answer-history";
import { sanitizeStartAttribution } from "./attribution";
import { analyticsDimensions, analyticsFilterLabels, analyticsOptions, EMPTY_ANALYTICS_FILTERS, hasAnalyticsFilters, matchesAnalyticsFilters, type AnalyticsFilters, type AnalyticsRange } from "./analytics-filters";
export type { AnalyticsRange } from "./analytics-filters";
export const rate = (n: number, d: number) => d ? Math.round(n / d * 1000) / 10 : null;
/** Stable exact wording identity; separate from historical row IDs retained for CSV/UI compatibility. */
export const analyticsWordingKey = (question: Pick<Question, "type" | "title">) => createHash("sha256").update(JSON.stringify([question.type, question.title])).digest("hex");
const day = (n: number) => new Date(n).toISOString().slice(0, 10);
interface AnalyticsEntry extends Attempt { done: boolean; result?: QuizSubmissionResult }
interface AnswerGroup {
    id: string; questionId: string; title: string; type: string; current: boolean; multiple: boolean;
    completions: number; eligible: number; answered: number; unanswered: number; skipped: number; unavailable: number; invalid: number;
    firstStartedAt: number | null; lastStartedAt: number | null;
    options: { id: string; label: string; count: number }[];
}
function answerPatterns(form: FormSchemaType, entries: AnalyticsEntry[]) {
    const groups = new Map<string, AnswerGroup>();
    const current = new Set(form.questions.filter(supportedAnswers).map(questionSignature));
    const add = (q: Question) => {
        const key = questionSignature(q);
        let group = groups.get(key);
        if (!group) {
            group = { id: `answer-version-${createHash("sha256").update(key).digest("hex").slice(0,20)}`, questionId: q.id, title: q.title, type: q.type, current: current.has(key), multiple: multiTypes.has(q.type), completions: 0, eligible: 0, answered: 0, unanswered: 0, skipped: 0, unavailable: 0, invalid: 0, firstStartedAt: null, lastStartedAt: null, options: snapshotChoices(q).map(o => ({ ...o, count: 0 })) };
            groups.set(key, group);
        }
        return group;
    };
    form.questions.filter(supportedAnswers).forEach(add);
    let linkedCompletions = 0, withStoredAnswers = 0;
    for (const entry of entries.filter(a => a.done)) {
        linkedCompletions++;
        // Never recover deleted submissions or contact data from an attempt's cached result.
        const answers = entry.result?.answers && typeof entry.result.answers === "object" && !Array.isArray(entry.result.answers) ? entry.result.answers : undefined;
        if (answers) withStoredAnswers++;
        let visible: Set<string> | undefined;
        try { if (answers) visible = new Set(resolvePath(entry.form, answers).questions.map(q => q.id)); } catch { /* Broken historical routing has unknown eligibility. */ }
        for (const q of entry.form.questions.filter(supportedAnswers)) {
            const group = add(q);
            group.completions++;
            group.firstStartedAt = Math.min(group.firstStartedAt ?? entry.startedAt, entry.startedAt);
            group.lastStartedAt = Math.max(group.lastStartedAt ?? entry.startedAt, entry.startedAt);
            if (!answers || !visible) { group.unavailable++; continue; }
            if (!visible.has(q.id)) { group.skipped++; continue; }
            group.eligible++;
            const selection = historicalSelection(q, answers[q.id]);
            if (selection.status === "unanswered") { group.unanswered++; continue; }
            if (selection.status === "invalid") { group.invalid++; continue; }
            const selected = selection.selected;
            group.answered++;
            for (const id of selected) group.options.find(o => o.id === id)!.count++;
        }
    }
    // Keep payload/DOM bounded for quizzes with a long editing history, and disclose omissions.
    const sorted = [...groups.values()].sort((a, b) => b.answered - a.answered || b.completions - a.completions || Number(b.current) - Number(a.current));
    return {
        linkedCompletions, withStoredAnswers, versionCount: groups.size, omittedVersions: Math.max(0, groups.size - 60),
        questions: sorted.slice(0, 60).map(group => {
            const options = [...group.options].sort((a, b) => b.count - a.count);
            return { ...group, firstStartedAt: group.firstStartedAt ? new Date(group.firstStartedAt).toISOString() : null, lastStartedAt: group.lastStartedAt ? new Date(group.lastStartedAt).toISOString() : null,
                omittedOptions: Math.max(0, options.length - 100), omittedSelections: options.slice(100).reduce((sum, option) => sum + option.count, 0),
                options: options.slice(0, 100).map(option => ({ ...option, percentage: rate(option.count, group.answered) })) };
        }),
    };
}
interface AttributionRow { id: string; source: string; medium: string; campaign?: string; kind: "tagged" | "referral" | "unknown" | "other"; starts: number; completions: number; leads: number }
function summarizeAttribution(entries: AnalyticsEntry[]) {
    const sources = new Map<string, AttributionRow>(), campaigns = new Map<string, AttributionRow>();
    let measuredStarts = 0, identifiedSourceStarts = 0, campaignTaggedStarts = 0;
    for (const entry of entries) {
        const attribution = sanitizeStartAttribution(entry.attribution);
        if (attribution) measuredStarts++;
        const kind = attribution?.source ? "tagged" : attribution?.referrerHost ? "referral" : "unknown";
        if (kind !== "unknown") identifiedSourceStarts++;
        if (attribution?.campaign) campaignTaggedStarts++;
        const source = attribution?.source || attribution?.referrerHost || "Unknown source";
        const medium = attribution?.medium || "Unspecified";
        const update = (map: Map<string, AttributionRow>, key: string, campaign?: string) => {
            const row = map.get(key) || { id: key, source, medium, ...(campaign ? { campaign } : {}), kind, starts: 0, completions: 0, leads: 0 };
            row.starts++; row.completions += Number(entry.done); row.leads += Number(Boolean(entry.done && entry.result?.contact)); map.set(key, row);
        };
        update(sources, JSON.stringify([kind, source, medium]));
        update(campaigns, JSON.stringify([attribution?.campaign ?? null, kind, source, medium]), attribution?.campaign || "Unknown campaign");
    }
    const bounded = (rows: Map<string, AttributionRow>, campaign = false) => {
        const ordered = [...rows.values()].sort((a, b) => b.starts - a.starts || a.source.localeCompare(b.source));
        const shown = ordered.slice(0, 20);
        if (ordered.length > 20) shown.push(ordered.slice(20).reduce<AttributionRow>((other, row) => ({ ...other, starts: other.starts + row.starts, completions: other.completions + row.completions, leads: other.leads + row.leads }), { id: "other", source: "Other recorded sources", medium: "Multiple", ...(campaign ? { campaign: "Other recorded campaigns" } : {}), kind: "other", starts: 0, completions: 0, leads: 0 }));
        return shown.map(row => ({ ...row, completionRate: rate(row.completions, row.starts), leadRate: rate(row.leads, row.starts) }));
    };
    return { measuredStarts, identifiedSourceStarts, unknownSourceStarts: entries.length - identifiedSourceStarts, legacyStarts: entries.length - measuredStarts, campaignTaggedStarts, sources: bounded(sources), campaigns: bounded(campaigns, true), sourceGroups: sources.size, campaignGroups: campaigns.size };
}
export function summarizeAnalytics(form: FormSchemaType, rows: {
    id: string;
    payload: Attempt;
}[], submissions: QuizSubmissionResult[], range: AnalyticsRange, now = Date.now(), visits: { id: string; payload: LandingVisit }[] = [], filters: AnalyticsFilters = EMPTY_ANALYTICS_FILTERS) {
    const cutoff = range === "all" ? 0 : Date.parse(day(now)) - (Number(range) - 1) * 86400000;
    const all = rows.filter(r => !r.payload.preview && r.payload.form.id === form.id);
    // Use the same snapshot dimensions for the report and its preceding-period comparison.
    const retained = all.filter(r => Number.isFinite(r.payload.startedAt) && r.payload.startedAt <= now);
    const dimensions = new Map(retained.map(r => [r.id, analyticsDimensions(r.payload)]));
    const cohort = retained.filter(r => matchesAnalyticsFilters(dimensions.get(r.id)!, filters));
    const selected = cohort.filter(r => r.payload.startedAt >= cutoff);
    const stored = new Map(submissions.filter(s => s.formId === form.id).map(s => [s.id, s]));
    const entries = selected.map(r => ({ ...r.payload, result: stored.get(r.id), done: Boolean(r.payload.completed || stored.has(r.id)) }));
    const completed = entries.filter(a => a.done);
    const leads = completed.filter(a => Boolean(a.result?.contact));
    const instrumented = entries.filter(a => a.analyticsVersion === 1);
    const finishedTracked = instrumented.filter(a => a.done);
    const resultViews = finishedTracked.filter(a => a.resultViewedAt);
    const clicks = resultViews.filter(a => a.offerClickedAt);
    const quiet = (a: typeof entries[number]) => !a.done && a.analyticsVersion === 1 && now - (a.lastSeenAt || a.startedAt) >= 30 * 60000;
    const durations = completed.map(a => a.completedAt ? (a.completedAt - a.startedAt) / 1000 : null).filter((v): v is number => v !== null && v >= 0).sort((a, b) => a - b);
    const medianSeconds = durations.length ? (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2 : null;
    // A changed title must not relabel an earlier session. Keep each reached wording separate.
    const questionMap = new Map(form.questions.filter(q => q.type !== "hidden").map(q => [q.id, q]));
    for (const a of entries) for (const q of a.form.questions)
        if (q.type !== "hidden" && a.reached.includes(q.id) && !questionMap.has(q.id)) questionMap.set(q.id, q);
    const questions = [...questionMap].flatMap(([questionId, fallback]) => {
        const reached = entries.filter(a => a.reached.includes(questionId));
        const wordings = new Map<string, { title: string; entries: typeof entries }>();
        for (const entry of reached) {
            const snapshot = entry.form.questions.find(q => q.id === questionId && q.type !== "hidden");
            if (!snapshot) continue;
            const key = JSON.stringify([snapshot.type, snapshot.title]);
            const group = wordings.get(key) || { title: snapshot.title, entries: [] };
            group.entries.push(entry); wordings.set(key, group);
        }
        if (!wordings.size) wordings.set(JSON.stringify([fallback.type, fallback.title]), { title: fallback.title, entries: [] });
        return [...wordings].map(([key, group]) => {
            const eligible = group.entries.filter(a => a.analyticsVersion === 1);
            const stopped = eligible.filter(a => quiet(a) && a.lastQuestionId === questionId).length;
            const current = form.questions.some(q => q.id === questionId && JSON.stringify([q.type, q.title]) === key);
            return { id: wordings.size === 1 ? questionId : `${questionId}:wording:${createHash("sha256").update(key).digest("hex").slice(0, 20)}`,
                questionId, wordingKey: createHash("sha256").update(key).digest("hex"), title: `${group.title}${current ? "" : " (earlier wording)"}`, current,
                reached: group.entries.length, completed: group.entries.filter(a => a.done).length, quiet: stopped, measured: eligible.length, quietRate: rate(stopped, eligible.length) };
        });
    });
    const trendStart = range === "all" ? Math.max(Date.parse(day(now)) - 89 * 86400000, entries.reduce((first, a) => Math.min(first, a.startedAt), now)) : cutoff;
    const days: {
        date: string;
        starts: number;
        completions: number;
        leads: number;
    }[] = [];
    for (let t = Date.parse(day(trendStart)); t <= now; t += 86400000) {
        const cohort = entries.filter(a => day(a.startedAt) === day(t));
        days.push({ date: day(t), starts: cohort.length, completions: cohort.filter(a => a.done).length, leads: cohort.filter(a => a.result?.contact).length });
    }
    const segments = new Map<string, {
        title: string;
        completions: number;
        leads: number;
        clicks: number;
    }>();
    for (const a of completed) {
        const title = a.result?.marketing?.title || a.result?.matchedTier?.title || (a.result ? "Completed" : "Result unavailable");
        const row = segments.get(title) || { title, completions: 0, leads: 0, clicks: 0 };
        row.completions++;
        row.leads += Number(Boolean(a.result?.contact));
        row.clicks += Number(Boolean(a.offerClickedAt && a.resultViewedAt));
        segments.set(title, row);
    }
    // A stored preview response is known, not an unlinked public response.
    const allIds = new Set(rows.filter(r => r.payload.form.id === form.id).map(a => a.id));
    const previous = range === "all" ? [] : cohort.filter(r => r.payload.startedAt >= cutoff - Number(range) * 86400000 && r.payload.startedAt < cutoff);
    const previousRate = rate(previous.filter(r => r.payload.completed || stored.has(r.id)).length, previous.length);
    const completionRate = rate(completed.length, entries.length);
    return { cohort: { filters: { ...filters }, labels: analyticsFilterLabels(filters), active: hasAnalyticsFilters(filters), options: analyticsOptions([...dimensions.values()]), optionsScope: "all-retained-starts" as const, landingScope: "unfiltered" as const, unlinkedSubmissionsScope: "date-only-unassignable" as const }, landing: summarizeLandingVisits(form.id, visits, rows, cutoff, now), range, generatedAt: new Date(now).toISOString(), starts: entries.length, completions: completed.length, leads: leads.length, consentedLeads: leads.filter(a => a.result?.contact?.marketingConsent).length, completionRate, leadRate: rate(leads.length, entries.length), medianSeconds, timedCompletions: durations.length, resultViews: resultViews.length, offerClicks: clicks.length, offerClickRate: rate(clicks.length, resultViews.length), trackedCompletions: finishedTracked.length, measuredSessions: instrumented.length, quietSessions: entries.filter(quiet).length, completionChange: completionRate !== null && previousRate !== null ? Math.round((completionRate - previousRate) * 10) / 10 : null, previousStarts: previous.length, answerDistributions: answerPatterns(form, entries), attribution: summarizeAttribution(entries), questions, days, segments: [...segments.values()].sort((a, b) => b.completions - a.completions), unlinkedSubmissions: submissions.filter(s => s.formId === form.id && !allIds.has(s.id || "") && Date.parse(s.submittedAt) >= cutoff && Date.parse(s.submittedAt) <= now).length };
}
export type AnalyticsSummary = ReturnType<typeof summarizeAnalytics>;
