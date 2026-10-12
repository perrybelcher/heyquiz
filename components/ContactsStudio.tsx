"use client";
import { UserPlus, Users, RefreshCw, Download, Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, Mail, ShieldCheck, CalendarDays, Link2, History } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormSchemaType, QuizSubmissionResult } from "@/lib/schema";
import MarketingResultCard from "./MarketingResultCard";
import ResultLinkManager, { type ResultLinkSelection } from "./ResultLinkManager";
import ContactSavedFilters from "./ContactSavedFilters";
import { defaultCapture, contactsCsv, contactExportRows, type CaptureConfig } from "@/lib/contacts";
import { contactAnswerQuery, parseContactAnswerCohort, contactAnswerVersionLabel, contactAnswerOptionLabel, sameAnswerPair, type ContactAnswerCohort } from "@/lib/contact-answer-cohort";
import { emptyContactFilters, contactFilterError, filterContacts, contactPage, contactResultOptions, contactResultTitle, contactScore, contactCategoryOptions, type ContactFilters } from "@/lib/contact-filters";

import { parseContactContexts, contactContextFor, contactContextExport, contactContextOptions, contactSourceLabel, contactCampaignLabel, contactActivityLabel, type ContactContexts } from "@/lib/contact-context";

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
}

export default function ContactsStudio({ form, onChange }: { form: FormSchemaType; onChange: (form: FormSchemaType) => void }) {
  const config = form.capture || defaultCapture;
  const [linkSelection, setLinkSelection] = useState<(ResultLinkSelection & { formId: string }) | undefined>();
  const contactTrigger = useRef<HTMLButtonElement>(null), directoryHeading = useRef<HTMLHeadingElement>(null);
  function selectContactLink(row: QuizSubmissionResult, trigger: HTMLButtonElement) {
    if (!row.id) return;
    contactTrigger.current = trigger;
    setLinkSelection(previous => ({ formId: form.id, responseId: row.id!, label: row.contact?.name || row.contact?.email || "This contact", completedAt: row.submittedAt, requestId: (previous?.requestId || 0) + 1 }));
  }
  function returnToContact() {
    const trigger = contactTrigger.current;
    // The contact may have been collapsed while its saved-link panel was open.
    if (trigger?.isConnected) {
      const details = trigger.closest("details");
      if (details) details.open = true;
    }
    const target = trigger?.isConnected && trigger.getClientRects().length ? trigger : directoryHeading.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", behavior: "instant" });
  }
  const [loaded, setLoaded] = useState<{ formId: string; rows: QuizSubmissionResult[]; contexts: ContactContexts; answerCohort: ContactAnswerCohort } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [requestState, setRequestState] = useState<{ formId: string; refresh: number; answerQuery: string; error: string } | null>(null);
  const [filterState, setFilterState] = useState({ formId: form.id, values: emptyContactFilters });
  const [requestedPage, setRequestedPage] = useState(1);
  const [moreFilters, setMoreFilters] = useState(false);
  const moreFiltersTrigger = useRef<HTMLButtonElement>(null);
  const filters = filterState.formId === form.id ? filterState.values : emptyContactFilters;
  const answerPair = useMemo(() => filters.answerVersion && filters.answerOption ? { version: filters.answerVersion, option: filters.answerOption } : null, [filters.answerVersion, filters.answerOption]);
  const answerQuery = contactAnswerQuery(answerPair);
  const loading = requestState?.formId !== form.id || requestState?.refresh !== refresh || requestState?.answerQuery !== answerQuery;
  const error = loading ? "" : requestState?.error || "";
  const rows = useMemo(() => loaded?.formId === form.id ? loaded.rows : [], [loaded, form.id]);
  const contexts = useMemo(() => loaded?.formId === form.id ? loaded.contexts : {}, [loaded, form.id]);
  const answerCohort = loaded?.formId === form.id ? loaded.answerCohort : null;
  const answerVersion = answerCohort?.versions.find(version => version.id === filters.answerVersion);
  const answerCounts = answerPair && !loading && !error && sameAnswerPair(answerPair, answerCohort?.selection) ? answerCohort?.counts : null;
  const hasLoaded = loaded?.formId === form.id;
  function update(patch: Partial<CaptureConfig>) { onChange({ ...form, capture: { ...config, ...patch } }); }
  function changeFilters(patch: Partial<ContactFilters>) {
    setFilterState({ formId: form.id, values: { ...filters, ...patch } });
    setRequestedPage(1);
  }
  function clearFilters() { setFilterState({ formId: form.id, values: emptyContactFilters }); setRequestedPage(1); }
  function applySavedFilters(values: ContactFilters) {
    setFilterState({ formId: form.id, values });
    setRequestedPage(1);
    if (values.source || values.campaign || values.category || values.answerVersion) setMoreFilters(true);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/forms/${form.id}/contacts${answerQuery}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Could not load contacts.");
      if (!Array.isArray(data.contacts)) throw Error("The contact list could not be read. Please refresh.");
      if (!controller.signal.aborted) {
        setLoaded({ formId: form.id, rows: data.contacts, contexts: parseContactContexts(data.contacts, data.contextByResponse), answerCohort: parseContactAnswerCohort(data.answerCohort, data.contacts.map((row: QuizSubmissionResult) => row.id), answerPair) });
        setRequestState({ formId: form.id, refresh, answerQuery, error: "" });
      }
    }).catch(cause => {
      if (!controller.signal.aborted) setRequestState({ formId: form.id, refresh, answerQuery, error: cause instanceof Error ? cause.message : "Could not load contacts." });
    });
    return () => controller.abort();
  }, [form.id, refresh, answerQuery, answerPair]);
  const filterError = contactFilterError(filters);
  const matching = useMemo(() => filterContacts(rows, filters, contexts, answerCohort), [rows, filters, contexts, answerCohort]);
  const resultOptions = useMemo(() => contactResultOptions(rows), [rows]);
  const selectedResultMissing = Boolean(filters.result && !resultOptions.some(option => option.value === filters.result));
  const categoryOptions = useMemo(() => contactCategoryOptions(rows), [rows]);
  const sourceOptions = useMemo(() => contactContextOptions(rows, contexts, "source"), [rows, contexts]);
  const campaignOptions = useMemo(() => contactContextOptions(rows, contexts, "campaign"), [rows, contexts]);
  const extraFilterCount = Number(Boolean(filters.source)) + Number(Boolean(filters.campaign)) + Number(Boolean(filters.category)) + Number(Boolean(answerPair));
  const page = contactPage(matching, requestedPage);
  const activeFilters = Object.keys(emptyContactFilters).some(key => filters[key as keyof ContactFilters] !== emptyContactFilters[key as keyof ContactFilters]);
  const optedIn = rows.filter(row => row.contact?.marketingConsent === true).length;
  const exportReady = Boolean(matching.length) && !loading && !error && !filterError && (!answerPair || sameAnswerPair(answerPair, answerCohort?.selection));
  function exportCsv() {
    if (!exportReady) return;
    // Export the full filtered set, not the currently displayed page of 25.
    const csv = contactsCsv(contactExportRows(matching).map((row, index) => ({ ...row, ...contactContextExport(matching[index], contexts) })));
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${form.id}-contacts.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="mx-auto w-full max-w-6xl min-w-0 space-y-6 overflow-auto p-4 sm:p-8">
    <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-label="Lead capture settings">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold"><UserPlus size={20} aria-hidden="true"/>Lead capture</h2><p className="mt-1 max-w-xl text-sm text-slate-500">Collect contact details alongside quiz results. Publish changes to update the live quiz.</p></div>
        <label className="flex items-center gap-2 rounded-lg bg-stone-50 p-3 text-sm font-medium"><input type="checkbox" checked={config.enabled} onChange={event => update({ enabled: event.target.checked })}/>Enable lead capture</label>
      </div>
      {config.enabled && <details className="mt-5 border-t border-stone-100 pt-4">
        <summary className="text-sm font-semibold">Capture settings <span className="ml-2 font-normal text-slate-500">{config.required ? "Required" : "Optional"} · {config.placement === "before_results" ? "Before results" : "After results"}</span></summary>
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Placement<select className="hq-input mt-1" value={config.placement} onChange={event => update({ placement: event.target.value as CaptureConfig["placement"], required: false, buttonText: event.target.value === "after_results" ? "Save my details" : "See my results" })}><option value="before_results">Before results</option><option value="after_results">After results</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={config.placement === "after_results"} checked={config.required} onChange={event => update({ required: event.target.checked })}/>Require contact details before showing results</label></div>
          <div className="grid gap-4 sm:grid-cols-2">{(["name", "phone"] as const).map(key => <label key={key} className="text-sm capitalize">{key}<select className="hq-input mt-1" value={config[key]} onChange={event => update({ [key]: event.target.value })}>{["off", "optional", "required"].map(value => <option key={value}>{value}</option>)}</select></label>)}</div>
          <p className="text-xs text-slate-500">Email is required when sharing details.</p>
          {(["title", "description", "buttonText", "privacyUrl"] as const).map(key => <label className="block text-sm" key={key}>{{ title: "Heading", description: "Transition copy", buttonText: "Button text", privacyUrl: "Privacy policy URL" }[key]}<input className="hq-input mt-1" value={config[key]} onChange={event => update({ [key]: event.target.value })}/></label>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.marketingEnabled} onChange={event => update({ marketingEnabled: event.target.checked })}/>Offer a separate, optional marketing opt-in</label>
          {config.marketingEnabled && <input aria-label="Marketing consent wording" className="hq-input" value={config.marketingLabel} onChange={event => update({ marketingLabel: event.target.value })}/>}
          <p className="text-xs text-slate-500">Marketing consent starts unchecked. Declining it never blocks results. Connect lead delivery from the Integrate tab.</p>
        </div>
      </details>}
    </section>

    <section className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white" aria-label="Contact directory" aria-busy={loading}>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-800">Your audience</p><h2 ref={directoryHeading} tabIndex={-1} className="flex items-center gap-2 text-2xl font-semibold focus:outline-none"><Users size={23} aria-hidden="true"/>Contacts{hasLoaded ? ` (${matching.length})` : ""}</h2><p className="mt-2 text-sm text-slate-500">One contact per response. Separate quiz attempts stay separate.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="hq-secondary !px-3 !py-2 disabled:opacity-50"><RefreshCw size={15} aria-hidden="true"/>Refresh</button><button type="button" disabled={!exportReady} onClick={exportCsv} className="hq-primary !px-3 !py-2" title={`Export all ${matching.length} matching contacts`}><Download size={15} aria-hidden="true"/>Export CSV</button></div>
        </div>
        {hasLoaded && <div className="grid grid-cols-2 gap-3" role="group" aria-label="Contact totals"><div className="rounded-xl bg-stone-50 px-4 py-3"><p className="flex items-center gap-2 text-xs text-slate-500"><Mail size={14} aria-hidden="true"/>All responses with contact details</p><p className="mt-1 text-xl font-semibold">{rows.length.toLocaleString()}</p></div><div className="rounded-xl bg-emerald-50/60 px-4 py-3"><p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} aria-hidden="true"/>Marketing opted in</p><p className="mt-1 text-xl font-semibold text-emerald-900">{optedIn.toLocaleString()}</p></div></div>}
        <ContactSavedFilters key={form.id} formId={form.id} filters={filters} onApply={applySavedFilters}/>
        <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/50 p-4" role="group" aria-label="Contact filters">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={16} aria-hidden="true"/>Find the right contacts</h3><button type="button" onClick={clearFilters} disabled={!activeFilters} className="flex items-center gap-1 text-xs font-semibold text-red-800 disabled:text-slate-400"><X size={14} aria-hidden="true"/>Clear filters</button></div>
          <div className="grid gap-3 md:grid-cols-2"><label className="block min-w-0 text-xs font-medium text-slate-600">Search contacts<span className="relative mt-1 block"><Search size={16} aria-hidden="true" className="absolute left-3 top-3.5 text-slate-400"/><input aria-label="Search contacts" placeholder="Name, email, phone or result…" className="hq-input !pl-9" value={filters.query} onChange={event => changeFilters({ query: event.target.value })}/></span></label><label className="block min-w-0 text-xs font-medium text-slate-600">Marketing consent<select aria-label="Filter marketing consent" className="hq-input mt-1" value={filters.consent} onChange={event => changeFilters({ consent: event.target.value as ContactFilters["consent"] })}><option value="all">All contacts</option><option value="yes">Marketing opted in</option><option value="no">No marketing consent</option></select></label></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block min-w-0 text-xs font-medium text-slate-600">Submitted from<input aria-label="Submitted from" type="date" className="hq-input mt-1 min-w-0" value={filters.from} onChange={event => changeFilters({ from: event.target.value })}/></label>
            <label className="block min-w-0 text-xs font-medium text-slate-600">Submitted through<input aria-label="Submitted through" type="date" className="hq-input mt-1 min-w-0" value={filters.to} onChange={event => changeFilters({ to: event.target.value })}/></label>
            <label className="block min-w-0 text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-1">Saved result<select aria-label="Filter saved result" className="hq-input mt-1" value={filters.result} onChange={event => changeFilters({ result: event.target.value })}><option value="">All saved results</option>{selectedResultMissing && <option value={filters.result}>Previously selected result (0)</option>}{resultOptions.map(option => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}</select></label>
          </div>
          {hasLoaded && !loading && !error && selectedResultMissing && <p role="status" className="text-xs leading-relaxed text-slate-600">The selected result is no longer present in loaded contact history. This filter is still active; clear or change it to see other contacts.</p>}
          <div className="grid gap-3 sm:grid-cols-3"><label className="block min-w-0 text-xs font-medium text-slate-600">Score availability<select aria-label="Score availability" className="hq-input mt-1" value={filters.score} onChange={event => changeFilters({ score: event.target.value as ContactFilters["score"], ...(event.target.value === "unscored" ? { minScore: "", maxScore: "" } : {}) })}><option value="all">Any score status</option><option value="scored">Has a percentage score</option><option value="unscored">No percentage score</option></select></label><label className="block min-w-0 text-xs font-medium text-slate-600">Minimum score %<input aria-label="Minimum score percent" type="number" min="0" max="100" step="any" inputMode="decimal" disabled={filters.score === "unscored"} placeholder="0" className="hq-input mt-1 disabled:bg-stone-100" value={filters.minScore} onChange={event => changeFilters({ minScore: event.target.value })}/></label><label className="block min-w-0 text-xs font-medium text-slate-600">Maximum score %<input aria-label="Maximum score percent" type="number" min="0" max="100" step="any" inputMode="decimal" disabled={filters.score === "unscored"} placeholder="100" className="hq-input mt-1 disabled:bg-stone-100" value={filters.maxScore} onChange={event => changeFilters({ maxScore: event.target.value })}/></label></div>
          <p className="text-xs leading-relaxed text-slate-500">Dates include the full day in your device’s timezone. Saved results include earlier names. Scores use the overall scorecard or graded knowledge result; product recommendations and unscored responses have no percentage.</p>
          <div className="border-t border-stone-200 pt-4">
            <button ref={moreFiltersTrigger} type="button" aria-expanded={moreFilters} aria-controls="contact-more-filters" onClick={() => setMoreFilters(value => !value)} className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-800"><SlidersHorizontal size={15} aria-hidden="true"/>More filters{extraFilterCount ? ` (${extraFilterCount} active)` : ""}<span aria-hidden="true">{moreFilters ? "−" : "+"}</span></button>
            <div id="contact-more-filters" hidden={!moreFilters} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setMoreFilters(false); moreFiltersTrigger.current?.focus(); } }}>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-xs font-medium text-slate-600">Start source<select aria-label="Filter start source" className="hq-input mt-1" value={filters.source} onChange={event => changeFilters({ source: event.target.value })}><option value="">All sources</option>{filters.source && !sourceOptions.some(option => option.value === filters.source) && <option value={filters.source}>{contactSourceLabel(filters.source)} (0)</option>}{sourceOptions.map(option => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}</select></label>
                <label className="block min-w-0 text-xs font-medium text-slate-600">Start campaign<select aria-label="Filter start campaign" className="hq-input mt-1" value={filters.campaign} onChange={event => changeFilters({ campaign: event.target.value })}><option value="">All campaigns</option>{filters.campaign && !campaignOptions.some(option => option.value === filters.campaign) && <option value={filters.campaign}>{contactCampaignLabel(filters.campaign)} (0)</option>}{campaignOptions.map(option => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}</select></label>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">Recorded when this response started. Unknown means not recorded or no retained history; it does not mean direct traffic.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-xs font-medium text-slate-600">Saved scorecard category<select aria-label="Filter saved category" className="hq-input mt-1" value={filters.category} onChange={event => changeFilters({ category: event.target.value, categoryScore: "all", categoryMin: "", categoryMax: "" })}><option value="">All categories</option>{filters.category && !categoryOptions.some(option => option.value === filters.category) && <option value={filters.category}>Previously selected category (0)</option>}{categoryOptions.map(option => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}</select></label>
                <label className="block min-w-0 text-xs font-medium text-slate-600">Category availability<select aria-label="Category score availability" disabled={!filters.category} className="hq-input mt-1 disabled:bg-stone-100" value={filters.categoryScore} onChange={event => changeFilters({ categoryScore: event.target.value as ContactFilters["categoryScore"], ...(["unscored", "missing"].includes(event.target.value) ? { categoryMin: "", categoryMax: "" } : {}) })}><option value="all">Has this saved category</option><option value="scored">Category has a score</option><option value="unscored">Category has no score</option><option value="missing">Category not present</option></select></label>
                <label className="block min-w-0 text-xs font-medium text-slate-600">Minimum category %<input aria-label="Minimum category percent" type="number" min="0" max="100" step="any" inputMode="decimal" placeholder="0" disabled={!filters.category || ["unscored", "missing"].includes(filters.categoryScore)} className="hq-input mt-1 disabled:bg-stone-100" value={filters.categoryMin} onChange={event => changeFilters({ categoryMin: event.target.value })}/></label>
                <label className="block min-w-0 text-xs font-medium text-slate-600">Maximum category %<input aria-label="Maximum category percent" type="number" min="0" max="100" step="any" inputMode="decimal" placeholder="100" disabled={!filters.category || ["unscored", "missing"].includes(filters.categoryScore)} className="hq-input mt-1 disabled:bg-stone-100" value={filters.categoryMax} onChange={event => changeFilters({ categoryMax: event.target.value })}/></label>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">Category scores and names are saved at completion. Missing information stays unscored. Earlier versions may use different scoring rules. All selected filters apply together.</p>
              <div className="mt-5 border-t border-stone-200 pt-4" role="group" aria-label="Historical answer condition">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block min-w-0 text-xs font-medium text-slate-600">Saved question version<select aria-label="Filter saved question version" className="hq-input mt-1" value={filters.answerVersion} onChange={event => changeFilters({ answerVersion: event.target.value, answerOption: "" })}><option value="">Any answer</option>{filters.answerVersion && !answerVersion && <option value={filters.answerVersion}>Previously selected question (unavailable)</option>}{answerCohort?.versions.map(version => <option key={version.id} value={version.id}>{contactAnswerVersionLabel(version)} ({version.contacts})</option>)}</select></label>
                  <label className="block min-w-0 text-xs font-medium text-slate-600">Selected answer<select aria-label="Filter selected answer" className="hq-input mt-1 disabled:bg-stone-100" disabled={!answerVersion} value={filters.answerOption} onChange={event => changeFilters({ answerOption: event.target.value })}><option value="">Choose an answer</option>{filters.answerOption && !answerVersion?.options.some(option => option.id === filters.answerOption) && <option value={filters.answerOption}>Previously selected answer (unavailable)</option>}{answerVersion?.options.map(option => <option key={option.id} value={option.id}>{contactAnswerOptionLabel(answerVersion, option)}</option>)}</select></label>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">Uses the saved question and answer wording from each response. {answerVersion?.multiple ? "Multiple selections match when they include this answer. " : ""}This condition combines with every other filter.</p>
                {filters.answerVersion && !filters.answerOption && <p role="status" className="mt-2 text-xs text-slate-700">Choose an answer to apply this condition.</p>}
                {hasLoaded && !answerCohort?.versions.length && <p className="mt-2 text-xs text-slate-600">No supported saved choice questions are available in retained contact history.</p>}
                {Boolean(answerCohort?.omittedVersions) && <p className="mt-2 text-xs text-slate-600">Showing up to 60 saved question versions; {answerCohort?.omittedVersions} additional versions are omitted. A valid active selection stays available.</p>}
                {Boolean(answerVersion?.omittedOptions) && <p className="mt-2 text-xs text-slate-600">Showing up to 100 answers; {answerVersion?.omittedOptions} additional answers are omitted. A valid active selection stays available.</p>}
                {Boolean(answerCohort?.unavailableSnapshots) && <p className="mt-2 text-xs text-slate-600">Saved question history is unavailable for {answerCohort?.unavailableSnapshots} contacts. Their choices cannot be inferred.</p>}
                {answerCounts && <div className="mt-3 rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-600" role="status"><p className="font-semibold text-slate-700">Answer coverage across all {rows.length} retained contacts</p><p className="mt-1">{answerCounts.answered} valid answers · {answerCounts.unanswered} unanswered · {answerCounts.skipped} skipped by quiz logic · {answerCounts.otherVersion} other version or question absent · {answerCounts.unavailable} history unavailable · {answerCounts.invalid} invalid answers</p><p className="mt-1">Only valid answers selecting this option match. Unavailable information is never treated as an answer.</p></div>}
              </div>
            </div>
          </div>
          {filterError && <p role="alert" className="text-sm text-red-800">{filterError}</p>}
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">Could not load contacts</p><p className="mt-1">{error}</p>{hasLoaded && <p className="mt-1">Showing the last loaded contacts. Export is unavailable until refresh succeeds.</p>}<button type="button" className="mt-3 font-semibold underline" onClick={() => setRefresh(value => value + 1)}>Try loading again</button></div>}
        {loading && <p role="status" className="text-sm text-slate-500">{hasLoaded ? "Refreshing contacts…" : "Loading contacts…"}</p>}
        {hasLoaded && !filterError && <p role="status" className="text-sm text-slate-600">Showing {page.start}–{page.end} of {matching.length.toLocaleString()} matching contacts · {rows.length.toLocaleString()} total. CSV includes all {matching.length.toLocaleString()} matches.</p>}
      </div>
      {hasLoaded && !filterError && <div className="border-t border-stone-100">
        {!matching.length ? <div className="px-6 py-12 text-center"><Users className="mx-auto mb-4 text-stone-400" aria-hidden="true"/><h3 className="font-semibold">{rows.length ? "No contacts match these filters" : "Your first contact will appear here"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{rows.length ? "Try a wider date or score range, or clear the filters to see everyone." : "Contacts appear when someone completes your published quiz and shares their details. Private preview responses do not create contacts."}</p>{activeFilters && <button type="button" onClick={clearFilters} className="hq-secondary mt-5">Show all contacts</button>}</div> : <div className="divide-y divide-stone-100">{page.rows.map((row, index) => {
          const score = contactScore(row), context = contactContextFor(row, contexts);
          return <details key={row.id || `${row.submittedAt}-${index}`} className="group min-w-0 px-5 py-4 sm:px-6" data-contact-row>
            <summary className="break-words text-sm marker:text-stone-400"><span className="font-medium">{row.contact?.name || row.contact?.email} · {contactResultTitle(row)} · {row.contact?.marketingConsent === true ? "Marketing opted in" : "No marketing consent"}</span><span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><CalendarDays size={13} aria-hidden="true"/>{displayDate(row.submittedAt)}</span><span className="rounded-md bg-stone-100 px-2 py-1 text-slate-700">{score.value === null ? score.label : `${score.value}% · ${score.label}`}</span></span></summary>
            <div className="mt-5 space-y-5 rounded-xl bg-stone-50/70 p-4 sm:p-5">{row.id && <button type="button" disabled={loading || Boolean(error)} onClick={event => selectContactLink(row, event.currentTarget)} className="hq-secondary !px-3 !py-2"><Link2 size={15} aria-hidden="true"/>Manage saved result link</button>}<dl className="grid gap-4 text-sm sm:grid-cols-2"><div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Response ID</dt><dd><p className="mt-1 break-all font-mono text-xs select-all">{row.id || "Unavailable"}</p><p className="mt-1 text-xs text-slate-500">Keep this reference if you need help with this response.</p></dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt><dd className="mt-1 break-all">{row.contact?.email}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt><dd className="mt-1 break-words">{row.contact?.phone || "Not provided"}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consent recorded</dt><dd className="mt-1 break-words">{row.contact?.recordedAt ? displayDate(row.contact.recordedAt) : "Date unavailable"} · {row.contact?.consentText || "Marketing opt-in not offered"}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Answers</dt><dd className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{row.grading.map(answer => `${answer.questionTitle}: ${answer.userAnswer}`).join("\n") || "Answers unavailable for this response."}</dd></div></dl><section aria-label="Recorded response activity" className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><History size={17} aria-hidden="true"/>Recorded activity</h3>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="font-semibold text-slate-600">Start source</dt><dd className="mt-1 break-words">{contactSourceLabel(context.source)}</dd></div><div><dt className="font-semibold text-slate-600">Start campaign</dt><dd className="mt-1 break-words">{contactCampaignLabel(context.campaign)}</dd></div></dl>
              {context.activity.length ? <ol className="mt-5 space-y-4 border-l border-stone-200 pl-4">{context.activity.map(event => <li key={event.kind} className="relative"><span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-red-800"/><p className="text-sm font-medium">{contactActivityLabel[event.kind]}</p><time dateTime={event.at} className="mt-1 block text-xs text-slate-600">{displayDate(event.at)}</time></li>)}</ol> : <p className="mt-4 text-sm text-slate-600">No valid activity dates are available for this response.</p>}
              {context.history === "unavailable" && <p className="mt-4 text-xs leading-relaxed text-slate-600">Start and interaction history is unavailable. The saved response and contact details are still shown.</p>}
              {context.incomplete && <p className="mt-3 text-xs leading-relaxed text-slate-600">Some inconsistent or invalid activity dates could not be shown.</p>}
              <p className="mt-4 text-xs leading-relaxed text-slate-600">Times use your device’s timezone. Interaction means a recorded result view or action click, not a purchase. This is a partial history; question timing, saved-report visits and downloads are not recorded here.</p>
            </section><div><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Result details</h3>{row.marketing ? <MarketingResultCard result={row.marketing}/> : <p className="text-sm">{score.value === null ? score.label : `${score.value}% · ${score.label}`}{row.matchedTier?.message ? ` — ${row.matchedTier.message}` : ""}</p>}</div></div>
          </details>;
        })}</div>}
        {matching.length > 0 && <nav aria-label="Contact pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-4 sm:px-6"><p className="text-xs text-slate-500">Page {page.page} of {page.pages} · 25 per page</p><div className="flex gap-2"><button type="button" className="hq-secondary !px-3 !py-2 disabled:opacity-40" disabled={page.page <= 1} onClick={() => setRequestedPage(page.page - 1)}><ChevronLeft size={16} aria-hidden="true"/>Previous</button><button type="button" className="hq-secondary !px-3 !py-2 disabled:opacity-40" disabled={page.page >= page.pages} onClick={() => setRequestedPage(page.page + 1)}>Next<ChevronRight size={16} aria-hidden="true"/></button></div></nav>}
      </div>}
    </section>
    <ResultLinkManager formId={form.id} selection={linkSelection?.formId === form.id ? linkSelection : undefined} onReturnToContact={returnToContact}/>
  </main>;
}
