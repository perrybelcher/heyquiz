import ResultVideo from "./ResultVideo";
import type { MarketingResult } from "@/lib/marketing";

type Category = MarketingResult["categories"][number];

function Coverage({ category }: { category: Category }) {
  return <p className="text-xs text-slate-500 mt-3">{category.answered} of {category.applicable} applicable questions scored{category.score === null ? ` · ${category.minAnswers} needed` : ""}</p>;
}

function OverallScore({ result }: { result: MarketingResult }) {
  if (result.overallScore === undefined) return null;
  return <section data-result-block="overall" aria-label="Overall score" className="rounded-2xl border border-slate-200 p-5">
    <h2 className="text-sm font-medium">Overall score</h2>
    <p className={`${result.overallScore === null ? "text-2xl" : "text-4xl"} font-semibold mt-2 tabular-nums`}>{result.overallScore === null ? "Not enough information" : `${result.overallScore}%`}</p>
    <p className="text-sm text-slate-600 mt-2">{result.overallScore === null ? "Every category needs enough scored answers before an overall recommendation is available." : "Each category contributes equally to this score."}</p>
  </section>;
}

function Priorities({ result }: { result: MarketingResult }) {
  if (!result.priorities?.length) return null;
  return <section data-result-block="priorities" className="rounded-2xl border border-slate-200 p-5">
    <h2 className="font-semibold">Your next priorities</h2>
    <p className="text-sm text-slate-600 mt-1">Starting with your lowest scored areas.</p>
    <ol className="list-decimal pl-5 mt-4 space-y-4">{result.priorities.map(priority => <li key={priority.categoryId}><strong>{priority.title}</strong><p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{priority.action}</p></li>)}</ol>
  </section>;
}

function Reasons({ result }: { result: MarketingResult }) {
  if (!result.reasons.length) return null;
  return <section data-result-block="reasons" className="rounded-2xl bg-indigo-50 p-5">
    <h2 className="font-semibold mb-3">Why this fits</h2>
    <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
  </section>;
}

function Advice({ result, prominent = false }: { result: MarketingResult; prominent?: boolean }) {
  if (!result.advice) return null;
  return <section data-result-block="advice" className={prominent ? "rounded-2xl bg-indigo-50 border border-slate-200 p-6" : ""}>
    <h2 className="font-semibold mb-2">A useful first step</h2>
    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{result.advice}</p>
  </section>;
}

