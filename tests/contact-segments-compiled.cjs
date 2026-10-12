// Independent HTTP acceptance against an explicitly isolated compiled server.
// Synthetic owner records only; no public attempts, contacts or email jobs.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto'), ts = require('typescript'), { request } = require('playwright');
const base = process.env.TEST_BASE_URL, dataDir = process.env.HEYQUIZ_DATA_DIR;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(dataDir && path.resolve(dataDir).endsWith('/pippi-overnight-2026-10-12/release-test-data'));
assert.equal(process.env.HEYQUIZ_LOCAL_MODE, '1');
for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VERCEL', 'VERCEL_ENV']) assert.ok(!process.env[key]);
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { readRecord, writeRecord, removeRecord } = require('../lib/records.ts');
const { FormSchema } = require('../lib/schema.ts');
const { emptyContactFilters } = require('../lib/contact-filters.ts');
const stamp = Date.now(), ids = ['main', 'empty', 'foreign'].map(kind => `qa-segment-http-${kind}-${stamp}`), foreignOwner = 'qa-segment-foreign-owner';
const filters = { ...emptyContactFilters, consent: 'yes' }; delete filters.query;
const setId = (owner, id) => createHash('sha256').update(JSON.stringify([owner, id])).digest('hex');
const form = id => FormSchema.parse({ id, title: 'Synthetic saved-filter HTTP checks', mode: 'survey', questions: [{ id: 'q', title: 'Choose', type: 'multiple_choice', options: [{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }] }] });
const checks = [], pass = message => { checks.push(message); console.log('PASS ' + message); };
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-14/contact-segments-compiled');
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const owner = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const visitor = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const route = id => `/api/forms/${id}/contact-segments`;
  async function expect(response, status) {
    assert.equal(response.status(), status, `HTTP ${response.status()} instead of ${status}: ${await response.text()}`);
    assert.match(response.headers()['cache-control'] || '', /private/);
    assert.match(response.headers()['cache-control'] || '', /no-store/);
    return response.json();
  }
  const current = async id => expect(await owner.get(route(id)), 200);
  try {
    assert.equal((await owner.post('/api/auth', { data: { local: true } })).status(), 200);
    for (const id of ids.slice(0, 2)) assert.equal((await owner.post('/api/forms', { data: form(id) })).status(), 201);
    await writeRecord('forms', ids[2], foreignOwner, form(ids[2]), 0);
    const endpoint = route(ids[0]);
    for (const method of ['get', 'post', 'patch', 'delete']) {
      const data = method === 'post' ? { revision: 0, name: 'Never written', filters }
        : method === 'patch' ? { revision: 0, id: '00000000-0000-4000-8000-000000000000', operation: 'rename', name: 'Never written' }
          : { revision: 0, id: '00000000-0000-4000-8000-000000000000' };
      await expect(await visitor[method](endpoint, method === 'get' ? {} : { data }), 401);
      await expect(await owner[method](route(ids[2]), method === 'get' ? {} : { data }), 404);
    }
    assert.deepEqual(await current(ids[0]), { schemaVersion: 1, revision: 0, segments: [] });
    assert.equal(await readRecord('contact_segments', setId('local', ids[0])), null);
    pass('Compiled collection denies anonymous and foreign owners on every method; private empty collection stays absent');

    for (const origin of ['https://foreign.example.test', base.replace('http:', 'https:'), 'null']) await expect(await owner.post(endpoint, { headers: { Origin: origin }, data: { revision: 0, name: 'Blocked origin', filters } }), 403);
    await expect(await owner.get(endpoint + '?owner=another'), 400);
    await expect(await owner.post(endpoint, { headers: { 'Content-Type': 'text/plain' }, data: 'plain' }), 400);
    await expect(await owner.post(endpoint, { headers: { 'Content-Type': 'application/json' }, data: '{broken' }), 400);
    await expect(await owner.post(endpoint, { data: { revision: 0, name: '界'.repeat(6000), filters } }), 413);
    for (const body of [
      { revision: 0, name: 'Extra owner', filters, owner_id: 'other' },
      { revision: 0, name: 'PII search', filters: { ...filters, query: 'synthetic-private@example.test' } },
      { revision: 0, name: 'Incomplete pair', filters: { ...filters, answerVersion: 'answer-version-' + 'a'.repeat(20) } },
      { revision: 0, name: 'Contradictory', filters: { ...filters, score: 'unscored', minScore: '0' } },
    ]) await expect(await owner.post(endpoint, { data: body }), 400);
    assert.equal(await readRecord('contact_segments', setId('local', ids[0])), null);
    pass('Origin scheme, body/media/UTF-8 budget, query and forbidden filter fields reject before any record is created');

    let state = await expect(await owner.post(endpoint, { data: { revision: 0, name: 'First group', filters } }), 201);
    const first = state.segments[0]; assert.match(first.id, /^[a-f0-9-]{36}$/); assert.deepEqual(first.filters, filters);
    assert.deepEqual(Object.keys(first).sort(), ['createdAt', 'filters', 'id', 'name', 'updatedAt']);
    await expect(await owner.post(endpoint, { data: { revision: state.revision, name: ' first GROUP ', filters } }), 409);
    await expect(await owner.patch(endpoint, { data: { revision: 0, id: first.id, operation: 'rename', name: 'Stale name' } }), 409);
    assert.deepEqual(await current(ids[0]), state);
    for (let n = 2; n <= 19; n++) state = await expect(await owner.post(endpoint, { data: { revision: state.revision, name: 'Group ' + n, filters } }), 201);
    const competing = await Promise.all(['Last A', 'Last B'].map(name => owner.post(endpoint, { data: { revision: state.revision, name, filters } })));
    assert.deepEqual(competing.map(r => r.status()).sort(), [201, 409]);
    for (const response of competing) await expect(response, response.status());
    state = await current(ids[0]); assert.equal(state.segments.length, 20);
    await expect(await owner.post(endpoint, { data: { revision: state.revision, name: 'Too many', filters } }), 409);
    pass('Actual concurrent creates at19 enforce20 quota and one CAS winner; duplicate names and stale revisions preserve the set');

    const modifications = await Promise.all([
      owner.patch(endpoint, { data: { revision: state.revision, id: first.id, operation: 'rename', name: 'Renamed group' } }),
      owner.patch(endpoint, { data: { revision: state.revision, id: first.id, operation: 'replace', filters: { ...filters, consent: 'no' } } }),
    ]);
    assert.deepEqual(modifications.map(r => r.status()).sort(), [200, 409]);
    const committed = await expect(modifications.find(r => r.status() === 200), 200); await expect(modifications.find(r => r.status() === 409), 409);
    assert.deepEqual(await current(ids[0]), committed);
    const secondEndpoint = route(ids[1]); let second = await expect(await owner.post(secondEndpoint, { data: { revision: 0, name: 'Disposable group', filters } }), 201);
    const deletedId = second.segments[0].id; second = await expect(await owner.delete(secondEndpoint, { data: { revision: second.revision, id: deletedId } }), 200);
    assert.deepEqual(second, { schemaVersion: 1, revision: 2, segments: [] });
    await expect(await owner.post(secondEndpoint, { data: { revision: 0, name: 'Stale recreate', filters } }), 409);
    assert.equal((await readRecord('contact_segments', setId('local', ids[1]))).version, 2);
    pass('Concurrent rename/replace cannot lose an edit; last deletion retains revision and stale create cannot reset it');

    const key = setId('local', ids[0]), good = await readRecord('contact_segments', key);
    const corrupt = await writeRecord('contact_segments', key, 'local', { ...good.payload, segments: [{ ...good.payload.segments[0], unexpected: 'Never returned' }] }, good.version);
    for (const method of ['get', 'post']) {
      const reply = await expect(await owner[method](endpoint, method === 'get' ? {} : { data: { revision: corrupt.version, name: 'Should not repair', filters } }), 503);
      assert.ok(!JSON.stringify(reply).includes('Never returned'));
    }
    assert.deepEqual(await readRecord('contact_segments', key), corrupt);
    await writeRecord('contact_segments', key, 'local', good.payload, corrupt.version);
    const retirementKey = setId('local', ids[0]); await writeRecord('result_report_revocations', retirementKey, 'local', { retiredAt: 'bad' }, 0);
    await expect(await owner.get(endpoint), 503); await removeRecord('result_report_revocations', retirementKey, 'local');
    pass('Malformed aggregate and retirement data fail closed with safe503 responses, without empty-list fallback or rewriting');

    const retained = await readRecord('contact_segments', key);
    assert.equal((await owner.delete('/api/forms/' + ids[0])).status(), 200);
    await expect(await owner.get(endpoint), 404);
    assert.equal((await owner.post('/api/forms', { data: form(ids[0]) })).status(), 201);
    await expect(await owner.get(endpoint), 410);
    await expect(await owner.post(endpoint, { data: { revision: retained.version, name: 'Cannot revive', filters } }), 410);
    assert.deepEqual(await readRecord('contact_segments', key), retained);
    assert.equal((await owner.get('/api/forms/' + ids[0] + '/contacts')).status(), 200);
    assert.deepEqual((await current(ids[1])).segments, []);
    pass('Real delete/recreate keeps prior definitions inaccessible while ordinary contacts and fresh unrelated quizzes work');
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ checks, publicStarts: 0, contactWrites: 0, emailJobs: 0, scope: 'Synthetic local compiled HTTP only' }, null, 2));
  } finally {
    for (const [index, id] of ids.entries()) {
      const recordOwner = index === 2 ? foreignOwner : 'local';
      if (recordOwner === 'local') await owner.delete('/api/forms/' + id).catch(() => {});
      for (const kind of ['forms', 'published']) await removeRecord(kind, id, recordOwner).catch(() => {});
      for (const kind of ['contact_segments', 'result_report_revocations']) await removeRecord(kind, setId(recordOwner, id), recordOwner).catch(() => {});
    }
    await owner.dispose(); await visitor.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
