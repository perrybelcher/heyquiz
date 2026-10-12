/* In-memory records, real signing and real route handlers. No provider/network operations. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), Module = require('node:module'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const root = path.resolve(__dirname, '..'), originalLoad = Module._load, originalFetch = global.fetch, originalNow = Date.now, originalSecret = process.env.SESSION_SECRET;
Module._load = function (request, parent, isMain) { return originalLoad.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, isMain); };
global.fetch = () => { throw Error('Evidence tests must not use network'); };
const NOW = Date.parse('2026-10-12T12:00:00.000Z'); let time = NOW;
Date.now = () => time; process.env.SESSION_SECRET = 'test-only-evidence-synthetic-signing-key-0000000000';
const auth = require('../lib/auth.ts'), records = require('../lib/records.ts'), { FormSchema } = require('../lib/schema.ts');
const contract = require('../lib/experiment-evidence.ts'), server = require('../lib/experiment-evidence-server.ts'), analytics = require('../lib/analytics.ts');
const owner = 'evidence-owner', memory = new Map(); let actor = owner, writeHook = null, failRemove = false, writes = 0, reads = 0;
const copy = value => structuredClone(value), rowKey = (kind, id) => `${kind}:${id}`;
auth.requireUser = async () => { if (!actor) throw new auth.HttpError(401, 'Sign in.'); return { id: actor }; };
records.readRecord = async (kind, id) => { reads++; return copy(memory.get(rowKey(kind, id)) || null); };
records.listRecords = async (kind, user) => { reads++; return copy([...memory.values()].filter(row => row.kind === kind && row.owner_id === user)); };
records.writeRecord = async (kind, id, user, payload, expected) => {
  const old = memory.get(rowKey(kind, id)); if (expected !== undefined && (old?.version || 0) !== expected) throw new records.ConflictError();
  const row = { kind, id, owner_id: user, version: (old?.version || 0) + 1, payload: copy(payload) }; memory.set(rowKey(kind, id), row); writes++;
  if (writeHook) await writeHook(kind, id, row); return copy(row);
};
records.removeRecord = async (kind, id, user) => { if (failRemove) throw Error('Synthetic removal failure'); const row = memory.get(rowKey(kind, id)); if (!row || row.owner_id !== user) return false; return memory.delete(rowKey(kind, id)); };
const route = require('../app/api/forms/[id]/experiment-evidence/route.ts'), experiments = require('../app/api/experiments/route.ts');
const BASE = 'http://127.0.0.1:3164', headers = { Origin: BASE, 'Content-Type': 'application/json' }, context = { params: Promise.resolve({ id: 'source' }) };
const seedRow = (kind, id, payload, who = owner) => memory.set(rowKey(kind, id), { kind, id, owner_id: who, version: 1, payload: copy(payload) });
const form = id => FormSchema.parse({ id, title: `Synthetic ${id}`, mode: 'form', publishedAt: '2026-10-12T00:00:00.000Z', questions: [{ id: 'q', type: 'multiple_choice', title: 'What makes this step unclear?', options: [{ id: 'yes', label: 'First' }, { id: 'no', label: 'Second' }] }] });
const source = form('source'), variant = form('variant');
const selected = { questionId: 'q', wordingKey: analytics.analyticsWordingKey(source.questions[0]), range: '7', filters: { source: 'utm:unknown', campaign: 'value:all', version: '' } };
const attempt = (patch = {}) => ({ form: copy(source), startedAt: NOW - 3600000, expiresAt: NOW + 3600000, preview: false, analyticsVersion: 1, attribution: { version: 1, source: 'unknown', campaign: 'all' }, reached: ['q'], lastQuestionId: 'q', lastSeenAt: NOW - 1800000, ...patch });
const request = (value = selected, extra = {}, url = `${BASE}/api/forms/source/experiment-evidence`) => new Request(url, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(value) });
const plan = { version: 1, hypothesis: 'A clearer question may help people finish.', intendedChange: 'Clarify the title; retain options and scoring.', primaryMetric: 'completions' };
const digest = value => server.experimentEvidenceSnapshot(value);
const launch = (proof, patch = {}) => experiments.POST(new Request(`${BASE}/api/experiments`, { method: 'POST', headers: { ...headers, ...(proof === undefined ? {} : { [contract.EXPERIMENT_EVIDENCE_HEADER]: proof }) }, body: JSON.stringify({ name: 'Synthetic evidence test', a: 'source', b: 'variant', plan, reviewedSnapshots: [digest(memory.get('published:source').payload), digest(variant)], ...patch }) }));
const retirementId = crypto.createHash('sha256').update(JSON.stringify([owner, source.id])).digest('hex');
let groups = 0; const check = async (name, fn) => { await fn(); groups++; console.log('PASS ' + name); };
(async () => { try {
  seedRow('forms', 'source', source); seedRow('published', 'source', source); seedRow('forms', 'variant', variant); seedRow('published', 'variant', variant);
  seedRow('attempts', 'quiet', attempt()); seedRow('attempts', 'active', attempt({ lastSeenAt: NOW - 1799999 })); seedRow('attempts', 'legacy', attempt({ analyticsVersion: undefined }));
  seedRow('attempts', 'completed', attempt()); seedRow('submissions', 'completed', { id: 'completed', formId: source.id, submittedAt: new Date(NOW - 10000).toISOString(), contact: { email: 'synthetic@example.invalid' } });
  const prepared = await server.prepareExperimentEvidence(source.id, owner, selected, NOW);
  await check('exact snapshot cohort uses existing question metrics and immutable UTC observation', async () => {
    assert.deepEqual(prepared.evidence.counts, { reached: 4, measured: 3, quiet: 1, completed: 1 });
    assert.equal(prepared.evidence.cutoffAt, '2026-10-06T00:00:00.000Z'); assert.equal(prepared.evidence.observedAt, '2026-10-12T12:00:00.000Z');
    assert.equal(prepared.evidence.publicationNarrowed, true); assert.equal(prepared.evidence.cohort.filters.version, 'published:2026-10-12T00:00:00.000Z');
    const before = copy(prepared.evidence); seedRow('attempts', 'later', attempt());
    assert.deepEqual(await server.verifyExperimentEvidence(prepared.proof, owner, source.id, digest(source), NOW + 1000), before);
    const refreshed = await server.prepareExperimentEvidence(source.id, owner, selected, NOW + 1000); assert.equal(refreshed.evidence.counts.quiet, 3); memory.delete('attempts:later');
  });
  await check('strict selectors and links carry no claimed counts, proof, duplicate dimensions or unsafe IDs', async () => {
    const href = contract.experimentEvidenceHref(source.id, selected); assert.deepEqual(contract.parseExperimentEvidenceHandoff(new URL(href, BASE).searchParams), { formId: source.id, selector: selected });
    assert.equal(contract.parseExperimentEvidenceHandoff(new URLSearchParams()), null);
    for (const suffix of ['&quiet=10', '&proof=fake', '&source=unknown']) assert.throws(() => contract.parseExperimentEvidenceHandoff(new URL(href + suffix, BASE).searchParams));
    for (const bad of [{ ...selected, count: 99 }, { ...selected, wordingKey: 'q' }, { ...selected, questionId: '__proto__' }, { ...selected, filters: { ...selected.filters, source: 'all' } }]) await assert.rejects(() => server.prepareExperimentEvidence(source.id, owner, bad), error => error.status === 400);
    for (const value of ['bad', '', '2026-02-30T00:00:00.000Z']) assert.equal(contract.ExperimentEvidenceSchema.safeParse({ ...prepared.evidence, observedAt: value }).success, false);
  });
  await check('wording identity survives second historical wording without changing existing row IDs', async () => {
    const first = analytics.summarizeAnalytics(source, [{ id: 'one', payload: attempt() }], [], 'all', NOW).questions[0]; assert.equal(first.id, 'q');
    const earlier = copy(source); earlier.questions[0].title = 'Earlier wording';
    const report = analytics.summarizeAnalytics(source, [{ id: 'one', payload: attempt() }, { id: 'two', payload: attempt({ form: earlier }) }], [], 'all', NOW);
    assert.equal(report.questions.find(q => q.current).wordingKey, first.wordingKey); assert.match(report.questions.find(q => q.current).id, /^q:wording:/);
    assert.notEqual(report.questions.find(q => !q.current).wordingKey, first.wordingKey);
  });
  await check('preview, foreign source, other attribution and altered same-time snapshot never contribute', async () => {
    const baseline = copy(prepared.evidence.counts), changedSnapshot = copy(source); changedSnapshot.questions[0].options[0].label = 'Changed option';
    seedRow('attempts', 'preview', attempt({ preview: true })); seedRow('attempts', 'foreign', attempt(), 'foreign'); seedRow('attempts', 'other', attempt({ attribution: { version: 1, source: 'other', campaign: 'all' } })); seedRow('attempts', 'same-time', attempt({ form: changedSnapshot }));
    assert.deepEqual((await server.prepareExperimentEvidence(source.id, owner, selected)).evidence.counts, baseline);
    const reordered = Object.fromEntries(Object.entries(source).reverse()); assert.equal(digest(source), digest(reordered));
    await assert.rejects(() => server.prepareExperimentEvidence(source.id, 'foreign', selected), error => error.status === 404);
    for (const version of ['unknown', 'published:2026-10-11T00:00:00.000Z']) await assert.rejects(() => server.prepareExperimentEvidence(source.id, owner, { ...selected, filters: { ...selected.filters, version } }), error => error.status === 409);
    await assert.rejects(() => server.prepareExperimentEvidence(source.id, owner, { ...selected, wordingKey: analytics.analyticsWordingKey({ type: 'multiple_choice', title: 'Earlier wording' }) }), error => error.status === 409);
    for (const id of ['preview', 'foreign', 'other', 'same-time']) memory.delete('attempts:' + id);
  });
  await check('proof binds purpose, owner, source digest and exact expiry; tampered or future claims fail', async () => {
    for (const proof of [prepared.proof + '.extra', prepared.proof.slice(0, -2) + 'xx', 'x'.repeat(8193), auth.signToken({ purpose: 'experiment', exp: NOW + 60000 }), auth.signToken({ ...auth.verifyToken(prepared.proof), issuedAt: NOW + 1, exp: NOW + 1 + contract.EXPERIMENT_EVIDENCE_LIFETIME })]) await assert.rejects(() => server.verifyExperimentEvidence(proof, owner, source.id, digest(source)), error => error.status === 409);
    await assert.rejects(() => server.verifyExperimentEvidence(prepared.proof, 'foreign', source.id, digest(source)), error => error.status === 409);
    await assert.rejects(() => server.verifyExperimentEvidence(prepared.proof, owner, variant.id, digest(source)), error => error.status === 409);
    await assert.rejects(() => server.verifyExperimentEvidence(prepared.proof, owner, source.id, '0'.repeat(64)), error => error.status === 409);
    time = NOW + contract.EXPERIMENT_EVIDENCE_LIFETIME; await assert.rejects(() => server.verifyExperimentEvidence(prepared.proof, owner, source.id, digest(source)), error => error.status === 409); time = NOW;
  });
  await check('durable retirement denies identical same-ID recreation and malformed receipt fails closed', async () => {
    seedRow('result_report_revocations', retirementId, { retiredAt: NOW });
    await assert.rejects(() => server.verifyExperimentEvidence(prepared.proof, owner, source.id, digest(source)), error => error.status === 410);
    seedRow('forms', source.id, source); seedRow('published', source.id, source);
    await assert.rejects(() => server.prepareExperimentEvidence(source.id, owner, selected), error => error.status === 410);
    memory.get('result_report_revocations:' + retirementId).payload.retiredAt = 'bad'; await assert.rejects(() => server.prepareExperimentEvidence(source.id, owner, selected), error => error.status === 503);
    memory.delete('result_report_revocations:' + retirementId);
    const published = memory.get('published:source'); published.version = 0; await assert.rejects(() => server.prepareExperimentEvidence(source.id, owner, selected), error => error.status === 503); published.version = 1;
  });
  await check('endpoint authenticates before reads, protects origin and returns private header-only proof', async () => {
    actor = null; const before = reads; let response = await route.POST(request(), context); assert.equal(response.status, 401); assert.equal(reads, before); assert.equal(response.headers.get('cache-control'), 'private, no-store'); actor = owner;
    for (const Origin of ['https://foreign.invalid', 'https://127.0.0.1:3164', 'invalid', BASE + '/path']) assert.equal((await route.POST(request(selected, { Origin }), context)).status, 403);
    response = await route.POST(request(), context); assert.equal(response.status, 200); assert.ok(response.headers.get(contract.EXPERIMENT_EVIDENCE_HEADER)); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const body = await response.json(); assert.deepEqual(Object.keys(body), ['evidence']); assert.equal(JSON.stringify(body).includes(prepared.proof), false); assert.equal(JSON.stringify(body).includes('@'), false); assert.equal(JSON.stringify(body).includes('attempt'), false);
    const normalized = new Request('http://localhost:3164/api/forms/source/experiment-evidence', { method: 'POST', headers: { ...headers, Host: '127.0.0.1:3164' }, body: JSON.stringify(selected) }); assert.equal((await route.POST(normalized, context)).status, 200);
  });
  await check('endpoint byte/media/query and malformed JSON limits fail before record reads', async () => {
    for (const req of [request(selected, { 'Content-Type': 'text/plain' }), request(selected, {}, `${BASE}/api/forms/source/experiment-evidence?quiet=1`), request(selected, { 'content-length': 'bad' }), new Request(`${BASE}/api/forms/source/experiment-evidence`, { method: 'POST', headers, body: '{' }), new Request(`${BASE}/api/forms/source/experiment-evidence`, { method: 'POST', headers, body: new Uint8Array([255]) })]) { const before = reads, response = await route.POST(req, context); assert.equal(response.status, 400); assert.equal(reads, before); assert.equal(response.headers.get('cache-control'), 'private, no-store'); }
    for (const body of ['x'.repeat(4097), 'é'.repeat(2049)]) { const before = reads; assert.equal((await route.POST(new Request(`${BASE}/api/forms/source/experiment-evidence`, { method: 'POST', headers, body }), context)).status, 413); assert.equal(reads, before); }
  });
  await check('launch freezes only reviewed aggregate and subsequent DTO excludes proof and respondent data', async () => {
    const before = writes, response = await launch(prepared.proof); assert.equal(response.status, 201, await response.clone().text()); assert.equal(writes, before + 1);
    const id = (await response.json()).id, stored = memory.get('experiments:' + id); assert.deepEqual(stored.payload.evidence, prepared.evidence); assert.deepEqual(stored.payload.plan, plan);
    assert.equal(JSON.stringify(stored.payload).includes(prepared.proof), false); assert.equal(Object.hasOwn(stored.payload, 'proof'), false);
    const listing = await experiments.GET(), dto = (await listing.json()).experiments.find(row => row.id === id); assert.deepEqual(dto.evidence, prepared.evidence); assert.equal(JSON.stringify(dto).includes('@'), false); assert.equal(JSON.stringify(dto).includes(prepared.proof), false);
    assert.equal((await launch(prepared.proof, { evidence: prepared.evidence })).status, 400); assert.equal((await launch(prepared.proof, { plan: undefined, reviewedSnapshots: undefined })).status, 400);
    assert.equal((await launch(prepared.proof, { a: 'variant', b: 'source', reviewedSnapshots: [digest(variant), digest(source)] })).status, 409);
  });
  await check('source mutation during write rejects and compensates only the fresh experiment record', async () => {
    const original = copy(memory.get('published:source')), beforeIds = [...memory.keys()].filter(k => k.startsWith('experiments:'));
    writeHook = kind => { if (kind === 'experiments') memory.get('published:source').payload.title = 'Changed during launch'; };
    const response = await launch(prepared.proof); assert.equal(response.status, 409); assert.deepEqual([...memory.keys()].filter(k => k.startsWith('experiments:')), beforeIds);
    writeHook = null; memory.set('published:source', original);
    writeHook = kind => { if (kind === 'experiments') seedRow('result_report_revocations', retirementId, { retiredAt: NOW }); };
    const retired = await launch(prepared.proof); assert.equal(retired.status, 410); assert.deepEqual([...memory.keys()].filter(k => k.startsWith('experiments:')), beforeIds);
    writeHook = null; memory.delete('result_report_revocations:' + retirementId);
  });
  await check('compensation failure is visible and has no proof/source payload leakage or automatic retry', async () => {
    const original = copy(memory.get('published:source')), before = writes;
    writeHook = kind => { if (kind === 'experiments') memory.get('published:source').payload.title = 'PRIVATE SOURCE SENTINEL'; }; failRemove = true;
    const response = await launch(prepared.proof); assert.equal(response.status, 503); assert.equal(writes, before + 1); const body = await response.text(); assert.match(body, /cleanup could not be confirmed/); assert.equal(body.includes(prepared.proof), false); assert.equal(body.includes('PRIVATE SOURCE SENTINEL'), false); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    writeHook = null; failRemove = false; memory.set('published:source', original);
  });
  await check('manual basic/planned launches work without evidence or configured signer', async () => {
    delete process.env.SESSION_SECRET;
    const planned = await launch(undefined); assert.equal(planned.status, 201); const id = (await planned.json()).id; assert.equal('evidence' in memory.get('experiments:' + id).payload, false);
    const basic = await launch(undefined, { plan: undefined, reviewedSnapshots: undefined }); assert.equal(basic.status, 201);
    const evidence = await route.POST(request(), context); assert.equal(evidence.status, 503); assert.equal(evidence.headers.get('cache-control'), 'private, no-store');
  });
  console.log(`${groups} experiment evidence model/service/route groups passed; in-memory records and synthetic signing only.`);
} finally { Module._load = originalLoad; global.fetch = originalFetch; Date.now = originalNow; if (originalSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = originalSecret; } })().catch(error => { console.error(error); process.exitCode = 1; });
