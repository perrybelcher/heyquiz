const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { buildResultPdfModel: build, safeResultPdfLink: safeLink, PdfRenderError, RESULT_PDF_TEXT_LIMIT } = require('../lib/result-pdf-model.ts');
let checks = 0;
function test(name, callback) { callback(); checks++; console.log('PASS ' + name); }
const clone = value => structuredClone(value);
function base() {
  return {
    submissionId: 'PRIVATE-submission', formId: 'PRIVATE-form', createdAt: '2026-10-12T09:30:00.000Z', expiresAt: 9999999999999,
    quizTitle: 'Your growth assessment', theme: { primaryColor: '#922c3b', brandName: 'Example Studio', hidePippiBranding: false },
    heading: 'Your saved result', message: 'A useful summary.', cta: { label: 'Read your plan', url: 'https://example.test/plan' },
    result: { totalPointsEarned: 6, totalPointsPossible: 8, percentageScore: 75 },
  };
}
function section(type, index) {
  return { id: 'PRIVATE-section-' + index, type, title: type + ' title', body: type + ' body', label: type + ' destination', url: 'https://example.test/' + type, condition: { type: 'outcome', outcomeId: 'PRIVATE-condition' } };
}
function marketing(layout = 'stacked') {
  const report = base();
  report.result.marketing = {
    kind: 'scorecard', status: 'scored', presentation: { layout }, title: 'Your personal plan', message: 'A frozen assessment.',
    outcomeId: 'PRIVATE-outcome', overallScore: null, advice: 'Begin with a small weekly habit.', ctaLabel: 'Explore the programme', ctaUrl: 'https://example.test/programme',
    reasons: ['You prefer practical learning.', 'Consistency matters to you.'], priorities: [{ categoryId: 'PRIVATE-low', title: 'Make time', action: 'Schedule ten minutes.' }],
    categories: [
      { id: 'PRIVATE-low', title: 'Consistency', description: 'Your current routine.', score: 0, answered: 1, applicable: 2, minAnswers: 1, bandTitle: 'Starting out', advice: 'Start small.', action: 'NOT-DISPLAYED-category-action' },
      { id: 'PRIVATE-high', title: 'Confidence', description: 'Your confidence today.', score: 100, answered: 2, applicable: 2, minAnswers: 1 },
      { id: 'PRIVATE-missing', title: 'Support', description: 'More context is needed.', score: null, answered: 1, applicable: 3, minAnswers: 2 },
    ],
    resultSections: ['text', 'image', 'testimonial', 'faq', 'cta', 'video'].map(section),
  };
  return report;
}
const content = model => model.blocks.map(block => block.text ?? block.label ?? '|');
function ordered(model, values) {
  const rows = content(model); let previous = -1;
  for (const value of values) { const index = rows.indexOf(value, previous + 1); assert.ok(index > previous, JSON.stringify(value) + ' missing or out of order: ' + rows.join(' / ')); previous = index; }
}
function error(report, code = 'invalid_report') {
  assert.throws(() => build(report), e => e instanceof PdfRenderError && e.code === code && e.status === 422 && !e.message.includes('PRIVATE'));
}
function frozen(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) frozen(child); Object.freeze(value); } return value; }

