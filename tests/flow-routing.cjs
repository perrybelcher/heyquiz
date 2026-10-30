const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const { resolvePath, publicForm } = require('../lib/engine.ts');
const { migrateLegacyRouting, validateFlowRouting } = require('../lib/flow-routing.ts');
const { evaluateMarketing, validateMarketing } = require('../lib/marketing.ts');
const base = FormSchema.parse({ id: 'flow-test', title: 'Flow', mode: 'survey', questions: [{ id: 'q1', title: 'Choose', type: 'multiple_choice', required: true, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'd', label: 'D' }] }, { id: 'q2', title: 'More', type: 'short_answer' }, { id: 'q3', title: 'Other', type: 'short_answer' }], logicRules: [{ id: 'branch', sourceQuestionId: 'q1', operator: 'equals', value: 'd', action: 'jump_to_question', targetQuestionId: 'q3' }] });
const migrated = migrateLegacyRouting(base);
assert.deepEqual(migrated.issues, []);
for (const answer of ['a', 'b', 'c', 'd'])
    assert.deepEqual(resolvePath(base, { q1: answer }).questions.map(q => q.id), resolvePath(migrated.form, { q1: answer }).questions.map(q => q.id));
const form = migrated.form;
validateFlowRouting(form, true);
form.editorLayout = { version: 1, positions: { q1: { x: 1, y: 2 } } };
assert.equal(publicForm(form).editorLayout, undefined);
// Explicit links can go backwards in array order and are independent of canvas placement.
form.routing.routes.q3.default = { kind: 'question', id: 'q2' };
form.routing.routes.q2.default = { kind: 'automatic' };
assert.deepEqual(resolvePath(form, { q1: 'd' }).questions.map(q => q.id), ['q1', 'q3', 'q2']);
validateFlowRouting(form, true);
form.routing.routes.q2.default = { kind: 'question', id: 'q1' };
assert.throws(() => validateFlowRouting(form), /loop/);
form.routing.routes.q2.default = { kind: 'automatic' };
delete form.routing.routes.q3.default;
validateFlowRouting(form);
assert.throws(() => validateFlowRouting(form, true), /default/);
assert.equal(resolvePath(form, { q1: 'd' }).incomplete, true);
form.routing.routes.q3.default = { kind: 'automatic' };
// Conditions cannot use an answer on an abandoned branch.
form.routing.routes.q3.rules = [{ id: 'offpath', match: 'all', conditions: [{ questionId: 'q2', operator: 'equals', value: 'secret' }], destination: { kind: 'question', id: 'q2' } }];
assert.deepEqual(resolvePath(form, { q1: 'd', q2: 'secret' }).questions.map(q => q.id), ['q1', 'q3']);
// Grouped pages evaluate routing after collecting all visible answers on that page.
const grouped = FormSchema.parse({ ...base, logicRules: [], settings: { presentation: 'page' }, pages: [{ id: 'p1', title: 'Page 1', questionIds: ['q1', 'q2'] }, { id: 'p2', title: 'Page 2', questionIds: ['q3'] }], questions: base.questions.map((q, i) => ({ ...q, pageId: i < 2 ? 'p1' : 'p2' })) });
const g = migrateLegacyRouting(grouped).form;
g.routing.routes.p1.rules = [{ id: 'laterfield', match: 'all', conditions: [{ questionId: 'q2', operator: 'equals', value: 'finish' }], destination: { kind: 'automatic' } }];
assert.deepEqual(resolvePath(g, { q1: 'a', q2: 'finish' }).questions.map(q => q.id), ['q1', 'q2']);
// Direct terminal resolves the same marketing result before conditional sections.
const direct = FormSchema.parse({ ...base, logicRules: [], marketing: { kind: 'segmentation', outcomes: [{ id: 'result', title: 'Selected', description: 'Description', advice: 'Advice', ctaLabel: 'Go', ctaUrl: 'https://example.com', minPoints: 1 }], rules: [], categories: [], fallbackTitle: 'Fallback', fallbackMessage: 'No match' } });
direct.routing = { version: 1, entry: { kind: 'question', id: 'q1' }, routes: { q1: { rules: [], default: { kind: 'outcome', id: 'result' } } } };
validateMarketing(direct, true);
assert.equal(evaluateMarketing(direct, { q1: 'a' }).outcomeId, 'result');
assert.equal(resolvePath(direct, { q1: 'a' }).outcomeId, 'result');
console.log('PASS flow routing: legacy parity, direct results, grouped pages, off-path conditions, drafts, cycles and public layout stripping');
// is_not_answered on a skipped field cannot qualify.
form.routing.routes.q3.rules[0].conditions[0]={questionId:'q2',operator:'is_not_answered'};
assert.deepEqual(resolvePath(form,{q1:'d'}).questions.map(q=>q.id),['q1','q3']);
// Disconnected cycles must also fail the publication gate.
const disconnected=structuredClone(direct);
disconnected.routing.routes.q2={rules:[],default:{kind:'question',id:'q3'}};
disconnected.routing.routes.q3={rules:[],default:{kind:'question',id:'q2'}};
assert.throws(()=>validateFlowRouting(disconnected,true),/loop/);
// Choice IDs and labels may collide: explicit routing must compare actual IDs only.
const collision = structuredClone(form);
collision.questions[0].options[0].label = 'b';
collision.routing.routes.q1 = { rules: [{ id: 'only-b', match: 'all', conditions: [{ questionId: 'q1', operator: 'equals', value: 'b' }], destination: { kind: 'question', id: 'q3' } }], default: { kind: 'automatic' } };
assert.deepEqual(resolvePath(collision, { q1: 'a' }).questions.map(q => q.id), ['q1']);
assert.deepEqual(resolvePath(collision, { q1: 'b' }).questions.map(q => q.id), ['q1', 'q3']);
const legacyCollision = { ...collision, routing: undefined, logicRules: [{ id: 'collision', sourceQuestionId: 'q1', operator: 'equals', value: 'b', action: 'jump_to_question', targetQuestionId: 'q3' }] };
assert.ok(migrateLegacyRouting(legacyCollision).issues.some(issue => issue.includes('collision')));
const legacyLabel = { ...base, logicRules: [{ id: 'label', sourceQuestionId: 'q1', operator: 'equals', value: 'D', action: 'jump_to_question', targetQuestionId: 'q3' }] };
assert.equal(migrateLegacyRouting(legacyLabel).form.routing.routes.q1.rules[0].conditions[0].value, 'd');

