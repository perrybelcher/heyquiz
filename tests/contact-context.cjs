const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { projectContactContext, parseContactContexts, contactContextExport, contactContextOptions } = require('../lib/contact-context.ts');
const { emptyContactFilters, filterContacts, contactFilterError, contactCategoryKey, contactCategoryOptions, contactPage } = require('../lib/contact-filters.ts');
const { contactExportRows, contactsCsv } = require('../lib/contacts.ts');
const t = Date.parse('2026-10-01T10:00:00.000Z'), iso = n => new Date(n).toISOString();
const row = (id, patch = {}) => ({ id, formId: 'quiz', submittedAt: iso(t), totalPointsPossible: 0, percentageScore: 100, answers: { private: 'PRIVATE ANSWER' }, grading: [], contact: { email: 'PRIVATE_EMAIL@example.test', recordedAt: iso(t - 100), placement: 'before_results', marketingConsent: true }, marketing: { kind: 'scorecard', title: 'Saved result', categories: [{ id: 'focus', title: 'Focus', score: 0, answered: 2, applicable: 2, minAnswers: 2 }] }, ...patch });
const attempt = (patch = {}) => ({ form: { id: 'quiz', publishedAt: iso(t - 10000), questions: [{ secret: 'PRIVATE FORM' }] }, startedAt: t - 1000, expiresAt: t + 1000, preview: false, reached: ['q1'], lastSeenAt: t - 200, completedAt: t + 1, resultViewedAt: t + 100, offerClickedAt: t + 200, attribution: { version: 1, source: 'Newsletter', campaign: 'Autumn launch' }, result: { answers: 'PRIVATE CACHE' }, ...patch });
const filters = patch => ({ ...emptyContactFilters, ...patch }); let count = 0;
function check(name, fn) { fn(); count++; console.log('PASS ' + name); }
check('Only allowlisted start attribution and five genuine stored dates enter context', () => {
  const actual = projectContactContext(row('one'), attempt(), t + 1000);
  assert.deepEqual(actual.activity.map(event => event.kind), ['started', 'contact', 'submitted', 'result', 'offer']);
  assert.equal(actual.source, 'utm:Newsletter'); assert.equal(actual.campaign, 'value:Autumn launch');
  for (const secret of ['PRIVATE', 'expiresAt', 'reached', 'lastSeenAt', 'questions', 'completedAt']) assert.ok(!JSON.stringify(actual).includes(secret));
  assert.deepEqual(parseContactContexts([row('one')], { one: actual }).one, actual);
});
check('Unknown is separate from real reserved labels and sanitized referrer fallback', () => {
  const values = ['unknown', 'all'].map(source => projectContactContext(row(source), attempt({ attribution: { version: 1, source, campaign: source } }), t + 1000));
  assert.equal(values[0].source, 'utm:unknown'); assert.equal(values[1].campaign, 'value:all');
  const invalid = projectContactContext(row('bad'), attempt({ attribution: { version: 1, source: 'private@example.test', campaign: 'https://private.test/path', referrerHost: 'NEWS.example.test' } }), t + 1000);
  assert.equal(invalid.source, 'ref:news.example.test'); assert.equal(invalid.campaign, 'unknown');
  const missing = projectContactContext(row('missing'), undefined, t + 1000); assert.equal(missing.history, 'unavailable'); assert.equal(missing.source, 'unknown');
  assert.deepEqual(missing.activity.map(event => event.kind), ['contact', 'submitted']);
});
check('After-results contact ordering and click-only records do not invent a view', () => {
  const actual = projectContactContext(row('after', { contact: { recordedAt: iso(t + 500), placement: 'after_results' } }), attempt({ resultViewedAt: undefined }), t + 1000);
  assert.deepEqual(actual.activity.map(event => event.kind), ['started', 'submitted', 'offer', 'contact']);
  const same = projectContactContext(row('same'), attempt({ resultViewedAt: t + 200 }), t + 1000);
  assert.equal(same.activity.find(e => e.kind === 'result').at, same.activity.find(e => e.kind === 'offer').at);
});
check('Invalid, future and causally inconsistent timestamps are omitted honestly', () => {
  const actual = projectContactContext(row('bad', { contact: { recordedAt: iso(t + 20), placement: 'before_results' } }), attempt({ startedAt: t + 10, resultViewedAt: t - 100, offerClickedAt: Infinity }), t + 1000);
  assert.deepEqual(actual.activity.map(event => event.kind), ['submitted']); assert.equal(actual.incomplete, true);
  assert.equal(projectContactContext(row('bad-date', { submittedAt: 'invalid' }), undefined, t).incomplete, true);
  for (const bad of ['2026-02-30T10:00:00Z', '2026-04-31T10:00:00.000Z', '2026-10-01T24:00:00Z', '2026-10-01T10:00:00+25:00']) {
    const invalid = projectContactContext(row('calendar', { submittedAt: bad, contact: { recordedAt: bad, placement: 'before_results' } }), undefined, t + 1000);
    assert.deepEqual(invalid.activity, []); assert.equal(invalid.incomplete, true);
  }
  const offset = projectContactContext(row('offset', { submittedAt: '2026-10-01T11:00:00+01:00', contact: { recordedAt: '2026-10-01T10:59:59.900+01:00', placement: 'before_results' } }), undefined, t + 1000);
  assert.equal(offset.activity.find(event => event.kind === 'submitted').at, iso(t)); assert.equal(offset.incomplete, false);
});
check('Missing or malformed API context cannot silently become exportable unknown metadata', () => {
  const r = row('one'), valid = projectContactContext(r, attempt(), t + 1000);
  for (const value of [undefined, {}, [], { one: { ...valid, source: 'http://secret.test' } }, { one: { ...valid, activity: [...valid.activity, valid.activity[0]] } }, { one: { ...valid, activity: [{ kind: 'toString', at: iso(t) }] } }]) assert.throws(() => parseContactContexts([r], value), /could not be read/);
  assert.equal(Object.keys(parseContactContexts([], undefined)).length, 0);
  const clean = parseContactContexts([r], { one: { ...valid, bearer: 'PRIVATE TOKEN' } }); assert.ok(!JSON.stringify(clean).includes('PRIVATE TOKEN'));
});
const rows = [row('zero'), row('fifty', { marketing: { kind: 'scorecard', title: 'Saved result', categories: [{ id: 'focus', title: 'Focus', score: 50 }] } }), row('null', { marketing: { kind: 'scorecard', categories: [{ id: 'focus', title: 'Focus', score: null }] } }), row('missing', { marketing: { kind: 'product_finder', categories: [] } }), row('renamed', { marketing: { kind: 'scorecard', categories: [{ id: 'focus', title: 'Earlier focus', score: 100 }] } }), row('other-id', { marketing: { kind: 'scorecard', categories: [{ id: 'other', title: 'Focus', score: 100 }] } })];
const contexts = Object.fromEntries(rows.map((r, i) => [r.id, projectContactContext(r, i === 3 ? undefined : attempt({ attribution: { version: 1, source: i % 2 ? 'Search' : 'Newsletter', campaign: 'Autumn launch' } }), t + 1000)]));
const category = contactCategoryKey({ id: 'focus', title: 'Focus' });
check('Source, campaign, category and existing conditions combine by AND', () => {
  assert.deepEqual(filterContacts(rows, filters({ source: 'utm:Newsletter', campaign: 'value:Autumn launch', category, categoryMin: '0', categoryMax: '0', consent: 'yes' }), contexts).map(r => r.id), ['zero']);
  assert.deepEqual(filterContacts(rows, filters({ source: 'unknown' }), contexts).map(r => r.id), ['missing']);
  assert.equal(filterContacts(rows, filters({ source: 'utm:Newsletter', campaign: 'value:no-match' }), contexts).length, 0);
});
check('Category null, missing and zero are distinct and historical names/IDs stay separate', () => {
  assert.deepEqual(filterContacts(rows, filters({ category, categoryScore: 'unscored' }), contexts).map(r => r.id), ['null']);
  assert.deepEqual(filterContacts(rows, filters({ category, categoryScore: 'missing' }), contexts).map(r => r.id), ['missing', 'renamed', 'other-id']);
  assert.deepEqual(filterContacts(rows, filters({ category, categoryScore: 'scored' }), contexts).map(r => r.id), ['zero', 'fifty']);
  const options = contactCategoryOptions(rows); assert.equal(options.length, 3); assert.equal(new Set(options.map(o => o.label)).size, 3);
  assert.equal(contactContextOptions(rows, contexts, 'source').find(o => o.value === 'utm:Newsletter').count, 3);
});
check('Invalid category bounds and incompatible missing-score ranges never broaden results', () => {
  for (const patch of [{ categoryMin: '20' }, { category, categoryMin: '-1' }, { category, categoryMax: '101' }, { category, categoryMin: '50', categoryMax: '10' }, { category, categoryScore: 'missing', categoryMin: '0' }]) {
    assert.ok(contactFilterError(filters(patch))); assert.deepEqual(filterContacts(rows, filters(patch), contexts), []);
  }
});
check('All matched responses export with append-only metadata and existing formula/consent safeguards', () => {
  const many = Array.from({ length: 61 }, (_, i) => row('many-' + i));
  const linked = Object.fromEntries(many.map(r => [r.id, projectContactContext(r, attempt(), t + 1000)]));
  const matches = filterContacts(many, filters({ source: 'utm:Newsletter', category, categoryMax: '0' }), linked);
  assert.equal(contactPage(matches, 1).rows.length, 25); assert.equal(matches.length, 61);
  const original = contactExportRows(matches), exported = original.map((r, i) => ({ ...r, ...contactContextExport(matches[i], linked) }));
  assert.deepEqual(Object.keys(exported[0]).slice(0, Object.keys(original[0]).length), Object.keys(original[0]));
  assert.equal(exported[0].marketingConsent, true); assert.equal(exported[0].startSource, 'Newsletter · UTM source');
  exported[0].name = '=FORMULA()'; const csv = contactsCsv(exported); assert.ok(csv.includes('many-60')); assert.ok(csv.includes("'=FORMULA()"));
});
console.log(`${count} contact-context and cohort scenarios passed.`);
