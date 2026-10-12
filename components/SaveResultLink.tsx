"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark, ExternalLink, Mail, RefreshCw } from "lucide-react";
type Props = { formId: string; token: string };
export default function SaveResultLink(props: Props) {
    return <SaveResultLinkForAttempt key={`${props.formId}:${props.token}`} {...props}/>;
}
function SaveResultLinkForAttempt({ formId, token }: Props) {
    const [link, setLink] = useState<{
        path: string;
        expiresAt: string;
        resultEmail?: "synthetic" | "resend" | null;
    } | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
    const emailFlight = useRef(false), copyFlight = useRef(false);
    const [email, setEmail] = useState(""), [requested, setRequested] = useState(false), [emailBusy, setEmailBusy] = useState(false), [emailError, setEmailError] = useState("");
    const [emailJob, setEmailJob] = useState<{ state: "queued" | "preparing" | "prepared" | "sending" | "accepted" | "delivered" | "delivery_delayed" | "bounced" | "complained" | "unknown" | "failed" | "cancelled"; message: string; nextAttemptAt: number | null; canRetry: boolean } | null>(null);
    const scope = `${formId}:${token}`;
    const activeScope = useRef(scope);
    activeScope.current = scope;
    // Bounded receipt checks only. The server worker handles delivery; polling never resends.
    useEffect(() => {
        if (link?.resultEmail !== "resend" || !emailJob || !["queued", "sending", "accepted", "delivery_delayed"].includes(emailJob.state)) return;
        let checks = 0;
        const interval = window.setInterval(() => {
            if (++checks > 8) { window.clearInterval(interval); return; }
            void emailAction("status");
        }, 4000);
        return () => window.clearInterval(interval);
        // Status content changes must not restart the finite polling window.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, link?.resultEmail, Boolean(emailJob)]);
    async function emailAction(action: "request" | "status" | "prepare" | "retry") {
        if (emailFlight.current) return;
        emailFlight.current = true; setEmailBusy(true); setEmailError("");
        try {
            const response = await fetch(`/api/forms/${formId}/result-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action, ...(action === "request" ? { email, requested } : {}) }) });
            const data = await response.json();
            if (!response.ok) throw Error(data.error || "Could not update your result email. Your private link is still available.");
            if (activeScope.current === scope) setEmailJob(data.job);
        } catch (error) { if (activeScope.current === scope) setEmailError(error instanceof Error ? error.message : "Could not update your result email. Your private link is still available."); }
        finally { emailFlight.current = false; setEmailBusy(false); }
    }
    async function create() {
        setBusy(true);
        setError('');
        try {
            const response = await fetch(`/api/forms/${formId}/result-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
            const data = await response.json();
            if (!response.ok)
                throw Error(data.error || 'Could not create your link.');
            if (activeScope.current !== scope) return;
            setLink(data);
            if (data.resultEmail === "synthetic" || data.resultEmail === "resend") void emailAction("status");
        }
        catch (error) {
            setError(error instanceof Error ? error.message : 'Could not create your link.');
        }
        finally {
            setBusy(false);
        }
    }
    return <section aria-label="Keep your result" className="text-left border-t border-slate-200 mt-8 pt-6 space-y-3">
    <h2 className="font-semibold">Keep your result</h2><p className="text-sm text-slate-500">Create a private link to revisit or print your result for 30 days after completion. Anyone with the link can view it.</p>
    {!link ? <button type="button" className="hq-secondary" disabled={busy} onClick={() => void create()}><Bookmark size={16} aria-hidden="true"/>{busy ? 'Preparing your link…' : 'Create private result link'}</button> : <>
      <div className="flex flex-wrap gap-3"><a href={link.path} target="_blank" rel="noreferrer" className="hq-primary">Open saved result <ExternalLink size={15}/></a><button type="button" className="hq-secondary" onClick={async () => {
        if (copyFlight.current) return;
        copyFlight.current = true; setCopied(false); setError('');
        try {
            await navigator.clipboard.writeText(new URL(link.path, window.location.origin).href);
            setCopied(true);
        }
        catch {
            setError('Could not copy automatically. Select and copy the link below.');
        } finally { copyFlight.current = false; } }}>{copied ? 'Copied' : 'Copy private link'}</button></div>
      <label className="block text-xs text-slate-500">Private result link<input readOnly value={new URL(link.path, window.location.origin).href} className="hq-input w-full mt-2" onFocus={e => e.target.select()}/></label>
      <p className="text-xs text-slate-500">Available until {new Date(link.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.</p>
    </>}
    {link?.resultEmail === "synthetic" && <section aria-label="Local result email test" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 text-slate-900">
      <h3 className="font-semibold">Result email · local test</h3><p className="text-sm text-slate-700">Prepare an encrypted test copy on this computer. Nothing will be emailed. This is separate from marketing consent.</p>
      {!emailJob ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void emailAction("request"); }}>
        <label className="block text-sm">Test recipient email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="hq-input w-full mt-1"/></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={requested} required onChange={event => setRequested(event.target.checked)} className="mt-1"/><span>I request a local test copy containing my private result link. This does not sign me up for marketing emails.</span></label>
        <button className="hq-secondary" type="submit" disabled={emailBusy || !requested}>{emailBusy ? "Queuing…" : "Queue test copy"}</button>
      </form> : <><p role="status" className="text-sm font-medium">{emailJob.message}</p><p className="text-xs text-slate-600">This response keeps the original test recipient. No real email transport is connected.</p>
        {(emailJob.state === "queued" || emailJob.state === "preparing" || emailJob.state === "failed" && !emailJob.canRetry) && <button type="button" className="hq-secondary" disabled={emailBusy} onClick={() => void emailAction("prepare")}>{emailBusy ? "Preparing…" : emailJob.state === "failed" ? "Check preparation status" : "Prepare local test copy"}</button>}
        {emailJob.canRetry && <button type="button" className="hq-secondary" disabled={emailBusy} onClick={() => void emailAction("retry")}>{emailBusy ? "Queuing…" : "Retry local test"}</button>}
        {emailJob.state === "queued" && emailJob.nextAttemptAt && <p className="text-xs text-slate-600">Next preparation attempt is available at {new Date(emailJob.nextAttemptAt).toLocaleTimeString()}. Tests run only when you prepare them here or use the local test drain.</p>}
      </>}
      {emailError && <p role="alert" className="text-sm text-red-800">{emailError}</p>}
    </section>}
    {link?.resultEmail === "resend" && <section aria-label="Email your result" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 text-slate-900">
      <div className="flex items-center gap-2"><Mail size={18} aria-hidden="true"/><h3 className="font-semibold">Email your result</h3></div>
      <p className="text-sm text-slate-600">Keep your private report and downloadable PDF in one place. This email is separate from marketing.</p>
      {!emailJob ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void emailAction("request"); }}>
        <label className="block text-sm font-medium">Your email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="hq-input w-full mt-1"/></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={requested} required onChange={event => setRequested(event.target.checked)} className="mt-1"/><span>Email me my private result link. This does not sign me up for marketing emails.</span></label>
        <button className="hq-primary" type="submit" disabled={emailBusy || !requested}>{emailBusy ? "Requesting…" : "Email my result"}</button>
      </form> : <>
        <p role="status" className="text-sm font-medium">{emailJob.message}</p>
        <p className="text-xs text-slate-600">Delivery uses the address you originally entered. You can always open or copy your private result link above.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="hq-secondary" disabled={emailBusy} onClick={() => void emailAction("status")}><RefreshCw size={14} aria-hidden="true"/>{emailBusy ? "Checking…" : "Refresh delivery status"}</button>
          {emailJob.canRetry && <button type="button" className="hq-secondary" disabled={emailBusy} onClick={() => void emailAction("retry")}>Retry delivery</button>}
        </div>
        {emailJob.nextAttemptAt && emailJob.state === "queued" && <p className="text-xs text-slate-600">A delivery retry is scheduled after {new Date(emailJob.nextAttemptAt).toLocaleTimeString()}.</p>}
        {(emailJob.state === "accepted" || emailJob.state === "delivered") && <p className="text-xs text-slate-600">If you do not see the message, check your spam folder. Delivery status cannot confirm which inbox folder it reached.</p>}
      </>}
      {emailError && <p role="alert" className="text-sm text-red-800">{emailError}</p>}
    </section>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
