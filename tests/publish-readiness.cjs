const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX };
require.extensions['.ts'] = require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: options }).outputText, filename);
global.fetch = () => { throw Error('This synthetic readiness suite must not make network requests.'); };
const { FormSchema } = require('../lib/schema.ts');
const { defaultCapture } = require('../lib/contacts.ts');
const { getPublishReadiness } = require('../lib/publish-readiness.ts');
const engine = require('../lib/engine.ts');
const marketing = require('../lib/marketing.ts');
const diagnostics = require('../lib/scoring-diagnostics.ts');

const form = () => FormSchema.parse({ id: 'readiness-synthetic', title: 'A useful quiz', mode: 'survey', questions: [{ id: 'q-one', type: 'multiple_choice', title: 'Choose one', required: true, options: [{ id: 'answer-a', label: 'One' }, { id: 'answer-b', label: 'Two' }] }] });
const recommendation = () => FormSchema.parse({ ...form(), marketing: { kind: 'segmentation', outcomes: [{ id: 'outcome-a', title: 'First result', ctaUrl: 'https://example.test/first' }, { id: 'outcome-b', title: 'Second result', ctaUrl: 'https://example.test/second' }], rules: [{ id: 'rule-a', questionId: 'q-one', answerId: 'answer-a', targetId: 'outcome-a', points: 2 }, { id: 'rule-b', questionId: 'q-one', answerId: 'answer-b', targetId: 'outcome-b', points: 2 }] } });
const messages = checks => ({ blockers: checks.blockers.map(item => item.message), warnings: checks.warnings.map(item => item.message) });
const destinationWarning = count => `${count} results have no destination link. Respondents can read the result but cannot follow an offer button.`;
const privacyWarning = 'Lead capture is enabled without a privacy-policy link. Review this before collecting personal details.';
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }

test('ordinary and fully mapped marketing quizzes retain the original empty findings', () => {
  for (const value of [form(), recommendation()]) assert.deepEqual(messages(getPublishReadiness(value)), { blockers: [], warnings: [] });
});

test('empty quiz and whitespace quiz title retain blocker text and order', () => {
  const value = form(); value.questions = []; value.title = ' \n ';
  const checks = getPublishReadiness(value);
  assert.deepEqual(messages(checks), { blockers: ['Add at least one question.', 'Give your quiz a title.'], warnings: [] });
  assert.deepEqual(checks.blockers, [{ code: 'questions-empty', message: 'Add at least one question.' }, { code: 'quiz-title', message: 'Give your quiz a title.', targets: [{ kind: 'quiz-title' }] }]);
});

test('question titles stay one aggregate blocker including display fields, with exact source IDs', () => {
  const value = form(); value.title = ''; value.questions[0].title = ' ';
  value.questions.push({ id: 'a-display', type: 'heading', title: '' }, { id: 'a-valid-question', type: 'short_text', title: 'A title' });
  const checks = getPublishReadiness(value);
  assert.deepEqual(messages(checks), { blockers: ['Give your quiz a title.', 'Give every question a title.'], warnings: [] });
  assert.deepEqual(checks.blockers[1].targets, [{ kind: 'question-title', questionId: 'q-one' }, { kind: 'question-title', questionId: 'a-display' }]);
  value.questions.reverse();
  assert.deepEqual(getPublishReadiness(value).blockers[1].targets, [{ kind: 'question-title', questionId: 'a-display' }, { kind: 'question-title', questionId: 'q-one' }]);
});

test('blank answer labels and invalid landing content do not become new dialog gates', () => {
  const value = form(); value.questions[0].options[0].label = '';
  value.coverPage = { enabled: true, title: '', buttonText: '', sections: [] };
  assert.deepEqual(messages(getPublishReadiness(value)), { blockers: [], warnings: [] });
});

test('missing destinations are aggregate recommendations with known outcome IDs, not blockers', () => {
  const value = recommendation(); value.marketing.outcomes.forEach(outcome => { outcome.ctaUrl = ''; });
  const checks = getPublishReadiness(value);
  assert.deepEqual(messages(checks), { blockers: [], warnings: [destinationWarning(2)] });
  assert.deepEqual(checks.warnings[0].targets, [{ kind: 'outcome-cta', outcomeId: 'outcome-a' }, { kind: 'outcome-cta', outcomeId: 'outcome-b' }]);
  value.marketing.outcomes[0].ctaUrl = 'https://example.test/first';
  assert.deepEqual(messages(getPublishReadiness(value)).warnings, [destinationWarning(1)]);
  assert.deepEqual(getPublishReadiness(value).warnings[0].targets, [{ kind: 'outcome-cta', outcomeId: 'outcome-b' }]);
});