test('legacy graded report preserves stored points/percentage, original completion and safe CTA', () => {
  const report = base(); report.result.percentageScore = 74.5; // Never recompute the frozen value.
  assert.deepEqual(build(report), {
    title: 'Your growth assessment', brandName: 'Example Studio', hideBranding: false, createdAt: report.createdAt, layout: 'stacked', accent: '#922c3b',
    blocks: [{ kind: 'heading', text: 'Your saved result', level: 1 }, { kind: 'paragraph', text: 'A useful summary.' }, { kind: 'score', label: 'Score', value: 74.5 }, { kind: 'label', text: '6 of 8 points' }, { kind: 'link', label: 'Read your plan', url: 'https://example.test/plan' }],
  });
});
test('zero-point survey has narrative and CTA without an invented score', () => {
  const report = base(); report.result = { totalPointsEarned: 0, totalPointsPossible: 0, percentageScore: 0 };
  const model = build(report); assert.ok(!model.blocks.some(b => b.kind === 'score')); ordered(model, ['Your saved result', 'A useful summary.', 'Read your plan']);
});
test('product, segmentation and no-match preserve their saved wording without legacy knowledge scores', () => {
  for (const kind of ['product_finder', 'segmentation']) for (const status of ['matched', 'no_match']) {
    const report = marketing(); report.result.marketing = { kind, status, title: 'Saved ' + status, message: 'Original next step.', reasons: ['A supplied reason.'], categories: [], ctaLabel: 'Continue', ctaUrl: 'https://example.test/go' };
    report.result.totalPointsEarned = { mustNotRead: true };
    const model = build(report); assert.ok(!model.blocks.some(b => b.kind === 'score'));
    ordered(model, [kind === 'product_finder' ? 'Your recommendation' : 'Your next step', 'Saved ' + status, 'Original next step.', 'A supplied reason.', 'Continue']);
  }
});
test('stacked order matches the web report, including all resolved section types and final CTA', () => {
  const model = build(marketing());
  ordered(model, ['Your assessment', 'Your personal plan', 'Overall score', 'Your next priorities', 'Schedule ten minutes.', 'Why this fits', 'A useful first step', 'Consistency', 'Confidence', 'Support', 'text title', 'image title', 'testimonial body', 'testimonial title', 'faq title', 'faq body', 'cta title', 'cta body', 'cta destination', 'video title', 'Explore the programme']);
  for (const type of ['text', 'image', 'testimonial', 'faq', 'cta', 'video']) assert.ok(content(model).includes(type + ' body'));
  assert.ok(model.blocks.some(b => b.kind === 'link' && b.label === 'image destination' && b.url.endsWith('/image')));
  assert.ok(model.blocks.some(b => b.kind === 'link' && b.label === 'video destination' && b.url.endsWith('/video')));
});
test('score overview precedes reasons and retains every category detail and denominator', () => {
  const model = build(marketing('score_overview'));
  ordered(model, ['Overall score', 'Your scores at a glance', 'Consistency', 'Confidence', 'Support', 'Why this fits', 'Your next priorities', 'A useful first step', 'A closer look at each area', 'Consistency', 'Your current routine.', 'Confidence', 'Support', 'More context is needed.', 'text title', 'Explore the programme']);
  assert.ok(content(model).includes('2 of 3 categories have enough scored answers.'));
  assert.deepEqual(model.blocks.filter(b => b.kind === 'score' && b.coverage).map(b => [b.value, b.coverage]), [[0, '1 of 2 applicable questions scored'], [100, '2 of 2 applicable questions scored'], [null, '1 of 3 applicable questions scored · 2 needed']]);
  assert.equal(content(model).filter(s => s === 'Support').length, 2);
});
test('action plan keeps advice, priorities and primary CTA before supporting evidence', () => {
  const model = build(marketing('action_plan'));
  ordered(model, ['Your personal plan', 'A useful first step', 'Your next priorities', 'Explore the programme', 'How your answers shaped this', 'Overall score', 'Why this fits', 'Consistency', 'Confidence', 'Support', 'text title', 'video body']);
  const minimal = marketing('action_plan'); Object.assign(minimal.result.marketing, { categories: [], reasons: [], priorities: [] }); delete minimal.result.marketing.overallScore;
  assert.ok(!content(build(minimal)).includes('How your answers shaped this'));
});
test('legacy marketing without presentation, priorities, overall or sections keeps original stacked order', () => {
  const report = marketing(); for (const key of ['presentation', 'priorities', 'overallScore', 'resultSections']) delete report.result.marketing[key];
  const model = build(report); assert.equal(model.layout, 'stacked'); ordered(model, ['Why this fits', 'A useful first step', 'Consistency', 'Confidence', 'Support', 'Explore the programme']);
});
test('null/zero/100 remain distinct and partial coverage is never filled or recomputed', () => {
  const model = build(marketing());
  assert.deepEqual(model.blocks.filter(b => b.kind === 'score').map(b => b.value), [null, 0, 100, null]);
  ordered(model, ['Support', 'Score', 'More context is needed.', '1 of 3 applicable questions scored · 2 needed']);
  const report = marketing(); report.result.marketing.overallScore = 0;
  assert.equal(build(report).blocks.find(b => b.kind === 'score').value, 0);
});
test('model allowlist excludes answer/contact/internal IDs, conditions, source assets and bearer paths', () => {
  const report = marketing(); report.answers = ['PRIVATE-answer']; report.contact = { email: 'PRIVATE-email' }; report.reportUrl = 'https://example.test/result/PRIVATE.signature';
  report.result.grading = 'PRIVATE-grading'; report.theme.logoUrl = 'https://example.test/PRIVATE-logo'; report.theme.backgroundImageUrl = 'https://example.test/PRIVATE-background';
  const serialized = JSON.stringify(build(frozen(report)));
  assert.ok(!serialized.includes('PRIVATE')); assert.ok(!serialized.includes('NOT-DISPLAYED'));
  assert.deepEqual(Object.keys(build(report)), ['title', 'brandName', 'hideBranding', 'createdAt', 'layout', 'accent', 'blocks']);
});
test('frozen source is not mutated and output cannot change the saved snapshot', () => {
  const report = frozen(marketing()); const before = JSON.stringify(report); const model = build(report); model.blocks[0].text = 'Changed local output';
  assert.equal(JSON.stringify(report), before); assert.equal(build(report).blocks[0].text, 'Your assessment');
});
test('saved brand/hide preference, logo-alt fallback and decorative accent fallback are preserved', () => {
  const report = base(); Object.assign(report.theme, { hidePippiBranding: true, primaryColor: 'url(javascript:bad)' });
  assert.equal(build(report).hideBranding, true); assert.equal(build(report).brandName, 'Example Studio'); assert.equal(build(report).accent, '#922c3b');
  delete report.theme.brandName; report.theme.logoUrl = 'file:///PRIVATE-logo'; report.theme.logoAlt = 'Saved studio'; assert.equal(build(report).brandName, 'Saved studio');
  delete report.theme.logoAlt; assert.equal(build(report).brandName, report.quizTitle); delete report.theme.logoUrl; assert.equal(build(report).brandName, '');
});
test('HTTP(S) annotations reject credentials, controls, non-web URLs and result capabilities', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/a', '/relative', '//example.test/path', 'https://user:secret@example.test/a', 'https://example.test/a\n', 'https://example.test/a%0A', 'https://example.test/a%7f', 'https:\\example.test/a', 'https://example.test/%5cpath', 'https://example.test/result/abc.def', 'https://example.test/api/result/abc.def/pdf', 'https://example.test/%72esult%2fabc.def', 'https://example.test/?go=/result/abc.def', 'https://example.test/' + 'x'.repeat(2000)]) assert.equal(safeLink(url), null, url);
  for (const url of ['https://example.test/path?a=b#chapter', 'http://example.test/', 'https://example.test/a%20b', 'https://example.test/é']) assert.equal(safeLink(url), new URL(url).href);
  assert.equal(safeLink({ toString() { throw Error('Do not coerce'); } }), null);
});
test('unsafe destinations retain surrounding section content and useful labels without unsafe URLs', () => {
  const report = marketing(); report.result.marketing.ctaUrl = 'https://example.test/result/PRIVATE.signature';
  report.result.marketing.resultSections.find(s => s.type === 'image').url = 'file:///PRIVATE-file';
  const model = build(report), serialized = JSON.stringify(model);
  assert.ok(!serialized.includes('PRIVATE')); assert.ok(content(model).includes('image body')); assert.ok(content(model).includes('image destination — link unavailable in this PDF.')); assert.ok(content(model).includes('Explore the programme — link unavailable in this PDF.'));
});
test('malformed shape, enum, scalar, score and coverage data fails generically', () => {
  for (const value of [null, [], 2, {}, { ...base(), theme: [] }, { ...base(), result: null }]) error(value);
  const mutations = [r => r.quizTitle = 3, r => r.theme.hidePippiBranding = 'yes', r => r.theme.brandName = {}, r => r.result.marketing.kind = ['scorecard'], r => r.result.marketing.presentation.layout = { toString: () => 'stacked' }, r => r.result.marketing.categories = null, r => r.result.marketing.reasons = ['Valid', 4], r => r.result.marketing.resultSections[0].type = 'html', r => r.result.marketing.categories[0].score = NaN, r => r.result.marketing.categories[0].score = 101, r => r.result.marketing.categories[0].answered = 1.5, r => r.result.marketing.categories[0].answered = 3, r => r.result.marketing.categories[0].minAnswers = 0, r => r.result.marketing.overallScore = -1, r => r.result.marketing.overallScore = '0', r => r.result.marketing.resultSections[0].body = null];
  for (const mutate of mutations) { const report = marketing(); mutate(report); error(report); }
  for (const key of ['totalPointsEarned', 'totalPointsPossible', 'percentageScore']) for (const value of [-1, Infinity, NaN, '1', null]) { const report = base(); report.result[key] = value; error(report); }
});
test('date validation rejects malformed and rolled-over dates and normalizes valid offsets', () => {
  for (const date of ['junk', '', '42', '2026-02-30T09:30:00Z', '2025-02-29T09:30:00Z', '2026-10-12', '2026-10-12T25:30:00Z', '2026-10-12T09:30:00+25:00']) { const report = base(); report.createdAt = date; error(report); }
  const report = base(); report.createdAt = '2024-02-29T10:30:00+01:00'; assert.equal(build(report).createdAt, '2024-02-29T09:30:00.000Z');
});
test('valid Unicode is preserved for renderer preflight; controls and lone surrogates are rejected', () => {
  const report = base(); report.message = 'Café e\u0301 Ελληνικά Кириллица\n日本語 مرحبا 😀'; assert.equal(build(report).blocks[1].text, report.message);
  for (const value of ['bad\u0000text', 'bad\u000btext', '\ud800', '\udc00']) { report.message = value; error(report); }
});
test('long narrative is intact under budget; byte/count budgets fail rather than truncate', () => {
  const report = marketing(); const body = 'Long text.\n'.repeat(5000); report.result.marketing.message = body;
  assert.ok(content(build(report)).includes(body));
  report.result.marketing.message = 'x'.repeat(RESULT_PDF_TEXT_LIMIT + 1); error(report, 'report_too_large');
  report.result.marketing.message = 'é'.repeat(110000); error(report, 'report_too_large');
  for (const [key, size, value] of [['categories', 21, marketing().result.marketing.categories[0]], ['resultSections', 13, section('text', 0)], ['reasons', 1001, 'Reason'], ['priorities', 21, { title: 'A', action: 'B' }]]) {
    const oversized = marketing(); oversized.result.marketing[key] = Array.from({ length: size }, () => clone(value)); error(oversized, 'report_too_large');
  }
});
test('maximum category/section counts remain visible in every layout', () => {
  for (const layout of ['stacked', 'score_overview', 'action_plan']) {
    const report = marketing(layout); report.result.marketing.categories = Array.from({ length: 20 }, (_, i) => ({ ...clone(report.result.marketing.categories[i % 3]), title: 'Area ' + i }));
    report.result.marketing.resultSections = Array.from({ length: 12 }, (_, i) => ({ ...section('text', i), body: 'Section body ' + i }));
    const rows = content(build(report)); for (let i = 0; i < 20; i++) assert.ok(rows.includes('Area ' + i)); for (let i = 0; i < 12; i++) assert.ok(rows.includes('Section body ' + i));
  }
});
console.log(checks + ' native PDF model checks passed; pure synthetic data, no filesystem records, network, providers or rendering.');
