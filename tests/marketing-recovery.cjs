require('./marketing-brief.cjs');
const assert=require('node:assert/strict');
const {brief,fixture}=require('./marketing-brief.cjs');
const {generateMarketingQuiz}=require('../lib/marketing-agent.ts');
const {compileMarketingDraft}=require('../lib/marketing-brief.ts');
const {evaluateMarketing}=require('../lib/marketing.ts');
const response=d=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:typeof d==='string'?d:JSON.stringify(d)}]}}]}));
(async()=>{
 const original=global.fetch,key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='synthetic';
 try {
  for(const bad of ['{broken', {...fixture,questions:[]}]) {
   let calls=0;global.fetch=async(u,o)=>{calls++;if(calls===2)assert.match(JSON.parse(o.body).systemInstruction.parts[0].text,/previous attempt failed/);return response(calls===1?bad:fixture);};
   assert.equal((await generateMarketingQuiz(brief)).form.questions.length,3);assert.equal(calls,2);
  }
  let calls=0;global.fetch=async()=>{calls++;return response('bad');};
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===502&&/one automatic retry/.test(e.message));assert.equal(calls,2);
  for(const status of [400,401,403,404,429,500]) {
   calls=0;global.fetch=async()=>{calls++;return new Response('{}',{status});};
   await assert.rejects(()=>generateMarketingQuiz(brief));assert.equal(calls,1);
  }
  calls=0;global.fetch=async()=>{calls++;return new Response(JSON.stringify({promptFeedback:{blockReason:'SAFETY'}}));};
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===422);assert.equal(calls,1);
  global.fetch=async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning'}, {text:JSON.stringify(fixture)}]}}]}));
  assert.equal((await generateMarketingQuiz(brief)).form.questions.length,3);
  let paths=0;
  for(const kind of ['segmentation','product_finder','scorecard'])for(const count of [3,6,12]) {
   const b={...brief,kind,numQuestions:count};const d=structuredClone(fixture);
   d.questions=Array.from({length:count},(_,i)=>({...structuredClone(fixture.questions[i%3]),title:`Test question ${i+1}`}));
   const {form}=compileMarketingDraft(b,d);
   const neutral=Object.fromEntries(form.questions.map(q=>[q.id,'answer-2']));
   const n=evaluateMarketing(form,neutral);assert.equal(n.status,'no_match');paths++;
   if(kind==='scorecard')for(const [answer,score] of [['answer-0',100],['answer-1',0]]) {
    const r=evaluateMarketing(form,Object.fromEntries(form.questions.map(q=>[q.id,answer])));assert.equal(r.overallScore,score);paths++;
   } else for(const target of ['target-0','target-1']) {
    const answers=Object.fromEntries(form.questions.map(q=>[q.id,form.marketing.rules.some(r=>r.questionId===q.id&&r.targetId===target&&r.points>0)?'answer-0':'answer-2']));
    assert.equal(evaluateMarketing(form,answers).outcomeId,target);paths++;
   }
  }
  const impossible=structuredClone(fixture);
  impossible.questions.forEach(q=>q.options[0].weights=[{target:0,points:10},{target:1,points:10}]);
  assert.throws(()=>compileMarketingDraft({...brief,kind:'segmentation'},impossible),/clear answer path/);
  console.log(`PASS recovery bounds, provider errors, safety stops, thought filtering, 9 brief shapes / ${paths} scoring paths, unreachable outcome rejection`);
 }finally{global.fetch=original;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
})().catch(e=>{console.error(e);process.exitCode=1});
