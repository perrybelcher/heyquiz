// Independent acceptance fixtures: expected outcomes are literal product rules,
// never generated from the evaluator under test. No records or transports used.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { FormSchema } = require('../lib/schema.ts');
const { evaluateMarketing, validateMarketing } = require('../lib/marketing.ts');
const { gradeQuizSubmission } = require('../lib/scoring.ts');
const { publicForm } = require('../lib/engine.ts');
const { makeResultReport } = require('../lib/result-reports.ts');
const { publicationFingerprint } = require('../lib/publication.ts');
const { removeGuidedQuestion, removeGuidedAnswer, renameGuidedAnswer } = require('../lib/guided-editing.ts');
const { simulateJourneys } = require('../lib/journey-testing.ts');
const tests = [], run = (name, fn) => tests.push([name, fn]);
const outcome = id => ({ id, title: id, description: `Description ${id}`, advice: `Action ${id}`, ctaLabel: 'Next', ctaUrl: `https://example.test/${id}` });
const choice = (id, type = 'multiple_choice') => ({ id, type, title: id, required: false, options: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }] });
function qualification() {
  return FormSchema.parse({ id: 'independent-fit', title: 'Qualification fixture', quizType: 'qualification', mode: 'survey', questions: [choice('preference'), choice('services', 'multiselect'), { id: 'budget', type: 'number', title: 'Budget', required: false, minVal: 0, maxVal: 100 }], marketing: { kind: 'qualification', outcomes: [outcome('premium'), outcome('self-service')], qualificationRules: [
    { id: 'premium-rule', outcomeId: 'premium', match: 'all', conditions: [{ questionId: 'services', operator: 'equals', value: 'a' }, { questionId: 'budget', operator: 'greater_than', value: '50' }] },
    { id: 'self-rule', outcomeId: 'self-service', match: 'any', conditions: [{ questionId: 'preference', operator: 'equals', value: 'b' }, { questionId: 'budget', operator: 'less_than', value: '51' }] },
  ] } });
}
function weighted(quizType) {
  return FormSchema.parse({ id: 'independent-match', title: 'Matching fixture', quizType, mode: 'survey', questions: [choice('choice'), choice('constraint')], marketing: { kind: quizType === 'product_finder' ? 'product_finder' : 'segmentation', outcomes: [outcome('first'), outcome('second')], rules: [
    { id: 'first-a', questionId: 'choice', answerId: 'a', targetId: 'first', points: 2, reason: 'Alpha preference' },
    { id: 'second-a', questionId: 'choice', answerId: 'a', targetId: 'second', points: 2, reason: 'Shared preference' },
    { id: 'second-b', questionId: 'choice', answerId: 'b', targetId: 'second', points: 3, reason: 'Beta preference' },
  ] } });
}
run('qualification ordered all/any rules and strict numeric boundaries', () => {
  const form = qualification(); validateMarketing(form, true);
  for (const [answers, expected] of [
    [{services:['a'], budget:51, preference:'b'}, 'premium'],
    [{services:['a'], budget:50}, 'self-service'],
    [{services:['a'], budget:50.5}, 'premium'],
    [{services:['b'], budget:51}, undefined],
    [{preference:'b'}, 'self-service'],
    [{services:['a','b'], budget:'51'}, 'premium'],
    [{services:['a','a'], budget:51}, 'premium'],
  ]) assert.equal(evaluateMarketing(form, answers).outcomeId, expected, JSON.stringify(answers));
  form.marketing.qualificationRules.reverse();
  assert.equal(evaluateMarketing(form,{services:['a'],budget:51,preference:'b'}).outcomeId,'self-service');
});
run('missing/invalid values cannot satisfy negation or numeric rules', () => {
  const form=qualification(); form.marketing.qualificationRules=[{id:'negative',outcomeId:'premium',match:'all',conditions:[{questionId:'services',operator:'not_equals',value:'c'}]}];
  for(const services of [undefined,null,[],['unknown'],['a','unknown'],[1],true,'a',{}]) assert.equal(evaluateMarketing(form,{services}).status,'no_match',JSON.stringify(services));
  assert.equal(evaluateMarketing(form,{services:['a']}).outcomeId,'premium');
  assert.equal(evaluateMarketing(form,{services:['a','c']}).status,'no_match');
  const numeric=qualification();numeric.marketing.qualificationRules=[{id:'number',outcomeId:'premium',match:'all',conditions:[{questionId:'budget',operator:'not_equals',value:'1'}]}];
  for(const budget of [undefined,null,'', ' ', true, [], {}, Infinity, NaN, -1,101]) assert.equal(evaluateMarketing(numeric,{budget}).status,'no_match',String(budget));
  assert.equal(evaluateMarketing(numeric,{budget:0}).outcomeId,'premium');
});
run('hidden/skipped numeric and choice evidence never qualifies', () => {
  for(const action of ['hide_question','jump_to_question']) {
    const form=qualification();
    form.logicRules=[{id:'branch',sourceQuestionId:'preference',operator:'equals',value:'a',action,targetQuestionId:action==='hide_question'?'services':'budget'}];
    assert.equal(evaluateMarketing(form,{preference:'a',services:['a'],budget:60}).status,'no_match');
  }
});
run('answer renaming and deletion preserve intended eligibility', () => {
  const form=qualification(), renamed=renameGuidedAnswer(form,'services','a','Renamed');
  assert.equal(evaluateMarketing(renamed,{services:['a'],budget:60}).outcomeId,'premium');
  assert.equal(evaluateMarketing(renamed,{services:['Renamed'],budget:60}).status,'no_match');
  const removed=removeGuidedAnswer(form,'services','a');
  assert.deepEqual(removed.marketing.qualificationRules.map(rule=>rule.id),['self-rule'],'remove entire all-group rather than broaden eligibility');
  assert.equal(evaluateMarketing(removed,{budget:60}).status,'no_match');
  assert.equal(removeGuidedQuestion(form,'budget').marketing.qualificationRules.length,0);
});
run('weighted personalities/diagnostics preserve order ties and neutral fallbacks', () => {
  for(const type of ['personality','diagnostic']) {
    const form=weighted(type);validateMarketing(form,true);
    assert.equal(evaluateMarketing(form,{choice:'a'}).outcomeId,'first');
    assert.equal(evaluateMarketing(form,{choice:'b'}).outcomeId,'second');
    assert.equal(evaluateMarketing(form,{choice:'c'}).status,'no_match');
    form.marketing.outcomes.reverse();assert.equal(evaluateMarketing(form,{choice:'a'}).outcomeId,'second');
    const result=evaluateMarketing(form,{choice:'b'});
    assert.equal(result.quizType,type);assert.equal(result.overallScore,undefined);assert.deepEqual(result.reasons,['Beta preference']);
    assert.ok(simulateJourneys(form).notes.some(note=>note.includes('tie')));
  }
});
run('product exclusions remain authoritative despite positive points', () => {
  const form=weighted('product_finder');
  form.marketing.rules.push({id:'exclude',questionId:'constraint',answerId:'a',targetId:'first',points:0,effect:'exclude',reason:''});
  validateMarketing(form,true);
  assert.equal(evaluateMarketing(form,{choice:'a',constraint:'a'}).outcomeId,'second');
  assert.equal(evaluateMarketing(form,{choice:'a',constraint:'b'}).outcomeId,'first');
});
run('drafts save incomplete configuration but publication rejects missing rules/CTA/review', () => {
  const draft=FormSchema.parse({id:'draft',title:'Draft',quizType:'qualification',mode:'survey',marketing:{kind:'qualification'}});
  validateMarketing(draft);assert.throws(()=>validateMarketing(draft,true));
  const noCondition=qualification();noCondition.marketing.qualificationRules[0].conditions=[];validateMarketing(noCondition);assert.throws(()=>validateMarketing(noCondition,true));
  const noCta=qualification();noCta.marketing.outcomes[0].ctaUrl='';validateMarketing(noCta);assert.throws(()=>validateMarketing(noCta,true));
  const review=qualification();review.conversionReview={sourceQuizId:'source',required:true};validateMarketing(review);assert.throws(()=>validateMarketing(review,true));
  for(const mutate of [f=>f.marketing.qualificationRules[0].conditions[0].value='Alpha', f=>f.marketing.qualificationRules[0].outcomeId='unknown', f=>f.marketing.qualificationRules[0].conditions[0].questionId='unknown']) { const invalid=qualification();mutate(invalid);assert.throws(()=>validateMarketing(invalid,true)); }
});
run('typed identities reject incompatible combinations without normalizing legacy', () => {
  const old=FormSchema.parse({id:'old',title:'Legacy',mode:'survey',questions:[choice('q')]});
  const fingerprint=publicationFingerprint(old), serialized=JSON.stringify(old);
  validateMarketing(old,true);FormSchema.parse(old);assert.equal(JSON.stringify(old),serialized);assert.equal(publicationFingerprint(old),fingerprint);assert.equal(Object.hasOwn(old,'quizType'),false);
  for(const type of ['personality','diagnostic','product_finder','scorecard','knowledge']) assert.throws(()=>validateMarketing({...qualification(),quizType:type}));
  const publicQuiz=publicForm(qualification());assert.equal(publicQuiz.marketing.qualificationRules,undefined);assert.deepEqual(publicQuiz.marketing.outcomes,[]);
});
run('appearance changes cannot change decisions; saved result content stays frozen', () => {
  const form=qualification(), before=evaluateMarketing(form,{services:['a'],budget:60});
  form.theme.primaryColor='#008844';form.marketing.presentation={layout:'action_plan'};
  const after=evaluateMarketing(form,{services:['a'],budget:60});assert.equal(after.outcomeId,before.outcomeId);
  const report=makeResultReport(form,{...gradeQuizSubmission(form,{}),marketing:after},'response');
  form.quizType='personality';form.marketing.outcomes[0].title='Changed later';after.title='Changed result later';
  assert.equal(report.result.marketing.quizType,'qualification');assert.equal(report.result.marketing.title,'premium');assert.equal(report.result.marketing.advice,'Action premium');
});
run('knowledge type survives canonical grading and saved-report snapshot', () => {
  const form=FormSchema.parse({id:'knowledge',title:'Knowledge',quizType:'knowledge',mode:'quiz',questions:[{...choice('q'),points:1,options:[{id:'a',label:'Correct',isCorrect:true},{id:'b',label:'Incorrect',isCorrect:false}]}]});
  const result=gradeQuizSubmission(form,{q:'a'});assert.equal(result.quizType,'knowledge');
  assert.equal(makeResultReport(form,result,'response').result.quizType,'knowledge');
  const legacy={...form};delete legacy.quizType;assert.equal(Object.hasOwn(gradeQuizSubmission(legacy,{q:'a'}),'quizType'),false);
});
let failures=0;
for(const [name,fn] of tests) { try { fn();console.log(`PASS ${name}`); } catch(error) { failures++;console.error(`FAIL ${name}: ${error.message}`); } }
if(failures) process.exitCode=1; else console.log(`${tests.length} independent acceptance groups passed.`);
