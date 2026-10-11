const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { FormSchema } = require('../lib/schema.ts');
const { simulateJourneys, inspectConversation } = require('../lib/journey-testing.ts');
const { evaluateMarketing } = require('../lib/marketing.ts');
const { resolvePath, validationError } = require('../lib/engine.ts');
const { gradeQuizSubmission } = require('../lib/scoring.ts');
const base = (patch = {}) => FormSchema.parse({ id: 'journey-test', title: 'Choose your next step', mode: 'form', questions: [], outcomeTiers: [], ...patch });
const choice = (id, ids = ['yes', 'no'], patch = {}) => ({ id, title: id, type: 'multiple_choice', required: true, options: ids.map(id => ({ id, label: id })), ...patch });
let fetchCalls = 0;
const previousFetch = global.fetch;
global.fetch = () => { fetchCalls++; throw Error('Journey simulation must not use network'); };

// Branching counts actual visible journeys, not unused answers on skipped questions.
const branch = base({ questions: [choice('route', ['short', 'long']), choice('detail'), choice('finish')], logicRules: [{ id: 'show', sourceQuestionId: 'route', operator: 'equals', value: 'long', action: 'show_question', targetQuestionId: 'detail' }] });
let result = simulateJourneys(branch);
assert.equal(result.totalCombinations, 6);
assert.equal(result.exhaustive, true);
assert.equal(result.cases.filter(c => c.answers.route === 'short').length, 2);
for (const c of result.cases) {
  assert.deepEqual(c.questionIds, resolvePath(branch, c.answers).questions.map(q => q.id));
  for (const q of resolvePath(branch, c.answers).questions) assert.equal(validationError(q, c.answers[q.id]), null);
  if (c.answers.route === 'short') assert.equal(Object.hasOwn(c.answers, 'detail'), false);
}
const frozen = JSON.stringify(branch);
simulateJourneys(branch);
assert.equal(JSON.stringify(branch), frozen, 'simulation does not mutate the form');

// Required typed fields stop only journeys that actually reach them.
const typed = structuredClone(branch);
typed.questions[1] = { id: 'detail', title: 'Your email', type: 'email', required: true };
result = simulateJourneys(typed);
assert.deepEqual(result.unsupportedQuestionIds, ['detail']);
assert.equal(result.exhaustive, false);
assert.equal(result.totalCombinations, null);
assert.equal(result.cases.filter(c => c.status === 'completed').length, 2);
assert.equal(result.cases.filter(c => c.status === 'invalid').length, 1);
const blocked = result.cases.find(c => c.status === 'invalid');
assert.deepEqual(blocked.questionIds, ['route', 'detail']);
assert.match(blocked.error, /manual answer/);
assert.equal(Object.hasOwn(blocked.answers, 'detail'), false);
const optional = base({ questions: [{ id: 'notes', type: 'paragraph', title: 'Notes' }, choice('pick')] });
result = simulateJourneys(optional);
assert.equal(result.cases.length, 2);
assert.equal(result.exhaustive, false);
assert.deepEqual(result.unsupportedQuestionIds, ['notes']);
assert.ok(result.cases.every(c => !Object.hasOwn(c.answers, 'notes')));

// Real grading, boundaries, and explicit ending jumps.
const quiz = base({ mode: 'quiz', questions: [choice('answer', ['correct', 'wrong'], { points: 10, options: [{ id: 'correct', label: 'Correct', isCorrect: true }, { id: 'wrong', label: 'Wrong' }] })], outcomeTiers: [{ id: 'pass', title: 'Pass', message: '', badge: '', minScorePercent: 50, maxScorePercent: 100 }, { id: 'retry', title: 'Try again', message: '', badge: '', minScorePercent: 0, maxScorePercent: 49 }] });
result = simulateJourneys(quiz);
assert.deepEqual(result.cases.map(c => [c.resultId, c.score]), [['pass', 100], ['retry', 0]]);
for (const c of result.cases) assert.equal(c.score, gradeQuizSubmission(quiz, c.answers).percentageScore);
const jump = base({ mode: 'quiz', questions: [choice('route', ['finish']), { id: 'email', title: 'Email', type: 'email', required: true }], outcomeTiers: quiz.outcomeTiers, logicRules: [{ id: 'jump', sourceQuestionId: 'route', operator: 'equals', value: 'finish', action: 'jump_to_ending', targetOutcomeTierId: 'retry' }] });
result = simulateJourneys(jump);
assert.equal(result.exhaustive, true);
assert.deepEqual(result.unsupportedQuestionIds, []);
assert.equal(result.cases[0].resultId, 'retry');
assert.deepEqual(result.cases[0].questionIds, ['route']);

