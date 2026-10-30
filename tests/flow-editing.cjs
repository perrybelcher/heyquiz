const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { FormSchema } = require('../lib/schema.ts');
const { resolvePath } = require('../lib/engine.ts');
const { migrateLegacyRouting, validateFlowRouting } = require('../lib/flow-routing.ts');
const { appendFlowQuestion, connectAnswer, removeQuestion, reconcileFlowEdit, destinationChoices, routeOwner } = require('../lib/flow-editing.ts');

function fixture() {
  return migrateLegacyRouting(FormSchema.parse({
    id: 'edit-flow', title: 'Editing', mode: 'survey',
    questions: [
      { id: 'q1', title: 'Choose', type: 'multiple_choice', required: true, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
      { id: 'q2', title: 'Details', type: 'short_answer' },
      { id: 'q3', title: 'More', type: 'short_answer' },
    ],
  })).form;
}

// Text edits preserve the caller's identity, and so cannot reset canvas history.
const original = fixture();
const contentEdit = { ...original, title: 'New title' };
assert.equal(reconcileFlowEdit(original, contentEdit), contentEdit);
const withConnection = connectAnswer(original, 'q1', 'a', { kind: 'question', id: 'q3' });
assert.equal(reconcileFlowEdit(original, withConnection), withConnection);
assert.equal(original.routing.routes.q1.rules.length, 0);
assert.equal(withConnection.routing.routes.q1.rules.length, 1);

// Deleting a conditional target must NOT route A through the old q2 default.
const before = JSON.stringify(withConnection);
const removed = removeQuestion(withConnection, 'q3');
assert.equal(JSON.stringify(withConnection), before);
assert.equal(removed.routing.routes.q1.default, undefined);
assert.deepEqual(resolvePath(removed, { q1: 'a' }).questions.map(q => q.id), ['q1']);
assert.equal(resolvePath(removed, { q1: 'a' }).incomplete, true);
validateFlowRouting(removed);
assert.throws(() => validateFlowRouting(removed, true), /default/);
assert.equal(removeQuestion(original, 'missing'), original);

// Removing the entry is recoverable/saveable, never a silent automatic result.
const noEntry = removeQuestion(original, 'q1');
validateFlowRouting(noEntry);
assert.equal(resolvePath(noEntry, {}).incomplete, true);
assert.throws(() => validateFlowRouting(noEntry, true), /deleted/);

// Remove all references to deleted conditions, including visibility predicates.
const conditional = fixture();
conditional.routing.routes.q1.rules = [{ id: 'condition', match: 'all', conditions: [{ questionId: 'q2', operator: 'is_answered' }], destination: { kind: 'automatic' } }];
conditional.routing.visibility = { q3: [{ effect: 'show', match: 'all', conditions: [{ questionId: 'q2', operator: 'is_answered' }] }] };
const noCondition = removeQuestion(conditional, 'q2');
assert.equal(noCondition.routing.routes.q1.rules.length, 0);
assert.equal(noCondition.routing.routes.q1.default, undefined);
assert.equal(noCondition.routing.visibility.q3, undefined);
validateFlowRouting(noCondition);

// Removing an option discards its rule and makes its previous default explicit for review.
const noOption = reconcileFlowEdit(withConnection, {
  ...withConnection,
  questions: withConnection.questions.map(q => q.id === 'q1' ? { ...q, options: q.options.filter(o => o.id !== 'a') } : q),
});
assert.equal(noOption.routing.routes.q1.rules.length, 0);
assert.equal(noOption.routing.routes.q1.default, undefined);

// Deleted result destinations cannot silently fall through into a different result.
const resultFlow = fixture();
resultFlow.outcomeTiers = [{ id: 'end', title: 'End', minScorePercent: 0, maxScorePercent: 100 }];
const directResult = connectAnswer(resultFlow, 'q1', 'a', { kind: 'tier', id: 'end' });
const deletedResult = reconcileFlowEdit(directResult, { ...directResult, outcomeTiers: [] });
assert.equal(deletedResult.routing.routes.q1.rules.length, 0);
assert.equal(deletedResult.routing.routes.q1.default, undefined);
const knowledge = { ...directResult, quizType: 'knowledge' };
assert.equal(destinationChoices(knowledge).some(choice => choice.value.startsWith('tier:')), false);

// Required multi-select has many combinations; per-option rules are not a single-choice coverage proof.
const multi = fixture();
multi.questions[0].type = 'multiselect';
multi.routing.routes.q1 = { rules: ['a', 'b'].map(value => ({ id: value, match: 'all', conditions: [{ questionId: 'q1', operator: 'equals', value }], destination: { kind: 'automatic' } })) };
assert.throws(() => validateFlowRouting(multi, true), /default/);

// Grouped pages keep the shared page route while any fields remain.
const grouped = fixture();
grouped.settings.presentation = 'page';
grouped.pages = [{ id: 'page', title: 'Page', questionIds: ['q1', 'q2', 'q3'] }];
grouped.questions = grouped.questions.map(q => ({ ...q, pageId: 'page' }));
grouped.routing = { version: 1, entry: { kind: 'page', id: 'page' }, routes: { page: { rules: [], default: { kind: 'automatic' } } } };
assert.ok(removeQuestion(grouped, 'q2').routing.routes.page);
assert.equal(routeOwner({ ...grouped, pages: [], questions: grouped.questions.map(q => ({ ...q, pageId: undefined })) }, 'q1'), 'default');
console.log('PASS flow editing: identity, immutable commands, safe deletion, missing entry, visibility cleanup, result removal, grouped owners and multi-select coverage');
// Canvas deletions reuse existing downstream cleanup rather than orphaning scoring rules.
const scored = fixture();
scored.marketing = { kind: 'segmentation', rules: [{ questionId: 'q2', answerId: 'unused', targetId: 'out', effect: 'add', points: 1 }], categories: [], outcomes: [], qualificationRules: [{ id: 'qual', outcomeId: 'out', match: 'all', conditions: [{ questionId: 'q2', operator: 'equals', value: 'x' }] }] };
scored.editorLayout = { version: 1, positions: { q2: { x: 5, y: 10 }, q1: { x: 1, y: 2 } } };
const cleaned = removeQuestion(scored, 'q2');
assert.deepEqual(cleaned.marketing.rules, []);
assert.deepEqual(cleaned.marketing.qualificationRules, []);
assert.equal(cleaned.editorLayout.positions.q2, undefined);
assert.deepEqual(cleaned.editorLayout.positions.q1, { x: 1, y: 2 });

// A blank flow starts at its first added question, including a grouped page.
for (const grouped of [false, true]) {
 const empty = migrateLegacyRouting(FormSchema.parse({id:'blank-flow',title:'Blank',mode:'survey',settings:grouped?{presentation:'page'}:{},pages:grouped?[{id:'p1',title:'Page',questionIds:[]}]:undefined})).form;
 const question={id:'first',title:'First question',type:'multiple_choice',options:[{id:'a',label:'A'},{id:'b',label:'B'}],...(grouped?{pageId:'p1'}:{})};
 const added=appendFlowQuestion(empty,question);
 assert.deepEqual(resolvePath(added,{first:'a'}).questions.map(q=>q.id),['first']);
 assert.equal(resolvePath(added,{first:'a'}).incomplete,undefined);
 validateFlowRouting(added,true);
 const second=appendFlowQuestion(added,{...question,id:'second'});
 assert.deepEqual(second.routing.entry,added.routing.entry);
 assert.equal(second.questions.length,2);
 assert.equal(empty.questions.length,0);
}
console.log('PASS blank flow: first added question becomes entry, grouped pages work, later blocks preserve entry');
