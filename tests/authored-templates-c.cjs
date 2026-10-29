const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {diagnosticTemplates}=require('../lib/authored-templates/diagnostic.ts');
const {scorecardTemplates}=require('../lib/authored-templates/scorecard.ts');
const {evaluateMarketing,validateMarketing}=require('../lib/marketing.ts');
const {resolvePath}=require('../lib/engine.ts');
const fixtures=require('./fixtures/authored-templates-c.json');
const expectedGroups={
 'diagnostic-lead-generation':{
 clarity:['audience-situation','audience-evidence','audience-fit','audience-language','audience-change','offer-scope','offer-difference','offer-evidence','offer-cost','offer-next'],
 access:['visibility-location','visibility-info','visibility-intent','visibility-route','visibility-maintenance','enquiry-mobile','enquiry-fields','enquiry-error','enquiry-confirm','enquiry-alternative'],
 followthrough:['followup-hours','followup-owner','followup-context','followup-stalled','followup-stop','measurement-source','measurement-stage','measurement-period','measurement-reasons','measurement-review']},
 'diagnostic-team':{direction:['team-priority','team-done','team-change'],handoffs:['team-handoff','team-owner','team-decision'],capacity:['team-load','team-interrupt']},
 'diagnostic-retention':{value:['return-purpose','return-fit','return-progress'],service:['return-support','return-resolution','return-friction'],relevance:['return-timing','return-choice']},
};
for(const t of [...diagnosticTemplates,...scorecardTemplates]){
 const f=t.build('instance-a'),other=t.build('instance-b');
 assert.equal(f.questions.length,t.featured?30:8);assert.equal(new Set(f.questions.map(q=>q.id)).size,f.questions.length);
 for(const q of f.questions){assert.ok(q.title.trim());assert.ok(q.options.every(a=>a.label.trim()));assert.equal(new Set(q.options.map(a=>a.id)).size,q.options.length);}
 assert.equal(f.logicRules?.length??0,0);validateMarketing(f,true);
 f.questions[0].title='Changed';assert.notEqual(other.questions[0].title,'Changed');assert.notEqual(t.build('c').questions[0].title,'Changed');
 const full=fixtures[t.id];assert.equal(Object.keys(full.answers).length,f.questions.length);
 const r=evaluateMarketing(other,full.answers);if(full.outcomeId)assert.equal(r.outcomeId,full.outcomeId);if(full.overallScore!==undefined)assert.equal(r.overallScore,full.overallScore);
 assert.equal(resolvePath(other,full.answers).questions.length,f.questions.length);
 if(t.featured){const themes=new Map();for(const q of f.questions)themes.set(q.description,(themes.get(q.description)||0)+1);assert.equal(themes.size,6);assert.deepEqual([...themes.values()],[5,5,5,5,5,5]);}
}
for(const t of diagnosticTemplates){
 const f=t.build('diagnostic-test'),groups=expectedGroups[t.id];
 for(const [outcomeId,ids] of Object.entries(groups)){
 const answers=Object.fromEntries(f.questions.map(q=>[q.id,ids.includes(q.id)?'gap':'established']));
 assert.equal(evaluateMarketing(f,answers).outcomeId,outcomeId,`${t.id} ${outcomeId}`);
 assert.ok(f.marketing.outcomes.find(o=>o.id===outcomeId).advice.includes('3. '));
 }
 for(const answer of ['unknown','established'])assert.equal(evaluateMarketing(f,Object.fromEntries(f.questions.map(q=>[q.id,answer]))).status,'no_match');
 // Balanced maximums tie; declaration order is the documented tie break.
 assert.equal(evaluateMarketing(f,Object.fromEntries(f.questions.map(q=>[q.id,'gap']))).outcomeId,Object.keys(groups)[0]);
 assert.equal(evaluateMarketing(f,{}).status,'no_match');
}
for(const t of scorecardTemplates){
 const f=t.build('scorecard-test');
 for(const [answer,score,band] of [['not-yet',0,'overall-start'],['sometimes',33,'overall-start'],['usually',67,'overall-maintain'],['consistently',100,'overall-maintain']]){
 const r=evaluateMarketing(f,Object.fromEntries(f.questions.map(q=>[q.id,answer])));assert.equal(r.overallScore,score);assert.equal(r.outcomeId,band);assert.equal(r.status,'scored');
 }
 const allUnknown=evaluateMarketing(f,Object.fromEntries(f.questions.map(q=>[q.id,'unknown'])));assert.equal(allUnknown.overallScore,null);assert.equal(allUnknown.status,'no_match');
 const first=f.marketing.categories[0],ids=f.marketing.rules.filter(r=>r.targetId===first.id&&r.answerId==='not-yet').map(r=>r.questionId);
 const partial=Object.fromEntries(f.questions.map(q=>[q.id,'consistently']));ids.slice(first.minAnswers-1).forEach(id=>partial[id]='unknown');
 const incomplete=evaluateMarketing(f,partial);assert.equal(incomplete.categories[0].score,null);assert.equal(incomplete.overallScore,null);
 partial[ids[first.minAnswers-1]]='consistently';assert.equal(evaluateMarketing(f,partial).categories[0].score,100);
 // Literal 0+3 (short) or 0+3+3+0+3 (long) gives a middle category band.
 const mixed=Object.fromEntries(f.questions.map(q=>[q.id,'consistently']));ids.forEach((id,i)=>mixed[id]=(i===0||i===3)?'not-yet':'consistently');
 const mid=evaluateMarketing(f,mixed);assert.equal(mid.categories[0].score,t.featured?60:50);assert.equal(mid.categories[0].bandTitle,'Make the practice repeatable');
}
console.log('PASS six authored diagnostic/scorecard templates, 92 questions, all outcomes, balanced ties, neutral evidence, score/coverage boundaries, themes, cloning and literal full paths');
