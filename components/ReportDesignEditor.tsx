"use client";

import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_REPORT_DESIGN, REPORT_SECTIONS, REPORT_SECTION_LABELS, ReportDesignSchema, type ReportDesign, type ReportSection } from "@/lib/report-design";
import { buildResultPdfModel } from "@/lib/result-pdf-model";
import type { FormTheme } from "@/lib/schema";
import ReportDesignPreview from "./ReportDesignPreview";

export type ReportDesignDraft = { baseline: string; design: ReportDesign } | null;
const identity = (value?: ReportDesign) => JSON.stringify(value ?? null);
function parseDraft(raw: string | null, quizId: string): ReportDesignDraft {
  if (!raw || raw.length > 40000) return null;
  try {
    const saved = JSON.parse(raw), value = saved.draft?.design;
    if (saved.quizId !== quizId || saved.version !== 1 || typeof saved.draft?.baseline !== "string" || saved.draft.baseline.length > 16000 || !value) return null;
    // Recover bounded raw input, including an unfinished URL, into controls only.
    const { cta, title, subtitle, introduction, footer, ...settings } = value;
    if (!ReportDesignSchema.omit({ cta: true, title: true, subtitle: true, introduction: true, footer: true }).safeParse(settings).success) return null;
    if (![[title, 140], [subtitle, 240], [introduction, 2000], [footer, 160]].every(([text, limit]) => typeof text === "string" && text.length <= limit)) return null;
    const rest = { ...settings, title, subtitle, introduction, footer };
    if (cta !== undefined && (typeof cta.label !== "string" || cta.label.length > 80 || typeof cta.url !== "string" || cta.url.length > 2000 || Object.keys(cta).some(key => !["label", "url"].includes(key)))) return null;
    return { baseline: saved.draft.baseline, design: { ...rest, ...(cta ? { cta: { label: cta.label, url: cta.url } } : {}) } };
  } catch { return null; }
}

export function useReportDesignDraft(quizId: string) {
  const key = `pippi-report-design:${quizId}`, cached = useRef<string | null | undefined>(undefined), persisted = useRef<string | null | undefined>(undefined);
  const read = useCallback(() => {
    if (cached.current === undefined) try { cached.current = sessionStorage.getItem(key); } catch { cached.current = null; }
    return cached.current;
  }, [key]);
  const raw = useSyncExternalStore(() => () => {}, read, () => null);
  const restored = useMemo(() => parseDraft(raw, quizId), [raw, quizId]);
  const [override, setOverride] = useState<ReportDesignDraft | undefined>(undefined), [storageWarning, setStorageWarning] = useState(false);
  function update(next: ReportDesignDraft) {
    const previous = persisted.current === undefined ? raw : persisted.current;
    setOverride(next);
    try {
      if (next) {
        const serialized = JSON.stringify({ version: 1, quizId, draft: next });
        if (!parseDraft(serialized, quizId)) throw Error("Invalid pending report input.");
        sessionStorage.setItem(key, serialized); persisted.current = serialized;
      } else {
        if (sessionStorage.getItem(key) === previous) sessionStorage.removeItem(key);
        persisted.current = null;
      }
      setStorageWarning(false);
    } catch { setStorageWarning(true); }
  }
  return { draft: override === undefined ? restored : override, update, restored: override === undefined && !!restored, storageWarning };
}

