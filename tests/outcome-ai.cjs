const assert=require('node:assert/strict');
const {brief,fixture}=require('./marketing-brief.cjs');
const {compileMarketingDraft,createMarketingStarter,marketingDraftSchema}=require('../lib/marketing-brief.ts');
const {generateMarketingQuiz}=require('../lib/marketing-agent.ts');
const {generateQuizWithAgent}=require('../lib/agent-generator.ts');
const {evaluateMarketing}=require('../lib/marketing.ts');
const {gradeQuizSubmission}=require('../lib/scoring.ts');
(async()=>{
 const prior=global.fetch,key=process.env.GEMINI_API_KEY;
 try {
  process.env.GEMINI_API_KEY='synthetic';
  for(const [quizType,kind] of [['personality','segmentation'],['product_finder','product_finder'],['diagnostic','segmentation'],['qualification','qualification'],['scorecard','scorecard']]) {
   const input={...brief,quizType,kind};
   const output=structuredClone(fixture);
   if(kind!=='scorecard') {delete output.overallBands;output.results.forEach(r=>delete r.bands);}
   if(kind==='qualification') {output.questions.forEach(q=>q.options.forEach(o=>delete o.weights));output.qualificationRules=[{target:0,match:'all',conditions:[{question:0,answer:0,operator:'equals'}]},{target:1,match:'all',conditions:[{question:0,answer:1,operator:'equals'}]}];}
   const result=compileMarketingDraft(input,output);assert.equal(result.form.quizType,quizType);
   assert.equal(gradeQuizSubmission(result.form,{}).quizType,quizType);
   global.fetch=async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]}));
   assert.equal((await generateMarketingQuiz(input)).form.quizType,quizType);
   const starter=createMarketingStarter({...input,numQuestions:12});assert.equal(starter.form.quizType,quizType);
   if(kind==='qualification') {assert.equal(starter.form.marketing.rules.length,0);assert.equal(evaluateMarketing(starter.form,{'question-0':'answer-1'}).outcomeId,'target-1');assert.equal(evaluateMarketing(starter.form,{}).status,'no_match');}
   if(kind!=='scorecard') assert.equal(marketingDraftSchema(kind).safeParse(output).success,true);
  }
  global.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({title:'Facts',description:'Learn',questions:[{type:'multiple_choice',title:'One?',options:[{label:'True',isCorrect:true},{label:'False',isCorrect:false}]},{type:'multiple_choice',title:'Two?',options:[{label:'True',isCorrect:true},{label:'False',isCorrect:false}]}]})}]}}]}));
  assert.equal((await generateQuizWithAgent({topic:'Basic facts',numQuestions:2,quizType:'knowledge'})).quizType,'knowledge');
  assert.throws(()=>compileMarketingDraft({...brief,quizType:'personality',kind:'product_finder'},fixture));
  assert.throws(()=>compileMarketingDraft({...brief,kind:'qualification',quizType:'qualification'},fixture));
  console.log('PASS all six type-specific AI paths with mocked transport; no-score schemas, explicit route rules, 12-question starters and frozen identity');
 } finally {global.fetch=prior;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
})().catch(e=>{console.error(e);process.exitCode=1;});
