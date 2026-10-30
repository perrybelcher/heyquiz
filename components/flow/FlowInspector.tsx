"use client";
import { useState, useEffect, useRef } from "react";
import { X, Plus, ArrowUp, ArrowDown } from "lucide-react";
import VisibilityEditor from "./VisibilityEditor";
import "./flow-inspector.css";
import { singleTypes, multiTypes } from "@/lib/engine";
import { removeGuidedAnswer } from "@/lib/guided-editing";
import { nanoid } from "nanoid";
import type { FormSchemaType, LogicOperator, QuestionType } from "@/lib/schema";
import type { FlowDestination, FlowTransition } from "@/lib/flow-routing";
import {
  connectAnswer,
  destinationChoices,
  destinationKey,
  parseDestination,
  routeOwner,
  updateRoute,
} from "@/lib/flow-editing";
type Props = {
  form: FormSchemaType;
  id: string;
  readOnly: boolean;
  onChange: (form: FormSchemaType) => void;
  onClose: () => void;
  connect: (id: string, handle: string, destination: FlowDestination) => void;
  onDelete: () => void;
};
export default function FlowInspector({
  form,
  id,
  readOnly,
  onChange,
  onClose,
  connect,
  onDelete,
}: Props) {
  const [error, setError] = useState("");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  const q = form.questions.find((q) => q.id === id),
    outcome = id.startsWith("outcome:")
      ? form.marketing?.outcomes.find((o) => o.id === id.slice(8))
      : undefined;
  const tier = id.startsWith("tier:")
    ? form.outcomeTiers.find((t) => t.id === id.slice(5))
    : undefined;
  const [title, setTitle] = useState(
    q?.title || outcome?.title || tier?.title || "",
  );
  const owner = id.startsWith("page:") ? id.slice(5) : routeOwner(form, id),
    route = form.routing?.routes[owner] || { rules: [] },
    choices = destinationChoices(form);
  const choiceQuestion = !!q && (singleTypes.has(q.type) || multiTypes.has(q.type));
  // Keep the answer representation stable when changing an existing block.
  // Other types are available when adding a new question.
  const compatibleTypes: QuestionType[] = !q ? [] : singleTypes.has(q.type)
    ? Array.from(new Set([q.type, "multiple_choice", "dropdown"])) as QuestionType[]
    : multiTypes.has(q.type)
      ? Array.from(new Set([q.type, "multiselect"])) as QuestionType[]
      : ["short_answer", "paragraph"].includes(q.type)
        ? ["short_answer", "paragraph"]
        : [q.type];
  const typeName = (type: string) => ({
    multiple_choice: "Single choice", multiselect: "Multiple answers",
    short_answer: "Short answer", paragraph: "Long answer", dropdown: "Dropdown",
  }[type] || type.replaceAll("_", " "));
  const saveTitle = () => {
    if (tier) {
      onChange({
        ...form,
        outcomeTiers: form.outcomeTiers.map((t) =>
          t.id === tier.id ? { ...t, title } : t,
        ),
      });
      return;
    }
    if (q)
      onChange({
        ...form,
        questions: form.questions.map((n) =>
          n.id === id ? { ...n, title } : n,
        ),
      });
    else if (outcome && form.marketing)
      onChange({
        ...form,
        marketing: {
          ...form.marketing,
          outcomes: form.marketing.outcomes.map((o) =>
            o.id === outcome.id ? { ...o, title } : o,
          ),
        },
      });
  };
  const rules = (next: FlowTransition[]) =>
    onChange(updateRoute(form, owner, { ...route, rules: next }));
  const patch = (index: number, update: Partial<FlowTransition>) =>
    rules(route.rules.map((r, i) => (i === index ? { ...r, ...update } : r)));
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      className="flow-inspector"
      aria-label="Flow editor"
    >
      <header>
        <h2>
          {id === "automatic"
            ? "Calculated result"
            : id.startsWith("page:")
            ? "Page routing"
            : outcome || tier
              ? "Edit result"
              : "Edit question"}
        </h2>
        <button
          aria-label="Close question editor"
          onClick={() => {
            if (title !== (q?.title || outcome?.title || tier?.title || ""))
              saveTitle();
            onClose();
          }}
        >
          <X size={20} />
        </button>
      </header>
      <p className="flow-inspector-hint">{readOnly ? "Upgrade routing to edit this draft." : "Changes save with your quiz. Use Undo to reverse an edit."}</p>
      {error && <p role="alert">{error}</p>}
      {id === "automatic" && <p>This step calculates the result using your quiz’s scoring and matching rules. Edit result content and matching in the builder’s Results step. Each respondent still receives the result calculated from their answers.</p>}
      <fieldset disabled={readOnly}>
        {(q || outcome || tier) && (
          <label>
            {q ? "Question" : "Title"}
            <textarea
              rows={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title !== (q?.title || outcome?.title || tier?.title))
                  saveTitle();
              }}
            />
          </label>
        )}
        {(outcome || tier) && (
          <>
            <p>
              Connecting directly to this result bypasses automatic matching.
              Required contact capture still applies.
            </p>
            {(outcome
              ? ["description", "advice", "ctaLabel", "ctaUrl"]
              : ["message", "ctaText", "ctaUrl"]
            ).map((field) => (
              <label key={field}>
                {
                  (
                    {
                      description: "Explanation",
                      advice: "Advice",
                      ctaLabel: "Button label",
                      ctaText: "Button label",
                      ctaUrl: "Button URL",
                      message: "Explanation",
                    } as Record<string, string>
                  )[field]
                }
                <textarea
                  defaultValue={String(
                    ((outcome || tier) as unknown as Record<string, unknown>)[
                      field
                    ] || "",
                  )}
                  onBlur={(e) => {
                    if (outcome && form.marketing)
                      onChange({
                        ...form,
                        marketing: {
                          ...form.marketing,
                          outcomes: form.marketing.outcomes.map((o) =>
                            o.id === outcome.id
                              ? { ...o, [field]: e.target.value }
                              : o,
                          ),
                        },
                      });
                    else if (tier)
                      onChange({
                        ...form,
                        outcomeTiers: form.outcomeTiers.map((t) =>
                          t.id === tier.id
                            ? { ...t, [field]: e.target.value }
                            : t,
                        ),
                      });
                  }}
                />
              </label>
            ))}
          </>
        )}
        {q && (
          <>
            <label>
              Question type
              <select
                value={q.type}
                disabled={compatibleTypes.length === 1}
                onChange={(e) =>
                  onChange({
                    ...form,
                    questions: form.questions.map((n) =>
                      n.id === id
                        ? { ...n, type: e.target.value as QuestionType }
                        : n,
                    ),
                  })
                }
              >
                {compatibleTypes.map((type) => (
                  <option key={type} value={type}>
                    {typeName(type)}
                  </option>
                ))}
              </select>
            </label>
            <p>To use a different answer format, add a new question. Existing connections stay tied to their answer IDs.</p>
            <label>
              <input
                type="checkbox"
                checked={!!q.required}
                onChange={(e) =>
                  onChange({
                    ...form,
                    questions: form.questions.map((n) =>
                      n.id === id ? { ...n, required: e.target.checked } : n,
                    ),
                  })
                }
              />
              Required question
            </label>
          </>
        )}
        {choiceQuestion && <section className="flow-answer-intro" aria-label="Answer routing help">
          <h3>Answers & destinations</h3>
          <p>{q && multiTypes.has(q.type) ? "People can select more than one answer. Conditions run in order; the first match determines their path." : "Choose where each answer leads. You can connect several answers to the same destination."}</p>
        </section>}
        {choiceQuestion && q?.options?.map((a, i) => (
          <div className="flow-answer-edit" key={a.id} role="group" aria-label={`Answer ${String.fromCharCode(65 + i)}`}>
            <label>
              Answer {String.fromCharCode(65 + i)}
              <input
                defaultValue={a.label}
                key={`${a.id}:${a.label}`}
                onBlur={(e) => {
                  if (e.target.value !== a.label)
                    onChange({
                      ...form,
                      questions: form.questions.map((n) =>
                        n.id === id
                          ? {
                              ...n,
                              options: n.options?.map((o) =>
                                o.id === a.id
                                  ? { ...o, label: e.target.value }
                                  : o,
                              ),
                            }
                          : n,
                      ),
                    });
                }}
              />
            </label>
            <label>
              Then go to
              <select
                value={(() => {
                  const d = route.rules.find(
                    (r) =>
                      r.conditions.length === 1 &&
                      r.conditions[0].questionId === id &&
                      r.conditions[0].value === a.id &&
                      r.conditions[0].operator === "equals",
                  )?.destination;
                  return d ? destinationKey(d) : "";
                })()}
                onChange={(e) =>
                  e.target.value
                    ? connect(id, a.id, parseDestination(e.target.value))
                    : onChange(connectAnswer(form, id, a.id, undefined))
                }
              >
                <option value="">
                  {route.default
                    ? "Use Otherwise destination"
                    : "Unconnected — choose destination"}
                </option>
                {choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="flow-remove-answer"
              aria-label={`Remove answer ${String.fromCharCode(65 + i)}`}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove answer “${a.label}” and its affected routes?`,
                  )
                ) {
                  try {
                    onChange(removeGuidedAnswer(form, id, a.id));
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Could not remove answer",
                    );
                  }
                }
              }}
            >
              Remove answer
            </button>
          </div>
        ))}
        {choiceQuestion && q && (
          <button
            className="flow-add-answer"
            onClick={() =>
              onChange({
                ...form,
                questions: form.questions.map((n) =>
                  n.id === id
                    ? {
                        ...n,
                        options: [
                          ...(n.options || []),
                          { id: nanoid(10), label: "New answer" },
                        ],
                      }
                    : n,
                ),
              })
            }
          >
            <Plus size={17} />
            Add answer
          </button>
        )}
        {(outcome || tier) && (
          <button className="flow-delete" onClick={onDelete}>
            Delete result and affected routes
          </button>
        )}
        {(q || id.startsWith("page:")) && (
          <>
            <label>
              {id.startsWith("page:") ? "After Continue" : choiceQuestion ? "Default destination" : "Next destination"}
              <select
                aria-label="Otherwise / Continue"
                value={route.default ? destinationKey(route.default) : ""}
                onChange={(e) =>
                  onChange(
                    updateRoute(form, owner, {
                      ...route,
                      default: e.target.value
                        ? parseDestination(e.target.value)
                        : undefined,
                    }),
                  )
                }
              >
                <option value="">Unconnected — needs review</option>
                {choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="flow-default-help">{choiceQuestion ? "Answers without their own connection follow this default. Conditions can override it; the first matching rule wins." : "This is where people continue after this block."}</p>
            <details>
              <summary>Conditions and priority ({route.rules.length})</summary>
              <p>
                Rules run from top to bottom. First match wins, including
                multiple selected answers. Page routes run after Continue.
              </p>
              {route.rules.map((r, index) => (
                <section className="flow-rule" key={r.id}>
                  <div className="flow-tools">
                    <strong>Rule {index + 1}</strong>
                    <button
                      aria-label="Move rule up"
                      disabled={!index}
                      onClick={() => {
                        const n = [...route.rules];
                        [n[index - 1], n[index]] = [n[index], n[index - 1]];
                        rules(n);
                      }}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      aria-label="Move rule down"
                      disabled={index === route.rules.length - 1}
                      onClick={() => {
                        const n = [...route.rules];
                        [n[index + 1], n[index]] = [n[index], n[index + 1]];
                        rules(n);
                      }}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      onClick={() =>
                        rules(route.rules.filter((x) => x.id !== r.id))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <label>
                    Match
                    <select
                      value={r.match}
                      onChange={(e) =>
                        patch(index, { match: e.target.value as "all" | "any" })
                      }
                    >
                      <option value="all">All conditions</option>
                      <option value="any">Any condition</option>
                    </select>
                  </label>
                  {r.conditions.map((c, ci) => {
                    const update = (p: Partial<typeof c>) =>
                      patch(index, {
                        conditions: r.conditions.map((n, j) =>
                          j === ci ? { ...n, ...p } : n,
                        ),
                      });
                    return (
                      <div key={ci}>
                        <label>
                          Question
                          <select
                            value={c.questionId}
                            onChange={(e) =>
                              update({ questionId: e.target.value })
                            }
                          >
                            {form.questions.map((n) => (
                              <option value={n.id} key={n.id}>
                                {n.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Operator
                          <select
                            value={c.operator}
                            onChange={(e) =>
                              update({
                                operator: e.target.value as LogicOperator,
                              })
                            }
                          >
                            {[
                              "equals",
                              "not_equals",
                              "contains",
                              "greater_than",
                              "less_than",
                              "is_answered",
                              "is_not_answered",
                            ].map((o) => (
                              <option key={o} value={o}>
                                {o.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!["is_answered", "is_not_answered"].includes(
                          c.operator,
                        ) && (
                          <label>
                            Answer or value
                            {form.questions.find((n) => n.id === c.questionId)
                              ?.options?.length && c.operator !== "contains" ? (
                              <select
                                value={c.value || ""}
                                onChange={(e) =>
                                  update({ value: e.target.value })
                                }
                              >
                                <option value="">Choose answer</option>
                                {form.questions
                                  .find((n) => n.id === c.questionId)
                                  ?.options?.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.label}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <input
                                type={
                                  ["greater_than", "less_than"].includes(
                                    c.operator,
                                  )
                                    ? "number"
                                    : "text"
                                }
                                defaultValue={c.value || ""}
                                onBlur={(e) =>
                                  update({ value: e.target.value })
                                }
                              />
                            )}
                          </label>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() =>
                      patch(index, {
                        conditions: [
                          ...r.conditions,
                          {
                            questionId: q?.id || form.questions[0]?.id || "",
                            operator: "is_answered",
                          },
                        ],
                      })
                    }
                  >
                    Add condition
                  </button>
                  <label>
                    Destination
                    <select
                      value={destinationKey(r.destination)}
                      onChange={(e) =>
                        patch(index, {
                          destination: parseDestination(e.target.value),
                        })
                      }
                    >
                      {choices.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              ))}
              <button
                onClick={() =>
                  rules([
                    ...route.rules,
                    {
                      id: nanoid(12),
                      conditions: [
                        {
                          questionId: q?.id || form.questions[0]?.id || "",
                          operator: "is_answered",
                        },
                      ],
                      match: "all",
                      destination: { kind: "automatic" },
                    },
                  ])
                }
              >
                Add rule
              </button>
            </details>
            {q && <VisibilityEditor form={form} questionId={q.id} onChange={onChange} />}
            <details className="flow-quiz-settings">
              <summary>Quiz settings</summary>
              <p>The entry is the first screen shown when someone starts this quiz.</p>
              {form.routing && (
                <label>
                  Quiz entry
                  <select
                    value={destinationKey(form.routing.entry)}
                    onChange={(e) =>
                      onChange({
                        ...form,
                        routing: {
                          ...form.routing!,
                          entry: parseDestination(e.target.value),
                        },
                      })
                    }
                  >
                    {choices.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </details>
            {(q || outcome || tier) && (
              <button className="flow-delete" onClick={onDelete}>
                Delete block and affected routes
              </button>
            )}
          </>
        )}
      </fieldset>
    </aside>
  );
}
