"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
type Job = { responseId: string; requestedAt: number; state: string; message: string; attempts: number; nextAttemptAt: number | null };
type Listing = { mode: "resend"; total: number; jobs: Job[] };
/** Owner status contains no email addresses, provider IDs or private result URLs. */
export default function ResultEmailDeliveryManager({ formId }: { formId: string }) {
  const [data, setData] = useState<Listing | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(true), [unavailable, setUnavailable] = useState(false);
  const mounted = useRef(true), flight = useRef(false);
  const endpoint = `/api/forms/${encodeURIComponent(formId)}/result-email/drain`;
  const load = useCallback(async (run = false) => {
    if (flight.current) return;
    flight.current = true;
    try {
      if (run) {
        const processed = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!processed.ok) throw Error("Delivery could not be checked. Refresh and try again.");
      }
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json();
      if (response.status === 503 && body.code === "RESULT_EMAIL_UNAVAILABLE") { if (mounted.current) setUnavailable(true); return; }
      if (!response.ok) throw Error(body.error || "Delivery status could not be loaded.");
      if (mounted.current) { setData(body); setUnavailable(false); }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Delivery status could not be loaded."); }
    finally { flight.current = false; if (mounted.current) setBusy(false); }
  }, [endpoint]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (response.status === 503 && body.code === "RESULT_EMAIL_UNAVAILABLE") { if (!controller.signal.aborted) setUnavailable(true); return; }
      if (!response.ok) throw Error(body.error || "Delivery status could not be loaded.");
      if (!controller.signal.aborted) setData(body);
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Delivery status could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [endpoint]);
  if (unavailable) return null;
  return <section aria-label="Result email delivery" aria-busy={busy} className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><Mail size={20} aria-hidden="true"/>Result email delivery</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">Track emails requested by respondents. Accepted means the email provider has received the message; delivered means the recipient’s mail server accepted it.</p></div><button type="button" disabled={busy} className="hq-secondary !px-3 !py-2" onClick={() => { setBusy(true); setError(""); void load(); }}><RefreshCw size={15} aria-hidden="true"/>Refresh delivery</button></div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {!data && busy && <p role="status" className="text-sm text-slate-500">Loading delivery status…</p>}
    {data && <><p className="text-xs text-slate-500">{data.total} requested emails · showing the latest {data.jobs.length}. No email is sent by refreshing status.</p>
    {!data.jobs.length ? <p className="rounded-xl bg-stone-50 p-4 text-sm text-slate-500">Delivery requests will appear when someone completes your quiz and chooses “Email my result.”</p> : <ul className="divide-y divide-stone-100">{data.jobs.map(job => <li key={job.responseId} className="py-3 space-y-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Response {job.responseId.slice(0,8)}</span><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold capitalize">{job.state.replaceAll("_"," ")}</span></div><p className="text-sm text-slate-600">{job.message}</p><p className="text-xs text-slate-500">Requested {new Date(job.requestedAt).toLocaleString()} · {job.attempts} delivery attempts</p></li>)}</ul>}
    {data.jobs.some(job => ["queued","sending","accepted","delivery_delayed"].includes(job.state)) && <div className="border-t border-stone-100 pt-4"><button type="button" disabled={busy} className="hq-secondary !px-3 !py-2" onClick={() => { setBusy(true); setError(""); void load(true); }}>Check pending delivery</button><p className="mt-2 text-xs text-slate-500">Processes up to five due requests and checks provider receipts. It does not resend accepted emails or change recipients.</p></div>}
    </>}
  </section>;
}
