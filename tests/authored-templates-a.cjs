const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {personalityTemplates}=require('../lib/authored-templates/personality.ts');
const {knowledgeTemplates}=require('../lib/authored-templates/knowledge.ts');
const {evaluateMarketing,validateMarketing}=require('../lib/marketing.ts');
const {gradeQuizSubmission}=require('../lib/scoring.ts');
const {validateFormReferences,resolvePath,validationError}=require('../lib/engine.ts');
const fixtures=require('./fixtures/authored-templates-a.json');
const templates=[...personalityTemplates,...knowledgeTemplates];
assert.equal(templates.length,6);assert.equal(templates.reduce((n,t)=>n+t.build('count').questions.length,0),92);
for(const group of [personalityTemplates,knowledgeTemplates])assert.deepEqual(group.map(t=>t.build('count').questions.length).sort((a,b)=>a-b),[8,8,30]);
for(const template of templates){
 const form=template.build('first'),second=template.build('second'),fixture=fixtures[template.id];
 assert.equal(form.title,template.title);validateFormReferences(form);validateMarketing(form,true);
 assert.equal(resolvePath(form,fixture.answers).questions.length,form.questions.length);
 assert.equal(new Set(form.questions.map(q=>q.id)).size,form.questions.length);
 assert.equal(Object.keys(fixture.answers).length,form.questions.length);
 for(const q of form.questions){assert.ok(q.title.trim());assert.equal(validationError(q,fixture.answers[q.id]),null);assert.equal(new Set(q.options.map(o=>o.id)).size,q.options.length);assert.ok(q.options.every(o=>o.label.trim()));}
 const original=second.questions[0].title;form.questions[0].title='Changed';assert.equal(second.questions[0].title,original);assert.equal(template.build('third').questions[0].title,original);
 if(template.quizType==='personality'){
  assert.deepEqual(form.marketing.outcomes.map(o=>o.id),['planner','explorer','connector']);
  // Explicit authored choice IDs select the three written profile blueprints; expected IDs are not computed from evaluation.
  for(const profile of ['planner','explorer','connector']){const answers=Object.fromEntries(Object.keys(fixture.answers).map(qid=>[qid,`${qid}-${profile}`]));assert.equal(evaluateMarketing(form,answers).outcomeId,profile);}
  const unknown=Object.fromEntries(Object.keys(fixture.answers).map(qid=>[qid,`${qid}-unsure`]));assert.equal(evaluateMarketing(form,unknown).status,'no_match');
  const ids=Object.keys(fixture.answers);assert.equal(evaluateMarketing(form,{[ids[0]]:`${ids[0]}-planner`}).status,'no_match');
  const tie={[ids[0]]:`${ids[0]}-planner`,[ids[1]]:`${ids[1]}-explorer`,[ids[2]]:`${ids[2]}-planner`,[ids[3]]:`${ids[3]}-explorer`};assert.equal(evaluateMarketing(form,tie).outcomeId,'planner');form.marketing.outcomes.reverse();assert.equal(evaluateMarketing(form,tie).outcomeId,'explorer');
  for(const q of form.questions){const rules=form.marketing.rules.filter(r=>r.questionId===q.id);assert.equal(rules.length,3);assert.ok(rules.every(r=>r.points===1));}
 }else{
  assert.equal(gradeQuizSubmission(form,fixture.answers).percentageScore,100);
  const wrong=Object.fromEntries(Object.keys(fixture.answers).map(qid=>[qid,`${qid}-alternative-1`]));assert.equal(gradeQuizSubmission(form,wrong).percentageScore,0);
  const neutral=Object.fromEntries(Object.keys(fixture.answers).map(qid=>[qid,`${qid}-unsure`]));assert.equal(gradeQuizSubmission(form,neutral).totalPointsEarned,0);
  const mixed={...wrong};Object.keys(fixture.answers).slice(0,form.questions.length/2).forEach(qid=>mixed[qid]=`${qid}-correct`);const result=gradeQuizSubmission(form,mixed);assert.equal(result.percentageScore,50);assert.equal(result.matchedTier.id,'developing');assert.ok(result.grading.every(q=>q.explanation));
  for(const q of form.questions)assert.equal(q.options.filter(o=>o.isCorrect).length,1);
 }
 console.log(`PASS ${template.id}: authored references, literal full path, independent copies and result fixtures`);
}
