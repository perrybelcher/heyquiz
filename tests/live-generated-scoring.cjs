// Explicitly pass exported synthetic QA quiz schemas. Never enumerates user quizzes.
require('./marketing-brief.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {evaluateMarketing}=require('../lib/marketing.ts');
const base='https://www.pippiapp.com';
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}
(async()=>{let count=0;for(const file of process.argv.slice(2)){
 const f=JSON.parse(fs.readFileSync(file,'utf8')),m=f.marketing;
 const choose=fn=>Object.fromEntries(f.questions.map(q=>[q.id,fn(q)]));
 const rules=(q,o)=>m.rules.filter(r=>r.questionId===q.id&&r.answerId===o.id);
 const neutral=choose(q=>q.options.find(o=>!rules(q,o).length).id);
 const cases=[neutral];
 if(m.kind==='scorecard')for(const direction of [1,-1])cases.push(choose(q=>[...q.options].filter(o=>rules(q,o).length).sort((a,b)=>direction*(rules(q,b).reduce((n,r)=>n+r.points,0)-rules(q,a).reduce((n,r)=>n+r.points,0)))[0].id));
 else for(const target of m.outcomes)cases.push(choose(q=>[...q.options].sort((a,b)=>{
  const own=o=>rules(q,o).filter(r=>r.targetId===target.id).reduce((n,r)=>n+r.points,0),other=o=>rules(q,o).filter(r=>r.targetId!==target.id).reduce((n,r)=>n+r.points,0);return own(b)-own(a)||other(a)-other(b);
 })[0].id));
 cases.push(choose(q=>q.options[f.questions.indexOf(q)%q.options.length].id));
 const expected=cases.map(a=>evaluateMarketing(f,a));assert.equal(expected[0].status,'no_match');
 if(m.kind==='scorecard'){assert.equal(expected[1].overallScore,100);assert.equal(expected[2].overallScore,0);}else m.outcomes.forEach((o,i)=>assert.equal(expected[i+1].outcomeId,o.id));
 for(let i=0;i<cases.length;i++){const start=await post(`/api/forms/${f.id}/start`,{});assert.deepEqual(start.form.marketing.rules,[]);const result=await post(`/api/forms/${f.id}/submit`,{token:start.token,answers:cases[i]});assert.deepEqual(result.marketing,expected[i]);count++;}
 console.log(`PASS live ${f.id}: ${m.kind}, ${f.questions.length} questions, ${cases.length} published paths match preview`);
 }console.log(`PASS ${count} live synthetic submissions; no contact details or emails`);
})().catch(e=>{console.error(e);process.exitCode=1});
