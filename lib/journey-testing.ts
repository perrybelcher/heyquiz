import type { FormSchemaType, Question } from "./schema";
import { displayTypes, multiTypes, singleTypes, resolvePath, validationError, validateFormReferences, type Answers } from "./engine";
import { evaluateMarketing, validateMarketing } from "./marketing";
import { gradeQuizSubmission } from "./scoring";

export type ConversationTarget = "promise" | "questions" | "results" | "capture" | "design" | "publish";
export interface ConversationIssue {
  id: string;
  severity: "error" | "warning" | "note";
  message: string;
  target: ConversationTarget;
  questionId?: string;
}
export interface ConversationInspection { issues: ConversationIssue[] }
export interface JourneyCategoryResult {
  id: string;
  score: number | null;
  answered: number;
  applicable: number;
  minAnswers: number;
}
export interface JourneyCase {
  id: string;
  answers: Answers;
  questionIds: string[];
  resultTitle: string;
  resultId?: string;
  status: "matched" | "scored" | "no_match" | "completed" | "invalid";
  error?: string;
  score?: number;
  /** Stable IDs and saved numeric evidence, not editorial titles or advice. */
  categories?: JourneyCategoryResult[];
  resultSectionIds?: string[];
  /** Labels describe how this path was selected, not proof that a score boundary was reached. */
  targetedChecks?: string[];
  enumerated?: boolean;
}
export interface JourneySimulation {
  cases: JourneyCase[];
  /** Exact distinct terminal answer paths, only known after a complete discrete traversal. */
  totalCombinations: number | null;
  exhaustive: boolean;
  unsupportedQuestionIds: string[];
  reachedResultIds: string[];
  unreachedResultIds: string[];
  notes: string[];
  targetedCases: number;
  enumeratedCases: number;
}

const readableError = (error: unknown) => error instanceof Error ? error.message : "This journey could not be evaluated.";
const validUrl = (value: string) => { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname); } catch { return false; } };

