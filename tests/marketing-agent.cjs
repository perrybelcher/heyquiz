const assert=require('node:assert/strict');
const {brief,fixture}=require('./marketing-brief.cjs');
const {generateMarketingQuiz}=require('../lib/marketing-agent.ts');
(async()=>{
 const fetchBefore=global.fetch,keyBefore=process.env.GEMINI_API_KEY;
 try{
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===503);
  process.env.GEMINI_API_KEY='synthetic-test-key';
  let calls=0;
  global.fetch=async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.ok(body.systemInstruction.parts[0].text.includes('Do not invent'));assert.equal(JSON.parse(body.contents[0].parts[0].text).audience,brief.audience);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(fixture)}]}}]}),{status:200});};
  const result=await generateMarketingQuiz(brief);assert.equal(result.form.questions.length,3);assert.equal(calls,1);
  global.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'```json\n'+JSON.stringify(fixture)+'\n```'}]}}]}),{status:200});
  assert.equal((await generateMarketingQuiz(brief)).form.questions.length,3);
  global.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"questions":[]}'}]}}]}),{status:200});
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===502);
  global.fetch=async()=>new Response('',{status:429});
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===503 && e.message.includes('usage limit'));
  global.fetch=async()=>{throw new DOMException('timed out','TimeoutError');};
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===504 && e.message.includes('brief is still here'));
  global.fetch=async()=>{throw new TypeError('network disconnected');};
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===502 && e.message.includes('could not reach'));
  global.fetch=async()=>new Response('not json',{status:200});
  await assert.rejects(()=>generateMarketingQuiz(brief),e=>e.status===502);
  console.log('PASS mocked AI transport, missing configuration, invalid output and provider failure');
 }finally{global.fetch=fetchBefore;if(keyBefore===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=keyBefore;}
})().catch(e=>{console.error(e);process.exitCode=1;});
