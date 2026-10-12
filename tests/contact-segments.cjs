// Offline service/API rehearsal: only fresh temporary records and synthetic participants.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), ts = require('typescript'), Module = require('node:module');
const { randomUUID } = require('node:crypto');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pippi-contact-segments-'));
process.env.HEYQUIZ_DATA_DIR = directory; process.env.TZ = 'Europe/London';
for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) process.env[key] = '';
const root = path.resolve(__dirname, '..'), originalLoad = Module._load, originalFetch = global.fetch;
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
let user = 'owner', outbound = 0;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const auth = {
  HttpError, requireUser: async () => { if (!user) throw new HttpError(401, 'Sign in'); return { id: user }; },
  checkOrigin: request => { const origin = request.headers.get('origin'); if (origin && new URL(origin).host !== (request.headers.get('host') || new URL(request.url).host)) throw new HttpError(403, 'Foreign origin'); },
  apiError: error => Response.json({ error: error.message }, { status: error.status || 400 }),
};
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/auth' || request === './auth' && parent?.filename.startsWith(path.join(root, 'lib'))) return auth;
  return originalLoad.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, isMain);
};
global.fetch = async () => { outbound++; throw Error('Outbound requests are forbidden in this rehearsal.'); };
const loadedBeforeSchema = new Set(Object.keys(require.cache));
const schema = require('../lib/contact-segment-schema.ts');
const sharedDependencies = Object.keys(require.cache).filter(file => !loadedBeforeSchema.has(file));
const records = require('../lib/records.ts');
const service = require('../lib/contact-segments.ts'), route = require('../app/api/forms/[id]/contact-segments/route.ts');
const { deleteForm } = require('../lib/storage.ts'), { revokeFormResultReports } = require('../lib/result-reports.ts');
const { emptyContactFilters, filterContacts, contactResultKey, contactCategoryKey } = require('../lib/contact-filters.ts');
const { writeRecord, readRecord, removeRecord } = records;
const filters = patch => schema.contactSegmentFiltersFromCurrent({ ...emptyContactFilters, ...patch });
const fid = label => 'qa-segments-' + label;
const form = (id, owner = 'owner') => writeRecord('forms', id, owner, { id, title: 'Synthetic quiz' }, 0);
const recordPath = (kind, id) => path.join(directory, kind, id + '.json');
const raw = async (kind, id, modify) => { const filename = recordPath(kind, id), before = fs.readFileSync(filename, 'utf8'); fs.writeFileSync(filename, JSON.stringify(modify(JSON.parse(before)))); return () => fs.writeFileSync(filename, before); };
const status = async (promise, expected) => assert.rejects(promise, error => error instanceof HttpError && error.status === expected, 'expected HTTP ' + expected);
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
const body = (revision, name = 'Opted in', selected = filters({ consent: 'yes' })) => ({ revision, name, filters: selected });
function api(method, formId, value, options = {}) {
  const headers = { Origin: 'http://127.0.0.1', ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  const request = new Request('http://127.0.0.1/api/forms/' + formId + '/contact-segments' + (options.query || ''), { method, headers, ...(method === 'GET' ? {} : { body: options.raw === undefined ? JSON.stringify(value) : options.raw, ...(options.raw instanceof ReadableStream ? { duplex: 'half' } : {}) }) });
  return route[method](request, { params: Promise.resolve({ id: formId }) });
}
(async () => { try {
  await test('strict browser-safe schema excludes search/member/count fields and incomplete/invalid conditions', async () => {
    const valid = filters({ consent: 'yes' });
    for (const value of [{ ...valid, query: 'synthetic@example.test' }, { ...valid, members: ['response'] }, { ...valid, count: 10 }, { ...valid, from: '2026-02-30' }, { ...valid, from: '2026-10-02', to: '2026-10-01' }, { ...valid, minScore: '101' }, { ...valid, minScore: '80', maxScore: '20' }, { ...valid, score: 'unscored', minScore: '0' }, { ...valid, answerVersion: 'answer-version-12345678901234567890' }, { ...valid, answerOption: 'a' }, { ...valid, source: 'all' }, { ...valid, campaign: 'campaign' }, { ...valid, result: '[ "knowledge", "tier", "Old" ]' }, { ...valid, category: '["category"]' }, { ...valid, categoryScore: 'missing' }, { ...valid, category: '["c","C"]', categoryScore: 'unscored', categoryMin: '0' }]) assert.throws(() => schema.parseContactSegmentFilters(value), schema.ContactSegmentValidationError);
    for (const query of ['synthetic@example.test', ' ', '\t']) assert.throws(() => schema.contactSegmentFiltersFromCurrent({ ...emptyContactFilters, consent: 'yes', query }), /Clear contact search/);
    assert.throws(() => schema.contactSegmentFiltersFromCurrent(emptyContactFilters), /at least one/);
    assert.deepEqual(Object.keys(valid), Object.keys(emptyContactFilters).filter(key => key !== 'query'));
    assert.ok(!sharedDependencies.some(file => /[\/]lib[\/](auth|records|storage|local-record-reads|result-reports)\.ts$/.test(file)), 'shared schema has no server auth/storage dependency');
  });
  await test('all supported definitions retain exact existing contact membership and historical/null/zero meanings', async () => {
    const rows = [0, 1, 2, 3].map(index => ({ id: 'r' + index, formId: 'quiz', submittedAt: ['2026-03-29T00:00:00.000Z', '2026-03-29T22:59:59.999Z', '2026-03-29T23:00:00.000Z', 'invalid'][index], totalPointsPossible: 1, percentageScore: index === 0 ? 0 : 50, contact: { name: 'Synthetic ' + index, email: 'contact@example.test', marketingConsent: index === 0 }, marketing: { kind: 'scorecard', title: index < 2 ? 'Earlier wording' : 'Current wording', overallScore: index === 1 ? null : index === 0 ? 0 : 50, categories: index === 3 ? [] : [{ id: 'c', title: index === 2 ? 'Renamed category' : 'Earlier category', score: index === 1 ? null : index === 0 ? 0 : 50 }] } }));
    const contexts = { r0: { source: 'utm:unknown', campaign: 'value:all' }, r1: { source: 'unknown', campaign: 'unknown' }, r2: { source: 'ref:example.test', campaign: 'value:Autumn' }, r3: { source: 'utm:Newsletter', campaign: 'value:Spring' } };
    const version = 'answer-version-12345678901234567890', cohort = { selection: { version, option: 'a' }, matchingIds: ['r0', 'r2'] };
    const cases = [{ consent: 'yes' }, { consent: 'no' }, { from: '2026-03-29', to: '2026-03-29' }, { result: contactResultKey(rows[0]) }, { score: 'scored', minScore: '0', maxScore: '0' }, { score: 'unscored' }, { source: 'unknown' }, { source: 'utm:unknown', campaign: 'value:all' }, { source: 'ref:example.test' }, { campaign: 'value:Spring' }, { category: contactCategoryKey(rows[0].marketing.categories[0]), categoryScore: 'scored', categoryMin: '0', categoryMax: '0' }, { category: contactCategoryKey(rows[0].marketing.categories[0]), categoryScore: 'unscored' }, { category: contactCategoryKey(rows[0].marketing.categories[0]), categoryScore: 'missing' }, { answerVersion: version, answerOption: 'a' }];
    for (const patch of cases) {
      const current = { ...emptyContactFilters, ...patch }, roundtrip = schema.contactFiltersFromSegment(schema.parseContactSegmentFilters(JSON.parse(JSON.stringify(filters(patch)))));
      assert.deepEqual(roundtrip, current);
      assert.deepEqual(filterContacts(rows, roundtrip, contexts, cohort).map(row => row.id), filterContacts(rows, current, contexts, cohort).map(row => row.id));
    }
    assert.deepEqual(filterContacts(rows, schema.contactFiltersFromSegment(filters(cases[2])), contexts).map(row => row.id), ['r0', 'r1'], 'inclusive DST day preserved');
    assert.deepEqual(filterContacts(rows, schema.contactFiltersFromSegment(filters(cases[7])), contexts).map(row => row.id), ['r0'], 'literal labels never become unknown/all sentinels');
  });
  await test('owner-scoped empty/create/rename/replace/delete persists revision and carries no contact data', async () => {
    const id = fid('lifecycle'); await form(id); await form(fid('other'));
    assert.deepEqual(await service.listContactSegments(id, 'owner'), { schemaVersion: 1, revision: 0, segments: [] });
    let saved = await service.createContactSegment(id, 'owner', body(0, '  Opted in  ')); assert.equal(saved.revision, 1); assert.equal(saved.segments[0].name, 'Opted in');
    assert.throws(() => schema.parseContactSegmentResponse({ ...saved, revision: 0 }), schema.ContactSegmentValidationError);
    assert.throws(() => schema.parseContactSegmentResponse({ ...saved, segments: [...saved.segments, saved.segments[0]] }), schema.ContactSegmentValidationError);
    assert.throws(() => schema.parseContactSegmentResponse({ ...saved, counts: 1 }), schema.ContactSegmentValidationError);
    const selected = saved.segments[0]; assert.match(selected.id, /^[a-f0-9-]{36}$/); assert.deepEqual(Object.keys(selected), ['id', 'name', 'createdAt', 'updatedAt', 'filters']);
    saved = await service.updateContactSegment(id, 'owner', { revision: 1, id: selected.id, operation: 'rename', name: 'New name' }); assert.equal(saved.revision, 2); assert.deepEqual(saved.segments[0].filters, selected.filters);
    saved = await service.updateContactSegment(id, 'owner', { revision: 2, id: selected.id, operation: 'replace', filters: filters({ source: 'unknown' }) }); assert.equal(saved.segments[0].name, 'New name'); assert.equal(saved.segments[0].createdAt, selected.createdAt);
    saved = await service.deleteContactSegment(id, 'owner', { revision: 3, id: selected.id }); assert.deepEqual(saved, { schemaVersion: 1, revision: 4, segments: [] });
    assert.equal((await readRecord('contact_segments', service.contactSegmentRecordId(id, 'owner'))).version, 4);
    await status(service.createContactSegment(id, 'owner', body(0, 'Stale creation')), 409);
    assert.equal((await service.createContactSegment(id, 'owner', body(4, 'Fresh creation'))).revision, 5);
    assert.deepEqual(await service.listContactSegments(fid('other'), 'owner'), { schemaVersion: 1, revision: 0, segments: [] });
    await status(service.listContactSegments(id, 'foreign'), 404); await status(service.deleteContactSegment(id, 'foreign', { revision: 5, id: selected.id }), 404);
  });
  await test('20-definition quota and parallel local CAS writes cannot lose updates or overflow the set', async () => {
    const id = fid('quota'); await form(id); let saved;
    for (let i = 0; i < 19; i++) saved = await service.createContactSegment(id, 'owner', body(i, 'Filter ' + i));
    const races = await Promise.allSettled([service.createContactSegment(id, 'owner', body(19, 'Candidate A')), service.createContactSegment(id, 'owner', body(19, 'Candidate B'))]);
    assert.equal(races.filter(result => result.status === 'fulfilled').length, 1); assert.equal(races.find(result => result.status === 'rejected').reason.status, 409);
    saved = await service.listContactSegments(id, 'owner'); assert.equal(saved.revision, 20); assert.equal(saved.segments.length, 20);
    await status(service.createContactSegment(id, 'owner', body(20, 'Over quota')), 409);
    const target = saved.segments[0], next = await Promise.allSettled([service.updateContactSegment(id, 'owner', { revision: 20, id: target.id, operation: 'rename', name: 'Changed A' }), service.deleteContactSegment(id, 'owner', { revision: 20, id: target.id })]);
    assert.equal(next.filter(result => result.status === 'fulfilled').length, 1); assert.equal(next.find(result => result.status === 'rejected').reason.status, 409);
    const final = await service.listContactSegments(id, 'owner'); assert.equal(final.revision, 21); assert.ok(final.segments.some(segment => segment.id === saved.segments[1].id));
    await status(service.deleteContactSegment(id, 'owner', { revision: 20, id: target.id }), 409);
  });
  await test('duplicate normalized names, foreign IDs, query injection, invalid names and invalid target never change records', async () => {
    const id = fid('strict'); await form(id); const saved = await service.createContactSegment(id, 'owner', body(0, 'Readiness'));
    for (const name of ['READINESS', 'Ｒｅａｄｉｎｅｓｓ']) await status(service.createContactSegment(id, 'owner', body(1, name)), 409);
    for (const name of ['', 'x'.repeat(81), 'Bad\nName']) await status(service.createContactSegment(id, 'owner', body(1, name)), 400);
    await status(service.createContactSegment(id, 'owner', { ...body(1), owner_id: 'foreign' }), 400);
    await status(service.createContactSegment(id, 'owner', { ...body(1), filters: { ...filters({ consent: 'yes' }), query: 'private@example.test' } }), 400);
    await status(service.updateContactSegment(id, 'owner', { revision: 1, id: randomUUID(), operation: 'rename', name: 'Missing' }), 404);
    assert.deepEqual(await service.listContactSegments(id, 'owner'), saved);
  });
  await test('128 KiB aggregate and 16 KiB mutation limits reject rather than truncate definitions', async () => {
    const id = fid('bytes'); await form(id);
    const largeFilters = filters({ result: JSON.stringify(['knowledge', 'id', 'é'.repeat(1950)]), category: JSON.stringify(['category', 'é'.repeat(1950)]) });
    let successes = 0, revision = 0;
    for (let i = 0; i < 20; i++) {
      try { const result = await service.createContactSegment(id, 'owner', body(revision, 'Large ' + i, largeFilters)); revision = result.revision; successes++; }
      catch (error) { assert.equal(error.status, 400); break; }
    }
    assert.ok(successes > 0 && successes < 20); const set = await service.listContactSegments(id, 'owner'); assert.equal(set.segments.length, successes);
    assert.ok(schema.contactSegmentJsonBytes(set) <= schema.CONTACT_SEGMENT_SET_BYTES);
    assert.throws(() => schema.parseContactSegmentCreate({ ...body(0), extra: 'x'.repeat(17000) }), /too large/);
  });
  await test('malformed stored wrapper/payload fails closed without overwrite or silent normalization', async () => {
    const id = fid('corrupt'); await form(id); await service.createContactSegment(id, 'owner', body(0)); const key = service.contactSegmentRecordId(id, 'owner');
    for (const modify of [r => ({ ...r, kind: 'other' }), r => ({ ...r, id: 'other' }), r => ({ ...r, owner_id: 'foreign' }), r => ({ ...r, version: 0 }), r => ({ ...r, version: 1.5 }), r => ({ ...r, version: Number.MAX_SAFE_INTEGER + 1 }), r => ({ ...r, payload: { ...r.payload, formId: 'other' } }), r => ({ ...r, payload: { ...r.payload, schemaVersion: 2 } }), r => ({ ...r, payload: { ...r.payload, members: [] } }), r => ({ ...r, payload: { ...r.payload, segments: r.payload.segments.map(s => ({ ...s, name: ' Untrimmed ' })) } }), r => ({ ...r, payload: { ...r.payload, segments: r.payload.segments.map(s => ({ ...s, filters: { ...s.filters, count: 3 } })) } })]) {
      const restore = await raw('contact_segments', key, modify), before = fs.readFileSync(recordPath('contact_segments', key));
      try { await status(service.listContactSegments(id, 'owner'), 503); await status(service.createContactSegment(id, 'owner', body(1, 'No overwrite')), 503); assert.deepEqual(fs.readFileSync(recordPath('contact_segments', key)), before); } finally { restore(); }
    }
    const filename = recordPath('contact_segments', key), before = fs.readFileSync(filename); fs.writeFileSync(filename, '{broken');
    try { await status(service.listContactSegments(id, 'owner'), 503); assert.equal(fs.readFileSync(filename, 'utf8'), '{broken'); } finally { fs.writeFileSync(filename, before); }
  });
  await test('deleted/recreated and same-millisecond retired IDs remain denied; new IDs and other owners stay isolated', async () => {
    const id = fid('retired'); await form(id); const saved = await service.createContactSegment(id, 'owner', body(0));
    const clock = Date.now; try {
      Date.now = () => 1800000000000;
      assert.equal(await deleteForm(id, 'owner'), true); await status(service.listContactSegments(id, 'owner'), 404);
      await form(id); await status(service.listContactSegments(id, 'owner'), 410); await status(service.createContactSegment(id, 'owner', body(1, 'Revive')), 410);
      await status(service.updateContactSegment(id, 'owner', { revision: 1, id: saved.segments[0].id, operation: 'rename', name: 'Revive' }), 410);
      await status(service.deleteContactSegment(id, 'owner', { revision: 1, id: saved.segments[0].id }), 410);
      await deleteForm(id, 'owner'); await form(id); await status(service.listContactSegments(id, 'owner'), 410);
    } finally { Date.now = clock; }
    assert.equal((await readRecord('contact_segments', service.contactSegmentRecordId(id, 'owner'))).version, 1);
    await removeRecord('forms', id, 'owner'); await form(id, 'foreign'); await status(service.listContactSegments(id, 'owner'), 404);
    assert.deepEqual(await service.listContactSegments(id, 'foreign'), { schemaVersion: 1, revision: 0, segments: [] });
    await form(fid('fresh')); assert.equal((await service.createContactSegment(fid('fresh'), 'owner', body(0))).revision, 1);
  });
  await test('malformed lifecycle receipt or form wrapper never authorizes saved filters; zero retirement also denies', async () => {
    const id = fid('bad-receipt'); await form(id); await revokeFormResultReports(id, 'owner'); const key = service.contactSegmentRecordId(id, 'owner');
    for (const modify of [r => ({ ...r, owner_id: 'foreign' }), r => ({ ...r, kind: 'other' }), r => ({ ...r, id: 'other' }), r => ({ ...r, version: 0 }), r => ({ ...r, payload: {} }), r => ({ ...r, payload: { retiredAt: -1 } }), r => ({ ...r, payload: { retiredAt: 1.1 } }), r => ({ ...r, payload: { retiredAt: '123' } }), r => ({ ...r, payload: { retiredAt: 1, extra: true } })]) {
      const restore = await raw('result_report_revocations', key, modify); try { await status(service.listContactSegments(id, 'owner'), 503); await status(service.createContactSegment(id, 'owner', body(0)), 503); } finally { restore(); }
    }
    const restore = await raw('result_report_revocations', key, r => ({ ...r, payload: { retiredAt: 0 } })); try { await status(service.listContactSegments(id, 'owner'), 410); } finally { restore(); }
    const formRestore = await raw('forms', id, r => ({ ...r, kind: 'other' })); try { await status(service.listContactSegments(id, 'owner'), 503); } finally { formRestore(); }
  });
  await test('one reread reconciles competing first insert and post-commit failure without retry or duplication', async () => {
    for (const mode of ['first-insert', 'after-commit', 'unchanged-failure']) {
      const id = fid(mode); await form(id); let writes = 0, reads = 0;
      records.readRecord = async (kind, key) => { if (kind === 'contact_segments') reads++; return readRecord(kind, key); };
      records.writeRecord = async (...args) => {
        if (args[0] !== 'contact_segments') return writeRecord(...args); writes++;
        if (mode === 'first-insert') await writeRecord(...[...args.slice(0, 3), { ...args[3], segments: args[3].segments.map(s => ({ ...s, name: 'Winning concurrent save' })) }, args[4]]);
        if (mode === 'after-commit') await writeRecord(...args);
        throw Error('PRIVATE ADAPTER MESSAGE');
      };
      try { await status(service.createContactSegment(id, 'owner', body(0)), mode === 'unchanged-failure' ? 503 : 409); assert.equal(writes, 1); assert.equal(reads, 2); }
      finally { records.writeRecord = writeRecord; records.readRecord = readRecord; }
      const saved = await service.listContactSegments(id, 'owner'); assert.equal(saved.segments.length, mode === 'unchanged-failure' ? 0 : 1);
      if (mode !== 'unchanged-failure') { await status(service.createContactSegment(id, 'owner', body(0)), 409); assert.equal((await service.listContactSegments(id, 'owner')).segments.length, 1); }
    }
  });
  await test('deletion races before/after commit keep any late stored rows inaccessible after recreation', async () => {
    for (const when of ['before', 'after']) {
      const id = fid('delete-race-' + when); await form(id);
      records.writeRecord = async (...args) => {
        if (args[0] !== 'contact_segments') return writeRecord(...args);
        if (when === 'before') { await deleteForm(id, 'owner'); await form(id); }
        const result = await writeRecord(...args);
        if (when === 'after') { await deleteForm(id, 'owner'); await form(id); }
        return result;
      };
      try { await status(service.createContactSegment(id, 'owner', body(0)), 410); } finally { records.writeRecord = writeRecord; }
      await status(service.listContactSegments(id, 'owner'), 410); await status(service.createContactSegment(id, 'owner', body(0)), 410);
    }
  });
  await test('GET final eligibility recheck and generic read errors never leak definitions', async () => {
    const id = fid('read-race'); await form(id); await service.createContactSegment(id, 'owner', body(0));
    records.readRecord = async (kind, key) => { const result = await readRecord(kind, key); if (kind === 'contact_segments') { await deleteForm(id, 'owner'); await form(id); } return result; };
    try { await status(service.listContactSegments(id, 'owner'), 410); } finally { records.readRecord = readRecord; }
    records.readRecord = async () => { throw Error('PRIVATE STORAGE DETAIL'); };
    try { await assert.rejects(service.listContactSegments(fid('fresh'), 'owner'), error => error.status === 503 && !error.message.includes('PRIVATE')); } finally { records.readRecord = readRecord; }
  });
  await test('actual route contract checks authentication/origin/query/body bounds and keeps all responses no-store', async () => {
    const id = fid('api'); await form(id);
    let response = await api('GET', id); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    user = null; assert.equal((await api('GET', id)).status, 401); assert.equal((await api('POST', id, body(0))).status, 401); user = 'owner';
    for (const origin of ['https://foreign.test', 'https://127.0.0.1', 'null', 'not a url']) for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) assert.equal((await api(method, id, {}, { headers: { Origin: origin } })).status, 403);
    const normalized = new Request('http://localhost/api/forms/' + id + '/contact-segments', { headers: { Host: '127.0.0.1', Origin: 'http://127.0.0.1' } });
    assert.equal((await route.GET(normalized, { params: Promise.resolve({ id }) })).status, 200, 'Next internal hostname normalization must not reject legitimate Host/Origin');
    assert.equal((await api('GET', id, undefined, { headers: { Origin: 'http://foreign.test', 'X-Forwarded-Host': 'foreign.test' } })).status, 403, 'forwarded host never authorizes a supplied origin');
    assert.equal((await api('GET', id, undefined, { query: '?owner=foreign' })).status, 400);
    assert.equal((await api('POST', id, {}, { headers: { 'Content-Type': 'text/plain' } })).status, 400);
    assert.equal((await api('POST', id, {}, { raw: '{bad json' })).status, 400);
    assert.equal((await api('POST', id, {}, { raw: new Uint8Array([255]) })).status, 400);
    assert.equal((await api('POST', id, {}, { headers: { 'Content-Length': '16385' } })).status, 413);
    assert.equal((await api('POST', id, {}, { raw: ' '.repeat(16385) })).status, 413);
    assert.equal((await api('POST', id, {}, { raw: 'é'.repeat(9000), headers: { 'Content-Length': '2' } })).status, 413, 'actual UTF-8 bytes override understated Content-Length');
    let cancelled = false;
    const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(9000)); }, cancel() { cancelled = true; } });
    response = await api('POST', id, {}, { raw: stream }); assert.equal(response.status, 413); assert.ok(cancelled); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    response = await api('POST', id, body(0)); assert.equal(response.status, 201); let saved = schema.parseContactSegmentResponse(await response.json());
    assert.equal((await api('POST', id, body(0))).status, 409);
    response = await api('PATCH', id, { revision: 1, id: saved.segments[0].id, operation: 'rename', name: 'Renamed API filter' }); assert.equal(response.status, 200); saved = await response.json();
    response = await api('DELETE', id, { revision: 2, id: saved.segments[0].id }); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { schemaVersion: 1, revision: 3, segments: [] });
    user = 'foreign'; assert.equal((await api('GET', id)).status, 404); user = 'owner';
    await deleteForm(id, 'owner'); await form(id); response = await api('GET', id); assert.equal(response.status, 410); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });
  assert.equal(outbound, 0); console.log(`${count} saved-contact-filter service/API groups passed. Fresh synthetic temporary records only; zero outbound requests.`);
} finally { records.writeRecord = writeRecord; records.readRecord = readRecord; Module._load = originalLoad; global.fetch = originalFetch; fs.rmSync(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
