// Independent real localhost publication boundaries, with no respondent starts.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { randomUUID, createHash } = require('node:crypto'), { request } = require('playwright');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts'), { publicationFingerprint } = require('../lib/publication.ts');
const { cloudEnabled, readRecord, removeRecord } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164', out = path.resolve(process.env.ARTIFACT_DIR);
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/); assert.equal(process.env.HEYQUIZ_LOCAL_MODE, '1'); assert.equal(cloudEnabled(), false);
assert.ok(process.env.HEYQUIZ_DATA_DIR?.endsWith('/pippi-overnight-2026-10-12/release-test-data')); fs.mkdirSync(out, { recursive: true });
const id = 'qa-publish-boundary-' + randomUUID(), headers = { Origin: base }, observations = [], receipts = [];
(async () => {
  const owner = await request.newContext(), guest = await request.newContext();
  const json = async (response, status) => { assert.equal(response.status(), status); return response.json(); };
  const publish = async () => {
    const res = await owner.post(base + '/api/forms/' + id + '/publish', { headers, data: {} }), body = await json(res, 200);
    assert.equal(body.success, true); assert.equal(body.url, '/play/' + id);
    const live = (await readRecord('published', id, 'local')).payload;
    if (process.env.REQUIRE_PUBLICATION_RECEIPT === '1') {
      assert.equal(res.headers()['cache-control'], 'private, no-store');
      assert.deepEqual(body.publication, { version: 1, formId: id, fingerprint: publicationFingerprint(live) });
      receipts.push({ verified: true, payloadLogged: false });
    }
    return live;
  };
  const publicTitle = async (expected, excluded) => {
    const res = await guest.get(base + '/play/' + id); assert.equal(res.status(), 200);
    const html = await res.text(); assert.ok(html.includes(expected)); if (excluded) assert.equal(html.includes(excluded), false);
  };
  try {
    await json(await owner.post(base + '/api/auth', { headers, data: { local: true } }), 200);
    await json(await owner.post(base + '/api/forms', { headers, data: FormSchema.parse({ id, title: 'Synthetic first live edition', mode: 'survey', questions: [{ id: 'q', type: 'multiple_choice', title: 'Pick a route', options: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }] }] }) }), 201);
    assert.equal((await guest.post(base + '/api/forms/' + id + '/publish', { headers, data: {} })).status(), 401);
    assert.equal((await owner.post(base + '/api/forms/' + id + '/publish', { headers: { Origin: 'https://unrelated.example.invalid' }, data: {} })).status(), 403);
    assert.equal(await readRecord('published', id, 'local'), null);
    const first = await publish(); await publicTitle(first.title, 'Synthetic saved draft edition');
    observations.push('Only the authenticated same-origin creator publishes the first public version.');
    const draft = await json(await owner.get(base + '/api/forms/' + id), 200);
    await json(await owner.put(base + '/api/forms/' + id, { headers, data: { ...draft, title: 'Synthetic saved draft edition' } }), 200);
    assert.equal((await readRecord('forms', id, 'local')).payload.title, 'Synthetic saved draft edition');
    assert.equal(publicationFingerprint((await readRecord('published', id, 'local')).payload), publicationFingerprint(first));
    await publicTitle(first.title, 'Synthetic saved draft edition');
    observations.push('Saving a changed draft preserves the exact previous public snapshot and server-rendered page.');
    const second = await publish(); assert.equal(second.title, 'Synthetic saved draft edition'); await publicTitle(second.title, first.title);
    observations.push('Explicit republish changes the public snapshot at the same URL.');
    const savedBeforePause = await readRecord('forms', id, 'local');
    await json(await owner.delete(base + '/api/forms/' + id + '/publish', { headers }), 200);
    assert.equal(await readRecord('published', id, 'local'), null); assert.deepEqual(await readRecord('forms', id, 'local'), savedBeforePause);
    const receiptId = createHash('sha256').update(JSON.stringify(['local', id])).digest('hex');
    assert.equal(await readRecord('result_report_revocations', receiptId, 'local'), null);
    const restored = await publish(); assert.equal(publicationFingerprint(restored), publicationFingerprint(second)); await publicTitle(second.title);
    observations.push('Pause preserves the draft without a retirement receipt; republish restores the same content and URL.');
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: true, groups: observations.length, observations, publicStarts: 0, scope: 'Actual isolated localhost HTTP and owned synthetic records; no hosted verification.' }, null, 2));
    fs.writeFileSync(path.join(out, 'receipt-results.json'), JSON.stringify({ required: process.env.REQUIRE_PUBLICATION_RECEIPT === '1', verifiedReceipts: receipts.length }, null, 2));
    console.log('PASS four compiled publication boundary groups; zero public starts; receipts verified: ' + receipts.length + '.');
  } finally {
    await owner.delete(base + '/api/forms/' + id, { headers }).catch(() => {});
    await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', id])).digest('hex'), 'local').catch(() => {});
    await owner.dispose(); await guest.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
