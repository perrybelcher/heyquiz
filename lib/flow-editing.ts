import type { FormSchemaType } from "./schema";
import { singleTypes, multiTypes } from "./engine";
import { removeGuidedQuestion } from "./guided-editing";
import type { FlowDestination, FlowRoute } from "./flow-routing";

export const automatic: FlowDestination = { kind: "automatic" };
export function routeOwner(form: FormSchemaType, questionId: string): string {
  const q = form.questions.find((q) => q.id === questionId);
  return form.settings.presentation === "page"
    ? q?.pageId || form.pages?.[0]?.id || "default"
    : questionId;
}
export function destinationKey(d: FlowDestination): string {
  return d.kind === "automatic" ? "automatic" : `${d.kind}:${d.id}`;
}
export function parseDestination(value: string): FlowDestination {
  if (value === "automatic") return automatic;
  const split = value.indexOf(":");
  return {
    kind: value.slice(0, split) as "question" | "page" | "tier" | "outcome",
    id: value.slice(split + 1),
  };
}
export function destinationChoices(
  form: FormSchemaType,
): { value: string; label: string }[] {
  return [
    { value: "automatic", label: "Calculate result" },
    ...(form.settings.presentation === "page" && form.pages?.length
      ? form.pages.map((p) => ({
          value: `page:${p.id}`,
          label: `Page: ${p.title || p.id}`,
        }))
      : form.questions.map((q) => ({
          value: `question:${q.id}`,
          label: q.title || "Untitled question",
        }))),
    ...(!["knowledge", "scorecard"].includes(form.quizType || "")
      ? (form.marketing?.outcomes || []).map((o) => ({
          value: `outcome:${o.id}`,
          label: `Show result: ${o.title}`,
        }))
      : []),
    ...(!form.marketing && !["knowledge", "scorecard"].includes(form.quizType || "")
      ? form.outcomeTiers.map((t) => ({
          value: `tier:${t.id}`,
          label: `Show ending: ${t.title}`,
        }))
      : []),
  ];
}
export function updateRoute(
  form: FormSchemaType,
  owner: string,
  route: FlowRoute,
): FormSchemaType {
  if (!form.routing) return form;
  return {
    ...form,
    routing: {
      ...form.routing,
      routes: { ...form.routing.routes, [owner]: route },
    },
  };
}
export function connectAnswer(
  form: FormSchemaType,
  questionId: string,
  optionId: string,
  destination: FlowDestination | undefined,
): FormSchemaType {
  const owner = routeOwner(form, questionId),
    route = form.routing?.routes[owner] || { rules: [] };
  const rules = route.rules.filter(
    (r) =>
      !(
        r.conditions.length === 1 &&
        r.conditions[0].questionId === questionId &&
        r.conditions[0].operator === "equals" &&
        r.conditions[0].value === optionId
      ),
  );
  if (destination)
    rules.unshift({
      id: `answer-${questionId}-${optionId}`,
      match: "all",
      conditions: [{ questionId, operator: "equals", value: optionId }],
      destination,
    });
  return updateRoute(form, owner, { ...route, rules });
}
/** Removal is reconciled atomically so incoming edges cannot silently use their defaults. */
export function removeQuestion(form: FormSchemaType, id: string): FormSchemaType {
  if (!form.questions.some(q => q.id === id)) return form;
  return reconcileFlowEdit(form, removeGuidedQuestion(form, id));
}

/**
 * Shared by every editor. A removed rule is an unresolved route, not permission
 * to fall through to a different result. Content-only changes preserve identity
 * so canvas history can distinguish its own commands from external reloads.
 */
export function reconcileFlowEdit(previous: FormSchemaType, next: FormSchemaType): FormSchemaType {
  if (!previous.routing || !next.routing) return next;
  const questions = new Map(next.questions.map(q => [q.id, q]));
  const owners = new Set(next.questions.map(q => routeOwner(next, q.id)));
  const validDestination = (d: FlowDestination): boolean => {
    switch (d.kind) {
      case "automatic": return true;
      case "question": return questions.has(d.id);
      case "page": return owners.has(d.id);
      case "tier": return !next.marketing && !["knowledge", "scorecard"].includes(next.quizType || "") && next.outcomeTiers.some(t => t.id === d.id);
      case "outcome": return next.marketing?.kind !== "scorecard" && !!next.marketing?.outcomes.some(o => o.id === d.id);
    }
  };
  const validCondition = (c: import("./flow-routing").FlowCondition): boolean => {
    const q = questions.get(c.questionId);
    if (!q) return false;
    if (!["equals", "not_equals"].includes(c.operator) || (!singleTypes.has(q.type) && !multiTypes.has(q.type))) return true;
    // Preserve legacy label conditions until explicitly edited; avoid breaking
    // migrations or silently discarding rules during unrelated text changes.
    const old = previous.questions.find(item => item.id === q.id);
    const legacyLabel = old?.options?.some(o => o.label === c.value && !old.options?.some(option => option.id === c.value));
    return !!q.options?.some(o => o.id === c.value || (legacyLabel && o.label === c.value));
  };
  let changed = false;
  const routes: Record<string, FlowRoute> = {};
  for (const [owner, route] of Object.entries(next.routing.routes)) {
    if (!owners.has(owner)) { changed = true; continue; }
    const rules = route.rules.filter(rule => validDestination(rule.destination) && rule.conditions.every(validCondition));
    const invalidated = rules.length !== route.rules.length;
    const defaultDestination = !invalidated && route.default && validDestination(route.default) ? route.default : undefined;
    if (invalidated || defaultDestination !== route.default) {
      routes[owner] = { ...route, rules, default: defaultDestination };
      changed = true;
    } else routes[owner] = route;
  }
  const visibility: NonNullable<typeof next.routing.visibility> = {};
  for (const [id, rules] of Object.entries(next.routing.visibility || {})) {
    if (!questions.has(id)) { changed = true; continue; }
    const validRules = rules.filter(rule => rule.conditions.every(validCondition));
    if (validRules.length !== rules.length) {
      changed = true;
      // Losing a visibility predicate requires review before publication.
      const owner = routeOwner(next, id);
      if (routes[owner]) routes[owner] = { ...routes[owner], default: undefined };
    }
    if (validRules.length) visibility[id] = validRules.length === rules.length ? rules : validRules;
    else if (rules.length) changed = true;
  }
  let editorLayout = next.editorLayout;
  if (editorLayout) {
    const removedIds = previous.questions.filter(q => !questions.has(q.id)).map(q => q.id);
    if (removedIds.some(id => id in editorLayout!.positions)) {
      const positions = { ...editorLayout.positions };
      removedIds.forEach(id => delete positions[id]);
      editorLayout = { ...editorLayout, positions };
      changed = true;
    }
  }
  if (!changed) return next;
  return {
    ...next,
    routing: { ...next.routing, routes, visibility: next.routing.visibility ? visibility : undefined },
    editorLayout,
  };
}
