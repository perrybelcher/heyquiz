"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpLeft, Clock3, Link2, Link2Off, RefreshCw, Trash2, Search } from "lucide-react";
import type { ManagedResultLink, ResultLinkListing } from "@/lib/report-management";

const statusLabels = { not_created: "Not created", active: "Active", expired: "Expired", revoked: "Revoked" };
function dateLabel(value: string | number | null) {
  const date = value === null ? null : new Date(value);
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
}
export type ResultLinkSelection = { responseId: string; label: string; completedAt: string; requestId: number };
type ManagerProps = { formId: string; selection?: ResultLinkSelection; onReturnToContact?: () => void };
export default function ResultLinkManager({ formId, selection, onReturnToContact }: ManagerProps) {
  // Keyed inner state also prevents a late request for one quiz updating another.
  // A new contact selection resets the view atomically; a late response from the
  // previous selection cannot replace the newly targeted contact's status.
  return <ResultLinkManagerForQuiz key={`${formId}:${selection?.requestId ?? 0}`} formId={formId} selection={selection} onReturnToContact={onReturnToContact}/>;
}
function ResultLinkManagerForQuiz({ formId, selection, onReturnToContact }: ManagerProps) {
  const [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState(selection?.responseId || ""), [draftQuery, setDraftQuery] = useState(selection?.responseId || "");
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedContact = selection && query === selection.responseId ? selection : undefined;
  const [loaded, setLoaded] = useState<{ page: number; refresh: number; query: string; data?: ResultLinkListing; error?: string } | null>(null);
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const operation = useRef(false), mounted = useRef(true);
  const loading = loaded?.page !== page || loaded?.refresh !== refresh || loaded?.query !== query;
  const data = loaded?.data, error = loading ? "" : loaded?.error;
  const endpoint = `/api/forms/${encodeURIComponent(formId)}/report-links`;
  useEffect(() => {
    if (!selection) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [selection]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${endpoint}?page=${page}&responseId=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Result links could not be loaded.");
        if (!controller.signal.aborted) setLoaded({ page, refresh, query, data: body });
      })
      .catch(error => {
        if (!controller.signal.aborted) setLoaded(previous => ({ page, refresh, query, data: previous?.data, error: error instanceof Error ? error.message : "Result links could not be loaded." }));
      });
    return () => controller.abort();
  }, [endpoint, page, refresh, query]);
  async function mutate(action: "revoke" | "cleanup", row?: ManagedResultLink) {
    if (operation.current || loading || error) return;
    const target = row && selectedContact && selectedContact.responseId === row.responseId ? `${selectedContact.label}, completed ${dateLabel(row.completedAt)}` : `response ${row?.responseId}`;
    const confirmed = window.confirm(action === "revoke"
      ? `Permanently revoke the saved link for ${target}? Anyone with that link will lose access. Another link cannot be created from this response. The quiz response itself will be kept.`
      : "Remove up to 25 expired saved report copies from this quiz? Quiz responses, contacts and revocation history will be kept. Active saved links will not change.");
    if (!confirmed) return;
    operation.current = true; setBusy(true); setFeedback(null);
    try {
      const response = await fetch(action === "revoke" ? endpoint : `${endpoint}/cleanup`, {
        method: action === "revoke" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(action === "revoke" ? { body: JSON.stringify({ responseId: row!.responseId }) } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The change could not be completed. Refresh and try again.");
      if (!mounted.current) return;
      setFeedback(action === "revoke" ? { text: "Saved link permanently revoked. The quiz response is still available." } : {
        text: `${body.removed} expired saved report ${body.removed === 1 ? "copy removed" : "copies removed"}. ${body.remaining} remaining. Quiz responses were kept.${body.failed ? ` ${body.failed} copies could not be removed; try again.` : ""}`,
        error: body.failed > 0,
      });
      setRefresh(value => value + 1);
    } catch (error) {
      if (mounted.current) setFeedback({ text: error instanceof Error ? error.message : "The change could not be completed.", error: true });
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white" aria-label="Saved result links" aria-busy={loading || busy}>
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 ref={heading} tabIndex={-1} className="flex items-center gap-2 text-2xl font-semibold focus:outline-none"><Link2 size={23} aria-hidden="true"/>Saved result links</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Private links let people revisit their results for 30 days after completion. Revoke a link here to end access permanently. Anyone holding an active link can view that saved result.</p></div><button type="button" className="hq-secondary !px-3 !py-2 disabled:opacity-50" disabled={loading || busy} onClick={() => { setFeedback(null); setRefresh(value => value + 1); }}><RefreshCw size={15} aria-hidden="true"/>Refresh result links</button></div>
      {selectedContact && <div className="rounded-xl border border-stone-200 bg-stone-50 p-4"><p className="break-words text-sm font-semibold">Selected contact: {selectedContact.label}</p><p className="mt-1 text-xs text-slate-600">Completed {dateLabel(selectedContact.completedAt)}. Only this response is selected.</p>{onReturnToContact && <button type="button" onClick={onReturnToContact} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-red-800 underline"><ArrowUpLeft size={15} aria-hidden="true"/>Back to contact details</button>}</div>}
      {data && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Saved link totals">{(Object.keys(statusLabels) as ManagedResultLink["status"][]).map(status => <div key={status} className="rounded-xl bg-stone-50 px-3 py-3"><p className="text-xs text-slate-500">{statusLabels[status]}</p><p className="mt-1 text-xl font-semibold">{data.counts[status]}</p></div>)}</div>}
      <p className="text-xs leading-relaxed text-slate-500">Includes retained quiz responses, whether or not they contain contact details. “Not created” means a result link was never saved. Deleting a response also ends its link’s access.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setQuery(draftQuery.trim()); setPage(1); }}>
        <label className="block min-w-0 flex-1 text-xs font-medium text-slate-600">Find response by full ID<input className="hq-input mt-1 font-mono" maxLength={128} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} placeholder="Optional lookup for support"/></label>
        <button type="submit" className="hq-secondary !px-3 !py-2" disabled={busy}><Search size={15} aria-hidden="true"/>Find response</button>
        {query && <button type="button" className="hq-secondary !px-3 !py-2" disabled={busy} onClick={() => { setQuery(""); setDraftQuery(""); setPage(1); }}>Show all responses</button>}
      </form>
      {data && !loading && <p role="status" className="text-xs text-slate-500">{data.matched} matching responses · {data.total} retained responses. Status totals above include the whole quiz.</p>}
      {loading && <p role="status" className="text-sm text-slate-500">Loading saved result links…</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}{data && <p className="mt-1">Showing the last loaded status. Refresh before making changes.</p>}</div>}
      {feedback && <p role={feedback.error ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${feedback.error ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{feedback.text}</p>}
    </div>
    {data && <>
      {!data.rows.length ? <p className="border-t border-stone-100 px-6 py-8 text-sm text-slate-500">{query ? "No response matches that full ID. Check the ID or show all responses." : "Completed quiz responses will appear here. Private previews do not create saved links."}</p> : <ul className="divide-y divide-stone-100 border-t border-stone-100">{data.rows.map(row => <li key={row.responseId} data-result-link-row={row.responseId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">Response <span className="font-mono">{row.responseId.slice(0, 8)}</span></p><p className="mt-1 text-xs text-slate-500">Completed {dateLabel(row.completedAt)}</p><p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">{row.status === "revoked" ? <Link2Off size={15} aria-hidden="true"/> : row.status === "active" ? <Link2 size={15} aria-hidden="true"/> : <Clock3 size={15} aria-hidden="true"/>}{statusLabels[row.status]}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{row.status === "active" ? `Expires ${dateLabel(row.expiresAt)}` : row.status === "revoked" ? "Access ended permanently. The response is retained." : row.status === "expired" ? `The saved link’s 30-day window ended ${dateLabel(row.expiresAt)}.` : row.creationWindowExpired ? "The 30-day creation window has ended; no link was saved." : "This respondent has not saved a result link."}</p></div>
        {row.status === "active" && <button type="button" className="hq-secondary !px-3 !py-2 text-sm disabled:opacity-50" aria-label={`Revoke link for response ${row.responseId.slice(0, 8)}`} disabled={loading || busy || Boolean(error)} onClick={() => mutate("revoke", row)}><Link2Off size={15} aria-hidden="true"/>Revoke link</button>}
      </li>)}</ul>}
      {data.pages > 1 && <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 p-5" aria-label="Saved link pages"><p className="text-xs text-slate-500">Page {data.page} of {data.pages} · {data.matched} matching responses</p><div className="flex gap-2"><button type="button" className="hq-secondary !px-3 !py-2 disabled:opacity-40" disabled={loading || busy || data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous links</button><button type="button" className="hq-secondary !px-3 !py-2 disabled:opacity-40" disabled={loading || busy || data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Next links</button></div></nav>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 bg-stone-50/60 p-5 sm:p-6"><div><h3 className="text-sm font-semibold">Expired report copies</h3><p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">{data.expiredCopies} expired saved copies can be removed. This frees their saved report content; it does not delete quiz responses or contacts. Link expiry and revocation history stay recorded.</p></div><button type="button" className="hq-secondary !px-3 !py-2 text-sm disabled:opacity-50" disabled={loading || busy || Boolean(error) || !data.expiredCopies} onClick={() => mutate("cleanup")}><Trash2 size={15} aria-hidden="true"/>Clean expired copies (up to 25)</button></div>
    </>}
  </section>;
}