// Product exclusions win; simultaneous picks use the actual evaluator.
const product = base({ questions: [choice('needs', ['fit', 'avoid'], { type: 'multiselect' })], marketing: { kind: 'product_finder', outcomes: [{ id: 'product', title: 'A product', description: 'Fits your needs', minPoints: 1 }], rules: [{ id: 'add', questionId: 'needs', answerId: 'fit', targetId: 'product', effect: 'add', points: 1 }, { id: 'exclude', questionId: 'needs', answerId: 'avoid', targetId: 'product', effect: 'exclude', points: 0 }] } });
result = simulateJourneys(product);
assert.equal(result.totalCombinations, 3);
assert.equal(result.cases.find(c => c.answers.needs.length === 2).status, 'no_match');
for (const c of result.cases) {
  const expected = evaluateMarketing(product, c.answers);
  assert.equal(c.resultId, expected.outcomeId);
  assert.equal(c.resultTitle, expected.title);
  assert.equal(c.status, expected.status);
}
const scores = base({ questions: [choice('practice', ['always', 'sometimes', 'never', 'unknown'])], marketing: { kind: 'scorecard', scorecard: { title: 'Your score', bands: [{ id: 'low', min: 0, max: 49, title: 'Build foundations' }, { id: 'high', min: 50, max: 100, title: 'Keep going' }] }, categories: [{ id: 'readiness', title: 'Readiness', minAnswers: 1 }], rules: ['always', 'sometimes', 'never'].map((answerId, i) => ({ id: 'r' + i, questionId: 'practice', answerId, targetId: 'readiness', points: [2, 1, 0][i], effect: 'add' })) } });
result = simulateJourneys(scores);
assert.deepEqual(result.cases.map(c => [c.status, c.score]), [['scored', 100], ['scored', 50], ['scored', 0], ['no_match', undefined]]);
assert.deepEqual(new Set(result.reachedResultIds), new Set(['high', 'low']));

// Bounds are honest, including large multi-select and URL-provided inputs.
assert.equal(simulateJourneys(base({ questions: [choice('x')] }), 2).exhaustive, true);
result = simulateJourneys(branch, 2);
assert.equal(result.cases.length, 2);
assert.equal(result.totalCombinations, null);
assert.equal(result.exhaustive, false);
assert.ok(result.notes.some(n => n.includes('bounded sample')));
const huge = base({ questions: Array.from({ length: 12 }, (_, i) => choice('q' + i, ['a', 'b', 'c', 'd'])) });
assert.equal(simulateJourneys(huge, 999999).cases.length, 512);
assert.equal(simulateJourneys(huge, 0).cases.length, 1);
assert.equal(simulateJourneys(huge, NaN).cases.length, 256);
const many = base({ questions: [choice('many', Array.from({ length: 15 }, (_, i) => 'a' + i), { type: 'checkboxes' })] });
result = simulateJourneys(many);
assert.equal(result.exhaustive, false);
assert.equal(result.cases.length, 16);
assert.ok(result.notes.some(n => n.includes('Large choice fields')));
const hidden = base({ questions: [{ id: 'campaign', type: 'hidden', title: 'Campaign' }, choice('q')] });
result = simulateJourneys(hidden);
assert.equal(result.exhaustive, false);
assert.deepEqual(result.unsupportedQuestionIds, ['campaign']);
const captcha = base({ questions: [{ id: 'security', type: 'captcha', title: 'Security' }] });
assert.equal(simulateJourneys(captcha).cases[0].status, 'invalid');

