// Render actual creator screens in both interfaces with synthetic records only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
require.extensions['.css'] = () => {};
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...rest) { return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name, ...rest); };
const originalLoad = Module._load;
Module._load = function(name, ...rest) { return name === 'next/navigation' ? { useRouter: () => ({ refresh() {} }) } : originalLoad.call(this, name, ...rest); };
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { InterfaceProvider } = require('../components/v2/InterfaceContext.tsx');
const Contacts = require('../components/ContactsOverview.tsx').default;
const Reports = require('../components/ReportsOverview.tsx').default;
const Tabs = require('../components/ReportTabs.tsx').default;
const render = (version, Component, props) => renderToStaticMarkup(React.createElement(InterfaceProvider, {version}, React.createElement(Component, props)));
const contact = (id, name, consent) => ({ id, formId: 'quiz/one', submittedAt: '2026-10-29T12:30:00Z', totalPointsPossible: 0, totalPointsEarned: 0, percentageScore: 100, passed: true, grading: [], contact: { name, email: 'sample@example.test', marketingConsent: consent } });
for (const version of ['v1', 'v2']) {
  const html = render(version, Contacts, { contacts: [contact('attempt-1', 'Alex First', true), contact('attempt-2', 'Alex Again', false)], quizzes: [{id:'quiz/one',title:'Readiness'}] });
  for (const expected of ['Alex First','Alex Again','Readiness','sample@example.test','quiz%2Fone','Manage quiz contacts','25 per page']) assert.ok(html.includes(expected), `${version}: ${expected}`);
  assert.ok(!html.includes('100%'), 'unscored contacts must not display a fabricated score');
  assert.equal(html.includes('<table'), version === 'v2');
  const empty = render(version, Contacts, {contacts:[],quizzes:[]}); assert.ok(empty.includes('No contacts yet'));
  const report = render(version, Reports, {quizzes:[{id:'quiz/one',title:'Readiness',responseCount:0},{id:'quiz/two',title:'Unavailable',responseCount:undefined}]});
  assert.ok(report.includes('Readiness')); assert.ok(report.includes('Unavailable')); assert.ok(report.includes('/reports/quiz%2Fone'));
  assert.equal(report.includes('<table'), version === 'v2');
  const tabs = render(version, Tabs, {analytics:React.createElement('p',null,'Analytics content'),responses:React.createElement('p',null,'Response content')});
  assert.ok(tabs.includes('role="tablist"')); assert.ok(tabs.includes('aria-selected="true"')); assert.ok(tabs.includes('hidden=""')); assert.ok(tabs.includes('Response content'));
}
console.log('PASS V1/V2 data screens: real render parity, separate attempts, honest unscored records, encoded links, empty states and accessible report panels.');