export default function ReportDesignEditor({ value, quizTitle, theme, draft, onDraftChange, onChange, restored, storageWarning }: {
  value?: ReportDesign; quizTitle: string; theme: FormTheme; draft: ReportDesignDraft;
  onDraftChange: (value: ReportDesignDraft) => void; onChange: (value: ReportDesign | undefined) => void;
  restored?: boolean; storageWarning?: boolean;
}) {
  const id = useId(), current = value ?? DEFAULT_REPORT_DESIGN, design = draft?.design ?? current;
  const stale = !!draft && draft.baseline !== identity(value), parsed = ReportDesignSchema.safeParse(design);
  const errors = parsed.success ? [] : parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }));
  function change(patch: Partial<ReportDesign>) {
    const next = { ...design, ...patch };
    onDraftChange(value && identity(next) === identity(current) ? null : { baseline: draft?.baseline ?? identity(value), design: next });
  }
  function toggle(section: ReportSection) {
    change({ sections: design.sections.includes(section) ? design.sections.filter(item => item !== section) : [...design.sections, section] });
  }
  function move(section: ReportSection, direction: -1 | 1) {
    const items = [...design.sections], from = items.indexOf(section), to = from + direction;
    if (from < 0 || to < 0 || to >= items.length) return;
    [items[from], items[to]] = [items[to], items[from]]; change({ sections: items });
  }
  let model: ReturnType<typeof buildResultPdfModel> | undefined;
  if (parsed.success) {
    try {
      model = buildResultPdfModel({ quizTitle: quizTitle || "Your quiz", createdAt: "2026-01-01T12:00:00.000Z", theme, reportDesign: parsed.data,
        result: { marketing: { kind: "scorecard", title: "Your sample result", message: "A clear starting point, with room to learn more.", overallScore: null,
          categories: [{ title: "One area of strength", description: "Example category context.", score: 75, answered: 3, applicable: 4, minAnswers: 2, bandTitle: "Building momentum", advice: "Keep a useful weekly habit." }, { title: "An area to explore", description: "The sample has not supplied enough information.", score: null, answered: 0, applicable: 2, minAnswers: 1 }],
          priorities: [{ title: "Choose one practical step", action: "Make time for a small improvement this week." }], reasons: ["A sample explanation of how answers inform the result."], advice: "Try one useful change and review it.",
          resultSections: [{ type: "faq", title: "Where do I begin?", body: "Start with the next step that feels most useful to you.", label: "", url: "" }], ctaLabel: "See the next step", ctaUrl: "https://example.test/sample" } } });
    } catch { /* A malformed legacy theme cannot poison the creator's draft. */ }
  }
  const inputClass = "w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 focus:outline-2 focus:outline-offset-2 focus:outline-stone-700";
  return <details className="min-w-0 rounded-xl border border-stone-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold text-stone-900">Report design <span className="font-normal text-stone-600">· PDF and saved result{draft ? " · unapplied changes" : ""}</span></summary>
    <section aria-label="Report design settings" className="mt-5 min-w-0 space-y-5 text-sm text-stone-800">
      <p>Design the saved report and downloaded PDF. The quiz player keeps its own result layout. Publish changes for new responses; existing responses retain their original report.</p>
      {!value && <p className="rounded-lg bg-stone-100 p-3">Your report currently uses the original layout. Choose Apply report design to use the style shown below.</p>}
      {restored && <p role="status" className="rounded-lg bg-blue-50 p-3 text-blue-950">Unapplied report settings were recovered in this browser tab. Review them before applying.</p>}
      {storageWarning && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-950">Pending settings could not be backed up or cleared. Keep this tab open and apply your changes before leaving.</p>}
      <fieldset className="space-y-3"><legend className="font-semibold">PDF style</legend><div className="grid gap-3 sm:grid-cols-2">
        {([['editorial', 'Editorial', 'Open spacing, large headings and fine accent rules.'], ['executive', 'Executive', 'A dark masthead and shaded score panels.']] as const).map(([style, label, help]) => <label key={style} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${design.style === style ? 'border-stone-800 bg-stone-50' : 'border-stone-300'}`}><input type="radio" name={`${id}-style`} value={style} checked={design.style === style} onChange={() => change({ style })} className="mt-1"/><span><span className="block font-semibold">{label}</span><span className="mt-1 block text-xs leading-relaxed text-stone-600">{help}</span></span></label>)}
      </div></fieldset>
      <label className="flex items-start gap-3"><input type="checkbox" checked={design.cover} onChange={event => change({ cover: event.target.checked })} className="mt-1"/><span>Add a separate cover page to the PDF</span></label>
      {([['title','Report title',140,1],['subtitle','Report subtitle',240,2],['introduction','Opening introduction',2000,5],['footer','Closing footer note',160,2]] as const).map(([key,label,limit,rows]) => <div key={key} className="space-y-2"><label htmlFor={`${id}-${key}`} className="block font-semibold">{label}</label>{rows === 1 ? <input id={`${id}-${key}`} className={inputClass} maxLength={limit} value={design[key]} placeholder={key === 'title' ? quizTitle || 'Your quiz title' : undefined} onChange={event => change({ [key]: event.target.value })}/> : <textarea id={`${id}-${key}`} className={inputClass} rows={rows} maxLength={limit} value={design[key]} onChange={event => change({ [key]: event.target.value })}/>}<p className="text-xs text-stone-600">{design[key].length} / {limit} characters.{key === 'title' ? ' Leave blank to use the saved quiz title.' : ''}</p></div>)}
      <fieldset className="space-y-3"><legend className="font-semibold">Supporting sections</legend><p className="text-xs leading-relaxed text-stone-600">The result summary and all scores, category guidance and missing-information notices always remain. Optional sections appear only when that result contains them.</p>
        {[...design.sections, ...REPORT_SECTIONS.filter(section => !design.sections.includes(section))].map(section => { const index = design.sections.indexOf(section); return <div key={section} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3"><label className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={index >= 0} onChange={() => toggle(section)}/><span>{REPORT_SECTION_LABELS[section]}</span></label>{index >= 0 && <div className="flex gap-2"><button type="button" aria-label={`Move ${REPORT_SECTION_LABELS[section]} up`} onClick={() => move(section,-1)} disabled={index === 0} className="rounded border border-stone-300 px-3 py-2 disabled:bg-stone-100 disabled:text-stone-500">↑</button><button type="button" aria-label={`Move ${REPORT_SECTION_LABELS[section]} down`} onClick={() => move(section,1)} disabled={index === design.sections.length-1} className="rounded border border-stone-300 px-3 py-2 disabled:bg-stone-100 disabled:text-stone-500">↓</button></div>}</div>; })}
      </fieldset>
      <div className="space-y-3"><label className="flex items-start gap-3"><input type="checkbox" checked={!!design.cta} onChange={event => change({ cta: event.target.checked ? { label: '', url: '' } : undefined })} className="mt-1"/><span>Use a custom report button</span></label><p className="text-xs text-stone-600">Otherwise the report uses the saved result button. This does not change buttons inside additional result sections.</p>{design.cta && <><label className="block font-semibold" htmlFor={`${id}-cta-label`}>Report button text</label><input id={`${id}-cta-label`} maxLength={80} value={design.cta.label} onChange={event => change({ cta: { ...design.cta!, label: event.target.value } })} className={inputClass}/><label className="block font-semibold" htmlFor={`${id}-cta-url`}>Report button link</label><input id={`${id}-cta-url`} type="url" maxLength={2000} value={design.cta.url} onChange={event => change({ cta: { ...design.cta!, url: event.target.value } })} className={inputClass}/>{!design.sections.includes('action') && <p className="text-amber-900">Enable Main next-step button above to show this custom button.</p>}</>}</div>
      {!!errors.length && <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">{errors.map((error,index) => <p key={index}>{error.path}: {error.message}</p>)}</div>}
      {stale && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-950">The saved report design changed while you were editing. Your pending settings remain here. Reload current design before applying another change.</p>}
      <p role="status" className="text-stone-700">{draft ? "Unapplied settings stay in this browser tab. They are not part of your saved quiz yet." : "Applied design follows normal draft saving and publication."}</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={!parsed.success || stale || (!!value && !draft)} onClick={() => { if (parsed.success && !stale) { onChange(parsed.data); onDraftChange(null); } }} className="rounded-lg bg-stone-900 px-4 py-2.5 font-semibold text-white disabled:bg-stone-200 disabled:text-stone-600">Apply report design</button>{draft && <button type="button" className="rounded-lg border border-stone-300 px-4 py-2.5 font-semibold" onClick={() => onDraftChange(null)}>{stale ? 'Reload current design' : 'Discard unapplied design'}</button>}<button type="button" className="rounded-lg border border-stone-300 px-4 py-2.5 font-semibold" onClick={() => { onChange(undefined); onDraftChange(null); }}>Use original report layout</button></div>
      <p className="text-xs leading-relaxed text-stone-600">PDFs use your brand name and a readable version of your accent color, with bundled fonts. Logos, images and videos remain online. Some writing systems need Print / Save as PDF. This is a structured report designer, with automatic pagination.</p>
      <section aria-label="Report sample preview" className="min-w-0 space-y-3"><h3 className="font-semibold">Live sample preview</h3><p className="text-xs text-stone-600">Fixed example scores and text, not a real participant. This web preview illustrates style and order; PDF page breaks and type sizes can differ. Use a completed quiz’s saved result to download the actual report.</p>{model ? <ReportDesignPreview model={model} sample/> : <p className="rounded-lg bg-stone-100 p-3">Correct the fields above to preview this design. Invalid settings have not changed your quiz.</p>}</section>
    </section>
  </details>;
}