// Marketing quizzes render their marketing result, so legacy tier destinations are incompatible.
const misleadingTier = structuredClone(direct);
misleadingTier.outcomeTiers = [{ id: 'legacy-tier', title: 'Other result', minScorePercent: 0, maxScorePercent: 100 }];
misleadingTier.routing.routes.q1.default = { kind: 'tier', id: 'legacy-tier' };
assert.throws(() => validateFlowRouting(misleadingTier, true), /compatible ending/);

// Knowledge quizzes always retain computed score truth and cannot force a direct tier.
const { gradeQuizSubmission } = require('../lib/scoring.ts');
const knowledge = structuredClone(migrated.form);
knowledge.quizType = 'knowledge';
knowledge.mode = 'quiz';
knowledge.questions[0].points = 1;
knowledge.questions[0].options[0].isCorrect = true;
knowledge.outcomeTiers = [{ id: 'pass', title: 'Pass', minScorePercent: 100, maxScorePercent: 100 }, { id: 'fail', title: 'Fail', minScorePercent: 0, maxScorePercent: 99 }];
assert.equal(gradeQuizSubmission(knowledge, { q1: 'b' }).percentageScore, 0);
assert.equal(gradeQuizSubmission(knowledge, { q1: 'b' }).matchedTier.id, 'fail');
knowledge.routing.routes.q1.default = { kind: 'tier', id: 'pass' };
assert.throws(() => validateFlowRouting(knowledge, true), /compatible ending/);

// Conversion to a knowledge quiz invalidates direct outcomes instead of silently calculating another result.
const { previewQuizConversion } = require('../lib/quiz-conversion.ts');
const converted = previewQuizConversion({ ...direct, quizType: 'personality' }, 'knowledge').form;
assert.equal(converted.routing.routes.q1.default, undefined);
assert.equal(resolvePath(converted, { q1: 'a' }).incomplete, true);
assert.throws(() => validateFlowRouting(converted, true), /default/);
// No editor draft or outcome copy leaks through the respondent payload.
direct.editorLayout = { version: 1, positions: { q1: { x: 42, y: 84 } } };
direct.resultEmailCopy = undefined;
const publicPayload = JSON.parse(JSON.stringify(publicForm(direct)));
assert.equal(publicPayload.editorLayout, undefined);
assert.deepEqual(publicPayload.marketing.outcomes, []);
assert.deepEqual(publicPayload.marketing.rules, []);
// A required question can still be hidden; coverage alone cannot replace its skip continuation.
const hiddenCoverage = fixtureForHiddenCoverage();
function fixtureForHiddenCoverage() {
  const next = structuredClone(base);
  next.logicRules = [];
  next.routing = { version: 1, entry: { kind: 'question', id: 'q1' }, routes: { q1: { rules: next.questions[0].options.map(option => ({ id: option.id, match: 'all', conditions: [{ questionId: 'q1', operator: 'equals', value: option.id }], destination: { kind: 'automatic' } })) } }, visibility: { q1: [{ effect: 'show', match: 'all', conditions: [{ questionId: 'q2', operator: 'equals', value: 'show' }] }] } };
  return next;
}
assert.throws(() => validateFlowRouting(hiddenCoverage, true), /default/);
assert.equal(resolvePath(hiddenCoverage, { q1: 'a' }).incomplete, true);
// Renaming after migration cannot alter a former exact-label route.
const renamedMigration = migrateLegacyRouting(legacyLabel).form;
const routeBeforeRename = resolvePath(renamedMigration, { q1: 'd' }).questions.map(q => q.id);
renamedMigration.questions[0].options.find(option => option.id === 'd').label = 'A completely different answer label';
assert.deepEqual(resolvePath(renamedMigration, { q1: 'd' }).questions.map(q => q.id), routeBeforeRename);
assert.equal(renamedMigration.routing.routes.q1.rules[0].conditions[0].value, 'd');
