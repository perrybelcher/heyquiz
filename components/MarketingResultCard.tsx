import type { MarketingResult } from "@/lib/marketing";
export default function MarketingResultCard({
  result, onOfferClick,
}: {
  result: MarketingResult;
  onOfferClick?: () => void;
}) {
  return (
    <div className="text-left space-y-6">
      <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">
        {result.kind === "product_finder"
          ? "Your recommendation"
          : result.kind === "segmentation"
            ? "Your next step"
            : "Your assessment"}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{result.title}</h1>
      <p className="text-slate-600 leading-relaxed whitespace-pre-line">
        {result.message}
      </p>
      {result.reasons.length > 0 && (
        <div className="rounded-2xl bg-indigo-50 p-5">
          <h2 className="font-semibold mb-3">Why this fits</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">
            {result.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {result.advice && (
        <div>
          <h2 className="font-semibold mb-2">A useful first step</h2>
          <p className="text-slate-600 whitespace-pre-line">{result.advice}</p>
        </div>
      )}
      {result.categories.map((c) => (
        <div className="rounded-2xl border border-slate-200 p-5" key={c.id}>
          <div className="flex justify-between gap-4">
            <h2 className="font-semibold">{c.title}</h2>
            <span className="font-semibold text-indigo-600">
              {c.score === null ? "Not enough information" : `${c.score}%`}
            </span>
          </div>
          {c.score !== null && (
            <div className="h-2 bg-slate-100 rounded-full my-4">
              <div
                className="bg-indigo-600 h-2 rounded-full"
                style={{ width: `${c.score}%` }}
              />
            </div>
          )}
          <p className="text-sm text-slate-600 mt-3 whitespace-pre-line">
            {c.description}
          </p>
          <p className="text-xs text-slate-400 mt-3">
            {c.answered} of {c.applicable} applicable questions scored
            {c.score === null ? ` · ${c.minAnswers} needed` : ""}
          </p>
        </div>
      ))}
      {result.ctaUrl && /^https?:\/\//i.test(result.ctaUrl) && (
        <a className="hq-primary" href={result.ctaUrl} onClick={onOfferClick}>
          {result.ctaLabel || "Explore this option"} →
        </a>
      )}
    </div>
  );
}
