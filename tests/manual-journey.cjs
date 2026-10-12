/* Model/codec boundaries. Scoring literals are independently covered elsewhere. */
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const fixtures = require('../lib/journey-fixtures.ts'), manual = require('../lib/manual-journey.ts'), codec = require('../lib/journey-fixture-codec.ts'), transfer = require('../lib/journey-fixture-transfer.ts');
const clone = value => structuredClone(value), typed = (type, value) => ({ type, value });
const form = FormSchema.parse({ id: 'manual-codec', title: 'Synthetic codec check', mode: 'form', questions: [
  { id: 'choice', title: 'Choice', type: 'multiple_choice', required: true, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
  { id: 'amount', title: 'Synthetic number', type: 'number' }, { id: 'note', title: 'Synthetic text', type: 'short_answer' },
  { id: 'agree', title: 'Checkbox', type: 'checkbox' },
] });
const input = { answers: { choice: 'a', agree: false }, typedAnswers: { amount: typed('number', '01.00'), note: typed('short_answer', '  Synthetic Café  ') } };
const prepare = (i = input, raw = null, name = '  Manual case  ', id = 'manual-case', f = form) => manual.prepareManualJourneyCase(f, i, name, id, raw);
const apply = (review, i = input, raw = review.libraryRaw, name = review.name, f = form) => manual.applyManualJourneyCase(f, i, name, raw, review);
const rawLocal = (cases, version = 2) => JSON.stringify({ version, quizId: form.id, cases });
const rawFile = (cases, version = 2) => JSON.stringify({ format: 'pippi-journey-cases', version, quizId: form.id, cases });
let groups = 0, denied = 0;
const savedFetch = global.fetch, savedStorage = Object.getOwnPropertyDescriptor(global, 'localStorage');
global.fetch = () => { denied++; throw Error('Manual model must remain local'); };
Object.defineProperty(global, 'localStorage', { configurable: true, get() { denied++; throw Error('Model must not read storage'); } });
const check = (name, run) => { run(); groups++; console.log('PASS ' + name); };
try {
  const review = prepare(), saved = apply(review), fixture = saved.fixture;
  const legacyInput = { answers: { choice: 'a' }, typedAnswers: {} };
  const legacy = apply(prepare(legacyInput, null, 'Legacy', 'legacy'), legacyInput).fixture;
  delete legacy.expected.categories; delete legacy.expected.resultSectionIds;
  check('review preserves exact lexical inputs, complete expectations and caller data without side effects', () => {
    const before = JSON.stringify({ form, input }), checked = prepare();
    assert.equal(checked.inputBaseline, JSON.stringify(input)); assert.equal(checked.name, '  Manual case  ');
    assert.equal(checked.fixture.name, 'Manual case'); assert.equal(checked.fixture.typedAnswers.amount.value, '01.00');
    assert.equal(checked.fixture.typedAnswers.note.value, '  Synthetic Café  '); assert.equal(checked.fixture.answers.agree, false);
    assert.deepEqual(checked.fixture.expected, { status: 'completed', resultId: null, score: null, questionIds: ['choice', 'amount', 'note', 'agree'], categories: [], resultSectionIds: [] });
    assert.deepEqual(apply(checked).cases, [checked.fixture]); assert.equal(JSON.stringify({ form, input }), before);
    assert.equal(fixtures.runJourneyFixture(form, checked.fixture).passed, true); assert.equal(denied, 0);
  });
  check('raw library bytes, input, name and draft changes require a fresh review', () => {
    assert.throws(() => apply(review, { ...input, typedAnswers: { ...input.typedAnswers, amount: typed('number', '1') } }), /changed/);
    assert.throws(() => apply(review, input, rawLocal([], 1)), /changed/);
    assert.throws(() => apply(review, input, null, 'Manual case'), /changed/);
    assert.throws(() => apply(review, input, null, review.name, { ...form, title: 'Changed' }), /changed/);
    const raw = rawLocal([legacy], 1), withLegacy = prepare(input, raw);
    assert.throws(() => apply(withLegacy, input, JSON.stringify(JSON.parse(raw), null, 2)), /changed/);
    assert.equal(JSON.parse(raw).cases.length, 1);
  });
  check('review metadata, proposed expectations and actual result cannot substitute an unreviewed baseline', () => {
    for (const mutate of [r => r.fixture.expected.score = 90, r => r.fixture.id = 'different', r => r.fixture.createdAt = '2026-01-01T00:00:00.000Z', r => r.actual.status = 'scored', r => r.omittedQuestionIds.push('choice'), r => r.unsupportedQuestionIds.push('choice')]) {
      const tampered = clone(review); mutate(tampered); assert.throws(() => apply(tampered), /changed/);
    }
    const forged = clone(review); forged.fixture.expected.score = 90; forged.fixtureBaseline = codec.canonicalJourneyValue(forged.fixture);
    assert.throws(() => apply(forged), /changed/);
  });
  check('blank optional typed values are omitted; valid typed values keep exact provenance and no inferred zero', () => {
    const blank = { answers: { choice: 'a' }, typedAnswers: { amount: typed('number', '  '), note: typed('short_answer', '') } };
    const checked = prepare(blank); assert.deepEqual(checked.omittedQuestionIds, ['amount', 'note']);
    assert.equal(Object.hasOwn(checked.fixture, 'inputVersion'), false); assert.deepEqual(checked.fixture.answers, { choice: 'a' });
    assert.equal(JSON.parse(apply(checked, blank).serialized).version, 1);
    const zero = clone(blank); zero.typedAnswers.amount.value = '0'; const z = prepare(zero);
    assert.equal(z.fixture.typedAnswers.amount.value, '0'); assert.equal(z.fixture.inputVersion, 2);
  });
  check('input errors identify safe field IDs without exposing supplied values and accept only supported types', () => {
    for (const [type, value] of [['number', 'Infinity'], ['number', '0x10'], ['number', '1e999'], ['number', '9'.repeat(65)], ['short_answer', 'x'.repeat(257)], ['short_answer', 'SECRET\nVALUE'], ['short_answer', '\u202e'], ['short_answer', '\ud800']]) {
      const bad = clone(input), id = type === 'number' ? 'amount' : 'note'; bad.typedAnswers[id] = typed(type, value);
      assert.throws(() => prepare(bad), error => error.message.includes(id) && !error.message.includes(value));
    }
    for (const value of ['.5', '-0', '+2.0', '1e-3']) { const valid = clone(input); valid.typedAnswers.amount.value = value; assert.equal(prepare(valid).fixture.typedAnswers.amount.value, value); }
    const wrongFinite = clone(input); wrongFinite.answers.agree = 'false'; assert.throws(() => prepare(wrongFinite), /finite-choice/);
    const overlap = clone(input); overlap.answers.amount = '1'; assert.throws(() => prepare(overlap), /invalid/);
    const unknown = clone(input); unknown.typedAnswers.note.type = 'email'; assert.throws(() => prepare(unknown), /invalid/);
    const rawNumber = clone(input); rawNumber.typedAnswers.amount.value = 1; assert.throws(() => prepare(rawNumber), /invalid/);
  });
  check('all supplied fields are preflighted before routing, and saved finite/typed provenance survives type edits', () => {
    for (const id of ['choice', 'amount']) {
      const changed = clone(form); changed.questions.find(q => q.id === id).type = id === 'choice' ? 'short_answer' : 'multiple_choice';
      const result = fixtures.runJourneyFixture(changed, fixture); assert.equal(result.passed, false); assert.equal(result.actual.status, 'invalid');
    }
    const missing = clone(form); missing.questions = missing.questions.filter(q => q.id !== 'note');
    assert.equal(fixtures.runJourneyFixture(missing, fixture).passed, false);
    const bad = clone(input); bad.typedAnswers.missing = typed('short_answer', 'synthetic'); assert.throws(() => prepare(bad), /existing question/);
    const unsupported = clone(form); unsupported.questions.push({ id: 'email', title: 'Optional email', type: 'email', required: false });
    assert.deepEqual(prepare(input, null, 'Unsupported notice', 'notice', unsupported).unsupportedQuestionIds, ['email']);
    const supplied = clone(input); supplied.typedAnswers.email = typed('short_answer', 'synthetic'); assert.throws(() => prepare(supplied, null, 'Bad', 'bad', unsupported), /recorded/);
    unsupported.questions.at(-1).required = true; assert.throws(() => prepare(input, null, 'Required', 'required', unsupported));
  });
  check('raw own reserved keys cannot be silently stripped from inputs, strict libraries or version2 transfer', () => {
    for (const map of ['answers', 'typedAnswers']) for (const key of ['__proto__', 'prototype', 'constructor']) {
      const bad = clone(input); Object.defineProperty(bad[map], key, { value: map === 'answers' ? 'a' : typed('short_answer', 'synthetic'), enumerable: true });
      assert.throws(() => prepare(bad));
    }
    const bad = clone(fixture); Object.defineProperty(bad.typedAnswers, '__proto__', { value: typed('short_answer', 'synthetic'), enumerable: true });
    assert.throws(() => fixtures.validateJourneyFixtureLibrary([bad])); assert.throws(() => fixtures.parseJourneyFixtures(rawLocal([bad]), form.id));
    assert.throws(() => transfer.prepareJourneyFixtureImport(form, rawFile([bad]), []));
    const root = JSON.parse(rawLocal([fixture])); Object.defineProperty(root, '__proto__', { value: {}, enumerable: true });
    assert.throws(() => fixtures.parseJourneyFixtures(JSON.stringify(root), form.id));
  });
  check('legacy permissive local reads remain byte-preserving but append and promotion reject malformed historical metadata', () => {
    const old = clone(legacy); old.createdAt = 'old-date'; old.unknown = { kept: true }; old.answers.choice = ['a', 'a'];
    const raw = rawLocal([old], 1), read = fixtures.parseJourneyFixtures(raw, form.id);
    assert.deepEqual(read, [old]); assert.equal(Object.hasOwn(read[0].expected, 'categories'), false);
    assert.throws(() => prepare(input, raw), /current library is invalid/);
    assert.throws(() => transfer.prepareJourneyFixtureImport(form, rawFile([fixture]), read), /current library is invalid/);
    assert.throws(() => fixtures.serializeJourneyFixtures(form.id, [...read, fixture]), /invalid/);
    assert.equal(raw, rawLocal([old], 1)); assert.deepEqual(fixtures.parseJourneyFixtures(fixtures.serializeJourneyFixtures(form.id, []), form.id), []);
    assert.equal(fixtures.runJourneyFixture(form, legacy).passed, true);
  });
  check('version1 manual markers reject at root and case level; mixed version2 has full strict expectations', () => {
    for (const key of ['typedAnswers', 'inputVersion']) {
      const root = JSON.parse(rawLocal([legacy], 1)); root[key] = key === 'typedAnswers' ? {} : 2; assert.throws(() => fixtures.parseJourneyFixtures(JSON.stringify(root), form.id));
      const item = clone(legacy); item[key] = key === 'typedAnswers' ? {} : 2; assert.throws(() => fixtures.parseJourneyFixtures(rawLocal([item], 1), form.id));
      assert.throws(() => transfer.prepareJourneyFixtureImport(form, rawFile([item], 1), []));
    }
    for (const mutate of [f => delete f.expected.categories, f => delete f.expected.resultSectionIds, f => f.typedAnswers = {}, f => f.typedAnswers.note.extra = 'no', f => f.answers.note = 'synthetic']) {
      const bad = clone(fixture); mutate(bad); assert.throws(() => fixtures.parseJourneyFixtures(rawLocal([bad]), form.id)); assert.throws(() => transfer.exportJourneyFixtures(form.id, [bad]));
    }
    assert.throws(() => fixtures.parseJourneyFixtures(rawLocal([legacy]), form.id));
    assert.throws(() => transfer.prepareJourneyFixtureImport(form, rawFile([legacy]), []));
  });
  check('mixed local/file roundtrip preserves narrower legacy assertions and literal failing manual expectations', () => {
    const wrong = clone(fixture); wrong.expected.score = 91;
    const mixed = [legacy, wrong], local = fixtures.serializeJourneyFixtures(form.id, mixed), file = transfer.exportJourneyFixtures(form.id, mixed);
    assert.equal(JSON.parse(local).version, 2); assert.equal(JSON.parse(file).version, 2);
    assert.deepEqual(fixtures.parseJourneyFixtures(local, form.id), mixed);
    const imported = transfer.applyJourneyFixtureImport(form, [], transfer.prepareJourneyFixtureImport(form, file, []));
    assert.deepEqual(imported, mixed); assert.equal(fixtures.runJourneyFixture(form, imported[1]).passed, false);
    assert.equal(Object.hasOwn(imported[0].expected, 'categories'), false);
    assert.equal(JSON.parse(fixtures.serializeJourneyFixtures(form.id, [legacy])).version, 1);
    assert.equal(JSON.parse(transfer.exportJourneyFixtures(form.id, [legacy])).version, 1);
  });
  check('shared25-case quota preserves existing libraries and rejects duplicate or stale append', () => {
    const current = Array.from({ length: 25 }, (_, i) => ({ ...clone(legacy), id: 'legacy-' + i })), raw = rawLocal(current, 1);
    assert.throws(() => prepare(input, raw), /25/); assert.equal(fixtures.parseJourneyFixtures(raw, form.id).length, 25);
    assert.throws(() => prepare(input, rawLocal([legacy], 1), 'Duplicate', legacy.id), /already exists/);
    const room = rawLocal(current.slice(1), 1), r = prepare(input, room); assert.equal(apply(r, input, room).cases.length, 25);
    assert.throws(() => transfer.prepareJourneyFixtureImport(form, transfer.exportJourneyFixtures(form.id, [fixture]), current), /25/);
  });
  check('transfer UTF8 bytes and local character budgets remain independent and bounded', () => {
    const file = transfer.exportJourneyFixtures(form.id, [fixture]), exactFile = file + ' '.repeat(transfer.MAX_JOURNEY_TRANSFER_BYTES - Buffer.byteLength(file));
    assert.equal(transfer.prepareJourneyFixtureImport(form, exactFile, []).cases.length, 1);
    assert.throws(() => transfer.prepareJourneyFixtureImport(form, exactFile + ' ', []), /128 KiB/);
    assert.throws(() => transfer.prepareJourneyFixtureImport(form, file + '界'.repeat(50000), []), /128 KiB/);
    assert.throws(() => transfer.decodeJourneyFixtureFile(new Uint8Array([255])), /UTF-8/);
    const local = rawLocal([fixture]), exactLocal = local + ' '.repeat(500000 - local.length);
    assert.equal(fixtures.parseJourneyFixtures(exactLocal, form.id).length, 1);
    assert.throws(() => fixtures.parseJourneyFixtures(exactLocal + ' ', form.id), /large/);
    const large = Array.from({ length: 25 }, (_, n) => ({ ...clone(fixture), id: 'large-' + n, typedAnswers: Object.fromEntries(Array.from({ length: 100 }, (_, i) => ['q' + i, typed('short_answer', '界'.repeat(256))])) }));
    assert.throws(() => fixtures.serializeJourneyFixtures(form.id, large), /storage limit/);
  });
  assert.equal(denied, 0);
  console.log(`${groups} manual model/codec groups passed; no storage, network or provider operations.`);
} finally {
  global.fetch = savedFetch;
  if (savedStorage) Object.defineProperty(global, 'localStorage', savedStorage); else delete global.localStorage;
}
