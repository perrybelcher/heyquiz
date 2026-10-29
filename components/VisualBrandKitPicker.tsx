"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { FormTheme } from "@/lib/schema";
import type { VisualBrandKit } from "@/lib/visual-brand-kits";

type Review = { action: "update" | "rename" | "delete"; kit: VisualBrandKit };
export default function VisualBrandKitPicker({ theme, onPreview, invalid, applyImmediately = false }: {
    theme: FormTheme; onPreview: (theme: FormTheme) => void; invalid: boolean; applyImmediately?: boolean;
}) {
    const [kits, setKits] = useState<VisualBrandKit[]>([]), [selected, setSelected] = useState(""), [name, setName] = useState("");
    const [loading, setLoading] = useState(true), [operation, setOperation] = useState("");
    const [signedOut, setSignedOut] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
    const [message, setMessage] = useState(""), [error, setError] = useState(""), [review, setReview] = useState<Review | null>(null);
    const mounted = useRef(true), pending = useRef(false), request = useRef(0), controller = useRef<AbortController | null>(null);
    const trigger = useRef<HTMLButtonElement | null>(null), reviewPanel = useRef<HTMLDivElement>(null), selector = useRef<HTMLSelectElement>(null);
    const reviewId = useId(), kit = kits.find(k => k.id === selected), busy = loading || Boolean(operation);
    const stale = needsRefresh || signedOut, controlsDisabled = busy || Boolean(review) || stale;

    const requestKits = useCallback(async (signal: AbortSignal, focus = false) => {
        const sequence = ++request.current;
        const current = () => mounted.current && !signal.aborted && sequence === request.current;
        try {
            const response = await fetch("/api/visual-brand-kits", { cache: "no-store", signal });
            if (response.status === 401) {
                if (current()) { setSignedOut(true); setKits([]); setSelected(""); }
                return;
            }
            const data = await response.json();
            if (!response.ok) throw Error(data.error || "Could not load brand kits.");
            if (current()) {
                setKits(data.kits); setSignedOut(false); setNeedsRefresh(false); setError("");
                setSelected(previous => data.kits.some((saved: VisualBrandKit) => saved.id === previous) ? previous : "");
                // Refresh changes server revisions, never the typed name or quiz
                // theme. A conflicting action must be reviewed anew.
                if (focus) requestAnimationFrame(() => selector.current?.focus());
            }
        } catch (error) {
            if (current()) { setNeedsRefresh(true); setError(error instanceof Error ? error.message : "Could not load brand kits."); }
        } finally { if (current()) setLoading(false); }
    }, []);
    useEffect(() => {
        mounted.current = true;
        const abort = new AbortController(); controller.current = abort;
        // Defer the request until effect setup completes; an immediately
        // unmounted editor must not issue a load or synchronously change state.
        void Promise.resolve().then(() => { if (!abort.signal.aborted) return requestKits(abort.signal); });
        return () => { mounted.current = false; controller.current?.abort(); };
    }, [requestKits]);
    useEffect(() => {
        if (review) reviewPanel.current?.querySelector<HTMLElement>("input, button")?.focus();
    }, [review]);
    function closeReview() {
        setReview(null);
        requestAnimationFrame(() => trigger.current?.focus());
    }
    function refresh() {
        if (pending.current) return;
        setReview(null); controller.current?.abort();
        const abort = new AbortController(); controller.current = abort;
        setLoading(true); setError(""); setMessage("");
        void requestKits(abort.signal, true);
    }
    function openReview(action: Review["action"], button: HTMLButtonElement) {
        if (!kit || controlsDisabled) return;
        trigger.current = button; button.focus(); setError(""); setMessage("");
        // Freeze identity and revision while the selected kit is being reviewed.
        setReview({ action, kit: structuredClone(kit) });
    }
    async function mutate(action: "create" | Review["action"], target?: VisualBrandKit) {
        if (pending.current || busy || stale || (action !== "delete" && !name.trim()) || ((action === "create" || action === "update") && invalid) || (action !== "create" && !target)) return;
        pending.current = true; setOperation(action); setError(""); setMessage("");
        try {
            const body = action === "delete" ? { revision: target!.revision }
                : action === "rename" ? { name, revision: target!.revision }
                : { name, theme, ...(target ? { revision: target.revision } : {}) };
            const response = await fetch(action === "create" ? "/api/visual-brand-kits" : "/api/visual-brand-kits/" + encodeURIComponent(target!.id), {
                method: { create: "POST", update: "PUT", rename: "PATCH", delete: "DELETE" }[action],
                headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const saved = await response.json();
            if (!mounted.current) return;
            if (!response.ok) {
                if ([404, 409].includes(response.status)) setNeedsRefresh(true);
                if (response.status === 401) { setSignedOut(true); setKits([]); setSelected(""); setReview(null); }
                throw Error(saved.error || "Could not change this brand kit. Try again or refresh kits.");
            }
            if (action === "delete") {
                setKits(current => current.filter(k => k.id !== target!.id)); setSelected("");
                setMessage("“" + target!.name + "” was deleted from your saved kits. Your current preview and existing quizzes are unchanged.");
            } else {
                setKits(current => [saved, ...current.filter(k => k.id !== saved.id)]); setSelected(saved.id); setName(saved.name);
                setMessage(action === "rename" ? "Brand kit renamed to “" + saved.name + "”. Its saved design and existing quizzes are unchanged." : "Brand kit saved to your account. Existing quizzes stay unchanged.");
            }
            setReview(null);
            requestAnimationFrame(() => action === "delete" ? selector.current?.focus() : trigger.current?.focus());
        } catch (error) {
            if (mounted.current) setError(error instanceof Error ? error.message : "Could not change the brand kit. Try again or refresh kits.");
        } finally { pending.current = false; if (mounted.current) setOperation(""); }
    }
    return <section aria-label="Reusable visual brand kits" className="min-w-0 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3" aria-busy={busy}>
        <div><h3 className="text-sm font-semibold">Your brand, ready to reuse</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">{applyImmediately ? "Save this logo, palette and typography as a kit, or apply a saved kit to this draft. Publish to update the live quiz." : "Save this logo, palette and typography as a kit. Preview a kit here, then choose Apply theme."}</p></div>
        {signedOut ? <p className="text-sm text-slate-600">You can customize this quiz now. Sign in to save reusable kits to your account.</p> : <>
            {!loading && !kits.length && !needsRefresh && <p className="rounded-lg border border-dashed border-stone-300 bg-white p-3 text-xs leading-relaxed text-slate-600">No saved kits yet. Name your current design and save your first reusable brand kit.</p>}
            <label className="block text-sm">Saved brand kit<select ref={selector} aria-label="Saved brand kit" value={selected} disabled={controlsDisabled} onChange={event => { setSelected(event.target.value); setName(kits.find(k => k.id === event.target.value)?.name || ""); setMessage(""); setError(""); }} className="mt-1 w-full min-w-0 rounded-lg border bg-white p-2"><option value="">Choose a kit</option>{kits.map(k => <option key={k.id} value={k.id}>{k.name}{kits.filter(other => other.name === k.name).length > 1 ? " · " + k.id.slice(0, 8) : ""}</option>)}</select></label>
            <label className="block text-sm">Brand kit name<input className="mt-1 w-full min-w-0 rounded-lg border bg-white p-2" maxLength={100} disabled={busy || Boolean(review)} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Sunday Studio"/></label>
            <div className="flex flex-wrap gap-2"><button type="button" className="hq-secondary !text-xs" disabled={!kit || controlsDisabled} onClick={() => { if (kit) { onPreview(structuredClone(kit.theme)); setMessage(applyImmediately ? "Applied " + kit.name + " to this draft." : "Previewing " + kit.name + ". Apply theme to use it in this quiz."); setError(""); } }}>{applyImmediately ? "Apply selected kit" : "Preview selected kit"}</button><button type="button" className="hq-secondary !text-xs" disabled={controlsDisabled || invalid || !name.trim()} onClick={event => { trigger.current = event.currentTarget; void mutate("create"); }}>Save as new brand kit</button><button type="button" className="hq-secondary !text-xs" disabled={controlsDisabled || invalid || !kit || !name.trim()} onClick={event => openReview("update", event.currentTarget)}>Update selected kit</button></div>
            {kit && <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3"><button type="button" className="hq-secondary !px-3 !py-2 !text-xs" disabled={controlsDisabled} onClick={event => openReview("rename", event.currentTarget)}><Pencil size={14} aria-hidden="true"/>Rename selected kit</button><button type="button" className="hq-secondary !px-3 !py-2 !text-xs !text-red-800" disabled={controlsDisabled} onClick={event => openReview("delete", event.currentTarget)}><Trash2 size={14} aria-hidden="true"/>Delete selected kit</button></div>}
            {review && <div ref={reviewPanel} role="group" aria-labelledby={reviewId} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm space-y-3" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!pending.current) closeReview(); } }}>
                <p id={reviewId} className="break-words font-semibold">{review.action === "delete" ? "Delete “" + review.kit.name + "”?" : review.action === "rename" ? "Rename “" + review.kit.name + "”" : "Update “" + review.kit.name + "”?"}</p>
                <p className="text-xs leading-relaxed text-slate-700">{review.action === "delete" ? "This removes the reusable kit from your account. Your current theme preview, saved quizzes and published quizzes keep their own designs. This cannot be undone." : review.action === "rename" ? "Only the saved kit’s name changes. Its design and your quiz remain the same." : "Replace this saved kit with the current theme settings and name. Existing quizzes keep their own copy."}</p>
                {review.action === "rename" && <label className="block text-sm">New brand kit name<input className="mt-1 w-full min-w-0 rounded-lg border bg-white p-2" maxLength={100} disabled={busy} value={name} onChange={event => setName(event.target.value)}/></label>}
                <div className="flex flex-wrap gap-2"><button type="button" className="hq-secondary !px-3 !py-2 !text-xs" disabled={busy} onClick={closeReview}>Keep saved kit</button><button type="button" className="hq-primary !px-3 !py-2 !text-xs" disabled={busy || stale || (review.action !== "delete" && !name.trim()) || (review.action === "update" && invalid)} onClick={() => void mutate(review.action, review.kit)}>{review.action === "delete" ? "Delete this kit" : review.action === "rename" ? "Save kit name" : "Confirm kit update"}</button></div>
            </div>}
        </>}
        {busy && <p role="status" className="text-xs text-slate-600">{loading ? "Loading brand kits…" : operation === "delete" ? "Deleting brand kit…" : operation === "rename" ? "Renaming brand kit…" : "Saving brand kit…"}</p>}
        {message && <p role="status" className="text-xs leading-relaxed text-green-800">{message}</p>}
        {error && <div role="alert" className="space-y-2 text-xs leading-relaxed text-red-800"><p>{error}</p>{needsRefresh && <p>Your theme preview and typed name have been kept. Refresh, then review the selected kit again.</p>}<button type="button" className="flex items-center gap-1.5 underline" disabled={busy} onClick={refresh}><RefreshCw size={13} aria-hidden="true"/>Refresh kits</button></div>}
    </section>;
}
