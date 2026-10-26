// Real client coordination with mocked HTTP, no authentication credentials/providers.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
global.window=new EventTarget();global.BroadcastChannel=undefined;global.localStorage={length:0,getItem:()=>null,setItem:()=>{},key:()=>null};
const {checkEditorSession,registerDraftSave,prepareLogout,requestSafeLogout}=require('../lib/session-client.ts');
(async()=>{let calls=0,release;global.fetch=async()=>{calls++;await new Promise(r=>release=r);return Response.json({state:'authenticated',accountKey:'opaque',expiresAt:12345})};const first=checkEditorSession(),second=checkEditorSession();assert.equal(first,second);release();assert.equal((await first).accountKey,'opaque');assert.equal(calls,1);
global.fetch=async()=>Response.json({error:'expired'},{status:401});assert.equal((await checkEditorSession()).state,'reauth_required');
global.fetch=async()=>Response.json({error:'private provider detail'},{status:503});const outage=await checkEditorSession();assert.equal(outage.state,'unavailable');assert.ok(!JSON.stringify(outage).includes('private provider'));
global.fetch=async()=>{throw Error('network')};assert.equal((await checkEditorSession()).state,'unavailable');
global.fetch=async()=>Response.json({state:'authenticated',accountKey:'opaque',expiresAt:'invalid'});assert.equal((await checkEditorSession()).state,'unavailable');
let saves=0;const cleanup=registerDraftSave(async()=>{saves++;return {saved:true,persistent:true,dirty:true}});assert.equal((await prepareLogout())[0].saved,true);assert.equal(saves,1);cleanup();assert.deepEqual(await prepareLogout(),[]);
let loggedOut=false;global.fetch=async(url,init)=>{assert.equal(url,'/api/auth');assert.equal(init.method,'DELETE');loggedOut=true;return Response.json({ok:true})};assert.equal(await requestSafeLogout(),true);assert.ok(loggedOut);
console.log('PASS client session coordination: deduplicated checks, definitive vs transient failures, metadata validation, draft preparation and confirmed logout.');
})().catch(error=>{console.error(error);process.exitCode=1});