/** Concrete editorial/configuration checks; these are not conversion predictions. */
export function inspectConversation(form: FormSchemaType): ConversationInspection {
  const issues: ConversationIssue[] = [];
  const add = (id: string, severity: ConversationIssue["severity"], target: ConversationTarget, message: string, questionId?: string) => issues.push({ id, severity, target, message, ...(questionId ? { questionId } : {}) });
  if (!form.title.trim()) add("quiz-title", "error", "promise", "Give your quiz a title.");
  if (form.coverPage?.enabled) {
    if (!form.coverPage.title.trim()) add("cover-title", "error", "promise", "Add the opening promise people will see before starting.");
    if (!form.coverPage.buttonText.trim()) add("cover-button", "error", "promise", "Add a label to the start button.");
    if (!form.coverPage.subtitle?.trim()) add("cover-context", "note", "promise", "Explain what someone will learn by completing this quiz.");
  }
  const inputs = form.questions.filter(q => !displayTypes.has(q.type));
  if (!inputs.length) add("questions-empty", "error", "questions", "Add at least one question people can answer.");
  const unscored: { questionId: string; count: number }[] = [];
  for (const q of inputs) {
    if (!q.title.trim()) add(`title-${q.id}`, "error", "questions", "A question is missing its title.", q.id);
    if (singleTypes.has(q.type) || multiTypes.has(q.type)) {
      if (!q.options?.length) add(`options-${q.id}`, "error", "questions", `“${q.title || "Untitled question"}” needs answer choices.`, q.id);
      else {
        if (q.options.some(o => !o.label.trim())) add(`labels-${q.id}`, "error", "questions", `“${q.title || "Untitled question"}” has an answer without a label.`, q.id);
        const labels = q.options.map(o => o.label.trim().toLowerCase()).filter(Boolean);
        if (new Set(labels).size !== labels.length) add(`duplicate-labels-${q.id}`, "warning", "questions", `“${q.title || "Untitled question"}” has identical answer labels. Make the choices distinct.`, q.id);
        if (form.marketing) {
          const count = q.options.filter(o => !form.marketing!.rules.some(r => r.questionId === q.id && r.answerId === o.id)).length;
          if (count) unscored.push({ questionId: q.id, count });
        }
      }
    }
  }
  // One factual reminder avoids treating every intentionally unscored question as a separate defect.
  if (unscored.length) add("unscored-answers", "note", "questions", `${unscored.reduce((sum, q) => sum + q.count, 0)} answers across ${unscored.length} question${unscored.length === 1 ? "" : "s"} have no result rules. They may be intentionally neutral; review their effect on the result if needed.`, unscored[0].questionId);
  try { validateFormReferences(form); } catch (error) { add("question-references", "error", "questions", readableError(error)); }
  for (const rule of form.logicRules || []) {
    if (rule.action === "jump_to_ending" && (!rule.targetOutcomeTierId || !form.outcomeTiers.some(t => t.id === rule.targetOutcomeTierId))) add(`ending-${rule.id}`, "error", "questions", "A jump rule needs an existing ending.", rule.sourceQuestionId);
    if (["show_question", "hide_question", "jump_to_question"].includes(rule.action) && !rule.targetQuestionId) add(`logic-target-${rule.id}`, "error", "questions", "A logic rule is missing its destination question.", rule.sourceQuestionId);
  }
  try { validateMarketing(form, true); } catch (error) { add("result-rules", "error", "results", readableError(error)); }
  const checkButton = (id: string, title: string, label: string | undefined, url: string | undefined, expected = false) => {
    if ((expected || label?.trim()) && !url?.trim()) add(`destination-${id}`, "warning", "results", `“${title}” needs a destination link if you want to show its next-step button.`);
    if (url?.trim() && !validUrl(url)) add(`url-${id}`, "error", "results", `“${title}” needs a complete HTTP or HTTPS destination URL.`);
    if (url?.trim() && !label?.trim()) add(`button-${id}`, "warning", "results", `“${title}” needs a clear next-step button label.`);
  };
  if (form.marketing) {
    const m = form.marketing;
    if (m.kind === "scorecard") {
      for (const band of m.scorecard?.bands || []) checkButton(band.id, band.title, band.ctaLabel, band.ctaUrl);
    } else for (const outcome of m.outcomes) {
      if (!outcome.title.trim()) add(`result-title-${outcome.id}`, "error", "results", "A result is missing its title.");
      if (!outcome.description.trim() && !outcome.advice.trim()) add(`result-explanation-${outcome.id}`, "warning", "results", `Explain why “${outcome.title}” is useful to the person receiving it.`);
      checkButton(outcome.id, outcome.title, outcome.ctaLabel, outcome.ctaUrl, true);
    }
    if (!m.fallbackTitle.trim() || !m.fallbackMessage.trim()) add("fallback", "warning", "results", "Add a helpful fallback for answers that do not match a recommendation.");
  } else {
    for (const tier of form.outcomeTiers) checkButton(tier.id, tier.title, tier.ctaText, tier.ctaUrl);
    if (form.endingPage) checkButton("ending", form.endingPage.title || "Final page", form.endingPage.buttonText, form.endingPage.redirectUrl);
  }
  if (form.capture?.enabled) {
    if (!form.capture.privacyUrl.trim()) add("capture-privacy", "warning", "capture", "Add your privacy information link beside contact capture.");
    else if (!validUrl(form.capture.privacyUrl)) add("capture-privacy-url", "error", "capture", "Contact capture needs a complete HTTP or HTTPS privacy URL.");
    if (!form.capture.title.trim() || !form.capture.buttonText.trim()) add("capture-label", "error", "capture", "Give contact capture a heading and a button label.");
  }
  const severityOrder = { error: 0, warning: 1, note: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return { issues };
}

interface AnswerDomain { values: unknown[]; complete: boolean }
/** Only use values exposed by finite choice controls; typed values are never fabricated. */
function answerDomain(q: Question): AnswerDomain | undefined {
  if (singleTypes.has(q.type)) {
    const options = q.options || [];
    return { values: [...(!q.required ? [undefined] : []), ...options.slice(0, 512).map(o => o.id)], complete: options.length <= 512 };
  }
  if (multiTypes.has(q.type)) {
    const options = q.options || [];
    if (options.length <= 9) {
      const values: unknown[] = [];
      for (let mask = q.required ? 1 : 0; mask < 2 ** options.length; mask++) values.push(options.filter((_, index) => mask & (1 << index)).map(o => o.id));
      return { values, complete: true };
    }
    // Large multi-select fields get individual picks plus the all-selected case, never a false exhaustive claim.
    return { values: [...(!q.required ? [[]] : []), ...options.slice(0, 510).map(o => [o.id]), options.map(o => o.id)], complete: false };
  }
  if (q.type === "terms" || q.type === "checkbox") return { values: q.required ? [true] : [undefined, false, true], complete: true };
  return undefined;
}

/** Evaluate one explicit finite-choice case using the same routing and scoring as the player. */
export function evaluateJourneyCase(form: FormSchemaType, answers: Answers): JourneyCase {
  let path: ReturnType<typeof resolvePath>;
  try { validateJourneyConfiguration(form); path = resolvePath(form, answers); }
  catch (error) { return { id: "explicit", answers: {}, questionIds: [], resultTitle: "Needs a manual check", status: "invalid", error: readableError(error) }; }
  const clean = Object.fromEntries(path.questions.filter(q => !displayTypes.has(q.type) && q.type !== "password" && answers[q.id] !== undefined).map(q => [q.id, answers[q.id]]));
  const invalid = (error: string): JourneyCase => ({ id: "explicit", answers: clean, questionIds: path.questions.map(q => q.id), resultTitle: "Needs a manual check", status: "invalid", error });
  for (const q of path.questions) {
    if (q.type === "captcha") return invalid("Security challenges require a manual check in Preview.");
    const error = validationError(q, answers[q.id]);
    if (error) return invalid(`${q.title || "Untitled question"}: ${error}${!answerDomain(q) ? " Enter this answer manually in Preview." : ""}`);
  }
  try {
    const marketing = evaluateMarketing(form, clean);
    const grade = gradeQuizSubmission(form, clean);
    const resultId = marketing ? marketing.outcomeId : grade.matchedTier?.id;
    return {
      id: "explicit", answers: clean, questionIds: path.questions.map(q => q.id),
      resultTitle: marketing?.title || grade.matchedTier?.title || form.endingPage?.title || "Completed",
      ...(resultId ? { resultId } : {}),
      categories: marketing?.categories.map(({ id, score, answered, applicable, minAnswers }) => ({ id, score, answered, applicable, minAnswers })) || [],
      resultSectionIds: marketing?.resultSections?.map(section => section.id) || [],
      status: marketing?.status || (form.mode === "quiz" && grade.totalPointsPossible > 0 ? "scored" : "completed"),
      ...(marketing ? typeof marketing.overallScore === "number" ? { score: marketing.overallScore } : {} : form.mode === "quiz" && grade.totalPointsPossible > 0 ? { score: grade.percentageScore } : {}),
    };
  } catch (error) { return invalid(readableError(error)); }
}

function validateJourneyConfiguration(form: FormSchemaType) {
  validateFormReferences(form);
  validateMarketing(form);
  if (!form.questions.some(q => !displayTypes.has(q.type))) throw Error("Add at least one answerable question before testing journeys.");
  for (const rule of form.logicRules || []) {
    if (rule.action === "jump_to_ending" && !form.outcomeTiers.some(t => t.id === rule.targetOutcomeTierId)) throw Error("A jump rule refers to a missing ending.");
    if (["show_question", "hide_question", "jump_to_question"].includes(rule.action) && !rule.targetQuestionId) throw Error("A logic rule is missing its destination question.");
  }
}

type Strategy = { label: string; kind: "first" | "last" | "unmapped" | "zero" | "low" | "high" | "mixed" | "target"; targetId?: string };
function representativeValue(form: FormSchemaType, q: Question, domain: AnswerDomain, strategy: Strategy, index: number): unknown {
  if (strategy.kind === "first") return domain.values[0];
  if (strategy.kind === "last") return domain.values[domain.values.length - 1];
  const ranked = domain.values.map(value => {
    const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    const allRules = (form.marketing?.rules || []).filter(r => r.questionId === q.id && selected.includes(r.answerId));
    const rules = strategy.targetId ? allRules.filter(r => r.targetId === strategy.targetId) : allRules;
    // Point totals are a sampling heuristic, never a prediction of the final outcome.
    const points = form.marketing ? rules.reduce((sum, r) => sum + (r.effect === "exclude" ? -100000 : r.points), 0)
      : selected.reduce((sum: number, id: string) => sum + (q.options?.find(o => o.id === id)?.isCorrect ? 1 : -1), 0);
    return { value, points, mapped: Boolean(rules.length), unmapped: selected.length > 0 && !allRules.length, zero: rules.length > 0 && rules.every(r => r.effect === "add" && r.points === 0) };
  });
  if (strategy.kind === "unmapped") return (ranked.find(v => v.unmapped) || ranked[0]).value;
  if (strategy.kind === "zero") return (ranked.find(v => v.zero) || [...ranked].filter(v => v.mapped).sort((a, b) => a.points - b.points)[0] || ranked[0]).value;
  const direction = strategy.kind === "low" || (strategy.kind === "mixed" && index % 2 === 0) ? 1 : -1;
  const mapped = ranked.filter(v => v.mapped);
  // When the only target rule excludes a product, prefer an unmapped answer for
  // a high-point probe rather than forcing the exclusion into that probe.
  const candidates = form.marketing && mapped.length && !(direction < 0 && mapped.every(v => v.points < 0)) ? mapped : ranked;
  return [...candidates].sort((a, b) => direction * (a.points - b.points))[0].value;
}

/**
 * Representative paths run before traversal so a cap cannot silently exclude all
 * zero, high, or unmapped answers. They supplement enumeration; only a completed
 * discrete traversal proves finite-path coverage. Both share a bounded work budget.
 */
export function simulateJourneys(form: FormSchemaType, limit = 256): JourneySimulation {
  const cap = Number.isFinite(limit) ? Math.max(1, Math.min(512, Math.floor(limit))) : 256;
  const cases: JourneyCase[] = [], byPath = new Map<string, JourneyCase>();
  const unsupported = new Set(form.questions.filter(q => q.type === "hidden").map(q => q.id)), reached = new Set<string>();
  const notes = ["Local simulation only. No responses are submitted, no emails are sent, and no tracking events are recorded."];
  let truncated = false, partialDomain = false, visits = 0, badConfiguration = false;
  const nodeBudget = Math.min(8192, Math.max(32, Math.floor(10_000_000 / Math.max(1, form.questions.length * ((form.logicRules?.length || 0) + 1)))));
  const resultIds = form.marketing
    ? form.marketing.kind === "scorecard" ? (form.marketing.scorecard?.bands || []).map(b => b.id) : form.marketing.outcomes.map(o => o.id)
    : form.outcomeTiers.map(t => t.id);
  const add = (entry: JourneyCase, label?: string) => {
    const key = JSON.stringify([Object.entries(entry.answers).sort(([a], [b]) => a.localeCompare(b)), entry.questionIds, entry.status, entry.error]);
    const existing = byPath.get(key);
    if (existing) {
      if (label && !existing.targetedChecks?.includes(label)) (existing.targetedChecks ||= []).push(label);
      if (!label) existing.enumerated = true;
      return;
    }
    if (cases.length >= cap) { truncated = true; return; }
    const item = { ...entry, id: `journey-${cases.length + 1}`, ...(label ? { targetedChecks: [label] } : { enumerated: true }) };
    cases.push(item); byPath.set(key, item);
    if (item.resultId) reached.add(item.resultId);
  };
  const invalid = (answers: Answers, ids: string[], error: string): JourneyCase => ({ id: "invalid", answers, questionIds: ids, resultTitle: "Needs a manual check", status: "invalid", error });
  const visit = (answers: Answers, visited: Set<string>, strategy?: Strategy) => {
    if (++visits > nodeBudget) { truncated = true; return; }
    let path: ReturnType<typeof resolvePath>;
    try { path = resolvePath(form, answers); } catch (error) { add(invalid(answers, [...visited], readableError(error)), strategy?.label); badConfiguration = true; return; }
    const next = path.questions.find(q => !displayTypes.has(q.type) && !visited.has(q.id));
    if (!next) { add(evaluateJourneyCase(form, answers), strategy?.label); return; }
    const nextVisited = new Set(visited).add(next.id);
    const domain = answerDomain(next);
    if (!domain) {
      unsupported.add(next.id);
      if (next.required || next.type === "captcha") add(invalid(answers, path.questions.slice(0, path.questions.findIndex(q => q.id === next.id) + 1).map(q => q.id), `“${next.title || "Untitled question"}” requires a manual answer in Preview (${next.type.replaceAll("_", " ")}).`), strategy?.label);
      else visit(answers, nextVisited, strategy);
      return;
    }
    if (!domain.complete) partialDomain = true;
    if (!domain.values.length) { add(invalid(answers, path.questions.map(q => q.id), `“${next.title || "Untitled question"}” has no available answer choices.`), strategy?.label); badConfiguration = true; return; }
    const values = strategy ? [representativeValue(form, next, domain, strategy, visited.size)] : domain.values;
    for (const value of values) {
      visit(value === undefined ? answers : { ...answers, [next.id]: value }, nextVisited, strategy);
      if (truncated) break;
    }
  };
  try { validateJourneyConfiguration(form); }
  catch (error) { badConfiguration = true; add(invalid({}, [], readableError(error))); }
  if (!badConfiguration) {
    const strategies: Strategy[] = [
      { kind: "first", label: "First / optional skipped answers" },
      ...(form.marketing ? [{ kind: "unmapped" as const, label: "No-rule answers where available" }, { kind: "zero" as const, label: "Explicit zero-point answers where available" }] : []),
      { kind: "high", label: "Highest mapped points per question" },
      { kind: "low", label: "Lowest mapped points per question" },
      { kind: "mixed", label: "Alternating low / high points" },
      { kind: "last", label: "Last available answers" },
      ...(form.marketing?.kind === "scorecard" ? form.marketing.categories : form.marketing?.outcomes || []).map(t => ({ kind: "target" as const, label: `Favor “${t.title}” mapped points`, targetId: t.id })),
    ];
    // Leave room for enumeration even when callers request a very small sample.
    for (const strategy of strategies.slice(0, Math.max(1, Math.min(48, Math.floor(cap / 2))))) {
      visit({}, new Set(), strategy);
      if (truncated || badConfiguration) break;
    }
    if (!truncated && !badConfiguration) visit({}, new Set());
  }
  const exhaustive = !truncated && !partialDomain && !unsupported.size && !badConfiguration;
  const targetedCases = cases.filter(c => c.targetedChecks?.length).length;
  const enumeratedCases = cases.filter(c => c.enumerated).length;
  if (targetedCases) notes.push(`${targetedCases} distinct representative paths checked first (low, high, mixed, or unmapped choices where available). These selections are not proof of every score boundary or result.`);
  if (truncated) notes.push(`Testing stopped at the ${cap}-case or complexity limit. These cases are a bounded sample, not every possible journey.`);
  if (partialDomain) notes.push("Large choice fields were sampled. Their complete answer combinations have not been tested.");
  if (unsupported.size) notes.push("Typed inputs, URL-prefilled hidden fields, matrices, rankings, files, and security challenges are not generated. Required fields stop that simulated journey; optional fields are skipped. Complete those paths manually in Preview.");
  if (form.capture?.enabled) notes.push("Contact capture is not submitted or validated by this scoring simulation. Test its fields and sign-up experience separately in Preview.");
  if (form.settings.shuffleQuestions) notes.push("Question-order randomization is not exercised; this checks the configured answer and scoring paths.");
  if (form.settings.timerMinutes) notes.push("Timed-out submissions are not simulated.");
  if (exhaustive) notes.push(`All ${cases.length} discrete answer journeys were evaluated using the quiz's current branching and scoring rules.`);
  const unreachedResultIds = resultIds.filter(id => !reached.has(id));
  if (unreachedResultIds.length) notes.push(exhaustive ? "Some configured results were not reached by any of the complete discrete journeys checked." : "Some configured results were not observed in these cases. This does not prove they are unreachable.");
  return { cases, totalCombinations: exhaustive ? cases.length : null, exhaustive, unsupportedQuestionIds: [...unsupported], reachedResultIds: [...reached], unreachedResultIds, notes, targetedCases, enumeratedCases };
}
