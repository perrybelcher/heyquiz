export default function ResultsChart({
  stats,
}: {
  stats: {
    starts?: number;
    completionRate?: number;
    funnel?: { id: string; title: string; viewed: number }[];
  };
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 my-6">
      <div className="flex justify-between gap-6 mb-6">
        <div>
          <h3 className="font-semibold text-slate-900">Response journey</h3>
          <p className="text-sm text-slate-500 mt-1">
            See where respondents reach each question. Branching may
            intentionally skip steps.
          </p>
        </div>
        <div className="text-right shrink-0">
          <strong className="text-2xl text-indigo-600">
            {stats.completionRate || 0}%
          </strong>
          <p className="text-xs text-slate-500">
            completion · {stats.starts || 0} starts
          </p>
        </div>
      </div>
      {!stats.starts ? (
        <p className="text-sm text-slate-400">
          Share your published quiz to start collecting journey insights.
        </p>
      ) : (
        <div className="space-y-4">
          {stats.funnel?.map((q, i) => (
            <div key={q.id}>
              <div className="flex justify-between gap-4 mb-2 text-xs">
                <span className="truncate">
                  {i + 1}. {q.title}
                </span>
                <span>{q.viewed} reached</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full">
                <div
                  className="h-2 bg-indigo-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (q.viewed / (stats.starts || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