function CategoryOverview({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  return <section data-result-block="category-overview" aria-label="Category score overview" className="space-y-4">
    <div><h2 className="font-semibold">Your scores at a glance</h2><p className="text-sm text-slate-600 mt-1">{categories.filter(category => category.score !== null).length} of {categories.length} categories have enough scored answers.</p></div>
    <div className="grid sm:grid-cols-2 gap-3">{categories.map(category => <div key={category.id} data-category-overview={category.id} className="min-w-0 rounded-2xl bg-slate-50 border border-slate-200 p-4">
      <h3 className="font-semibold break-words">{category.title}</h3>
      <p className={`${category.score === null ? "text-base" : "text-3xl"} font-semibold text-indigo-600 mt-3 tabular-nums`}>{category.score === null ? "Not enough information" : `${category.score}%`}</p>
      <Coverage category={category} />
    </div>)}</div>
  </section>;
}

function CategoryDetails({ categories }: { categories: Category[] }) {
  return <>{categories.map(category => <section data-result-block="category" data-category-id={category.id} className="rounded-2xl border border-slate-200 p-5" key={category.id}>
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-2">
      <h2 className="font-semibold break-words">{category.title}</h2>
      <span className="font-semibold text-indigo-600 tabular-nums">{category.score === null ? "Not enough information" : `${category.score}%`}</span>
    </div>
    {category.score !== null && <div aria-hidden="true" className="h-2 bg-slate-100 rounded-full my-4"><div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${category.score}%` }} /></div>}
    {category.description && <p className="text-sm text-slate-600 mt-3 whitespace-pre-line">{category.description}</p>}
    {category.bandTitle && <h3 className="font-semibold mt-4">{category.bandTitle}</h3>}
    {category.advice && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{category.advice}</p>}
    <Coverage category={category} />
  </section>)}</>;
}

function PrimaryAction({ result, onOfferClick }: { result: MarketingResult; onOfferClick?: () => void }) {
  return result.ctaUrl && /^https?:\/\//i.test(result.ctaUrl)
    ? <a data-result-block="primary-action" className="hq-primary" href={result.ctaUrl} onClick={onOfferClick}>{result.ctaLabel || "Explore this option"} →</a>
    : null;
}

function ResultSections({ result, onOfferClick }: { result: MarketingResult; onOfferClick?: () => void }) {
  // Conditions have already been resolved into the saved result by the evaluator.
  // Presentation never checks the current draft or reselects content client-side.
  return <>{result.resultSections?.map(section => {
    const heading = section.title && <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>;
    const body = <p className="text-slate-600 leading-relaxed whitespace-pre-line">{section.body}</p>;
    const safeUrl = /^https?:\/\//i.test(section.url);
    if (section.type === "faq") return <details data-result-section={section.id} key={section.id} className="rounded-2xl border border-slate-200 p-5"><summary className="font-semibold cursor-pointer">{section.title || "Learn more"}</summary><div className="mt-3">{body}</div></details>;
    if (section.type === "testimonial") return <figure data-result-section={section.id} key={section.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-6"><blockquote className="text-lg leading-relaxed whitespace-pre-line">{section.body}</blockquote>{section.title && <figcaption className="mt-4 text-sm font-semibold">{section.title}</figcaption>}</figure>;
    return <section data-result-section={section.id} key={section.id} className="rounded-2xl border border-slate-200 p-6 space-y-4">
      {heading}
      {section.type === "video" && <ResultVideo url={section.url} title={section.label || section.title} />}
      {section.type === "image" && safeUrl && <img src={section.url} alt={section.label} loading="lazy" className="w-full max-h-96 object-contain rounded-xl" />}
      {section.body && body}
      {section.type === "cta" && safeUrl && <a className="hq-primary" href={section.url} onClick={onOfferClick}>{section.label || "Learn more"} →</a>}
    </section>;
  })}</>;
}

export default function MarketingResultCard({ result, onOfferClick }: { result: MarketingResult; onOfferClick?: () => void }) {
  // Historical results without a presentation keep the original order. A newly
  // selected layout cannot restyle a prior submission through a changed draft.
  const layout = result.presentation?.layout ?? "stacked";
  const hasEvidence = result.overallScore !== undefined || result.categories.length > 0 || result.reasons.length > 0;
  return <div data-result-layout={layout} className="text-left space-y-6 break-words">
    <header className="space-y-4">
      <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">{result.kind === "product_finder" ? "Your recommendation" : result.kind === "segmentation" ? "Your next step" : "Your assessment"}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{result.title}</h1>
      <p className="text-slate-600 leading-relaxed whitespace-pre-line">{result.message}</p>
    </header>
    {layout === "action_plan" ? <>
      <Advice result={result} prominent />
      <Priorities result={result} />
      <PrimaryAction result={result} onOfferClick={onOfferClick} />
      {hasEvidence && <section data-result-block="evidence" className="space-y-5 border-t border-slate-200 pt-6">
        <div><h2 className="text-lg font-semibold">How your answers shaped this</h2><p className="mt-2 text-sm text-slate-600">Review the supporting details, including any areas that need more information.</p></div>
        <OverallScore result={result} />
        <Reasons result={result} />
        <CategoryDetails categories={result.categories} />
      </section>}
      <ResultSections result={result} onOfferClick={onOfferClick} />
    </> : layout === "score_overview" ? <>
      <OverallScore result={result} />
      <CategoryOverview categories={result.categories} />
      <Reasons result={result} />
      <Priorities result={result} />
      <Advice result={result} />
      {Boolean(result.categories.length) && <section data-result-block="category-details" className="space-y-4 border-t border-slate-200 pt-6"><h2 className="text-lg font-semibold">A closer look at each area</h2><CategoryDetails categories={result.categories} /></section>}
      <ResultSections result={result} onOfferClick={onOfferClick} />
      <PrimaryAction result={result} onOfferClick={onOfferClick} />
    </> : <>
      <OverallScore result={result} />
      <Priorities result={result} />
      <Reasons result={result} />
      <Advice result={result} />
      <CategoryDetails categories={result.categories} />
      <ResultSections result={result} onOfferClick={onOfferClick} />
      <PrimaryAction result={result} onOfferClick={onOfferClick} />
    </>}
  </div>;
}