test('enabled capture adds privacy recommendation last and disabled capture adds none', () => {
  const value = recommendation(); value.marketing.outcomes[0].ctaUrl = '';
  value.capture = { ...defaultCapture, enabled: true };
  assert.deepEqual(messages(getPublishReadiness(value)), { blockers: [], warnings: [destinationWarning(1), privacyWarning] });
  assert.deepEqual(getPublishReadiness(value).warnings[1], { code: 'capture-privacy', message: privacyWarning, targets: [{ kind: 'capture-privacy' }] });
  value.capture.enabled = false;
  assert.deepEqual(messages(getPublishReadiness(value)).warnings, [destinationWarning(1)]);
});

test('existing truthiness URL policy is not silently strengthened by extraction', () => {
  const value = recommendation(); value.marketing.outcomes.forEach(outcome => { outcome.ctaUrl = ' '; });
  value.capture = { ...defaultCapture, enabled: true, privacyUrl: ' ' };
  assert.deepEqual(messages(getPublishReadiness(value)), { blockers: [], warnings: [] });
  value.capture.privacyUrl = 'not a URL';
  assert.deepEqual(messages(getPublishReadiness(value)), { blockers: [], warnings: [] });
});

test('reference validation remains the first configuration failure and avoids the marketing call', () => {
  const value = form(); value.questions.push(structuredClone(value.questions[0]));
  const original = marketing.validateMarketing; let called = 0;
  marketing.validateMarketing = () => { called++; throw Error('Second error must not replace first'); };
  try {
    assert.deepEqual(getPublishReadiness(value).blockers, [{ code: 'references', message: 'Question IDs must be unique.' }]);
    assert.equal(called, 0);
  } finally { marketing.validateMarketing = original; }
});

test('invalid marketing and scoring diagnostics preserve their original order before editorial warnings', () => {
  const value = recommendation(); value.questions[0].type = 'multiselect'; value.marketing.rules = [];
  value.marketing.outcomes.forEach(outcome => { outcome.ctaUrl = ''; });
  value.capture = { ...defaultCapture, enabled: true };
  const checks = getPublishReadiness(value);
  assert.deepEqual(messages(checks), {
    blockers: ['Add a result and at least one answer rule before publishing this marketing quiz.'],
    warnings: ['First result: no positive answer points are mapped.', 'Second result: no positive answer points are mapped.', '2 answer choices have no scoring rules. Confirm these are intentional neutral answers.', destinationWarning(2), privacyWarning],
  });
  assert.equal(checks.blockers[0].code, 'marketing');
  assert.ok(!checks.blockers[0].targets);
  assert.ok(checks.warnings.slice(0, 3).every(item => item.code === 'scoring-warning' && !item.targets));
});

test('finite path tie, unreachable result and fallback warnings remain unchanged', () => {
  const value = recommendation();
  value.marketing.rules[1].answerId = 'answer-a';
  assert.deepEqual(messages(getPublishReadiness(value)), { blockers: [], warnings: [
    '1 answer choices have no scoring rules. Confirm these are intentional neutral answers.',
    'Second result: unreachable across all 2 checked answer paths.',
    '1 answer paths tie for first place. The first result in your list wins.',
    '1 answer paths show the fallback instead of a recommendation.',
  ] });
});

test('scorecard bands retain validation without receiving ordinary outcome destination warnings', () => {
  const value = FormSchema.parse({ ...form(), marketing: { kind: 'scorecard', categories: [{ id: 'category-a', title: 'Clarity' }], rules: [{ id: 'rule-a', questionId: 'q-one', answerId: 'answer-a', targetId: 'category-a', points: 2 }, { id: 'rule-b', questionId: 'q-one', answerId: 'answer-b', targetId: 'category-a', points: 1 }], scorecard: { bands: [{ id: 'band-a', min: 0, max: 100, title: 'Your guidance', ctaUrl: '' }] } } });
  assert.deepEqual(messages(getPublishReadiness(value)), { blockers: [], warnings: [] });
  value.marketing.scorecard.bands[0].max = 90;
  assert.deepEqual(messages(getPublishReadiness(value)), { blockers: ['Overall result: score bands must end at 100.'], warnings: [] });
});

