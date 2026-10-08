"use client";
import { UserPlus, Users, RefreshCw, Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormSchemaType, QuizSubmissionResult } from "@/lib/schema";
import MarketingResultCard from "./MarketingResultCard";
import { defaultCapture, contactsCsv, type CaptureConfig } from "@/lib/contacts";
export default function ContactsStudio({ form, onChange }: {
    form: FormSchemaType;
    onChange: (form: FormSchemaType) => void;
}) {
    const config = form.capture || defaultCapture;
    const [rows, setRows] = useState<QuizSubmissionResult[]>([]), [error, setError] = useState(""), [query, setQuery] = useState(""), [filter, setFilter] = useState("all"), [loading, setLoading] = useState(true);
    function update(patch: Partial<CaptureConfig>) { onChange({ ...form, capture: { ...config, ...patch } }); }
    async function refresh() { setLoading(true); setError(""); try {
        const r = await fetch(`/api/forms/${form.id}/contacts`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error);
        setRows(d.contacts);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Could not load contacts.");
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => {
        let cancelled = false;
        fetch(`/api/forms/${form.id}/contacts`, { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok)
            throw Error(d.error); if (!cancelled)
            setRows(d.contacts); }).catch(e => { if (!cancelled)
            setError(e.message); }).finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; };
    }, [form.id]);
    const visible = rows.filter(r => JSON.stringify([r.contact?.name, r.contact?.email, r.contact?.phone, r.marketing?.title]).toLowerCase().includes(query.toLowerCase()) && (filter === "all" || r.contact?.marketingConsent === (filter === "yes")));
    function exportCsv() { const csv = contactsCsv(visible.map(r => ({ responseId: r.id, submittedAt: r.submittedAt, email: r.contact?.email, name: r.contact?.name, phone: r.contact?.phone, marketingConsent: r.contact?.marketingConsent, consentText: r.contact?.consentText, recordedAt: r.contact?.recordedAt, privacyUrl: r.contact?.privacyUrl, formRevision: r.contact?.formRevision, purposeText: r.contact?.purposeText, placement: r.contact?.placement, result: r.marketing || r.matchedTier || {}, score: r.percentageScore, answers: r.answers || {} }))); const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `${form.id}-contacts.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return <main className="max-w-6xl w-full mx-auto p-8 overflow-auto space-y-8"><section className="bg-white rounded-2xl border p-6 space-y-4"><h2 className="text-xl font-semibold"><UserPlus size={20} aria-hidden="true" className="inline-block mr-2" />Lead capture</h2><p className="text-sm text-slate-500">Collect contact details alongside quiz results. Publish changes to update the live quiz. Connect lead delivery from the Integrate tab.</p>
    <label className="flex gap-2"><input type="checkbox" checked={config.enabled} onChange={e => update({ enabled: e.target.checked })}/>Enable lead capture</label>
    {config.enabled && <><div className="flex gap-6 flex-wrap"><label>Placement <select className="border rounded p-2" value={config.placement} onChange={e => update({ placement: e.target.value as CaptureConfig["placement"], required: false, buttonText: e.target.value === "after_results" ? "Save my details" : "See my results" })}><option value="before_results">Before results</option><option value="after_results">After results</option></select></label><label className="flex gap-2 items-center"><input type="checkbox" disabled={config.placement === "after_results"} checked={config.required} onChange={e => update({ required: e.target.checked })}/>Require contact details before showing results</label></div>
    <div className="flex gap-6">{(["name", "phone"] as const).map(k => <label key={k} className="capitalize">{k} <select className="border rounded p-2" value={config[k]} onChange={e => update({ [k]: e.target.value })}>{["off", "optional", "required"].map(v => <option key={v}>{v}</option>)}</select></label>)}<span className="text-sm self-center">Email is required when sharing details.</span></div>
    {(["title", "description", "buttonText", "privacyUrl"] as const).map(k => <label className="block text-sm" key={k}>{{ title: "Heading", description: "Transition copy", buttonText: "Button text", privacyUrl: "Privacy policy URL" }[k]}<input className="block border rounded-lg p-2 w-full mt-1" value={config[k]} onChange={e => update({ [k]: e.target.value })}/></label>)}
    <label className="flex gap-2"><input type="checkbox" checked={config.marketingEnabled} onChange={e => update({ marketingEnabled: e.target.checked })}/>Offer a separate, optional marketing opt-in</label>{config.marketingEnabled && <input aria-label="Marketing consent wording" className="border rounded-lg p-2 w-full" value={config.marketingLabel} onChange={e => update({ marketingLabel: e.target.value })}/>}<p className="text-xs text-slate-500">Marketing consent starts unchecked. Declining it never blocks results.</p></>}
  </section><section className="bg-white rounded-2xl border p-6 space-y-4"><div className="flex justify-between items-center"><h2 className="text-xl font-semibold"><Users size={20} aria-hidden="true" className="inline-block mr-2" />Contacts ({visible.length})</h2><div className="flex gap-3"><button onClick={() => void refresh()} className="border rounded-lg px-3 py-2"><RefreshCw size={15} aria-hidden="true" className="inline-block mr-2" />Refresh</button><button disabled={!visible.length} onClick={exportCsv} className="bg-indigo-600 text-white rounded-lg px-3 py-2 disabled:opacity-40"><Download size={15} aria-hidden="true" className="inline-block mr-2" />Export CSV</button></div></div><p className="text-sm text-slate-500">One contact per response. Separate quiz attempts stay separate.</p><div className="flex gap-3"><input aria-label="Search contacts" placeholder="Search name, email, phone or result…" className="border rounded-lg p-2 flex-1" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="Filter marketing consent" className="border rounded-lg p-2" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All contacts</option><option value="yes">Marketing opted in</option><option value="no">No marketing consent</option></select></div>{error && <p role="alert" className="text-red-600">{error}</p>}{loading ? <p>Loading contacts…</p> : !visible.length ? <p className="py-8 text-slate-500">No matching contacts yet. Preview responses do not create contacts.</p> : visible.map(r => <details key={r.id} className="border rounded-lg p-4"><summary className="cursor-pointer">{r.contact?.name || r.contact?.email} · {r.marketing?.title || r.matchedTier?.title || "Completed"} · {r.contact?.marketingConsent ? "Marketing opted in" : "No marketing consent"}</summary><dl className="mt-3 text-sm space-y-2"><dt>Email</dt><dd>{r.contact?.email}</dd><dt>Phone</dt><dd>{r.contact?.phone || "—"}</dd><dt>Consent recorded</dt><dd>{r.contact?.recordedAt} · {r.contact?.consentText || "Marketing opt-in not offered"}</dd><dt>Answers</dt><dd className="whitespace-pre-wrap">{r.grading.map(g => `${g.questionTitle}: ${g.userAnswer}`).join("\n")}</dd><dt>Result details</dt><dd>{r.marketing ? <MarketingResultCard result={r.marketing} /> : <span>{r.percentageScore}%</span>}</dd></dl></details>)}</section></main>;
}