// Malformed logic is a visible failure; stale references are not scored as passing.
const loop = base({ questions: [choice('a'), choice('b')], logicRules: [{ id: 'back', sourceQuestionId: 'b', operator: 'equals', value: 'yes', action: 'jump_to_question', targetQuestionId: 'a' }] });
result = simulateJourneys(loop);
assert.equal(result.cases[0].status, 'invalid');
assert.equal(result.exhaustive, false);
assert.ok(inspectConversation(loop).issues.some(i => i.id === 'question-references'));
assert.equal(simulateJourneys(base({ questions: [choice('empty', [])] })).cases[0].status, 'invalid');
const incomplete = base({ title: '', coverPage: { enabled: true, title: '', buttonText: '' }, questions: [choice('q', ['a', 'b'], { title: '', options: [{ id: 'a', label: 'Same' }, { id: 'b', label: ' same ' }] })], marketing: { kind: 'segmentation', outcomes: [{ id: 'outcome', title: 'An outcome', ctaLabel: 'Learn more' }], rules: [{ id: 'r', questionId: 'q', answerId: 'a', targetId: 'outcome', effect: 'add', points: 1 }] } });
const ids = new Set(inspectConversation(incomplete).issues.map(i => i.id));
for (const id of ['quiz-title', 'cover-title', 'cover-button', 'title-q', 'duplicate-labels-q', 'neutral-q', 'destination-outcome', 'result-explanation-outcome']) assert.ok(ids.has(id), id);
const unreachable = structuredClone(product);
unreachable.marketing.outcomes.push({ ...unreachable.marketing.outcomes[0], id: 'never', title: 'Never observed' });
result = simulateJourneys(unreachable);
assert.deepEqual(result.unreachedResultIds, ['never']);
result = simulateJourneys(unreachable, 1);
assert.ok(result.notes.some(n => n.includes('does not prove')));
const display = base({ questions: [{ id: 'heading', type: 'heading', title: 'Welcome' }, { id: 'checkbox', type: 'checkbox', title: 'Optional checkbox' }] });
assert.equal(simulateJourneys(display).cases.length, 3);
assert.ok(simulateJourneys(display).cases.every(c => !Object.hasOwn(c.answers, 'heading')));
const blank = simulateJourneys(base());
assert.equal(blank.cases[0].status, 'invalid');
assert.equal(blank.exhaustive, false);
assert.equal(blank.totalCombinations, null);
const exact = base({ questions: Array.from({ length: 8 }, (_, i) => choice('binary' + i)) });
assert.equal(simulateJourneys(exact).cases.length, 256);
assert.equal(simulateJourneys(exact).exhaustive, true);
const entirelyHidden = base({ questions: [choice('route', ['skip']), { id: 'secret', title: 'Do not show', type: 'email', required: true }], logicRules: [{ id: 'never-show', sourceQuestionId: 'route', operator: 'equals', value: 'never', action: 'show_question', targetQuestionId: 'secret' }] });
assert.equal(simulateJourneys(entirelyHidden).exhaustive, true);
assert.deepEqual(simulateJourneys(entirelyHidden).unsupportedQuestionIds, []);
const missingEnding = structuredClone(jump);
missingEnding.logicRules[0].targetOutcomeTierId = 'deleted';
assert.equal(simulateJourneys(missingEnding).cases[0].status, 'invalid');
const severity = inspectConversation(incomplete).issues.map(i => ({ error: 0, warning: 1, note: 2 })[i.severity]);
assert.deepEqual(severity, [...severity].sort((a, b) => a - b));
assert.equal(fetchCalls, 0);
global.fetch = previousFetch;
console.log('PASS local journey simulation: branching, jumps, hidden/typed coverage, grading, marketing exclusions, scorecard boundaries, multi-select, caps, and actionable inspection');
