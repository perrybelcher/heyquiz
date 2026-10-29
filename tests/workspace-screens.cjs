const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const path = require('node:path');
function component(file, initialResponses = [], version = "v1") {
  const slots = [], responses = [...initialResponses], requests = [], listeners = new Map();
  let cursor = 0, effects = [], queued = false, result, guard, confirm = false;
  const schedule = () => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; render(); }); } };
  const react = {
    useSyncExternalStore() { return false; },
    useLayoutEffect(fn, deps) { return react.useEffect(fn, deps); },
    useState(value) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof value === 'function' ? value() : value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; schedule(); }]; },
    useRef(value) { const i = cursor++; return slots[i] || (slots[i] = { current: value }); },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) { slots[i] = { deps }; effects.push(fn); } },
  };
  const compiledModule = { exports: {} };
  const fetch = async (url, options = {}) => { requests.push({ url, ...options }); const next = responses.shift(); assert.ok(next, `Unexpected fetch ${url}`); return { ok: next.status < 400, status: next.status, json: async () => next.body }; };
  const browser = { confirm: () => confirm, alert() {}, dispatchEvent() {}, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module: compiledModule, exports: compiledModule.exports, fetch, Event, window: browser,
    require: id => id.endsWith('/v2/InterfaceContext') ? { useInterfaceVersion: () => version } : id === 'react' ? react : id === 'react/jsx-runtime' ? jsx : id === '@/lib/workspace-navigation' ? { registerWorkspaceNavigationGuard(fn) { guard = fn; return () => {}; }, workspaceNavigationApproved: () => false } : id === 'next/link' ? { default: 'a' } : new Proxy({}, { get: (_, key) => key }),
  });
  let props = {};
  function render() { cursor = 0; effects = []; result = compiledModule.exports.default(props); for (const effect of effects) effect(); }
  return { mount(value = {}) { props = value; render(); }, get tree() { return result; }, responses, requests, listeners, get guard() { return guard; }, allowDeparture(value) { confirm = value; }, async settle() { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); } };
}
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function text(tree) { if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (!tree || typeof tree !== 'object') return ''; return [tree.props?.children].flat(Infinity).map(text).join(' '); }
function inputs(harness) { return nodes(harness.tree).filter(n => n.type === 'input'); }
const profile = { name: 'Original', company: 'Company', email: 'owner@example.test', revision: 1, local: false };
const submit = (harness, index) => nodes(harness.tree).filter(n => n.type === 'form')[index].props.onSubmit({ preventDefault() {} });
(async () => {
  let groups = 0;
  const h = component(path.resolve('components/ProfileSettings.tsx'), [{ status: 200, body: profile }]); h.mount(); await h.settle();
  assert.equal(inputs(h)[0].props.value, 'Original');
  inputs(h)[0].props.onChange({ target: { value: 'Edited' } }); await h.settle();
  assert.equal(await h.guard(), false); h.allowDeparture(true); assert.equal(await h.guard(), true);
  let prevented = false; h.listeners.get('beforeunload')({ preventDefault() { prevented = true; } }); assert.ok(prevented); groups++;
  h.responses.push({ status: 503, body: { error: 'Temporarily unavailable' } }); await submit(h, 0); await h.settle();
  assert.equal(inputs(h)[0].props.value, 'Edited'); assert.match(text(h.tree), /Temporarily unavailable/);
  h.responses.push({ status: 200, body: { ...profile, name: 'Edited', revision: 2 } }); await submit(h, 0); await h.settle();
  assert.match(text(h.tree), /Profile details saved/); assert.equal(JSON.parse(h.requests.at(-1).body).revision, 1); groups++;
  inputs(h)[2].props.onChange({ target: { value: 'next@example.test' } }); inputs(h)[3].props.onChange({ target: { value: 'synthetic-current-password' } }); await h.settle();
  h.responses.push({ status: 400, body: { error: 'Confirmation failed' } }); await submit(h, 1); await h.settle();
  assert.equal(inputs(h)[2].props.value, 'next@example.test'); assert.equal(inputs(h)[3].props.value, 'synthetic-current-password');
  h.responses.push({ status: 200, body: { ...profile, name: 'Edited', revision: 2, pendingEmail: 'next@example.test' } }); await submit(h, 1); await h.settle();
  assert.equal(inputs(h)[2].props.value, ''); assert.equal(inputs(h)[3].props.value, ''); assert.match(text(h.tree), /not your confirmed sign-in email/); assert.match(text(h.tree), /owner@example.test/); groups++;
  for (const [index, value] of [[4, 'current'], [5, 'next-password'], [6, 'different']]) inputs(h)[index].props.onChange({ target: { value } }); await h.settle();
  const before = h.requests.length; await submit(h, 2); await h.settle(); assert.equal(h.requests.length, before); assert.match(text(h.tree), /do not match/);
  inputs(h)[6].props.onChange({ target: { value: 'next-password' } }); await h.settle(); h.responses.push({ status: 200, body: { ok: true, reauthRequired: true } }); await submit(h, 2); await h.settle();
  assert.ok(inputs(h).slice(4).every(input => input.props.value === '')); assert.match(text(h.tree), /Sign in again/); assert.equal(await h.guard(), true); groups++;
  inputs(h)[0].props.onChange({ target: { value: 'Conflicting edit' } }); inputs(h)[2].props.onChange({ target: { value: 'retained@example.test' } }); await h.settle();
  h.responses.push({ status: 409, body: { error: 'Profile changed elsewhere' } }); await submit(h, 0); await h.settle();
  const reload = () => nodes(h.tree).find(node => node.type === 'button' && text(node) === 'Reload latest details');
  assert.ok(reload()); h.allowDeparture(false); const beforeReload = h.requests.length; await reload().props.onClick(); assert.equal(h.requests.length, beforeReload);
  h.allowDeparture(true); h.responses.push({ status: 200, body: { ...profile, name: 'Latest name', revision: 8 } }); await reload().props.onClick(); await h.settle();
  assert.equal(inputs(h)[0].props.value, 'Latest name'); assert.equal(inputs(h)[2].props.value, 'retained@example.test'); assert.ok(!reload()); groups++;
  const local = component(path.resolve('components/ProfileSettings.tsx'), [{ status: 200, body: { ...profile, local: true } }]); local.mount(); await local.settle();
  assert.ok(nodes(local.tree).filter(node => node.type === 'fieldset').slice(1).every(node => node.props.disabled)); groups++;
  const reports = component(path.resolve('components/ReportsOverview.tsx')); reports.mount({ quizzes: [{ id: 'quiz-one', title: 'First quiz' }, { id: 'quiz-two', title: 'Another quiz', publishedAt: '2026-01-01' }] });
  assert.match(text(reports.tree), /First quiz/); assert.ok(nodes(reports.tree).some(node => node.props?.href === '/reports/quiz-one'));
  inputs(reports)[0].props.onChange({ target: { value: 'another' } }); await reports.settle(); assert.doesNotMatch(text(reports.tree), /First quiz/); assert.match(text(reports.tree), /Another quiz/);
  inputs(reports)[0].props.onChange({ target: { value: 'missing' } }); await reports.settle(); assert.match(text(reports.tree), /No quizzes match/);
  const empty = component(path.resolve('components/ReportsOverview.tsx')); empty.mount({ quizzes: [] }); assert.match(text(empty.tree), /No quiz reports yet/); groups++;
  const newReports = component(path.resolve('components/ReportsOverview.tsx'), [], 'v2'); newReports.mount({ quizzes: [{ id: 'quiz-one', title: 'First quiz', responseCount: 0 }, { id: 'quiz-two', title: 'Another quiz', publishedAt: '2026-01-01', responseCount: 3 }] });
  assert.equal(nodes(newReports.tree).filter(n => n.type === 'table').length, 1);
  assert.match(text(newReports.tree), /First quiz/); assert.match(text(newReports.tree), /Another quiz/);
  inputs(newReports)[0].props.onChange({ target: { value: 'First' } }); await newReports.settle();
  assert.match(text(newReports.tree), /First quiz/); assert.ok(!text(newReports.tree).includes('Another quiz'));
  inputs(newReports)[0].props.onChange({ target: { value: 'missing' } }); await newReports.settle(); assert.match(text(newReports.tree), /No quizzes match/); groups++;
  console.log(`PASS workspace screens: ${groups} groups (dirty departures, retained failures, acknowledged saves, pending email, password handling, local restrictions, report search).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
