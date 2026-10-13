const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
let modelResponse,authorized=true,status=200,networkError=false;const env={GEMINI_API_KEY:'synthetic',GEMINI_MODEL:'test'};let calls=0;
function load(file,imports){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>imports[n]||require(n),process:{env},Response,Request,AbortSignal,fetch:async()=>{calls++;if(networkError)throw Error('network');return new Response(JSON.stringify(modelResponse),{status});},console:{warn(){}},Set});return module.exports;}
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const help=load('lib/help-content.ts',{}),guidance=load('lib/support-guidance.ts',{});const api=load('app/api/support/chat/route.ts',{'@/lib/help-content':help,'@/lib/support-guidance':guidance,'@/lib/rate-limit':{rateLimit(){}},'@/lib/auth':{HttpError,requireUser:async()=>{if(!authorized)throw new HttpError(401,'Sign in');},checkOrigin(){},apiError:e=>Response.json({error:e.message},{status:e.status||400})}});
async function ask(extra={}){return api.POST(new Request('http://localhost/api/support/chat',{method:'POST',body:JSON.stringify({message:'How do I set up result emails and PDF reports?',...extra})}));}
function fallback(d){assert.equal(d.mode,'guide');assert.match(d.answer,/Create private result link/);assert.match(d.answer,/Apply email copy/);assert.ok(d.answer.length>1500);assert.equal(d.sources[0].href,'/help/email-and-pdf');}
(async()=>{
modelResponse={candidates:[{content:{parts:[{text:JSON.stringify({answer:'Follow the result email guide.',sources:['email-and-pdf']})}]}}]};let d=await(await ask()).json();assert.equal(d.mode,'ai');
modelResponse.candidates[0].content.parts[0].text=JSON.stringify({answer:'Bogus citation',sources:['not-a-guide']});fallback(await(await ask()).json());
modelResponse.candidates[0].content.parts[0].text='not json';fallback(await(await ask()).json());
status=429;fallback(await(await ask()).json());status=200;networkError=true;fallback(await(await ask()).json());networkError=false;
delete env.GEMINI_API_KEY;const before=calls;fallback(await(await ask()).json());assert.equal(calls,before);
d=await(await ask({message:'What do I do next?',article:'pages-and-fields'})).json();assert.match(d.answer,/First name/);assert.equal(d.sources[0].href,'/help/pages-and-fields');
authorized=false;assert.equal((await ask()).status,401);assert.equal(calls,before);
console.log('PASS provider success, source validation, malformed output, quota/network/missing-key instructional fallback, article context and authentication; synthetic only');
})().catch(e=>{console.error(e);process.exitCode=1;});
