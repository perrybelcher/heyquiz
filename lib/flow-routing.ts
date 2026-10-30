import { z } from 'zod';
import type { FormSchemaType, Question, LogicOperator } from './schema';
import { evaluateCondition, isAnswered, orderedQuestions, validationError, singleTypes, type Answers } from './engine';
import { ValidationError } from './errors';
export type FlowDestination = {
    kind: 'question' | 'page' | 'tier' | 'outcome';
    id: string;
} | {
    kind: 'automatic';
};
export interface FlowCondition {
    questionId: string;
    operator: LogicOperator;
    value?: string;
}
export interface FlowTransition {
    id: string;
    conditions: FlowCondition[];
    match: 'all' | 'any';
    destination: FlowDestination;
}
export interface FlowRoute {
    rules: FlowTransition[];
    default?: FlowDestination;
}
export interface FlowVisibility {
    match: 'all' | 'any';
    conditions: FlowCondition[];
    effect: 'show' | 'hide';
}
export interface FlowRouting {
    version: 1;
    entry: FlowDestination;
    routes: Record<string, FlowRoute>;
    visibility?: Record<string, FlowVisibility[]>;
}
export interface FlowEditorLayout {
    version: 1;
    positions: Record<string, {
        x: number;
        y: number;
    }>;
}
export const FlowDestinationSchema = z.union([z.object({
        kind: z.enum(['question', 'page', 'tier', 'outcome']), id: z.string().min(1).max(128)
    }), z.object({
        kind: z.literal('automatic')
    })]);
