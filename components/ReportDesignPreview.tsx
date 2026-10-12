import { readableReportAccent } from "@/lib/report-design";
import type { CSSProperties } from "react";
import type { ResultPdfModel } from "@/lib/result-pdf-model";

/** Semantic web companion to the native PDF, not a pixel/page-break emulator. */
export default function ReportDesignPreview({ model, sample = false }: { model: ResultPdfModel; sample?: boolean }) {
  const design = model.design, executive = design?.style === "executive";
  // The native PDF also falls back to a readable accent when the quiz color is light.
  const accent = readableReportAccent(model.accent);
  const textStyle: CSSProperties = { overflowWrap: "anywhere", whiteSpace: "pre-line" };
  return <article aria-label={sample ? "Sample report design" : "Saved report document"} className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white text-slate-900 shadow-sm" style={{ borderTop: executive ? "8px solid #17202d" : `3px solid ${accent}`, "--hq-text": "#17202d", "--hq-card": "#ffffff", "--hq-body-size": "16px", "--hq-heading-scale": "1", "--hq-heading-font": "Arial, sans-serif", fontFamily: "Arial, sans-serif" } as CSSProperties}>
    <header className={`min-w-0 px-5 py-8 sm:px-9 ${design?.cover ? "border-b border-stone-200 pb-16 pt-12" : ""}`}>
      {executive && <p className="mb-6 bg-slate-900 px-3 py-3 text-xs font-bold uppercase tracking-widest text-white">Personal report</p>}
      {(model.brandName || !model.hideBranding) && <p className="mb-5 text-sm font-bold" style={{ ...textStyle, color: accent }}>{model.brandName || "Pippi"}</p>}
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" style={textStyle}>{model.title}</h1>
      {design?.subtitle && <p className="mt-4 text-base leading-relaxed text-slate-600" style={textStyle}>{design.subtitle}</p>}
      {design?.quizTitle !== model.title && design?.quizTitle && <p className="mt-4 text-sm text-slate-600" style={textStyle}>{design.quizTitle}</p>}
      <p className="mt-5 text-xs text-slate-600">{sample ? "Sample completion date" : `Saved result · ${new Date(model.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`}</p>
      {design?.cover && <p className="mt-6 text-xs text-slate-600">{sample ? "The downloaded PDF starts its results on a new page." : "Personal results and practical next steps"}</p>}
    </header>
    <div className="min-w-0 space-y-4 px-5 pb-8 sm:px-9">
      {design?.introduction && <section className="mb-8 border-l-2 border-stone-300 pl-4"><h2 className="mb-2 text-sm font-bold">About this report</h2><p className="text-sm leading-relaxed" style={textStyle}>{design.introduction}</p></section>}
      {model.blocks.map((block, index) => {
        if (block.kind === "rule") return <hr key={index} className="my-6 border-stone-200"/>;
        if (block.kind === "heading") return block.level === 1
          ? <h2 key={index} className="pt-2 text-2xl font-semibold leading-tight" style={textStyle}>{block.text}</h2>
          : <h3 key={index} className={block.level === 2 ? "border-t border-stone-200 pt-5 text-lg font-semibold" : "pt-2 text-sm font-bold"} style={textStyle}>{block.text}</h3>;
        if (block.kind === "score") return <div key={index} className={executive ? "rounded-xl bg-slate-100 p-4" : "py-2"}>
          <p className="text-sm font-semibold" style={textStyle}>{block.label}</p><p className="mt-1 text-2xl font-semibold" style={{ color: accent }}>{block.value === null ? "Not enough information" : `${block.value}%`}</p>
          {block.value !== null && <div aria-hidden="true" className="mt-2 h-1.5 bg-slate-200"><div className="h-full" style={{ width: `${block.value}%`, backgroundColor: accent }}/></div>}
          {block.coverage && <p className="mt-2 text-xs text-slate-600" style={textStyle}>{block.coverage}</p>}
        </div>;
        if (block.kind === "link") return sample ? <p key={index} className="text-sm font-semibold underline" style={{ ...textStyle, color: accent }}>{block.label} <span className="font-normal">(sample button)</span></p> : <a key={index} href={block.url} rel="noreferrer" className="block text-sm font-semibold underline underline-offset-4" style={{ ...textStyle, color: accent }}>{block.label} →</a>;
        return <p key={index} className={block.kind === "label" ? "text-xs leading-relaxed text-slate-600" : "text-sm leading-relaxed"} style={textStyle}>{block.text}</p>;
      })}
      {design?.footer && <footer className="border-t border-stone-200 pt-5 text-xs leading-relaxed text-slate-600" style={textStyle}>{design.footer}</footer>}
    </div>
    <div className="border-t border-stone-200 px-5 py-4 text-xs text-slate-600 sm:px-9">{model.hideBranding ? "Saved copy" : "Made with Pippi"}{sample && " · Sample content; not a participant result"}</div>
  </article>;
}
