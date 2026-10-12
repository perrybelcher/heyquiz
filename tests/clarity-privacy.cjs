const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../lib/clarity.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function setup(url='https://www.pippiapp.com/create', value='granted', referrer='') {
  const events={}, scripts=[], attributes={}, values=new Map(), exports={};
  if(value) values.set('pippi-behavior-consent-v1',JSON.stringify({value,expires:Date.now()+100000}));
  const location=new URL(url), window={addEventListener:(name,fn)=>events[name]=fn};
  const context={exports,process:{env:{}},URL,Date,Number,JSON,location,navigator:{},localStorage:{getItem:k=>values.get(k)},window,
    history:{pushState:(_d,_u,next)=>{events.destination=next;},replaceState:()=>{}},
    document:{referrer,documentElement:{setAttribute:(k,v)=>attributes[k]=v},addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({}),head:{appendChild:el=>scripts.push(el)}}};
  vm.runInNewContext(source,context);return {api:exports,context,window,events,scripts,attributes,values};
}
let n=0;function test(name,fn){fn();console.log('PASS '+name);n++;}
test('Only production creator routes without query/token fragments are eligible',()=>{
  const {api}=setup();for(const path of ['/create','/create/blank','/create/ai','/create/guided','/templates','/editor/quiz-example']) assert.ok(api.clarityLocationAllowed('https://www.pippiapp.com'+path),path);
  for(const path of ['/login','/signup','/reset-password','/auth/callback?code=secret','/result/secret','/play/example','/create?email=private','/create#token','/api/contacts','/','/create/draft'])assert.equal(api.clarityLocationAllowed('https://www.pippiapp.com'+path),false,path);
  for(const url of ['http://127.0.0.1:3175/create','https://heyquiz-fawn.vercel.app/create','https://www.pippiapp.com.evil.test/create'])assert.equal(api.clarityLocationAllowed(url),false);
});
test('No tag before consent, after denial/expiry, with GPC or sensitive referrer',()=>{
  for(const value of [null,'denied']){const s=setup(undefined,value);assert.equal(s.api.startClarity(),false);assert.equal(s.scripts.length,0);}
  const expired=setup();expired.values.set('pippi-behavior-consent-v1',JSON.stringify({value:'granted',expires:1}));assert.equal(expired.api.startClarity(),false);
  const gpc=setup();gpc.context.navigator.globalPrivacyControl=true;assert.equal(gpc.api.startClarity(),false);
  for(const ref of ['https://www.pippiapp.com/result/private','https://www.pippiapp.com/auth/callback','https://example.test/?email=private'])assert.equal(setup(undefined,'granted',ref).api.startClarity(),false);
});
test('One masked tag; analytics only; fixed events cannot transmit arbitrary content',()=>{
  const s=setup();assert.equal(s.api.startClarity(),true);s.api.startClarity();assert.equal(s.scripts.length,1);assert.equal(s.attributes['data-clarity-mask'],'true');assert.equal(s.scripts[0].referrerPolicy,'no-referrer');
  assert.equal(s.window.clarity.q[0][1].ad_Storage,'denied');assert.equal(s.window.clarity.q[0][1].analytics_Storage,'granted');
  s.api.clarityEvent('answer_example');s.api.clarityEvent('private@example.test');assert.equal(s.window.clarity.q.filter(c=>c[0]==='event').length,1);
});
test('Private navigation stops before history changes; no restart in the same document',()=>{
  const s=setup();s.api.startClarity();s.context.history.pushState(null,'','/result/private');assert.equal(s.window.clarity.q.at(-1)[0],'stop');assert.equal(s.events.destination,'/result/private');s.api.clarityEvent('answer_example');assert.ok(!s.window.clarity.q.some(c=>c[0]==='event'));assert.equal(s.api.startClarity(),false);
  s.scripts[0].onload();assert.equal(s.window.clarity.q.at(-1)[0],'stop','Late vendor load remains stopped');
});
test('Withdrawal and back navigation stop collection',()=>{for(const action of ['stop','back']){const s=setup();s.api.startClarity();action==='stop'?s.api.stopClarity():s.events.popstate();assert.equal(s.window.clarity.q.at(-1)[0],'stop');}});
console.log(`${n} Clarity privacy groups passed; no network calls.`);