const conditionSchema = z.object({
    questionId: z.string().min(1), operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_answered', 'is_not_answered']), value: z.string().optional()
});
export const FlowRoutingSchema: z.ZodType<FlowRouting> = z.object({
    version: z.literal(1), entry: FlowDestinationSchema, routes: z.record(z.string(), z.object({
        rules: z.array(z.object({
            id: z.string().min(1), conditions: z.array(conditionSchema).max(100), match: z.enum(['all', 'any']), destination: FlowDestinationSchema
        })).max(1000), default: FlowDestinationSchema.optional()
    })), visibility: z.record(z.string(), z.array(z.object({
        match: z.enum(['all', 'any']), conditions: z.array(conditionSchema).max(100), effect: z.enum(['show', 'hide'])
    }))).optional()
});
export const FlowEditorLayoutSchema: z.ZodType<FlowEditorLayout> = z.object({
    version: z.literal(1), positions: z.record(z.string(), z.object({
        x: z.number().finite(), y: z.number().finite()
    }))
});
function screenKey(form: FormSchemaType, q: Question) { return form.settings.presentation === 'page' ? q.pageId || form.pages?.[0]?.id || 'default' : q.id; }
function targetKey(form: FormSchemaType, d: FlowDestination): string | undefined {
    if (d.kind === 'page')
        return d.id;
    if (d.kind === 'question') {
        const q = form.questions.find(q => q.id === d.id);
        return q ? screenKey(form, q) : d.id;
    }
}
export function flowConditionsMatch(form: FormSchemaType, conditions: FlowCondition[], match: 'all' | 'any', known: Answers): boolean {
    const check = (c: FlowCondition) => {
        const q = form.questions.find(q => q.id === c.questionId), v = known[c.questionId];
        if (!q || !Object.prototype.hasOwnProperty.call(known, c.questionId))
            return false;
        if (c.operator === 'is_not_answered')
            return !isAnswered(v);
        if (!isAnswered(v) || validationError(q, v))
            return false;
        // New choice routes use stable IDs. A label that happens to equal a
        // different option ID must never make both answers follow that route.
        if (q.options?.some(option => option.id === c.value) && ['equals', 'not_equals'].includes(c.operator)) {
            const values = Array.isArray(v) ? v : [v];
            return c.operator === 'equals' ? values.includes(c.value) : !values.includes(c.value);
        }
        return evaluateCondition(c.operator, v, c.value, q);
    };
    return conditions.length > 0 && (match === 'all' ? conditions.every(check) : conditions.some(check));
}
export function resolveFlowPath(form: FormSchemaType, answers: Answers): {
    questions: Question[];
    tierId?: string;
    outcomeId?: string;
    incomplete?: boolean;
} {
    const routing = form.routing!;
    const path: Question[] = [], known: Answers = {}, seen = new Set<string>();
    let destination = routing.entry;
    for (let count = 0; count <= form.questions.length + 1; count++) {
        if (destination.kind === 'automatic')
            return {
                questions: path
            };
        if (destination.kind === 'tier')
            return {
                questions: path, tierId: destination.id
            };
        if (destination.kind === 'outcome')
            return {
                questions: path, outcomeId: destination.id
            };
        const key = targetKey(form, destination);
        if (!key)
            throw new ValidationError('A flow destination is missing.');
        if (seen.has(key))
            throw new ValidationError('The flow creates a loop.');
        seen.add(key);
        const questions = orderedQuestions(form).filter(q => screenKey(form, q) === key);
        if (!questions.length)
            return { questions: path, incomplete: true };
        // Same-screen answers are available together, independent of field order.
        const candidates = {
            ...known
        };
        questions.forEach(q => { candidates[q.id] = answers[q.id]; });
        const visible = questions.filter(q => { const rules = routing.visibility?.[q.id] || []; const matches = (r: FlowVisibility) => flowConditionsMatch(form, r.conditions, r.match, known); return !rules.some(r => r.effect === 'hide' && matches(r)) && (!rules.some(r => r.effect === 'show') || rules.some(r => r.effect === 'show' && matches(r))); });
        visible.forEach(q => { path.push(q); known[q.id] = candidates[q.id]; });
        const route = routing.routes[key];
        const rule = visible.length ? route?.rules.find(r => flowConditionsMatch(form, r.conditions, r.match, known)) : undefined;
        const next = rule?.destination || route?.default;
        if (!next)
            return {
                questions: path, incomplete: true
            };
        destination = next;
    }
    throw new ValidationError('The flow exceeds its navigation limit.');
}
export function validateFlowRouting(form: FormSchemaType, publishing = false): void {
    const r = form.routing;
    if (!r)
        return;
    if (form.logicRules?.length)
        throw new ValidationError('Explicit flows cannot also use legacy routing rules.');
    if (form.settings.shuffleQuestions)
        throw new ValidationError('Question shuffling is unavailable for explicit flows.');
    const keys = new Set(form.questions.map(q => screenKey(form, q)));
    const validateDestination = (d: FlowDestination) => {
        if (d.kind === 'automatic')
            return;
        if (d.kind === 'question' && !form.questions.some(q => q.id === d.id) || d.kind === 'page' && !keys.has(d.id))
            throw new ValidationError('A flow destination refers to a deleted question or page.');
        if (d.kind === 'tier' && (!!form.marketing || !form.outcomeTiers.some(t => t.id === d.id) || ['knowledge', 'scorecard'].includes(form.quizType || '')))
            throw new ValidationError('Choose an available compatible ending.');
        if (d.kind === 'outcome' && (!form.marketing?.outcomes.some(o => o.id === d.id) || ['knowledge', 'scorecard'].includes(form.quizType || '') || form.marketing.kind === 'scorecard'))
            throw new ValidationError('Choose an available marketing result.');
    };
    // A deleted entry remains visible as unresolved in a saveable draft.
    if (publishing) validateDestination(r.entry);
    const condition = (c: FlowCondition) => {
        const q = form.questions.find(q => q.id === c.questionId);
        if (!q)
            throw new ValidationError('A flow condition refers to a deleted question.');
        if (['greater_than', 'less_than'].includes(c.operator) && ((publishing && !c.value?.trim()) || (!!c.value?.trim() && !Number.isFinite(Number(c.value)))))
            throw new ValidationError('Numeric flow conditions require a finite value.');
    };
    for (const [key, route] of Object.entries(r.routes)) {
        if (!keys.has(key))
            throw new ValidationError('A flow route refers to a deleted question or page.');
        if (new Set(route.rules.map(x => x.id)).size !== route.rules.length)
            throw new ValidationError('Flow rule IDs must be unique per screen.');
        route.rules.forEach(rule => {
            rule.conditions.forEach(condition);
            validateDestination(rule.destination);
            if (publishing && !rule.conditions.length)
                throw new ValidationError('Complete each flow condition before publishing.');
        });
        if (route.default)
            validateDestination(route.default);
    }
    Object.entries(r.visibility || {}).forEach(([id, rs]) => {
        if (!form.questions.some(q => q.id === id))
            throw new ValidationError('Visibility refers to a deleted question.');
        rs.forEach(x => x.conditions.forEach(condition));
    });
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (key: string, complete = publishing) => {
        if (visiting.has(key))
            throw new ValidationError('Flow connections cannot create loops.');
        if (visited.has(key))
            return;
        visiting.add(key);
        const route = r.routes[key];
        if (complete && !route?.default) {
            const qs = form.questions.filter(q => screenKey(form, q) === key), q = qs.length === 1 ? qs[0] : undefined;
            const covered = q?.required && !r.visibility?.[q.id]?.length && singleTypes.has(q.type) && q.options?.length && q.options.every(o => route?.rules.some(rule => rule.conditions.length === 1 && rule.conditions[0].questionId === q.id && rule.conditions[0].operator === 'equals' && rule.conditions[0].value === o.id));
            if (!covered)
                throw new ValidationError('Every reachable question or page needs a default destination or complete required-answer coverage.');
        }
        for (const d of [...(route?.rules.map(x => x.destination) || []), ...(route?.default ? [route.default] : [])]) {
            const next = targetKey(form, d);
            if (next)
                visit(next, complete);
        }
        visiting.delete(key);
        visited.add(key);
    };
    // Check disconnected components for cycles too; completeness applies only to reachable screens.
    const start = targetKey(form, r.entry);
    if (start && keys.has(start))
        visit(start);
    keys.forEach(key => visit(key, false));
}
export function migrateLegacyRouting(form: FormSchemaType): {
    form: FormSchemaType;
    issues: string[];
} {
    if (form.routing)
        return {
            form, issues: []
        };
    const issues: string[] = [];
    if (form.settings.shuffleQuestions)
        issues.push('Turn off question shuffling before upgrading routing.');
    if (form.settings.presentation === 'page' && form.logicRules?.length)
        issues.push('Grouped-page branching must be reviewed in the existing editor before upgrading.');
    const qs = orderedQuestions(form), routes: Record<string, FlowRoute> = {}, visibility: NonNullable<FlowRouting['visibility']> = {};
    const screens = [...new Set(qs.map(q => screenKey(form, q)))];
    screens.forEach((key, i) => { const next = screens[i + 1]; const q = qs.find(q => screenKey(form, q) === next); routes[key] = {
        rules: [], default: next ? (form.settings.presentation === 'page' ? {
            kind: 'page', id: next
        } : {
            kind: 'question', id: q!.id
        }) : {
            kind: 'automatic'
        }
    }; });
    for (const rule of form.logicRules || []) {
        if (rule.operator === 'is_not_answered') issues.push('Review missing-answer conditions before upgrading; skipped answers cannot satisfy explicit flow conditions.');
        const condition: FlowCondition = {
            questionId: rule.sourceQuestionId, operator: rule.operator, value: rule.value
        };
        const source = qs.find(q => q.id === rule.sourceQuestionId);
        if (!source) {
            issues.push('A rule refers to a missing source question.');
            continue;
        }
        if (source.options?.some(option => option.id === condition.value) && source.options.some(option => option.id !== condition.value && option.label.trim().toLowerCase() === condition.value?.trim().toLowerCase())) {
            issues.push(`Review the answer ID/label collision on ${source.title || source.id} before upgrading.`);
        }
        if (source.options?.length && ['equals', 'not_equals'].includes(condition.operator) && !source.options.some(option => option.id === condition.value)) {
            const matches = source.options.filter(option => option.label.trim().toLowerCase() === condition.value?.trim().toLowerCase());
            if (matches.length === 1) condition.value = matches[0].id;
            else issues.push(`Review the ambiguous answer condition on ${source.title || source.id} before upgrading.`);
        }
        if (['show_question', 'hide_question'].includes(rule.action)) {
            if (rule.targetQuestionId)
                (visibility[rule.targetQuestionId] ??= []).push({
                    match: 'all', conditions: [condition], effect: rule.action === 'show_question' ? 'show' : 'hide'
                });
            continue;
        }
        let destination: FlowDestination;
        if (rule.action === 'jump_to_ending') {
            if ((form.quizType === 'knowledge' || !!form.marketing) && rule.targetOutcomeTierId && form.outcomeTiers.some(t => t.id === rule.targetOutcomeTierId)) issues.push('Review the legacy direct ending before upgrading; this quiz type calculates its result separately.');
            destination = rule.targetOutcomeTierId && form.outcomeTiers.some(t => t.id === rule.targetOutcomeTierId) ? {
                kind: 'tier', id: rule.targetOutcomeTierId
            } : {
                kind: 'automatic'
            };
        }
        else {
            if (!rule.targetQuestionId) {
                issues.push('A branching rule needs a destination.');
                continue;
            }
            destination = {
                kind: 'question', id: rule.targetQuestionId
            };
        }
        // Preserve legacy label-based comparisons: new edits always use IDs.
        routes[screenKey(form, source)].rules.push({
            id: rule.id, match: 'all', conditions: [condition], destination
        });
    }
    const entry: FlowDestination = qs.length ? (form.settings.presentation === 'page' ? {
        kind: 'page', id: screenKey(form, qs[0])
    } : {
        kind: 'question', id: qs[0].id
    }) : {
        kind: 'automatic'
    };
    return {
        form: {
            ...form, logicRules: [], routing: {
                version: 1, entry, routes, visibility
            }
        }, issues
    };
}
/** Whether the reachable graph still delegates any terminal to calculated results. */
export function flowUsesAutomaticResults(form: FormSchemaType): boolean {
    if (!form.routing)
        return true;
    const seen = new Set<string>();
    const visit = (d: FlowDestination): boolean => {
        if (d.kind === 'automatic')
            return true;
        const key = targetKey(form, d);
        if (!key || seen.has(key))
            return false;
        seen.add(key);
        const r = form.routing!.routes[key];
        return !!r && [...r.rules.map(x => x.destination), ...(r.default ? [r.default] : [])].some(visit);
    };
    return visit(form.routing.entry);
}
