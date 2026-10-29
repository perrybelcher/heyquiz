// Stateful hook harness executes real autosave transitions with synthetic browser
// storage and HTTP. Timers are held so no real server or background retry runs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const originalResolve=Module._resolveFilename;Module._resolveFilename=function(name,...rest){return originalResolve.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,...rest)};
const {FormSchema}=require('../lib/schema.ts');
class Store {constructor(){this.rows=new Map()}get length(){return this.rows.size}key(i){return [...this.rows.keys()][i]??null}getItem(k){return this.rows.get(k)??null}setItem(k,v){this.rows.set(k,v)}removeItem(k){this.rows.delete(k)}}
function harness({guest=false,accountKey='account-a',initial,fetcher,session=()=>({state:'authenticated',accountKey:'account-a',expiresAt:Date.now()+100000})}) {
 const slots=[],timers=new Map(),sessionStorage=new Store(),localStorage=new Store(),window=new EventTarget(),document=new EventTarget(),navigations=[],draftGuards=new Set();
 document.visibilityState='visible';window.history={replaceState:()=>{}};window.location={assign:url=>navigations.push(url)};
 let index=0,scheduled=false,disposed=false,form=initial,result,sequence=0,effects=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((item,i)=>Object.is(item,b[i]));
 function schedule(){if(!scheduled&&!disposed){scheduled=true;queueMicrotask(()=>{scheduled=false;render()})}}
 const react={useState(value){const i=index++;if(!(i in slots))slots[i]={value:typeof value==='function'?value():value};return[slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;schedule()}}]},useRef(value){const i=index++;return slots[i]??(slots[i]={current:value})},useCallback(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},useEffect(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn()})}}};
 const sessionClient={checkEditorSession:async()=>session(),registerDraftSave:guard=>{draftGuards.add(guard);return()=>draftGuards.delete(guard)}};
 const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../hooks/useAutosave.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const compiled={exports:{}};const context={module:compiled,exports:compiled.exports,require:id=>id==='react'?react:id==='@/lib/session-client'?sessionClient:id==='@/lib/clarity'?{clarityEvent:()=>{}}:require(id),window,document,navigator:{onLine:true},sessionStorage,localStorage,crypto:global.crypto,AbortSignal,Response,Date,JSON,console,queueMicrotask,setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,context,{filename:'useAutosave.ts'});
 function render(){index=0;effects=[];result=compiled.exports.useAutosave(form,guest,{accountKey:guest?undefined:accountKey,onRestore:value=>{form=value;schedule()}});const pending=effects;effects=[];for(const effect of pending)effect()}
 context.fetch=(...args)=>fetcher(...args);
 render();
 return {get value(){return result},window,document,localStorage,sessionStorage,timers,navigations,draftGuards,edit(value){form=value;render()},dispose(){disposed=true;for(const slot of slots)slot?.cleanup?.()},async settle(){for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve))}};
}
const fixture=(title='Pending',revision=0)=>FormSchema.parse({id:'reliability',title,revision,mode:'survey',questions:[{id:'q',title:'Question',type:'short_answer'}]});
(async()=>{let groups=0;
 // Failed before commit: an authoritative absent read permits same-ID creation.
 let posts=0;const draft=fixture();let app=harness({guest:true,initial:draft,fetcher:async(_url,init)=>{if(init?.method==='POST'){posts++;if(posts===1)throw Error('connection lost before commit');return Response.json({...draft,revision:1})}return Response.json({error:'not found'},{status:404})}});await app.settle();assert.equal(await app.value.saveNow(draft),false);await app.settle();assert.equal(posts,1);await app.value.saveNow(draft);await app.settle();assert.equal(posts,2);assert.equal(app.navigations.at(-1),'/editor/reliability');app.dispose();groups++;
 // A successful-but-unreadable creation confirmation can never become another POST.
 posts=0;app=harness({guest:true,initial:draft,fetcher:async(_url,init)=>{if(init?.method==='POST'){posts++;return new Response('unreadable',{status:201})}return Response.json({error:'not found'},{status:404})}});await app.settle();await app.value.saveNow(draft);await app.settle();await app.value.saveNow(draft);await app.settle();assert.equal(posts,1);assert.match(app.value.error,/verify/);app.dispose();groups++;
 // A lost PUT response is reconciled from actual server data without another PUT.
 const server=fixture('Original',4),changed={...server,title:'Latest'};let puts=0;let stored=server;app=harness({initial:server,fetcher:async(_url,init)=>{if(init?.method==='PUT'){puts++;stored={...changed,revision:5};throw Error('response lost')}return Response.json(stored)}});await app.settle();app.edit(changed);await app.settle();assert.equal(await app.value.saveNow(changed),true);await app.settle();assert.equal(puts,1);assert.equal(app.value.status,'saved');assert.equal([...app.localStorage.rows.keys()].filter(key=>key.startsWith('pippi-draft:')).length,0);app.dispose();groups++;
 // Expiry pauses mutations; wrong-account sign-in cannot write the draft.
 let identity={state:'authenticated',accountKey:'account-a',expiresAt:Date.now()+100000};puts=0;app=harness({initial:server,session:()=>identity,fetcher:async(_url,init)=>{if(init?.method==='PUT'){puts++;return Response.json({...changed,revision:5})}return Response.json(server)}});await app.settle();app.edit(changed);await app.settle();identity={state:'reauth_required'};app.window.dispatchEvent(new Event('focus'));await app.settle();assert.equal(app.value.authRequired,true);assert.equal(app.value.canEdit(),false);identity={state:'authenticated',accountKey:'account-b',expiresAt:Date.now()+100000};await app.value.afterSignIn();await app.settle();assert.equal(app.value.accountMismatch,true);assert.equal(puts,0);identity={state:'authenticated',accountKey:'account-a',expiresAt:Date.now()+100000};await app.value.afterSignIn();await app.settle();assert.equal(app.value.authRequired,false);assert.equal(puts,1);app.dispose();groups++;
 // A timer scheduled while visible cannot write after the browser is hidden.
 puts=0;app=harness({initial:server,fetcher:async(_url,init)=>{if(init?.method==='PUT'){puts++;return Response.json({error:'unavailable'},{status:503})}return Response.json(server)}});await app.settle();app.edit(changed);await app.settle();await app.value.saveNow(changed);await app.settle();const retry=[...app.timers.values()].find(timer=>timer.ms===2000);assert.ok(retry);app.document.visibilityState='hidden';retry.fn();await app.settle();assert.equal(puts,1);app.dispose();groups++;
 // location.assign is recorded without destroying this document: model a user
 // cancelling beforeunload after guest claim. Immediate refresh stays suppressed,
 // but focus, real activity and a cross-tab auth notice must restore protection.
 for(const trigger of ['focus','pointerdown','storage']) {
  let sessionChecks=0,sessionState={state:'authenticated',accountKey:'account-a',expiresAt:Date.now()+100000};
  app=harness({guest:true,initial:draft,session:()=>{sessionChecks++;return sessionState},fetcher:async()=>Response.json({...draft,revision:1})});
  await app.settle();await app.value.saveNow(draft);await app.settle();
  assert.equal(app.value.claimed,true);assert.equal(app.navigations.length,1);
  assert.equal(sessionChecks,2,'Claim must not start an immediate departure-time session refresh');
  assert.equal(app.draftGuards.size,1,'Cancelled departure must retain logout draft protection');
  sessionState={state:'reauth_required'};
  const event=new Event(trigger);if(trigger==='storage')Object.defineProperty(event,'key',{value:'pippi-auth-notice'});
  (trigger==='pointerdown'?app.document:app.window).dispatchEvent(event);await app.settle();
  assert.ok(sessionChecks>2,`${trigger} resumes session verification after cancelled departure`);
  assert.equal(app.value.authRequired,true,`${trigger} detects revoked authentication`);
  assert.equal(app.value.canEdit(),false);app.dispose();assert.equal(app.draftGuards.size,0);groups++;
 }
 // The retained logout guard saves edits made after cancelled claim navigation
 // through PUT on the same quiz, never a second guest creation.
 posts=0;puts=0;let claimedStored;
 app=harness({guest:true,initial:draft,fetcher:async(_url,init)=>{const body=JSON.parse(init.body);if(init.method==='POST')posts++;else if(init.method==='PUT')puts++;claimedStored={...body,revision:init.method==='POST'?1:2};return Response.json(claimedStored)}});
 await app.settle();await app.value.saveNow(draft);await app.settle();
 app.edit({...draft,title:'Edited after cancelling navigation'});await app.settle();
 assert.equal(app.draftGuards.size,1);const guarded=await [...app.draftGuards][0]();await app.settle();
 assert.equal(guarded.dirty,true);assert.equal(guarded.saved,true);assert.equal(guarded.persistent,true);
 assert.equal(posts,1);assert.equal(puts,1);assert.equal(claimedStored.title,'Edited after cancelling navigation');
 app.dispose();groups++;
 console.log(`PASS autosave reliability: ${groups} groups; creation/reconciliation, same-account reauthentication, hidden retry protection, cancelled claim navigation recovery and retained logout draft guards.`);
})().catch(error=>{console.error(error);process.exitCode=1});
