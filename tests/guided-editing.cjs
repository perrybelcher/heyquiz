const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const { MarketingSchema, evaluateMarketing, validateMarketing } = require('../lib/marketing.ts');
const { orderedQuestions, resolvePath, validateFormReferences } = require('../lib/engine.ts');
const { addGuidedQuestion, addGuidedAnswer, moveGuidedQuestion, moveGuidedAnswer, renameGuidedAnswer, reviewGuidedRemoval, removeGuidedQuestion, removeGuidedAnswer } = require('../lib/guided-editing.ts');
const choice = (id, pageId) => ({ id, type: 'multiple_choice', title: id, pageId, options: [{ id: 'a', label: 'Ready', isCorrect: true }, { id: 'b', label: 'Not yet' }, { id: 'c', label: 'Not sure' }] });
const fixture = () => FormSchema.parse({ id: 'guided-fixture', title: 'Test', mode: 'survey', questions: [choice('q1'), choice('q2'), choice('q3')], marketing: MarketingSchema.parse({ kind: 'segmentation', outcomes: [{ id: 'ready', title: 'Ready' }], rules: [{ id: 'rule-1', questionId: 'q1', answerId: 'a', targetId: 'ready', points: 3, reason: 'Old wording' }, { id: 'rule-2', questionId: 'q2', answerId: 'a', targetId: 'ready', points: 2 }] }) });
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
test('Question and answer movement preserve IDs, scoring and input object', () => {
  const form = fixture(), original = JSON.stringify(form), before = evaluateMarketing(form, { q1: 'a', q2: 'a' });
  const moved = moveGuidedAnswer(moveGuidedQuestion(form, 'q1', 1), 'q1', 'a', 1);
  assert.deepEqual(moved.questions.map(q => q.id), ['q2', 'q1', 'q3']);
  assert.deepEqual(moved.questions[1].options.map(o => o.id), ['b', 'a', 'c']);
  assert.deepEqual(evaluateMarketing(moved, { q1: 'a', q2: 'a' }), before);
  assert.equal(JSON.stringify(form), original);
  validateFormReferences(moved); validateMarketing(moved);
});
test('Adding a question respects page membership and creates fresh IDs with neutral scoring', () => {
  const form = fixture(); form.pages = [{ id: 'p1', title: 'One', questionIds: ['q1', 'q3'] }, { id: 'p2', title: 'Two', questionIds: ['q2'] }];
  form.questions[0].pageId = 'p1'; form.questions[1].pageId = 'p2'; form.questions[2].pageId = 'p1';
  const { form: updated, questionId } = addGuidedQuestion(form, 'multiselect', 'q1');
  assert.equal(updated.questions.find(q => q.id === questionId).pageId, 'p1');
  assert.deepEqual(orderedQuestions(updated).map(q => q.id), ['q1', questionId, 'q3', 'q2']);
  assert.deepEqual(updated.pages[0].questionIds, ['q1', questionId, 'q3']);
  assert.equal(updated.questions.find(q => q.id === questionId).options.length, 2);
  assert.equal(new Set(updated.questions.flatMap(q => [q.id, ...q.options.map(o => `${q.id}:${o.id}`)])).size, 15);
  assert.deepEqual(updated.marketing.rules, form.marketing.rules);
  const answered = addGuidedAnswer(updated, questionId);
  assert.equal(answered.questions.find(q => q.id === questionId).options.length, 3);
  validateFormReferences(answered); validateMarketing(answered); FormSchema.parse(answered);
});
test('Deleting a question cleans rules, pages and tracking without enabling all-step tracking', () => {
  const form = fixture(); form.pages = [{ id: 'p1', title: 'One', questionIds: ['q1', 'q2', 'q3'] }];
  form.logicRules = [{ id: 'source', sourceQuestionId: 'q1', operator: 'equals', value: 'a', action: 'jump_to_question', targetQuestionId: 'q2' }, { id: 'destination', sourceQuestionId: 'q2', operator: 'is_answered', action: 'hide_question', targetQuestionId: 'q1' }];
  form.tracking = { enabled: false, ga4Id: '', metaPixelId: '', events: ['question_view', 'quiz_complete'], questionIds: ['q1'], privacyUrl: '' };
  assert.ok(reviewGuidedRemoval(form, 'q1').changes.some(change => change.includes('2 branch')));
  const updated = removeGuidedQuestion(form, 'q1');
  assert.deepEqual(updated.logicRules, []); assert.equal(updated.marketing.rules.length, 1);
  assert.deepEqual(updated.pages[0].questionIds, ['q2', 'q3']); assert.deepEqual(updated.tracking.events, ['quiz_complete']);
  assert.deepEqual(updated.tracking.questionIds, []); validateFormReferences(updated); validateMarketing(updated);
});
test('Deleting an answer reviews and cleans ID, label and substring branches while retaining unrelated rules', () => {
  const form = fixture(); form.logicRules = ['a', 'Ready', 'ead', 'b'].map((value, i) => ({ id: `b${i}`, sourceQuestionId: 'q1', operator: i === 2 ? 'contains' : i === 1 ? 'not_equals' : 'equals', value, action: 'jump_to_question', targetQuestionId: 'q3' }));
  const review = reviewGuidedRemoval(form, 'q1', 'a');
  assert.ok(review.changes.some(change => change.includes('3 branch')));
  assert.ok(review.changes.some(change => change.includes('correct answer')));
  const updated = removeGuidedAnswer(form, 'q1', 'a');
  assert.deepEqual(updated.logicRules.map(r => r.id), ['b3']);
  assert.equal(updated.marketing.rules.length, 1); assert.equal(updated.questions[0].options.length, 2);
  assert.throws(() => removeGuidedAnswer(updated, 'q1', 'b'), /at least two/);
  validateMarketing(updated); validateFormReferences(updated);
});
test('Deleting a referenced calculation input is blocked instead of silently changing its result', () => {
  const form = fixture(); form.questions.push({ id: 'calc', type: 'calculation', title: 'Total', calculationFormula: '{{q1}} + 2' });
  assert.match(reviewGuidedRemoval(form, 'q1').blockers[0], /Total/);
  assert.throws(() => removeGuidedQuestion(form, 'q1'), /calculation/);
  assert.equal(form.questions.length, 4);
});
test('Repeated selected tracking IDs cannot broaden tracking when their question is removed', () => {
  const form = fixture(); form.tracking = { enabled: false, ga4Id: '', metaPixelId: '', events: ['question_view', 'quiz_complete'], questionIds: ['q1', 'q1'], privacyUrl: '' };
  assert.deepEqual(removeGuidedQuestion(form, 'q1').tracking.events, ['quiz_complete']);
});
test('Question movement rejects backward branching and page crossing without dropping rules', () => {
  for (const action of ['jump_to_question', 'hide_question', 'show_question']) {
    const form = fixture(); form.logicRules = [{ id: 'branch', sourceQuestionId: 'q1', operator: 'equals', value: 'a', action, targetQuestionId: 'q2' }];
    assert.throws(() => moveGuidedQuestion(form, 'q1', 1), /branch destination/);
    assert.equal(form.logicRules.length, 1);
  }
  const form = fixture(); form.pages = [{ id: 'p1', title: 'One', questionIds: ['q1'] }, { id: 'p2', title: 'Two', questionIds: ['q2', 'q3'] }];
  form.questions[0].pageId = 'p1'; form.questions[1].pageId = 'p2'; form.questions[2].pageId = 'p2';
  assert.throws(() => moveGuidedQuestion(form, 'q1', 1), /between pages/);
});
test('Renaming an answer clears stale reasons and preserves exact-label branch behavior', () => {
  const form = fixture(); form.logicRules = [{ id: 'branch', sourceQuestionId: 'q1', operator: 'equals', value: 'READY', action: 'jump_to_question', targetQuestionId: 'q3' }];
  const updated = renameGuidedAnswer(form, 'q1', 'a', 'I am ready to begin');
  assert.equal(updated.marketing.rules[0].reason, ''); assert.equal(updated.logicRules[0].value, 'a');
  assert.deepEqual(resolvePath(updated, { q1: 'a' }).questions.map(q => q.id), ['q1', 'q3']);
  assert.equal(updated.questions[0].options[0].id, 'a');
});
test('Adding beyond the schema question limit is rejected without changing the draft', () => {
  const form = fixture(); form.questions = Array.from({ length: 200 }, (_, i) => choice(`q${i}`));
  assert.throws(() => addGuidedQuestion(form, 'multiple_choice', 'q0'), /200/);
  assert.equal(form.questions.length, 200);
});
console.log(`${passed} guided editing scenarios passed.`);