test('unexpected non-Error validation failures retain the original fallback wording', () => {
  const original = engine.validateFormReferences;
  engine.validateFormReferences = () => { throw 'synthetic validation failure'; };
  try { assert.deepEqual(getPublishReadiness(form()).blockers, [{ code: 'references', message: 'Review your scoring and branching rules.' }]); }
  finally { engine.validateFormReferences = original; }
});

test('readiness returns fresh results without mutating frozen drafts or diagnostic arrays', () => {
  const value = recommendation(); value.marketing.outcomes[0].ctaUrl = ''; freeze(value);
  const before = JSON.stringify(value), original = diagnostics.scoringDiagnostics, warnings = Object.freeze(['A synthetic diagnostic.']);
  diagnostics.scoringDiagnostics = () => ({ warnings, checkedPaths: 0, exhaustive: false });
  try {
    const first = getPublishReadiness(value);
    assert.deepEqual(messages(first), { blockers: [], warnings: ['A synthetic diagnostic.', destinationWarning(1)] });
    first.warnings[0].message = 'Local caller mutation'; first.warnings[1].targets[0].outcomeId = 'changed';
    const second = getPublishReadiness(value);
    assert.equal(second.warnings[0].message, 'A synthetic diagnostic.');
    assert.equal(second.warnings[1].targets[0].outcomeId, 'outcome-a');
    assert.equal(JSON.stringify(value), before); assert.deepEqual(warnings, ['A synthetic diagnostic.']);
  } finally { diagnostics.scoringDiagnostics = original; }
});

test('only explicit diagnostic opt-out skips enumeration while preserving blockers and direct warnings', () => {
  const value = recommendation(); value.title = ''; value.questions[0].title = '';
  value.marketing.rules = []; value.marketing.outcomes[0].ctaUrl = '';
  value.capture = { ...defaultCapture, enabled: true };
  const original = diagnostics.scoringDiagnostics; let calls = 0;
  diagnostics.scoringDiagnostics = () => { calls++; throw Error('Enumeration must not run during an explicit lightweight check.'); };
  try {
    const checks = getPublishReadiness(value, { includeScoringDiagnostics: false });
    assert.equal(calls, 0);
    assert.deepEqual(messages(checks), {
      blockers: ['Give your quiz a title.', 'Give every question a title.', 'Add a result and at least one answer rule before publishing this marketing quiz.'],
      warnings: [destinationWarning(1), privacyWarning],
    });
    assert.deepEqual(checks.warnings.map(item => item.targets), [[{ kind: 'outcome-cta', outcomeId: 'outcome-a' }], [{ kind: 'capture-privacy' }]]);
    for (const options of [undefined, {}, { includeScoringDiagnostics: undefined }, { includeScoringDiagnostics: true }]) {
      assert.throws(() => getPublishReadiness(value, options), /Enumeration must not run/);
    }
    assert.equal(calls, 4, 'Default, empty options and explicit true must continue running the diagnostic.');
  } finally { diagnostics.scoringDiagnostics = original; }
});

test('explicit true is identical to the existing default and lightweight mode removes only diagnostic findings', () => {
  const value = recommendation(); value.marketing.rules[1].answerId = 'answer-a';
  value.marketing.outcomes[0].ctaUrl = ''; value.capture = { ...defaultCapture, enabled: true };
  const defaults = getPublishReadiness(value);
  assert.deepEqual(getPublishReadiness(value, {}), defaults);
  assert.deepEqual(getPublishReadiness(value, { includeScoringDiagnostics: true }), defaults);
  assert.deepEqual(getPublishReadiness(value, { includeScoringDiagnostics: false }), { blockers: defaults.blockers, warnings: defaults.warnings.filter(item => item.code !== 'scoring-warning') });
  assert.equal(defaults.warnings.filter(item => item.code === 'scoring-warning').length, 4);
});

