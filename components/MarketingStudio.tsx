"use client";
import { useState } from "react";
import { ShoppingBag, Users, ChartColumn, Plus, Trash2, RotateCcw, ArrowRight } from "lucide-react";
import { nanoid } from "nanoid";
import type { FormSchemaType } from "@/lib/schema";
import {
  MarketingSchema,
  evaluateMarketing,
  type MarketingConfig,
  validateMarketing,
} from "@/lib/marketing";
import MarketingResultCard from "./MarketingResultCard";
import ScorecardResultsEditor from "./ScorecardResultsEditor";
import { multiTypes, type Answers } from "@/lib/engine";
const kinds = {
  product_finder: "Product finder",
  segmentation: "Buyer segmentation",
  scorecard: "Category scorecard",
} as const;
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-sm text-slate-600 space-y-1">
      <span>{label}</span>
      {multiline ? (
        <textarea
          className="hq-input min-h-20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="hq-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export default function MarketingStudio({
  form,
  onChange,
}: {
  form: FormSchemaType;
  onChange: (form: FormSchemaType) => void;
}) {
  const [testAnswers, setTestAnswers] = useState<Answers>({});
  const m = form.marketing;
  const choices = form.questions.filter((q) => q.options?.length);
  const change = (patch: Partial<MarketingConfig>) =>
    m && onChange({ ...form, marketing: { ...m, ...patch } });
  let issue = "";
  try {
    validateMarketing(form, true);
  } catch (e) {
    issue = e instanceof Error ? e.message : "Review the rules.";
  }
  let simulated;
  try {
    simulated = m ? evaluateMarketing(form, testAnswers) : undefined;
  } catch {
    issue = "Review the question branching before simulating results.";
  }
  const targets = m?.kind === "scorecard" ? m.categories : m?.outcomes || [];
  const updateOutcome = (
    id: string,
    patch: Partial<MarketingConfig["outcomes"][number]>,
  ) =>
    change({
      outcomes: m!.outcomes.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-7">
          <p className="text-xs text-indigo-600 uppercase tracking-widest font-semibold">
            Marketing intelligence
          </p>
          <h1 className="text-3xl font-semibold mt-2">
            Turn answers into a useful next step.
          </h1>
          <p className="text-slate-500 mt-3">
            Match products, identify priorities, or build a scorecard. Keep
            preferences separate from right-or-wrong grading.
          </p>
        </div>
        {!m ? (
          <div className="grid md:grid-cols-3 gap-5">
            {Object.entries(kinds).map(([kind, title]) => (
              <button
                key={kind}
                className="text-left p-7 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400"
                onClick={() =>
                  onChange({
                    ...form,
                    mode: "survey",
                    settings: {
                      ...form.settings,
                      showAnswerKeyOnFinish: false,
                      feedbackMode: "end",
                    },
                    marketing: MarketingSchema.parse({ kind }),
                  })
                }
              >
                <div className="mb-4 inline-flex rounded-xl bg-indigo-50 text-indigo-600 p-3">{kind === "product_finder" ? <ShoppingBag size={24} aria-hidden="true" /> : kind === "segmentation" ? <Users size={24} aria-hidden="true" /> : <ChartColumn size={24} aria-hidden="true" />}</div><h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-sm text-slate-500 mt-3">
                  {kind === "product_finder"
                    ? "Recommend a fitting product and explain why."
                    : kind === "segmentation"
                      ? "Choose a relevant result and offer for each buyer."
                      : "Score factual practices across separate categories."}
                </p>
                <p className="text-sm text-indigo-600 mt-5">Set up <ArrowRight size={14} aria-hidden="true" className="inline-block ml-1" /></p>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-4 flex-wrap items-center mb-6">
              <span className="rounded-full bg-indigo-100 text-indigo-700 px-4 py-2 font-medium text-sm">
                {kinds[m.kind]}
              </span>
              <p className="text-xs text-slate-500 flex-1">
                {m.kind === "scorecard"
                  ? "Unknown answers are not zeros. Categories require a minimum number of scored answers."
                  : "Highest eligible points wins. Ties follow result order. Exclusions always override points."}
              </p>
              <button
                className="hq-secondary"
                onClick={() => {
                  if (
                    confirm(
                      "Remove marketing rules and return to standard results?",
                    )
                  )
                    onChange({ ...form, marketing: undefined });
                }}
              >
                <RotateCcw size={14} aria-hidden="true" className="inline-block mr-2" />Use standard results
              </button>
            </div>
            {issue && (
              <p
                role="status"
                className="rounded-xl bg-amber-50 text-amber-800 p-4 text-sm mb-6"
              >
                Before publishing: {issue}
              </p>
            )}
            <div className="grid xl:grid-cols-[1.3fr_1fr] gap-7">
              <div className="space-y-6">
                {m.kind === "scorecard" && <ScorecardResultsEditor marketing={m} onChange={marketing => onChange({...form, marketing})} />}
                <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {m.kind === "scorecard"
                        ? "Score categories"
                        : "Results & recommendations"}
                    </h2>
                    <button
                      className="hq-secondary"
                      onClick={() =>
                        m.kind === "scorecard"
                          ? change({
                              categories: [
                                ...m.categories,
                                {
                                  id: `cat-${nanoid(8)}`,
                                  title: "New category",
                                  description: "",
                                  minAnswers: 1,
                                },
                              ],
                            })
                          : change({
                              outcomes: [
                                ...m.outcomes,
                                {
                                  id: `out-${nanoid(8)}`,
                                  title: "New result",
                                  description: "",
                                  advice: "",
                                  ctaLabel: "Explore this option",
                                  ctaUrl: "",
                                  minPoints: 1,
                                },
                              ],
                            })
                      }
                    >
                      <Plus size={14} aria-hidden="true" className="inline-block mr-1" /> Add {m.kind === "scorecard" ? "category" : "result"}
                    </button>
                  </div>
                  {targets.map((target, index) => (
                    <details
                      className="rounded-xl border border-slate-200 p-4 space-y-4"
                      key={target.id}
                    >
                      <summary className="cursor-pointer font-semibold">
                        {target.title}
                      </summary>
                      <div className="flex justify-between gap-3">
                        <span className="text-xs text-slate-400">
                          {index + 1} · {target.id}
                        </span>
                        <button
                          aria-label={`Remove ${target.title}`}
                          className="text-xs text-rose-600"
                          onClick={() =>
                            change({
                              outcomes: m.outcomes.filter(
                                (o) => o.id !== target.id,
                              ),
                              categories: m.categories.filter(
                                (c) => c.id !== target.id,
                              ),
                              rules: m.rules.filter(
                                (r) => r.targetId !== target.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} aria-hidden="true" className="inline-block mr-1" />Remove
                        </button>
                      </div>
                      <Field
                        label="Title"
                        value={target.title}
                        onChange={(title) =>
                          m.kind === "scorecard"
                            ? change({
                                categories: m.categories.map((c) =>
                                  c.id === target.id ? { ...c, title } : c,
                                ),
                              })
                            : updateOutcome(target.id, { title })
                        }
                      />
                      <Field
                        label={
                          m.kind === "scorecard"
                            ? "Explanation & practical advice"
                            : "Result explanation"
                        }
                        multiline
                        value={target.description}
                        onChange={(description) =>
                          m.kind === "scorecard"
                            ? change({
                                categories: m.categories.map((c) =>
                                  c.id === target.id
                                    ? { ...c, description }
                                    : c,
                                ),
                              })
                            : updateOutcome(target.id, { description })
                        }
                      />
                      {m.kind === "scorecard" ? (
                        <label className="block text-sm">
                          Minimum scored answers
                          <input
                            className="hq-input mt-1"
                            type="number"
                            min={1}
                            max={200}
                            value={
                              m.categories.find((c) => c.id === target.id)!
                                .minAnswers
                            }
                            onChange={(e) =>
                              change({
                                categories: m.categories.map((c) =>
                                  c.id === target.id
                                    ? {
                                        ...c,
                                        minAnswers: Math.max(
                                          1,
                                          Number(e.target.value),
                                        ),
                                      }
                                    : c,
                                ),
                              })
                            }
                          />
                        </label>
                      ) : (
                        <>
                          {(() => {
                            const o = m.outcomes.find(
                              (o) => o.id === target.id,
                            )!;
                            return (
                              <>
                                <Field
                                  label="Useful first step"
                                  multiline
                                  value={o.advice}
                                  onChange={(advice) =>
                                    updateOutcome(o.id, { advice })
                                  }
                                />
                                <div className="grid sm:grid-cols-2 gap-3">
                                  <Field
                                    label="Button label"
                                    value={o.ctaLabel}
                                    onChange={(ctaLabel) =>
                                      updateOutcome(o.id, { ctaLabel })
                                    }
                                  />
                                  <Field
                                    label="Offer URL (optional)"
                                    value={o.ctaUrl}
                                    onChange={(ctaUrl) =>
                                      updateOutcome(o.id, { ctaUrl })
                                    }
                                  />
                                </div>
                                <label className="block text-sm">
                                  Minimum match points
                                  <input
                                    className="hq-input mt-1"
                                    type="number"
                                    min={1}
                                    value={o.minPoints}
                                    onChange={(e) =>
                                      updateOutcome(o.id, {
                                        minPoints: Math.max(
                                          1,
                                          Number(e.target.value),
                                        ),
                                      })
                                    }
                                  />
                                </label>
                              </>
                            );
                          })()}
                        </>
                      )}
                    </details>
                  ))}
                </section>
                <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Answer rules</h2>
                    <button
                      disabled={!targets.length || !choices.length}
                      className="hq-secondary"
                      onClick={() =>
                        change({
                          rules: [
                            ...m.rules,
                            {
                              id: `rule-${nanoid(8)}`,
                              questionId: choices[0].id,
                              answerId: choices[0].options![0].id,
                              targetId: targets[0].id,
                              effect: "add",
                              points: 1,
                              reason: "",
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={14} aria-hidden="true" className="inline-block mr-1" /> Add rule
                    </button>
                  </div>
                  <p className="text-sm text-slate-500">
                    Each selected answer contributes once. Use zero points for a
                    factual “not yet” answer; leave “not sure” unmapped.
                  </p>
                  {!choices.length && (
                    <p className="text-sm text-amber-700">
                      Add a choice question in Edit before creating rules.
                    </p>
                  )}
                  {m.rules.map((r, index) => {
                    const update = (p: Partial<typeof r>) =>
                      change({
                        rules: m.rules.map((x) =>
                          x.id === r.id ? { ...x, ...p } : x,
                        ),
                      });
                    const q = choices.find((q) => q.id === r.questionId);
                    return (
                      <details
                        className="border border-slate-200 rounded-xl p-4 space-y-3"
                        key={r.id}
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          {q?.options?.find((o) => o.id === r.answerId)
                            ?.label || "Choose an answer"}{" "}
                          → {r.effect === "exclude" ? "Exclude " : ""}
                          {targets.find((t) => t.id === r.targetId)?.title ||
                            "Choose a result"}
                        </summary>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-400">
                            Rule {index + 1}
                          </span>
                          <button
                            className="text-xs text-rose-600"
                            onClick={() =>
                              change({
                                rules: m.rules.filter((x) => x.id !== r.id),
                              })
                            }
                          >
                            <Trash2 size={14} aria-hidden="true" className="inline-block mr-1" />Remove rule
                          </button>
                        </div>
                        <label className="block text-sm">
                          When answering
                          <select
                            className="hq-input mt-1"
                            value={r.questionId}
                            onChange={(e) =>
                              update({
                                questionId: e.target.value,
                                answerId: choices.find(
                                  (q) => q.id === e.target.value,
                                )!.options![0].id,
                              })
                            }
                          >
                            {!q && (
                              <option value={r.questionId}>
                                Missing question — choose another
                              </option>
                            )}
                            {choices.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          Selected answer
                          <select
                            className="hq-input mt-1"
                            value={r.answerId}
                            onChange={(e) =>
                              update({ answerId: e.target.value })
                            }
                          >
                            {!q?.options?.some((o) => o.id === r.answerId) && (
                              <option value={r.answerId}>
                                Missing answer — choose another
                              </option>
                            )}
                            {q?.options?.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <label className="block text-sm">
                            {m.kind === "scorecard" ? "Category" : "Result"}
                            <select
                              className="hq-input mt-1"
                              value={r.targetId}
                              onChange={(e) =>
                                update({ targetId: e.target.value })
                              }
                            >
                              {targets.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm">
                            Effect
                            <select
                              className="hq-input mt-1"
                              value={r.effect}
                              onChange={(e) =>
                                update({
                                  effect: e.target.value as "add" | "exclude",
                                })
                              }
                            >
                              <option value="add">Add points</option>
                              {m.kind !== "scorecard" && (
                                <option value="exclude">
                                  Exclude this result
                                </option>
                              )}
                            </select>
                          </label>
                        </div>
                        {r.effect === "add" && (
                          <label className="block text-sm">
                            Points
                            <input
                              className="hq-input mt-1"
                              type="number"
                              min={0}
                              max={100}
                              value={r.points}
                              onChange={(e) =>
                                update({
                                  points: Math.max(
                                    0,
                                    Math.min(100, Number(e.target.value)),
                                  ),
                                })
                              }
                            />
                          </label>
                        )}
                        {m.kind !== "scorecard" && r.effect === "add" && (
                          <Field
                            label="Why this fits (shown when this rule matches)"
                            value={r.reason}
                            onChange={(reason) => update({ reason })}
                          />
                        )}
                      </details>
                    );
                  })}
                </section>
                <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="text-lg font-semibold">
                    Unsure or no-fit result
                  </h2>
                  <Field
                    label="Fallback title"
                    value={m.fallbackTitle}
                    onChange={(fallbackTitle) => change({ fallbackTitle })}
                  />
                  <Field
                    label="Fallback message"
                    multiline
                    value={m.fallbackMessage}
                    onChange={(fallbackMessage) => change({ fallbackMessage })}
                  />
                </section>
              </div>
              <aside className="space-y-5 order-first xl:order-last">
                <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="text-lg font-semibold">
                    Try an answer combination
                  </h2>
                  <p className="text-sm text-slate-500">
                    This simulator uses your unsaved draft. It creates no
                    response or lead. Use Preview to test the full question
                    flow.
                  </p>
                  {choices.map((q) => (
                    <label key={q.id} className="block text-sm">
                      {q.title}
                      {multiTypes.has(q.type) ? (
                        <div className="mt-2 space-y-2">
                          {q.options?.map((o) => (
                            <label key={o.id} className="flex gap-2">
                              <input
                                type="checkbox"
                                checked={
                                  Array.isArray(testAnswers[q.id]) &&
                                  (testAnswers[q.id] as string[]).includes(o.id)
                                }
                                onChange={(e) =>
                                  setTestAnswers((a) => ({
                                    ...a,
                                    [q.id]: e.target.checked
                                      ? [
                                          ...(Array.isArray(a[q.id])
                                            ? (a[q.id] as string[])
                                            : []),
                                          o.id,
                                        ]
                                      : (Array.isArray(a[q.id])
                                          ? (a[q.id] as string[])
                                          : []
                                        ).filter((id) => id !== o.id),
                                  }))
                                }
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <select
                          className="hq-input mt-1"
                          value={
                            typeof testAnswers[q.id] === "string"
                              ? (testAnswers[q.id] as string)
                              : ""
                          }
                          onChange={(e) =>
                            setTestAnswers((a) => ({
                              ...a,
                              [q.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Unanswered</option>
                          {q.options?.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  ))}
                </section>
                {simulated && (
                  <section className="bg-white rounded-2xl border border-slate-200 p-6">
                    <MarketingResultCard result={simulated} />
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
