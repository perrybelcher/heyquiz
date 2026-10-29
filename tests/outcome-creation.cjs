const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {quizTypes,validateQuizType}=require('../lib/quiz-types.ts');
const {blankQuiz}=require('../lib/blank-quiz.ts');
const {outcomeTemplate}=require('../lib/outcome-templates.ts');
const {evaluateMarketing}=require('../lib/marketing.ts');
const {outcomeRemovalImpact,removeOutcome,moveItem}=require('../lib/outcome-editing.ts');
const {safeAuthReturn}=require('../lib/auth-return-path.ts');
const {FormSchema}=require('../lib/schema.ts');
const {readGuestDraft}=require('../lib/guest-draft.ts');
for(const type of quizTypes){
 const blank=blankQuiz(`blank-${type}`,type);assert.equal(blank.quizType,type);assert.equal(blank.questions.length,0);assert.equal(blank.marketing?.outcomes.length??0,0);validateQuizType(blank);
 const sample=outcomeTemplate(type,`sample-${type}`);assert.equal(sample.quizType,type);validateQuizType(sample);assert.deepEqual(FormSchema.parse(JSON.parse(JSON.stringify(sample))),sample,'storage round trip preserves typed fixture');
 const store={getItem:key=>key===`heyquiz-draft:${sample.id}`?JSON.stringify(sample):null};assert.equal(readGuestDraft(store,store,sample.id).quizType,type);
 for(const path of ['/create/ai','/create/marketing'])assert.equal(safeAuthReturn(`${path}?quizType=${type}`),`${path}?quizType=${type}`);
}
assert.equal('quizType' in blankQuiz('legacy'),false);
// Keep deletion and routing regressions independent of evolving template copy.
function editingFixture(type,id) {
 return FormSchema.parse({...blankQuiz(id,type),questions:[{id:'preference',type:'multiple_choice',title:'Choose a path',options:[{id:'answer-0',label:'First'},{id:'answer-1',label:'Second'}]}],marketing:{kind:type==='qualification'?'qualification':'segmentation',outcomes:[0,1].map(i=>({id:'result-'+i,title:'Result '+i,minPoints:1})),rules:type==='qualification'?[]:[0,1].map(i=>({id:'rule-'+i,questionId:'preference',answerId:'answer-'+i,targetId:'result-'+i,points:1})),qualificationRules:type==='qualification'?[0,1].map(i=>({id:'route-'+i,outcomeId:'result-'+i,match:'all',conditions:[{questionId:'preference',operator:'equals',value:'answer-'+i}]})):[]}});
}
for(const type of ['personality','diagnostic','qualification']){
 const form=editingFixture(type,type);assert.equal(evaluateMarketing(form,{preference:'answer-0'}).outcomeId,'result-0');assert.equal(evaluateMarketing(form,{preference:'answer-1'}).outcomeId,'result-1');assert.equal(evaluateMarketing(form,{}).status,'no_match');
}
const form=editingFixture('qualification','cleanup');form.marketing.resultSections=[{id:'section',type:'text',title:'Specific',body:'Copy',url:'',label:'',condition:{type:'outcome',outcomeId:'result-0'}}];
assert.deepEqual(outcomeRemovalImpact(form,'result-0'),{answerRules:0,routes:1,sections:1});const removed=removeOutcome(form,'result-0');assert.equal(removed.marketing.outcomes.length,1);assert.equal(removed.marketing.qualificationRules.length,1);assert.equal(removed.marketing.resultSections.length,0);assert.equal(form.marketing.qualificationRules.length,2,'removal is immutable');
const weighted=editingFixture('personality','weighted');assert.equal(removeOutcome(weighted,'result-0').marketing.rules.length,1);
assert.deepEqual(moveItem(['first','second'],1,-1),['second','first']);assert.deepEqual(moveItem(['first','second'],0,-1),['first','second']);
assert.equal(safeAuthReturn('/create/draft?draft=quiz-new_copy'),'/create/draft?draft=quiz-new_copy');
for(const bad of ['/create/ai?quizType=unknown','/create/ai?quizType=personality&next=//evil.test','/create/marketing?quizType=personality#x','/create/draft?draft=../bad'])assert.equal(safeAuthReturn(bad),null);
console.log('PASS typed blank/template factories, literal outcome fixtures, storage identity, result deletion impact/cleanup, ordering and safe typed auth recovery');
