"use client";
import type { FormSchemaType, LogicOperator } from "@/lib/schema";
import type { FlowVisibility } from "@/lib/flow-routing";

type Props = {
  form: FormSchemaType;
  questionId: string;
  onChange: (form: FormSchemaType) => void;
};
export default function VisibilityEditor({
  form,
  questionId,
  onChange,
}: Props) {
  if (!form.routing) return null;
  const rules = form.routing.visibility?.[questionId] || [];
  const change = (next: FlowVisibility[]) =>
    onChange({
      ...form,
      routing: {
        ...form.routing!,
        visibility: { ...form.routing?.visibility, [questionId]: next },
      },
    });
  const patch = (index: number, value: Partial<FlowVisibility>) =>
    change(rules.map((r, i) => (i === index ? { ...r, ...value } : r)));
  return (
    <details>
      <summary>Question visibility ({rules.length})</summary>
      <p>
        Visibility uses valid answers from previously visited screens. Hidden
        questions follow their Otherwise connection.
      </p>
      {rules.map((rule, index) => (
        <section className="flow-rule" key={index}>
          <label>
            Visibility
            <select
              value={rule.effect}
              onChange={(e) =>
                patch(index, { effect: e.target.value as "show" | "hide" })
              }
            >
              <option value="show">Show only when</option>
              <option value="hide">Hide when</option>
            </select>
          </label>
          <label>
            Match
            <select
              value={rule.match}
              onChange={(e) =>
                patch(index, { match: e.target.value as "all" | "any" })
              }
            >
              <option value="all">All conditions</option>
              <option value="any">Any condition</option>
            </select>
          </label>
          {rule.conditions.map((condition, ci) => {
            const question = form.questions.find(
                (q) => q.id === condition.questionId,
              ),
              update = (value: Partial<typeof condition>) =>
                patch(index, {
                  conditions: rule.conditions.map((c, j) =>
                    j === ci ? { ...c, ...value } : c,
                  ),
                });
            return (
              <div key={ci}>
                <label>
                  Earlier question
                  <select
                    value={condition.questionId}
                    onChange={(e) =>
                      update({ questionId: e.target.value, value: undefined })
                    }
                  >
                    {form.questions
                      .filter((q) => q.id !== questionId)
                      .map((q) => (
                        <option value={q.id} key={q.id}>
                          {q.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Condition
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      update({ operator: e.target.value as LogicOperator })
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
                    ].map((op) => (
                      <option key={op} value={op}>
                        {op.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                {!["is_answered", "is_not_answered"].includes(
                  condition.operator,
                ) && (
                  <label>
                    Answer or value
                    {question?.options?.length &&
                    condition.operator !== "contains" ? (
                      <select
                        value={condition.value || ""}
                        onChange={(e) => update({ value: e.target.value })}
                      >
                        <option value="">Choose answer</option>
                        {question.options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        defaultValue={condition.value || ""}
                        onBlur={(e) => update({ value: e.target.value })}
                      />
                    )}
                  </label>
                )}
                <button
                  onClick={() =>
                    patch(index, {
                      conditions: rule.conditions.filter((_, j) => j !== ci),
                    })
                  }
                >
                  Remove condition
                </button>
              </div>
            );
          })}
          <button
            onClick={() =>
              patch(index, {
                conditions: [
                  ...rule.conditions,
                  {
                    questionId:
                      form.questions.find((q) => q.id !== questionId)?.id ||
                      questionId,
                    operator: "is_answered",
                  },
                ],
              })
            }
          >
            Add condition
          </button>
          <button onClick={() => change(rules.filter((_, i) => i !== index))}>
            Remove visibility rule
          </button>
        </section>
      ))}
      <button
        onClick={() =>
          change([
            ...rules,
            {
              effect: "show",
              match: "all",
              conditions: [
                {
                  questionId:
                    form.questions.find((q) => q.id !== questionId)?.id ||
                    questionId,
                  operator: "is_answered",
                },
              ],
            },
          ])
        }
      >
        Add visibility rule
      </button>
    </details>
  );
}
