import type { Attempt } from "./attempts";
import type { FormSchemaType, QuizSubmissionResult } from "./schema";
export type AnalyticsRange = "7" | "30" | "90" | "all";
export const rate = (n: number, d: number) => d ? Math.round(n / d * 1000) / 10 : null;
const day = (n: number) => new Date(n).toISOString().slice(0, 10);
export function summarizeAnalytics(form: FormSchemaType, rows: {
    id: string;
    payload: Attempt;
}[], submissions: QuizSubmissionResult[], range: AnalyticsRange, now = Date.now()) {
    const cutoff = range === "all" ? 0 : Date.parse(day(now)) - (Number(range) - 1) * 86400000;
    const all = rows.filter(r => !r.payload.preview && r.payload.form.id === form.id);
    const selected = all.filter(r => r.payload.startedAt >= cutoff && r.payload.startedAt <= now);
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
    const questionMap = new Map(form.questions.filter(q => q.type !== "hidden").map(q => [q.id, q.title]));
    for (const a of entries)
        for (const q of a.form.questions)
            if (q.type !== "hidden" && a.reached.includes(q.id) && !questionMap.has(q.id))
                questionMap.set(q.id, `${q.title} (earlier version)`);
    const questions = [...questionMap].map(([id, title]) => {
        const reached = entries.filter(a => a.reached.includes(id));
        const eligible = reached.filter(a => a.analyticsVersion === 1);
        const stopped = eligible.filter(a => quiet(a) && a.lastQuestionId === id).length;
        return { id, title, reached: reached.length, completed: reached.filter(a => a.done).length, quiet: stopped, measured: eligible.length, quietRate: rate(stopped, eligible.length) };
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
    const allIds = new Set(all.map(a => a.id));
    const previous = range === "all" ? [] : all.filter(r => r.payload.startedAt >= cutoff - Number(range) * 86400000 && r.payload.startedAt < cutoff);
    const previousRate = rate(previous.filter(r => r.payload.completed || stored.has(r.id)).length, previous.length);
    const completionRate = rate(completed.length, entries.length);
    return { range, generatedAt: new Date(now).toISOString(), starts: entries.length, completions: completed.length, leads: leads.length, consentedLeads: leads.filter(a => a.result?.contact?.marketingConsent).length, completionRate, leadRate: rate(leads.length, entries.length), medianSeconds, timedCompletions: durations.length, resultViews: resultViews.length, offerClicks: clicks.length, offerClickRate: rate(clicks.length, resultViews.length), trackedCompletions: finishedTracked.length, measuredSessions: instrumented.length, quietSessions: entries.filter(quiet).length, completionChange: completionRate !== null && previousRate !== null ? Math.round((completionRate - previousRate) * 10) / 10 : null, previousStarts: previous.length, questions, days, segments: [...segments.values()].sort((a, b) => b.completions - a.completions), unlinkedSubmissions: submissions.filter(s => s.formId === form.id && !allIds.has(s.id || "") && Date.parse(s.submittedAt) >= cutoff && Date.parse(s.submittedAt) <= now).length };
}
export type AnalyticsSummary = ReturnType<typeof summarizeAnalytics>;
