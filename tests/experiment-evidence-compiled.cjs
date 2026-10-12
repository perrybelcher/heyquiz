// Real localhost HTTP boundaries for reviewed aggregate experiment evidence.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { createHash, randomUUID } = require('node:crypto'), { request } = require('playwright');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts'), { cloudEnabled, readRecord, writeRecord, removeRecord } = require('../lib/records.ts'), { signToken } = require('../lib/auth.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164', proofHeader = 'X-Pippi-Experiment-Evidence';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/); assert.equal(process.env.HEYQUIZ_LOCAL_MODE, '1'); assert.equal(cloudEnabled(), false);
assert.ok(process.env.HEYQUIZ_DATA_DIR?.endsWith('/pippi-overnight-2026-10-12/release-test-data'));
const out = path.resolve(process.env.ARTIFACT_DIR); fs.mkdirSync(out, { recursive: true });
const ids = [0, 1, 2].map(() => 'qa-evidence-api-' + randomUUID()), attempts = [], experiments = [], headers = { Origin: base }, observations = [];
const plan = { version: 1, hypothesis: 'Clearer wording may reduce effort at the selected step.', intendedChange: 'Clarify the question while retaining choices and scoring.', primaryMetric: 'completions' };
const response = async (res, expected) => { assert.equal(res.status(), expected, 'Unexpected evidence API status'); return res.json(); };
const receipt = id => createHash('sha256').update(JSON.stringify(['local', id])).digest('hex');
(async () => {
  const owner = await request.newContext(), anonymous = await request.newContext();
  const post = (route, body, moreHeaders = {}) => owner.post(base + route, { headers: { ...headers, ...moreHeaders }, data: body });
  try {
    await response(await post('/api/auth', { local: true }), 200);
    for (const id of ids.slice(0, 2)) {
      await response(await post('/api/forms', FormSchema.parse({ id, title: 'Synthetic evidence ' + id.slice(-4), mode: 'survey', questions: [{ id: 'q', title: 'Choose a route', type: 'multiple_choice', options: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }] }] })), 201);
      await response(await post('/api/forms/' + id + '/publish', {}), 200);
    }
    const initial = await readRecord('published', ids[0], 'local'), form = { ...initial.payload, publishedAt: new Date(Date.now() - 3 * 3600000).toISOString() };
    // Synthetic historical publication makes aged quiet sessions coherent without waiting30 minutes.
    await writeRecord('published', ids[0], 'local', form, initial.version);
    const foreign = { ...form, id: ids[2] }; await writeRecord('forms', ids[2], 'other-synthetic-owner', foreign, 0); await writeRecord('published', ids[2], 'other-synthetic-owner', foreign, 0);
    const endpoint = '/api/forms/' + ids[0] + '/experiment-evidence';
    const wordingKey = createHash('sha256').update(JSON.stringify(['multiple_choice', 'Choose a route'])).digest('hex');
    const selector = { questionId: 'q', wordingKey, range: 'all', filters: { source: 'utm:newsletter', campaign: 'value:launch', version: '' } };
    async function seed(patch = {}, submission = false) {
      const id = 'qa-evidence-api-attempt-' + randomUUID(), now = Date.now(); attempts.push(id);
      await writeRecord('attempts', id, 'local', { form, startedAt: now - 2 * 3600000, expiresAt: now + 3600000, preview: false, reached: ['q'], analyticsVersion: 1, lastSeenAt: now - 3600000, lastQuestionId: 'q', attribution: { version: 1, source: 'newsletter', campaign: 'launch' }, ...patch }, 0);
      if (submission) await writeRecord('submissions', id, 'local', { id, formId: form.id, submittedAt: new Date(now - 3600000).toISOString(), answers: { q: 'a' }, grading: [], totalScore: 0, maxScore: 0, percentageScore: 0, passed: true }, 0);
    }
    await seed(); await seed(); await seed({}, true); await seed({ analyticsVersion: undefined });
    assert.equal((await anonymous.post(base + endpoint, { headers, data: selector })).status(), 401);
    assert.equal((await post(endpoint, selector, { Origin: 'https://foreign.invalid' })).status(), 403);
    assert.equal((await post('/api/forms/' + ids[2] + '/experiment-evidence', selector)).status(), 404);
    const getEvidence = async value => { const res = await post(endpoint, value); assert.equal(res.headers()['cache-control'], 'private, no-store'); const data = await response(res, 200); const proof = res.headers()[proofHeader.toLowerCase()]; assert.ok(proof && proof.length <= 8192); assert.deepEqual(Object.keys(data), ['evidence']); assert.equal(JSON.stringify(data).includes(proof), false); return { evidence: data.evidence, proof }; };
    const reviewed = await getEvidence(selector); assert.deepEqual(reviewed.evidence.counts, { reached: 4, measured: 3, quiet: 2, completed: 1 }); assert.equal(reviewed.evidence.publicationNarrowed, true); assert.equal(reviewed.evidence.cohort.filters.version, 'published:' + form.publishedAt);
    const exact = await getEvidence({ ...selector, filters: { ...selector.filters, version: 'published:' + form.publishedAt } }); assert.equal(exact.evidence.publicationNarrowed, false); assert.deepEqual(exact.evidence.counts, reviewed.evidence.counts);
    observations.push({ check: 'owned exact aggregate and explicit publication narrowing', counts: reviewed.evidence.counts });
    for (const value of [{ ...selector, counts: { quiet: 99 } }, { ...selector, proof: 'in-body' }, { ...selector, range: '2' }, { ...selector, filters: { ...selector.filters, source: 'invalid' } }]) assert.equal((await post(endpoint, value)).status(), 400);
    assert.equal((await post(endpoint, { ...selector, filters: { ...selector.filters, version: 'unknown' } })).status(), 409);
    assert.equal((await post(endpoint, { ...selector, wordingKey: 'f'.repeat(64) })).status(), 409);
    assert.equal((await post(endpoint, { ...selector, filters: { ...selector.filters, source: 'utm:no-sessions' } })).status(), 409);
    assert.equal((await owner.post(base + endpoint, { headers: { ...headers, 'Content-Type': 'application/json' }, data: ' '.repeat(4097) })).status(), 413);
    observations.push({ check: 'auth/origin/ownership/schema/wording/unknown-publication/empty-cohort/byte-limit rejection' });
    const listing = () => owner.get(base + '/api/experiments').then(res => response(res, 200));
    const snapshots = async () => { const data = await listing(); return ids.slice(0, 2).map(id => data.forms.find(row => row.id === id).snapshotKey); };
    const launchBody = { name: 'Synthetic reviewed evidence', a: ids[0], b: ids[1], plan, reviewedSnapshots: await snapshots() };
    const postLaunch = (proof, body = launchBody) => post('/api/experiments', body, proof ? { [proofHeader]: proof } : {});
    const count = (await listing()).experiments.length;
    for (const proof of [reviewed.proof + '.extra', reviewed.proof.slice(0, -3) + 'bad', 'x'.repeat(8193)]) assert.equal((await postLaunch(proof)).status(), 409);
    const claims = JSON.parse(Buffer.from(reviewed.proof.split('.')[0], 'base64url').toString());
    for (const change of [{ purpose: 'unrelated' }, { owner: 'other-synthetic-owner' }, { exp: Date.now() - 1 }, { evidence: { ...claims.evidence, counts: { reached: 1, measured: 1, quiet: 2, completed: 0 } } }]) assert.equal((await postLaunch(signToken({ ...claims, ...change }))).status(), 409);
    assert.equal((await postLaunch(reviewed.proof, { ...launchBody, a: ids[1], b: ids[0], reviewedSnapshots: [...launchBody.reviewedSnapshots].reverse() })).status(), 409);
    assert.equal((await postLaunch(reviewed.proof, { name: 'No reviewed plan', a: ids[0], b: ids[1] })).status(), 400);
    assert.equal((await listing()).experiments.length, count);
    observations.push({ check: 'tampered/wrong-purpose/wrong-owner/expired/oversized/wrong-arm/unplanned proofs rejected without creation' });
    await seed(); const refreshed = await getEvidence(selector); assert.deepEqual(refreshed.evidence.counts, { reached: 5, measured: 4, quiet: 3, completed: 1 });
    const created = await response(await postLaunch(reviewed.proof), 201); experiments.push(created.id);
    const saved = await readRecord('experiments', created.id, 'local'); assert.deepEqual(saved.payload.evidence, reviewed.evidence); assert.equal(JSON.stringify(saved.payload).includes(reviewed.proof), false);
    const dto = (await listing()).experiments.find(row => row.id === created.id); assert.deepEqual(dto.evidence, reviewed.evidence); assert.deepEqual(dto.plan, plan); assert.equal(JSON.stringify(dto).includes(reviewed.proof), false); assert.equal(JSON.stringify(dto).includes('answers'), false);
    assert.equal((await owner.patch(base + '/api/experiments/' + created.id, { headers, data: { active: false, evidence: {} } })).status(), 400);
    await response(await owner.patch(base + '/api/experiments/' + created.id, { headers, data: { active: false } }), 200); assert.deepEqual((await readRecord('experiments', created.id, 'local')).payload.evidence, reviewed.evidence);
    observations.push({ check: 'new traffic does not replace reviewed counts; frozen reload and status-only patch', reviewedQuiet: 2, refreshedQuiet: 3 });
    await response(await post('/api/forms/' + ids[0] + '/publish', {}), 200);
    const afterRepublish = { ...launchBody, reviewedSnapshots: await snapshots() }; assert.equal((await postLaunch(refreshed.proof, afterRepublish)).status(), 409);
    // Restore copied source bytes after a real deletion: the durable receipt must still deny this ID.
    await response(await owner.delete(base + '/api/forms/' + ids[0], { headers }), 200);
    await writeRecord('forms', ids[0], 'local', form, 0); await writeRecord('published', ids[0], 'local', form, 0);
    assert.equal((await post(endpoint, selector)).status(), 410);
    assert.equal((await postLaunch(reviewed.proof, { ...launchBody, reviewedSnapshots: await snapshots() })).status(), 410);
    observations.push({ check: 'republish and exact-byte same-ID recreation remain blocked' });
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: true, groups: observations.length, observations, publicStarts: 0, scope: 'Real isolated localhost HTTP with synthetic owned records; no production, provider, real email or cloud verification.' }, null, 2));
    console.log('PASS ' + observations.length + ' compiled evidence HTTP groups: authentic reviewed aggregates, preserved traffic snapshot, proof/privacy/ownership/publication/retirement boundaries.');
  } finally {
    for (const id of experiments) await removeRecord('experiments', id, 'local');
    for (const id of attempts) { await removeRecord('submissions', id, 'local'); await removeRecord('attempts', id, 'local'); }
    for (const id of ids.slice(0, 2)) { await owner.delete(base + '/api/forms/' + id, { headers }).catch(() => {}); await removeRecord('result_report_revocations', receipt(id), 'local'); }
    await removeRecord('published', ids[2], 'other-synthetic-owner'); await removeRecord('forms', ids[2], 'other-synthetic-owner');
    await owner.dispose(); await anonymous.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