test('runtime dependency graph stays client-safe and has no server or storage imports', () => {
  const seen = new Set();
  const visit = filename => {
    if (seen.has(filename)) return; seen.add(filename);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: options }).outputText;
    for (const [, request] of output.matchAll(/require\("([^\"]+)"\)/g)) {
      if (request.startsWith('.')) visit(require.resolve(path.resolve(path.dirname(filename), request)));
      else assert.equal(request, 'zod', `Unexpected runtime dependency: ${request}`);
    }
    assert.ok(!/\b(?:window|document|localStorage|sessionStorage|process|fetch)\b/.test(output), `Unexpected external state in ${path.basename(filename)}`);
  };
  visit(path.resolve(__dirname, '../lib/publish-readiness.ts'));
  assert.ok(seen.size >= 4);
});

// Exercise the actual component tree/callbacks with deterministic hook wiring.
// This does not claim browser layout, native focus or screen-reader acceptance.
const componentPath = path.resolve(__dirname, '../components/PublishReadiness.tsx');
let hookState;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent?.filename === componentPath && request === 'react') return { ...React,
    useEffect: effect => hookState.effects.push(effect), useMemo: run => run(), useRef: () => ({ current: hookState.dialog }),
  };
  if (request.startsWith('@/')) return originalLoad.call(this, path.resolve(__dirname, '..', request.slice(2)), parent, isMain);
  return originalLoad.call(this, request, parent, isMain);
};
const PublishReadiness = require(componentPath).default;
Module._load = originalLoad;
function render(value, busy = false) {
  let confirms = 0, closes = 0, shown = 0, closed = 0;
  hookState = { effects: [], dialog: { showModal() { shown++; }, close() { closed++; } } };
  const tree = PublishReadiness({ form: value, busy, onConfirm: () => confirms++, onClose: () => closes++ });
  const nodes = [];
  const walk = node => { if (!React.isValidElement(node)) return; nodes.push(node); React.Children.forEach(node.props.children, walk); };
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : React.isValidElement(node) ? React.Children.toArray(node.props.children).map(text).join('') : '';
  walk(tree);
  return { tree, nodes, text, effects: hookState.effects, state: () => ({ confirms, closes, shown, closed }), button: label => nodes.find(node => node.type === 'button' && text(node) === label) };
}

test('actual dialog keeps message order and disables confirmation for blockers', () => {
  const value = form(); value.title = ''; value.questions = []; value.capture = { ...defaultCapture, enabled: true, marketingEnabled: false };
  const ui = render(value);
  assert.equal(ui.tree.type, 'dialog'); assert.equal(ui.tree.props['aria-labelledby'], 'publish-readiness-title');
  assert.deepEqual(ui.nodes.filter(node => node.type === 'li').map(ui.text), ['Add at least one question.', 'Give your quiz a title.', privacyWarning]);
  assert.equal(ui.button('Publish now').props.disabled, true);
  assert.equal(ui.button('Back to editor').props.disabled, false);
  assert.ok(ui.text(ui.tree).includes('Optional capture. Marketing opt-in is off.'));
  let prevented = 0; ui.tree.props.onCancel({ preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.equal(ui.state().closes, 1);
});

test('actual dialog keeps warnings nonblocking and confirms only on the explicit action', () => {
  const value = recommendation(); value.marketing.outcomes[0].ctaUrl = ''; value.capture = { ...defaultCapture, enabled: true };
  const ui = render(value);
  assert.deepEqual(ui.nodes.filter(node => node.type === 'li').map(ui.text), [destinationWarning(1), privacyWarning]);
  assert.equal(ui.button('Publish now').props.disabled, false); assert.equal(ui.state().confirms, 0);
  ui.button('Publish now').props.onClick(); assert.equal(ui.state().confirms, 1);
  ui.button('Back to editor').props.onClick(); assert.equal(ui.state().closes, 1);
});

test('actual dialog preserves busy cancel guards, modal lifecycle and fresh-form rendering', () => {
  const ui = render(form(), true);
  assert.equal(ui.button('Publishing…').props.disabled, true); assert.equal(ui.button('Back to editor').props.disabled, true);
  let prevented = 0; ui.tree.props.onCancel({ preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.equal(ui.state().closes, 0);
  const cleanup = ui.effects[0](); assert.equal(ui.state().shown, 1); cleanup(); assert.equal(ui.state().closed, 1);
  const invalid = form(); invalid.title = '';
  assert.equal(render(invalid).button('Publish now').props.disabled, true);
  assert.equal(render(form()).button('Publish now').props.disabled, false);
});

console.log(`${passed} publish-readiness parity and component scenarios passed. No network, records or browser server used.`);
