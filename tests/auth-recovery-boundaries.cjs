// Synthetic component boundary checks: no browser profile, server, email or provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function component(file, search, reply) {
  const effects = [], states = [], events = [], calls = [], navigations = [];
  const window = {
    location: {search, replace: next => navigations.push(next)},
    history: {replaceState: (_state, _title, url) => events.push(['strip', url])},
  };
  const react = {useRef: value => ({current:value}), useState: value => [value, value => states.push(value)], useEffect: effect => effects.push(effect)};
  const compiledModule = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {module:compiledModule, exports:compiledModule.exports, window, URLSearchParams, Error, fetch: async (url,init) => { events.push(['fetch',url]); calls.push({url,init}); return reply; }, require: id => id==='react'?react:id.endsWith('.css')?{}:require(id)}, {filename:file});
  return {Component:compiledModule.exports.default,effects,states,events,calls,navigations};
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const children = node => node && typeof node === 'object' ? [node, ...[node.props?.children].flat(Infinity).flatMap(children)] : [];
(async()=>{
  let checks=0;
  const missing=component('components/AuthCallback.tsx','?error=expired&error_description=synthetic',undefined);
  missing.Component();missing.effects[0]();
  assert.deepEqual(missing.events,[['strip','/auth/callback']]);assert.equal(missing.calls.length,0);assert.match(missing.states[0],/missing or has expired/);checks++;

  const verified=component('components/AuthCallback.tsx','?code=synthetic-code&untrusted=ignored',{ok:true,json:async()=>({next:'/'})});
  verified.Component();verified.effects[0]();verified.effects[0]();await settle();
  assert.deepEqual(verified.events,[['strip','/auth/callback'],['fetch','/api/auth/account']]);
  assert.equal(verified.calls.length,1);assert.equal(verified.calls[0].init.method,'POST');
  assert.deepEqual(JSON.parse(verified.calls[0].init.body),{action:'exchange',code:'synthetic-code'});
  assert.deepEqual(verified.navigations,['/']);checks++;

  const rejected=component('components/AuthCallback.tsx','?code=synthetic-expired',{ok:false,json:async()=>({error:'Open the email link in the same browser.'})});
  rejected.Component();rejected.effects[0]();await settle();
  assert.deepEqual(rejected.events[0],['strip','/auth/callback']);assert.deepEqual(rejected.navigations,[]);assert.match(rejected.states[0],/same browser/);checks++;

  let retries=0;
  const recovery=component('app/error.tsx','',{ok:true,json:async()=>({reference:'synthetic-reference'})});
  const nodes=children(recovery.Component({error:new Error('synthetic private quiz content'),retry:()=>retries++}));
  const link=nodes.find(node=>node.type==='a'&&node.props.href==='/');assert.ok(link);assert.equal(link.props.onClick,undefined,'native anchor retains document navigation');
  nodes.find(node=>node.type==='button').props.onClick();assert.equal(retries,1);
  recovery.effects[0]();await settle();assert.equal(recovery.calls[0].url,'/api/diagnostics');assert.equal(recovery.calls[0].init.body,undefined);
  assert.ok(!JSON.stringify(nodes).includes('synthetic private quiz content'));checks++;

  const unmounted=component('app/error.tsx','',{ok:true,json:async()=>({reference:'synthetic-reference'})});
  unmounted.Component({error:new Error('synthetic'),retry:()=>{}});const cleanup=unmounted.effects[0]();cleanup();await settle();assert.deepEqual(unmounted.states,[]);checks++;
  console.log(`PASS auth/recovery boundaries: ${checks} groups; URL stripped before one-time exchange, missing/expired recovery, native workspace navigation, private diagnostics and unmount guard. No network or email.`);
})().catch(()=>{console.error('FAIL synthetic auth/recovery boundary checks');process.exitCode=1;});
