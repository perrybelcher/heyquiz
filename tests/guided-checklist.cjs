const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const { defaultCapture } = require('../lib/contacts.ts');
const { buildGuidedChecklist, resolveGuidedChecklistTarget, guidedTargetKey } = require('../lib/guided-checklist.ts');
const { getPublishReadiness } = require('../lib/publish-readiness.ts');
const fixture = () => FormSchema.parse({ id: 'guided-checklist-fixture', title: '', mode: 'survey', questions: ['q1', 'q2'].map(id => ({ id, title: '', type: 'multiple_choice', required: true, options: [{ id: 'a', label: '' }, { id: 'b', label: 'Another route' }] })), marketing: { kind: 'segmentation', outcomes: [{ id: 'one', title: 'First route' }, { id: 'two', title: 'Second route' }], rules: [{ id: 'rule1', questionId: 'q1', answerId: 'a', targetId: 'one', points: 1 }, { id: 'rule2', questionId: 'q2', answerId: 'b', targetId: 'two', points: 1 }] }, capture: { ...defaultCapture, enabled: true } });
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
test('Current title gates remain blockers; answer wording, destinations and privacy are recommendations', () => {
  const form = fixture(), items = buildGuidedChecklist(form), targeted = kind => items.filter(item => item.target?.kind === kind);
  assert.equal(targeted('quiz-title').length, 1); assert.equal(targeted('question-title').length, 2);
  assert.ok([...targeted('quiz-title'), ...targeted('question-title')].every(item => item.level === 'blocker' && item.source === 'readiness'));
  assert.equal(targeted('answer-label').length, 2); assert.equal(targeted('outcome-cta').length, 2); assert.equal(targeted('capture-privacy').length, 1);
  assert.ok([...targeted('answer-label'), ...targeted('outcome-cta'), ...targeted('capture-privacy')].every(item => item.level === 'recommendation'));
  const old = getPublishReadiness(form); assert.deepEqual(old.blockers.map(item => item.code), ['quiz-title', 'question-titles']);
});
test('Every exact target resolves to its intended current control and step', () => {
  const form = fixture();
  for (const [target, step] of [[{ kind: 'quiz-title' }, 0], [{ kind: 'question-title', questionId: 'q2' }, 1], [{ kind: 'answer-label', questionId: 'q1', answerId: 'a' }, 1], [{ kind: 'outcome-cta', outcomeId: 'two' }, 2], [{ kind: 'capture-privacy' }, 4]]) assert.deepEqual(resolveGuidedChecklistTarget(form, target), { step, target });
});
test('Reordering changes wording positions but not target identities or item keys', () => {
  const form = fixture(), before = buildGuidedChecklist(form).filter(item => item.target).map(item => [guidedTargetKey(item.target), item.id]).sort();
  form.questions.reverse(); form.questions[1].options.reverse(); form.marketing.outcomes.reverse();
  const after = buildGuidedChecklist(form).filter(item => item.target).map(item => [guidedTargetKey(item.target), item.id]).sort(); assert.deepEqual(after, before);
  const answer = buildGuidedChecklist(form).find(item => item.target?.questionId === 'q1' && item.target?.kind === 'answer-label'); assert.match(answer.message, /answer 2 in question 2/);
  assert.equal(resolveGuidedChecklistTarget(form, answer.target).target.answerId, 'a');
});
test('Missing and ambiguous question, answer, outcome targets never fall back', () => {
  const form = fixture();
  assert.equal(resolveGuidedChecklistTarget(form, { kind: 'question-title', questionId: 'absent' }), null);
  assert.equal(resolveGuidedChecklistTarget(form, { kind: 'answer-label', questionId: 'q1', answerId: 'absent' }), null);
  assert.equal(resolveGuidedChecklistTarget(form, { kind: 'outcome-cta', outcomeId: 'absent' }), null);
  form.questions.push(structuredClone(form.questions[0])); assert.equal(resolveGuidedChecklistTarget(form, { kind: 'question-title', questionId: 'q1' }), null); form.questions.pop();
  form.questions[0].options.push(structuredClone(form.questions[0].options[0])); assert.equal(resolveGuidedChecklistTarget(form, { kind: 'answer-label', questionId: 'q1', answerId: 'a' }), null);
  form.marketing.outcomes.push(structuredClone(form.marketing.outcomes[0])); assert.equal(resolveGuidedChecklistTarget(form, { kind: 'outcome-cta', outcomeId: 'one' }), null);
});
test('Changed marketing kind and disabled capture invalidate pending field targets', () => {
  const form = fixture(); form.marketing.kind = 'scorecard'; form.capture.enabled = false;
  assert.equal(resolveGuidedChecklistTarget(form, { kind: 'outcome-cta', outcomeId: 'one' }), null); assert.equal(resolveGuidedChecklistTarget(form, { kind: 'capture-privacy' }), null);
  const items = buildGuidedChecklist(form); assert.ok(!items.some(item => item.target?.kind === 'outcome-cta' || item.target?.kind === 'capture-privacy'));
});
test('Schema authority maps invalid supplied URLs to exact controls without stricter URL rules', () => {
  const form = fixture(); form.marketing.outcomes[1].ctaUrl = 'ftp://example.test'; form.capture.privacyUrl = 'not-a-url';
  const invalid = buildGuidedChecklist(form).filter(item => item.source === 'save'); assert.equal(invalid.length, 2); assert.ok(invalid.every(item => item.level === 'blocker'));
  assert.deepEqual(invalid.map(item => item.target).sort((a, b) => a.kind.localeCompare(b.kind)), [{ kind: 'capture-privacy' }, { kind: 'outcome-cta', outcomeId: 'two' }]);
  form.capture.privacyUrl = 'https://'; form.marketing.outcomes[1].ctaUrl = 'https://'; assert.equal(buildGuidedChecklist(form).filter(item => item.source === 'save').length, 0, 'Do not silently replace existing prefix-based schema policy');
});
test('Landing and opaque rule failures offer honest section/advanced review without invented field IDs', () => {
  const form = fixture(); form.coverPage = { enabled: true, title: 'Landing', subtitle: '', buttonText: '', showQuestionCount: true, layout: 'compact', sections: [] };
  form.marketing.rules[0].answerId = 'gone'; const items = buildGuidedChecklist(form);
  const landing = items.find(item => item.source === 'publish'); assert.equal(landing.reviewSection, 'promise'); assert.equal(landing.target, undefined);
  const opaque = items.find(item => item.source === 'readiness' && item.message.includes('missing question or answer')); assert.ok(opaque); assert.equal(opaque.target, undefined);
});
test('Repairing one field removes its own guidance; derivation never mutates/persists the form', () => {
  const form = fixture(), original = JSON.stringify(form); buildGuidedChecklist(form); assert.equal(JSON.stringify(form), original);
  const before = buildGuidedChecklist(form).filter(item => item.target?.kind === 'answer-label'); form.questions[1].options[0].label = 'New wording'; const after = buildGuidedChecklist(form).filter(item => item.target?.kind === 'answer-label'); assert.equal(after.length, 1); assert.equal(after[0].id, before.find(item => item.target.questionId === 'q1').id);
  assert.ok(!Object.keys(form).some(key => /checklist|pendingTarget/.test(key)));
});
test('Persistent derivation never invokes expensive path diagnostics', () => {
  const diagnostics = require('../lib/scoring-diagnostics.ts'), original = diagnostics.scoringDiagnostics;
  diagnostics.scoringDiagnostics = () => { throw Error('Path enumeration must be deferred to publish review'); };
  try { assert.ok(buildGuidedChecklist(fixture()).length > 0); } finally { diagnostics.scoringDiagnostics = original; }
});
test('Tuple keys do not collide for awkward but distinct target values', () => {
  assert.notEqual(guidedTargetKey({ kind: 'answer-label', questionId: 'a-b', answerId: 'c' }), guidedTargetKey({ kind: 'answer-label', questionId: 'a', answerId: 'b-c' }));
});
console.log(`${count} guided checklist groups passed.`);
