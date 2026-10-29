const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,...rest){return resolve.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,...rest);};
let saves=0;
Module._load=function(name,...rest){
 if(name==='@/lib/auth')return {checkOrigin:()=>{},requireUser:async()=>({id:'synthetic-owner'}),apiError:e=>Response.json({error:e.message},{status:e.status||400})};
 if(name==='@/lib/storage')return {saveForm:async form=>{saves++;return form;},getAllForms:async()=>[]};
 return load.call(this,name,...rest);
};
const previous=process.env.NEXT_PUBLIC_OUTCOME_QUIZZES_ENABLED;
(async()=>{try{
 for(const enabled of [false,true]){
  process.env.NEXT_PUBLIC_OUTCOME_QUIZZES_ENABLED=enabled?'1':'0';
  for(const file of ['../lib/outcome-availability.ts','../app/api/forms/route.ts'])delete require.cache[require.resolve(file)];
  const {POST}=require('../app/api/forms/route.ts');
  const send=body=>POST(new Request('https://example.test/api/forms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'synthetic',title:'Synthetic',mode:'survey',...body})}));
  assert.equal((await send({marketing:{kind:'qualification'}})).status,400);
  assert.equal((await send({quizType:'qualification',marketing:{kind:'qualification'}})).status,enabled?201:503);
  assert.equal((await send({quizType:'personality',marketing:{kind:'segmentation'}})).status,enabled?201:503);
  assert.equal((await send({marketing:{kind:'segmentation'}})).status,201);
  assert.equal((await send({quizType:'knowledge',mode:'quiz'})).status,201);
 }
 assert.equal(saves,6);
 const {MarketingBriefSchema}=require('../lib/marketing-brief.ts');
 const brief={audience:'Owners',offer:'Coaching offer',goal:'Book',kind:'qualification',ctaLabel:'Book',ctaUrl:'https://example.test',targets:[{title:'One',description:'First route'},{title:'Two',description:'Second route'}]};
 assert.equal(MarketingBriefSchema.safeParse(brief).success,false);assert.equal(MarketingBriefSchema.safeParse({...brief,quizType:'qualification'}).success,true);
 console.log('PASS creation rollback blocks typed outcomes and untyped qualification; preserves legacy marketing and knowledge creation');
}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_OUTCOME_QUIZZES_ENABLED;else process.env.NEXT_PUBLIC_OUTCOME_QUIZZES_ENABLED=previous;Module._load=load;Module._resolveFilename=resolve;}})().catch(e=>{console.error(e);process.exitCode=1;});
