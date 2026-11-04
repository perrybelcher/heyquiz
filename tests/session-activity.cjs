// Exercise the real component's event handlers with deferred session responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let state, effects = [], refs = [], cursor = 0, calls = 0, release;
let now = 1000000;
const window = new EventTarget(), document = new EventTarget();
document.visibilityState = 'visible';
const react = {
  useState: initial => { state ??= initial; return [state, value => { state = typeof value === 'function' ? value(state) : value; }]; },
  useRef: initial => refs[cursor++] ??= { current: initial },
  useCallback: fn => fn,
  useEffect: fn => effects.push(fn),
};
const jsx = (type, props) => ({ type, props });
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/SessionActivity.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: moduleObject.exports, module: moduleObject, window, document, Event,
  Date: { now: () => now }, setTimeout, clearTimeout,
  require: name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name === 'next/navigation') return { usePathname: () => '/contacts' };
    if (name === '@/lib/session-client') return {
      startSessionCoordination() {},
      checkEditorSession() { calls++; return new Promise(resolve => { release = resolve; }); },
    };
    return {};
  },
});
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const Component = moduleObject.exports.default;
  Component({ accountKey: 'owner', children: 'workspace' });
  const cleanup = effects[0]();
  assert.equal(state, 'authenticated', 'Entry check must not block the server-authenticated workspace');
  release({ state: 'authenticated', accountKey: 'owner', expiresAt: now + 3600000 }); await tick();
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(state, 'authenticated', 'Leaving the tab must not show a modal');
  now += 1000; document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'));
  assert.equal(calls, 1, 'A one-second return must reuse the recent check');
  now += 300000; window.dispatchEvent(new Event('focus'));
  assert.equal(calls, 2); assert.equal(state, 'authenticated', 'Slow routine checks must stay silent');
  release({ state: 'reauth_required' }); await tick();
  assert.equal(state, 'reauth_required', 'Confirmed expiry must require recovery');
  window.dispatchEvent(new Event('pippi-auth-change'));
  assert.equal(calls, 3, 'Explicit auth changes bypass the interval');
  assert.equal(state, 'reauth_required');
  release({ state: 'authenticated', accountKey: 'different', expiresAt: now + 3600000 }); await tick();
  assert.equal(state, 'mismatch', 'A different account cannot release the workspace');
  window.dispatchEvent(new Event('pippi-auth-change'));
  release({ state: 'authenticated', accountKey: 'owner', expiresAt: now + 3600000 }); await tick();
  assert.equal(state, 'authenticated');
  window.dispatchEvent(new Event('pippi-auth-change'));
  assert.equal(state, 'checking', 'Known identity changes block immediately');
  release({ state: 'unavailable' }); await tick(); assert.equal(state, 'unavailable');
  cleanup();
  console.log('PASS session activity: quiet entry and resume, short-return throttling, expiry, account changes and outages');
})().catch(error => { console.error(error); process.exitCode = 1; });
