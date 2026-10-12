"use client";

import { Bookmark, Check, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ContactFilters } from "@/lib/contact-filters";
import {
  CONTACT_SEGMENT_LIMIT, contactFiltersFromSegment, contactSegmentFiltersFromCurrent,
  parseContactSegmentResponse, type ContactSegmentResponse,
} from "@/lib/contact-segment-schema";

type Mutation = { kind: "create"; name: string } | { kind: "rename"; id: string; name: string; revision: number } | { kind: "replace"; id: string } | { kind: "delete"; id: string; revision: number };

/** Keyed by quiz in ContactsStudio: pending requests cannot populate another quiz. */
export default function ContactSavedFilters({ formId, filters, onApply }: {
  formId: string; filters: ContactFilters; onApply: (filters: ContactFilters) => void;
}) {
  const labelId = useId();
  const [list, setList] = useState<ContactSegmentResponse | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [read, setRead] = useState<{ generation: number; error: string }>({ generation: -1, error: "" });
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false), [managing, setManaging] = useState(false);
  const [rename, setRename] = useState<{ id: string; name: string; revision: number; reviewedName: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string; revision: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const serial = useRef(0), selection = useRef("");
  const lastFocused = useRef<HTMLElement | null>(null);
  const mutationController = useRef<AbortController | null>(null);
  const createRef = useRef<HTMLInputElement>(null), createTrigger = useRef<HTMLButtonElement>(null), manageTrigger = useRef<HTMLButtonElement>(null), headingRef = useRef<HTMLHeadingElement>(null);
  const createPanel = useRef<HTMLDivElement>(null), renamePanel = useRef<HTMLDivElement>(null), managePanel = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null), renameRef = useRef<HTMLInputElement>(null), keepRef = useRef<HTMLButtonElement>(null);
  const endpoint = `/api/forms/${encodeURIComponent(formId)}/contact-segments`;
  const loading = read.generation !== refresh;
  const ready = Boolean(list) && !loading && !read.error && !needsReload && !busy;
  const selected = list?.segments.find(item => item.id === selectedId);
  const renameTarget = rename ? list?.segments.find(item => item.id === rename.id) : undefined;
  const renameStale = Boolean(rename && (rename.revision !== list?.revision || !renameTarget));
  let saveBlocker = "";
  let currentDefinition: ReturnType<typeof contactSegmentFiltersFromCurrent> | null = null;
  try { currentDefinition = contactSegmentFiltersFromCurrent(filters); }
  catch (cause) { saveBlocker = cause instanceof Error ? cause.message : "Choose valid filters before saving."; }
  const modified = Boolean(selected && (!currentDefinition || JSON.stringify(currentDefinition) !== JSON.stringify(selected.filters)));

  useEffect(() => {
    const controller = new AbortController(), request = ++serial.current;
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body: unknown = await response.json();
      if (!response.ok) throw Error(responseError(body, "Could not load saved filters."));
      const value = parseContactSegmentResponse(body);
      if (controller.signal.aborted || request !== serial.current) return;
      setList(value); setRead({ generation: refresh, error: "" }); setNeedsReload(false);
    }).catch(cause => {
      if (!controller.signal.aborted && request === serial.current) setRead({ generation: refresh, error: cause instanceof Error ? cause.message : "Could not load saved filters." });
    });
    return () => { controller.abort(); mutationController.current?.abort(); };
  }, [endpoint, refresh]);
  useEffect(() => {
    // Disabling an in-flight submit can make a browser drop focus to BODY.
    // Remember actual focus movement so that loss differs from choosing another control.
    function rememberFocus(event: FocusEvent) {
      if (event.target instanceof HTMLElement && event.target !== document.body && event.target !== document.documentElement) lastFocused.current = event.target;
    }
    document.addEventListener("focusin", rememberFocus);
    return () => document.removeEventListener("focusin", rememberFocus);
  }, []);
  useEffect(() => { if (creating) createRef.current?.focus(); }, [creating]);
  const renameId = rename?.id, deletingId = deleting?.id;
  useEffect(() => { if (renameId) renameRef.current?.focus(); }, [renameId]);
  useEffect(() => { if (deletingId) keepRef.current?.focus(); }, [deletingId]);

  function returnFocus(closingPanel?: HTMLElement | null, preferred?: HTMLElement | null) {
    const active = document.activeElement;
    const focusOwner = active === document.body || active === document.documentElement ? lastFocused.current : active;
    if (closingPanel && !closingPanel.contains(focusOwner)) return;
    requestAnimationFrame(() => {
      // A response must not steal focus from another contact control. Cancellation
      // can fall back when an error or reload has disabled the normal select.
      if (closingPanel && document.activeElement !== active && document.activeElement !== document.body && document.activeElement !== document.documentElement) return;
      const target = [preferred, selectRef.current, manageTrigger.current, createTrigger.current, headingRef.current]
        .find(item => item?.isConnected && !item.matches(":disabled") && item.getClientRects().length);
      target?.focus();
    });
  }
  function cancelManagement() { setRename(null); setDeleting(null); returnFocus(); }
  function choose(id: string) {
    selection.current = id; setSelectedId(id); setRename(null); setDeleting(null); setManaging(false); setNotice("");
  }
  async function mutate(operation: Mutation) {
    if (!ready || !list || mutationController.current) return;
    let definition = currentDefinition;
    if (operation.kind === "create" || operation.kind === "replace") {
      // Recheck at the action boundary; contact search is never silently stripped.
      try { definition = contactSegmentFiltersFromCurrent(filters); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Choose valid filters before saving."); return; }
    }
    if ((operation.kind === "delete" || operation.kind === "rename") && operation.revision !== list.revision) {
      setError("The saved list changed. Cancel this confirmation and review the selected filter again."); return;
    }
    const revision = list.revision, selectedAtStart = selection.current, request = ++serial.current;
    const oldIds = new Set(list.segments.map(item => item.id)), controller = new AbortController();
    mutationController.current = controller;
    const body = operation.kind === "create" ? { revision, name: operation.name, filters: definition }
      : operation.kind === "rename" ? { revision, id: operation.id, operation: "rename", name: operation.name }
      : operation.kind === "replace" ? { revision, id: operation.id, operation: "replace", filters: definition }
      : { revision, id: operation.id };
    setBusy(true); setError(""); setNotice("");
    let retryWithoutReload = false;
    try {
      const response = await fetch(endpoint, { method: operation.kind === "create" ? "POST" : operation.kind === "delete" ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      const payload: unknown = await response.json();
      if (controller.signal.aborted || request !== serial.current) return;
      if (!response.ok) {
        retryWithoutReload = response.status === 400;
        if (response.status !== 400) setNeedsReload(true);
        throw Error(responseError(payload, "Could not save this filter. Reload the saved list before trying again."));
      }
      const next = parseContactSegmentResponse(payload);
      if (next.revision !== revision + 1) throw Error("The saved-filter response is out of date. Reload the saved list before trying again.");
      if (selection.current !== selectedAtStart) { setNeedsReload(true); setNotice("The selection changed during saving. Reload saved filters to see the confirmed list."); return; }
      setList(next);
      if (operation.kind === "create") {
        const created = next.segments.find(item => !oldIds.has(item.id));
        if (created) { selection.current = created.id; setSelectedId(created.id); }
        if (createRef.current?.value === operation.name) { returnFocus(createPanel.current, createTrigger.current); setCreating(false); }
        setName(value => value === operation.name ? "" : value); setNotice("Submitted filter definition saved. Contact search and contact records were not stored.");
      } else if (operation.kind === "rename") {
        const closesEditor = renameRef.current?.value === operation.name;
        setRename(value => value?.id === operation.id && value.name === operation.name ? null : value); setNotice("Saved filter renamed.");
        if (closesEditor) returnFocus(renamePanel.current);
      } else if (operation.kind === "replace") setNotice("Saved definition updated. The current contact view has not changed.");
      else {
        selection.current = ""; setSelectedId(""); setDeleting(null); setManaging(false); setNotice("Saved filter deleted. No contacts were deleted or changed."); returnFocus(managePanel.current);
      }
    } catch (cause) {
      if (!controller.signal.aborted && request === serial.current) {
        setError(cause instanceof Error ? cause.message : "Could not save this filter.");
        // Network/malformed-success outcomes can have committed. Require an
        // explicit refresh rather than repeating a mutation with stale state.
        if (!retryWithoutReload) setNeedsReload(true);
      }
    } finally {
      if (!controller.signal.aborted && request === serial.current) { setBusy(false); mutationController.current = null; }
    }
  }

  return <section aria-labelledby={`${labelId}-title`} className="min-w-0 rounded-xl border border-stone-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><h3 ref={headingRef} tabIndex={-1} id={`${labelId}-title`} className="flex items-center gap-2 text-sm font-semibold outline-none"><Bookmark size={16} aria-hidden="true"/>Saved filters</h3><span className="text-xs font-normal text-slate-600">{list?.segments.length ?? "—"}/{CONTACT_SEGMENT_LIMIT}</span></div>
      <button type="button" aria-label="Reload saved filters" disabled={loading || busy} onClick={() => { setError(""); setNotice(""); setRefresh(value => value + 1); }} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:text-slate-500"><RefreshCw size={13} aria-hidden="true"/>Reload</button>
    </div>
    {loading && <p role="status" className="mt-3 text-sm text-slate-600">Loading saved filters…</p>}
    {read.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">{read.error} Your current contact filters are unchanged.</p>}
    <div className="mt-3 flex min-w-0 flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 basis-44"><label className="text-xs font-medium text-slate-700" htmlFor={`${labelId}-select`}>Choose saved filters</label><select ref={selectRef} id={`${labelId}-select`} className="hq-input mt-1 w-full min-w-0" value={selectedId} disabled={!ready} onChange={event => choose(event.target.value)}><option value="">{list?.segments.length ? "Choose a saved filter" : "No saved filters yet"}</option>{selectedId && !selected && <option value={selectedId}>Previously selected filter (unavailable)</option>}{list?.segments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <button type="button" className="hq-secondary !px-3 !py-2" disabled={!ready || !selected} onClick={() => { if (selected) { onApply(contactFiltersFromSegment(selected.filters)); setNotice(`Applied “${selected.name}”. Contact search was cleared.`); } }}><Check size={15} aria-hidden="true"/>Apply saved filters</button>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">Apply replaces filters and clears search. Matching contacts may change; saved dates use your device’s timezone.</p>
    {selected && <p className="mt-2 text-xs text-slate-700">{modified ? "Modified — current filters differ from this saved definition." : "Current filters match this saved definition."}</p>}
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      <button ref={createTrigger} type="button" disabled={busy} aria-expanded={creating} aria-controls={creating ? `${labelId}-create` : undefined} className="inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-semibold text-red-800" onClick={() => setCreating(value => !value)}><Save size={14} aria-hidden="true"/>Save current filters</button>
      {(selected || rename || deleting) && <button ref={manageTrigger} type="button" disabled={busy} aria-expanded={managing} aria-controls={managing ? `${labelId}-manage` : undefined} className="inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-semibold text-slate-700" onClick={() => setManaging(value => !value)}><Pencil size={14} aria-hidden="true"/>Manage saved filter</button>}
    </div>
    {creating && <div ref={createPanel} id={`${labelId}-create`} className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3" onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); setCreating(false); createTrigger.current?.focus(); } }}>
      <label className="block text-xs font-medium text-slate-700" htmlFor={`${labelId}-name`}>New filter name<input ref={createRef} id={`${labelId}-name`} className="hq-input mt-1 w-full min-w-0" maxLength={80} placeholder="For example, opted-in coffee buyers" value={name} onChange={event => setName(event.target.value)} aria-describedby={`${labelId}-save-help${error ? ` ${labelId}-error` : ""}`}/></label>
      <p id={`${labelId}-save-help`} className="mt-2 text-xs leading-relaxed text-slate-600">Use a short descriptive label. {saveBlocker || "Only the supported filters are saved; no contact details or membership list."}</p>
      {(list?.segments.length || 0) >= CONTACT_SEGMENT_LIMIT && <p className="mt-2 text-xs text-slate-700">The saved-filter limit is reached. Update or delete an existing definition first.</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="hq-primary !px-3 !py-2" disabled={!ready || !name.trim() || Boolean(saveBlocker) || (list?.segments.length || 0) >= CONTACT_SEGMENT_LIMIT} onClick={() => mutate({ kind: "create", name })}>Save filter</button><button type="button" disabled={busy} className="hq-secondary !px-3 !py-2" onClick={() => { setCreating(false); createTrigger.current?.focus(); }}>Cancel save</button></div>
    </div>}
    {managing && (selected || rename || deleting) && <div ref={managePanel} id={`${labelId}-manage`} className="mt-3 border-t border-stone-200 pt-3">
      <p className="break-words text-xs font-semibold text-slate-700">Manage “{selected?.name || rename?.reviewedName || deleting?.name}”</p>
      {selected && <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="hq-secondary !px-3 !py-2" disabled={!ready || Boolean(saveBlocker) || !modified} onClick={() => mutate({ kind: "replace", id: selected.id })}><Save size={14} aria-hidden="true"/>Update saved filters</button><button type="button" className="hq-secondary !px-3 !py-2" disabled={!ready} onClick={() => { setDeleting(null); setRename({ id: selected.id, name: selected.name, revision: list!.revision, reviewedName: selected.name }); }}><Pencil size={14} aria-hidden="true"/>Rename saved filter</button><button type="button" className="hq-secondary !px-3 !py-2" disabled={!ready} onClick={() => { setRename(null); setDeleting({ id: selected.id, name: selected.name, revision: list!.revision }); }}><Trash2 size={14} aria-hidden="true"/>Delete saved filter</button></div>}
      {saveBlocker && <p className="mt-2 text-xs text-slate-600">{saveBlocker}</p>}
    {rename && <div ref={renamePanel} className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3" onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); cancelManagement(); } }}>
      <p className="mb-3 break-words text-xs leading-relaxed text-slate-700">Renaming “{rename.reviewedName}”. Your typed name is kept until you save or cancel.</p>
      <label className="block text-xs font-medium text-slate-700" htmlFor={`${labelId}-rename`}>Rename selected filter<input ref={renameRef} id={`${labelId}-rename`} aria-describedby={error ? `${labelId}-error` : undefined} value={rename.name} maxLength={80} className="hq-input mt-1 w-full min-w-0" onChange={event => setRename({ ...rename, name: event.target.value })}/></label>
      {renameStale && <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-slate-800"><p className="break-words">{renameTarget ? `The saved list changed. The latest saved name is “${renameTarget.name}”. Review it before saving your typed name.` : "This saved filter is no longer available. Your typed name is preserved; cancel to choose another definition."}</p>{renameTarget && <button type="button" className="hq-secondary mt-3 !px-3 !py-2" disabled={!ready} onClick={() => setRename({ ...rename, revision: list!.revision, reviewedName: renameTarget.name })}>Review latest name</button>}</div>}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="hq-primary !px-3 !py-2" disabled={!ready || renameStale || !rename.name.trim()} onClick={() => mutate({ kind: "rename", id: rename.id, name: rename.name, revision: rename.revision })}>Save filter name</button><button type="button" className="hq-secondary !px-3 !py-2" disabled={busy} onClick={cancelManagement}><X size={14} aria-hidden="true"/>Cancel rename</button></div>
    </div>}
    {deleting && <div role="group" aria-label="Confirm saved filter deletion" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3" onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); cancelManagement(); } }}>
      <p className="break-words text-sm text-red-950">Delete “{deleting.name}”? This removes only the reusable filter definition. Your contacts and current filters stay unchanged.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="hq-primary !px-3 !py-2" disabled={!ready || deleting.revision !== list?.revision} onClick={() => mutate({ kind: "delete", id: deleting.id, revision: deleting.revision })}>Confirm delete filter</button><button ref={keepRef} type="button" className="hq-secondary !px-3 !py-2" disabled={busy} onClick={cancelManagement}>Keep saved filter</button></div>
      {deleting.revision !== list?.revision && <p className="mt-2 text-xs text-red-900">The saved list changed. Keep this filter, then reopen Delete to review it again.</p>}
    </div>}
      <button type="button" disabled={busy} className="mt-3 rounded-md py-1 text-xs font-semibold text-slate-700 underline" onClick={() => { setManaging(false); manageTrigger.current?.focus(); }}>Close management</button>
    </div>}
    {busy && <p role="status" className="mt-3 text-sm text-slate-700">Saving the selected definition…</p>}
    {error && <p id={`${labelId}-error`} role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}{needsReload ? " Reload saved filters before trying again. Your current filters and typed name are unchanged." : " Your current filters and typed name are unchanged."}</p>}
    {notice && <p role="status" className="mt-3 break-words text-sm text-slate-700">{notice}</p>}
  </section>;
}

function responseError(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error.length <= 500 ? body.error : fallback;
}
