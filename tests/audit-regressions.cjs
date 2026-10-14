const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {validationError}=require('../lib/engine.ts'),{FormSchema}=require('../lib/schema.ts'),{reportScore,reportOutcome}=require('../lib/submission-reporting.ts');
const q={id:'q',title:'Phone',type:'phone',required:true};
for(const value of ['abc','123','+1 abc 5129715049','1'.repeat(16)])assert.ok(validationError(q,value));
for(const value of ['+1 (512) 555-0100','020 7946 0958','+44 20 7946 0958'])assert.equal(validationError(q,value),null);
assert.equal(validationError({...q,required:false},''),null);
assert.ok(validationError({...q,type:'image_upload'},{id:'file',name:'test.txt',mime:'text/plain'}));
assert.equal(validationError({...q,type:'image_upload'},{id:'file',name:'image.png',mime:'image/png'}),null);
const f=FormSchema.parse({id:'audit',title:'Audit',mode:'survey',questions:[{id:'n',type:'nps',title:'Recommend?',minRating:1,maxRating:10}]});
assert.equal(f.questions[0].minRating,0);assert.equal(validationError(f.questions[0],0),null);assert.ok(validationError(f.questions[0],11));
const result={percentageScore:100,totalPointsEarned:0,totalPointsPossible:0,matchedTier:{title:'Unrelated tier'},marketing:{kind:'product_finder',title:'Baking Tools Upgrade'}};
assert.equal(reportScore(result),null);assert.equal(reportOutcome(result),'Baking Tools Upgrade');assert.equal(reportScore({...result,marketing:undefined}),null);assert.equal(reportScore({...result,marketing:undefined,totalPointsPossible:10,percentageScore:70}),70);
console.log('PASS phone formats, image metadata rejection, legacy NPS normalization and zero, ungraded score and actual recommendation reporting');

(async()=>{
 const {generateQuizWithAgent}=require('../lib/agent-generator.ts');
 const before=global.fetch,key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='synthetic-key';
 const question={type:'multiple_choice',title:'Choose one',options:[{label:'Correct',isCorrect:true},{label:'Incorrect',isCorrect:false}],explanation:'A clear distinction'};
 let fixture={title:'Synthetic',description:'Synthetic quiz',questions:[question,{...question,title:'Choose again'}]};
 global.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(fixture)}]}}]}));
 try {assert.equal((await generateQuizWithAgent({topic:'Synthetic test',numQuestions:2})).questions.length,2);
 fixture.questions[0]={...question,options:[{label:'Same answer.',isCorrect:true},{label:'same answer',isCorrect:false}]};
 await assert.rejects(()=>generateQuizWithAgent({topic:'Synthetic test',numQuestions:2}),/duplicate answer/);
 console.log('PASS generated duplicate choices rejected with mocked provider; semantic overlap still requires human review');
 } finally {global.fetch=before;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
})().catch(e=>{console.error(e);process.exitCode=1});
