const {brief,fixture}=require('./marketing-brief.cjs');
const {compileMarketingDraft}=require('../lib/marketing-brief.ts');
const {evaluateMarketing}=require('../lib/marketing.ts');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:3155';let cookie='';const ids=[];
async function req(path,body,auth=true,method='POST') {const r=await fetch(base+path,{method,headers:{Origin:base,'Content-Type':'application/json',...(auth?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}
(async()=>{const login=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{"local":true}'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];let tested=0;
try{for(const kind of ['segmentation','product_finder','scorecard'])for(const numQuestions of [3,6,12]) {
 const d=structuredClone(fixture);d.questions=Array.from({length:numQuestions},(_,i)=>({...structuredClone(fixture.questions[i%3]),title:`Matrix question ${i+1}`}));
 const {form}=compileMarketingDraft({...brief,kind,numQuestions},d);form.title=`QA local ${kind} ${numQuestions}`;await req('/api/forms',form);ids.push(form.id);await req(`/api/forms/${form.id}/publish`,{});
 const cases=[Object.fromEntries(form.questions.map(q=>[q.id,'answer-2']))];
 if(kind==='scorecard')for(const answer of ['answer-0','answer-1'])cases.push(Object.fromEntries(form.questions.map(q=>[q.id,answer])));
 else for(const target of ['target-0','target-1'])cases.push(Object.fromEntries(form.questions.map(q=>[q.id,form.marketing.rules.some(r=>r.questionId===q.id&&r.targetId===target&&r.points>0)?'answer-0':'answer-2'])));
 cases.push(Object.fromEntries(form.questions.map((q,i)=>[q.id,`answer-${i%3}`])));
 for(const answers of cases){const start=await req(`/api/forms/${form.id}/start`,{},false);assert.deepEqual(start.form.marketing.rules,[]);const result=await req(`/api/forms/${form.id}/submit`,{token:start.token,answers},false);assert.deepEqual(result.marketing,evaluateMarketing(form,answers));tested++;}
 }console.log(`PASS ${tested} anonymous published submissions match preview across 9 generated fixture shapes`);
}finally{for(const id of ids)await req('/api/forms/'+id,undefined,true,'DELETE');}})().catch(e=>{console.error(e);process.exitCode=1});
