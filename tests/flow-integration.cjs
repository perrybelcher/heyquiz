const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const { retainFlowAnswers } = require('../lib/flow-answer-state.ts');
const { resolvePath } = require('../lib/engine.ts');
const { evaluateJourneyCase, simulateJourneys } = require('../lib/journey-testing.ts');
const q = (id, options = ['yes', 'no'], extra = {}) => ({ id, title: id, type: 'multiple_choice', required: true, options: options.map(id => ({ id, label: id })), ...extra });
const dest = id => ({ kind: 'question', id });
const rule = (id, questionId, value, destination) => ({ id, conditions: [{ questionId, operator: 'equals', value }], match: 'all', destination });
const form = FormSchema.parse({ id: 'flow-integration', title: 'Branches', mode: 'survey', questions: [q('start'), q('left'), q('right'), q('shared')], routing: { version: 1, entry: dest('start'), routes: {
  start: { rules: [rule('left-route', 'start', 'yes', dest('left'))], default: dest('right') },
  left: { rules: [], default: dest('shared') }, right: { rules: [], default: dest('shared') }, shared: { rules: [], default: { kind: 'automatic' } },
} } });
const oldAnswers = { start: 'yes', left: 'yes', right: 'no', shared: 'yes', forged: 'private' };
const leftAnswers = retainFlowAnswers(form, oldAnswers);
assert.deepEqual(leftAnswers, { start: 'yes', left: 'yes', shared: 'yes' });
assert.deepEqual(oldAnswers, { start: 'yes', left: 'yes', right: 'no', shared: 'yes', forged: 'private' });
const changed = retainFlowAnswers(form, { ...leftAnswers, start: 'no' });
assert.deepEqual(changed, { start: 'no', shared: 'yes' });
assert.deepEqual(resolvePath(form, changed).questions.map(q => q.id), ['start', 'right', 'shared']);
assert.equal(retainFlowAnswers(form, changed), changed, 'No unnecessary object churn on unchanged paths');
const legacy = { ...form, routing: undefined };
assert.equal(retainFlowAnswers(legacy, oldAnswers), oldAnswers, 'Legacy resume behavior remains unchanged');
const simulation = simulateJourneys(form);
assert.equal(simulation.exhaustive, true);
assert.equal(simulation.totalCombinations, 8);
assert.ok(simulation.cases.every(c => c.questionIds.length === 3));
assert.ok(simulation.cases.every(c => !('left' in c.answers && 'right' in c.answers)));
const incomplete = { ...form, routing: { ...form.routing, routes: { ...form.routing.routes, shared: { rules: [] } } } };
assert.equal(evaluateJourneyCase(incomplete, { start: 'yes', left: 'yes', shared: 'yes' }).status, 'invalid');
// Same page answers are available together, and references enter at the page boundary.
const grouped = FormSchema.parse({ id: 'flow-page-test', title: 'Page branch', mode: 'survey', settings: { presentation: 'page' }, pages: [{ id: 'p1', title: 'Start', questionIds: ['a', 'b'] }, { id: 'p2', title: 'Next', questionIds: ['c'] }], questions: [q('a', ['yes','no'], { pageId: 'p1' }), q('b', ['yes','no'], { pageId: 'p1' }), q('c', ['yes','no'], { pageId: 'p2' })], routing: { version: 1, entry: { kind: 'page', id: 'p1' }, routes: { p1: { rules: [rule('page-route', 'b', 'yes', dest('c'))], default: { kind: 'automatic' } }, p2: { rules: [], default: { kind: 'automatic' } } } } });
assert.deepEqual(resolvePath(grouped, { a:'no', b:'yes', c:'no' }).questions.map(q=>q.id), ['a','b','c']);
assert.deepEqual(retainFlowAnswers(grouped, { a:'no', b:'no', c:'yes' }), { a:'no', b:'no' });
console.log('PASS flow integration: abandoned-route state, shared answers, finite simulation, incomplete journeys and grouped screens');
