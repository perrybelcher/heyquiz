const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {MarketingSchema,evaluateMarketing,validateMarketing}=require('../lib/marketing.ts');
const {marketingTemplate}=require('../lib/marketing-templates.ts');
const {publicForm}=require('../lib/engine.ts');
const {evaluateJourneyCase}=require('../lib/journey-testing.ts');
for(const kind of ['scorecard','segmentation','product_finder']) {
 const f=marketingTemplate(kind,'sections');
 f.marketing=MarketingSchema.parse({...f.marketing,resultSections:[{id:'faq',type:'faq',title:'Next?',body:'Your next step'},{id:'action',type:'cta',url:'https://example.com',label:'Explore'}]});
 validateMarketing(f,true);
 assert.equal(evaluateMarketing(f,{}).resultSections[0].body,'Your next step');
 assert.equal(publicForm(f).marketing.resultSections,undefined);
 const empty=structuredClone(f);empty.marketing.resultSections[1].url='';assert.throws(()=>validateMarketing(empty,true),/add a URL/);validateMarketing(empty,false);
 const duplicate=structuredClone(f);duplicate.marketing.resultSections[1].id='faq';assert.throws(()=>validateMarketing(duplicate),/unique/);
 assert.equal(MarketingSchema.safeParse({...f.marketing,resultSections:[{id:'x',type:'image',url:'javascript:alert(1)'}]}).success,false);
}
console.log('PASS result sections across three quiz types, draft/publication validation, unique IDs, unsafe URL rejection and public redaction');
const {resultVideoEmbed}=require('../lib/result-video.ts');
assert.equal(resultVideoEmbed('https://youtu.be/dQw4w9WgXcQ'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
assert.equal(resultVideoEmbed('https://vimeo.com/123456'),'https://player.vimeo.com/video/123456?dnt=1');
for(const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','javascript:alert(1)','http://youtu.be/dQw4w9WgXcQ','https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ','https://vimeo.com/not-a-video']) assert.equal(resultVideoEmbed(url),null);
const f=marketingTemplate('scorecard','conditional');
f.marketing=MarketingSchema.parse({...f.marketing,scorecard:{},resultSections:[
 {id:'all',type:'text',body:'Always'},
 {id:'low',type:'text',body:'Only low',condition:{type:'score',min:0,max:49}},
 {id:'high',type:'text',body:'Only high',condition:{type:'score',min:50,max:100}},
 {id:'video',type:'video',url:'https://youtu.be/dQw4w9WgXcQ',condition:{type:'score',categoryId:f.marketing.categories[0].id,min:0,max:100}},
]});
assert.deepEqual(evaluateMarketing(f,{}).resultSections.map(s=>s.id),['all']);
assert.deepEqual(evaluateMarketing(f,{capture:'a2',followup:'a2',measure:'a2'}).resultSections.map(s=>s.id),['all','low','video']);
assert.deepEqual(evaluateMarketing(f,{capture:'a1',followup:'a1',measure:'a1'}).resultSections.map(s=>s.id),['all','high','video']);
assert.equal(evaluateMarketing(f,{capture:'a1',followup:'a1',measure:'a1'}).resultSections[1].condition,undefined);
f.marketing.resultSections[1].condition.min=90;assert.throws(()=>validateMarketing(f,true),/minimum score/);
f.marketing.resultSections[1].condition={type:'outcome',outcomeId:'missing'};assert.throws(()=>validateMarketing(f,true),/existing result/);
for(const kind of ['segmentation','product_finder']) {
 const g=marketingTemplate(kind,'outcome');
 const target=g.marketing.outcomes[0];
 g.marketing.resultSections=[{id:'only',type:'text',body:'Specific',title:'',url:'',label:'',condition:{type:'outcome',outcomeId:target.id}}];
 assert.deepEqual(evaluateMarketing(g,{}).resultSections,[]);
 const answers={};for(const r of g.marketing.rules.filter(r=>r.targetId===target.id&&r.effect==='add')) answers[r.questionId]=r.answerId;
 const result=evaluateMarketing(g,answers);assert.equal(result.outcomeId,target.id);assert.equal(result.resultSections.length,1);
}
console.log('PASS conditional sections, inclusive score boundaries, insufficient-answer gating, outcome matching, server filtering and video allowlist');
const boundary=marketingTemplate('scorecard','boundary');
boundary.marketing=MarketingSchema.parse({...boundary.marketing,scorecard:{},resultSections:[{id:'edge',type:'text',body:'Boundary',condition:{type:'score',min:50,max:50}}]});
assert.equal(evaluateMarketing(boundary,{capture:'a1',followup:'a1',measure:'a1'}).resultSections.length,1);
boundary.marketing.resultSections[0].condition.max=49;assert.equal(evaluateMarketing(boundary,{capture:'a1',followup:'a1',measure:'a1'}).resultSections.length,0);
boundary.marketing.resultSections[0].condition={type:'score',min:100,max:100};assert.equal(evaluateMarketing(boundary,{capture:'a0',followup:'a0',measure:'a0'}).resultSections.length,1);
boundary.marketing.resultSections[0].condition.categoryId='deleted';assert.throws(()=>validateMarketing(boundary,true),/available score category/);

const answerForm=marketingTemplate('scorecard','answer-sections');
const source=answerForm.questions[1];
const option=source.options[0];
answerForm.marketing.resultSections=MarketingSchema.parse({...answerForm.marketing,resultSections:[
  {id:'selected',type:'text',body:'Specific guidance',condition:{type:'answer',questionId:source.id,optionId:option.id}},
]}).resultSections;
const selected=answers=>evaluateMarketing(answerForm,answers).resultSections.map(section=>section.id);
validateMarketing(answerForm,true);
assert.deepEqual(evaluateJourneyCase(answerForm,{capture:'a0',followup:option.id,measure:'a0'}).resultSectionIds,['selected']);
assert.deepEqual(selected({[source.id]:option.id}),['selected']);
assert.deepEqual(selected({[source.id]:source.options[1].id}),[]);
assert.deepEqual(selected({}),[]);
assert.deepEqual(selected({[source.id]:[option.id]}),[]);
option.label='New label';
assert.deepEqual(selected({[source.id]:option.id}),['selected']);
source.type='multiselect';
assert.deepEqual(selected({[source.id]:[option.id,source.options[1].id]}),['selected']);
assert.deepEqual(selected({[source.id]:[option.id,'deleted']}),[]);
assert.deepEqual(selected({[source.id]:[option.id,42]}),[]);
const first=answerForm.questions[0];
answerForm.logicRules=[{id:'skip',sourceQuestionId:first.id,operator:'equals',value:first.options[0].id,
  action:'jump_to_question',targetQuestionId:answerForm.questions[2].id}];
assert.deepEqual(selected({[first.id]:first.options[0].id,[source.id]:[option.id]}),[]);
answerForm.marketing.resultSections[0].condition.optionId='deleted';
assert.throws(()=>validateMarketing(answerForm,true),/existing question and answer/);
validateMarketing(answerForm);
console.log('PASS answer conditions: stable IDs, valid single and multiple answers, skipped fields, and repair on deletion');
