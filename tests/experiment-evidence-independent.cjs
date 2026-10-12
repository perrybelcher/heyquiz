/* Independent literal evidence expectations. No server, filesystem records or provider calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const originalLoad = Module._load, originalNow = Date.now, originalFetch = global.fetch;
const NOW = Date.parse('2026-10-12T12:00:00.000Z'), DAY = 86400000, MINUTE = 60000;
const PUBLISHED = '2026-10-01T09:45:00.001Z', OWNER = 'evidence-independent-owner';
const BASE = 'http://127.0.0.1:3164', PRIVATE = 'PRIVATE-ANSWER-CONTACT-NEVER-EXPOSE';
process.env.SESSION_SECRET = 'independent-evidence-synthetic-only-secret-20261012';
for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY']) process.env[key] = '';
Date.now = () => NOW;
let outbound = 0, reads = 0, writes = 0, actor = OWNER, readHook = null, writeHook = null, failRemoval = false;
global.fetch = async () => { outbound++; throw new Error('Unexpected outbound request in isolated evidence QA.'); };
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
Module._load = function(request, parent, main) { return originalLoad.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, main); };
const records = require('../lib/records.ts'), auth = require('../lib/auth.ts');
const memory = new Map();
const clone = value => structuredClone(value);
const put = (kind, id, payload, owner_id = OWNER, version = 1) => memory.set(`${kind}:${id}`, { kind, id, payload: clone(payload), owner_id, version });
records.readRecord = async (kind, id) => { reads++; if (readHook) await readHook(kind, id); return clone(memory.get(`${kind}:${id}`) || null); };
records.listRecords = async (kind, owner) => { reads++; if (readHook) await readHook(kind, null); return clone([...memory.values()].filter(row => row.kind === kind && row.owner_id === owner)); };
records.writeRecord = async (kind, id, owner, payload, version) => {
  const current = memory.get(`${kind}:${id}`);
  if (current && current.owner_id !== owner) throw new Error('Cross-owner write.');
  if (version !== undefined && (current?.version || 0) !== version) throw new records.ConflictError();
  writes++; put(kind, id, payload, owner, (current?.version || 0) + 1); if (writeHook) await writeHook(kind, id); return clone(memory.get(`${kind}:${id}`));
};
records.removeRecord = async (kind, id, owner) => { if (failRemoval) throw new Error('Synthetic cleanup failure'); const row = memory.get(`${kind}:${id}`); if (!row || row.owner_id !== owner) return false; return memory.delete(`${kind}:${id}`); };
auth.requireUser = async () => { if (!actor) throw new auth.HttpError(401, 'Sign in.'); return { id: actor }; };
const { FormSchema } = require('../lib/schema.ts');
const { experimentSnapshotJson } = require('../lib/experiment-plan.ts');
const digest = value => crypto.createHash('sha256').update(experimentSnapshotJson(value)).digest('hex');
const literalWording = (type, title) => crypto.createHash('sha256').update(JSON.stringify([type, title])).digest('hex');
const A = FormSchema.parse({ id: 'independent-source', title: 'Synthetic clarity quiz', mode: 'form', publishedAt: PUBLISHED, questions: [
  { id: 'choice', type: 'multiple_choice', title: 'Choose a next step', options: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }] },
  { id: 'other', type: 'multiple_choice', title: 'Another step', options: [{ id: 'x', label: 'Other' }] },
] });
const B = FormSchema.parse({ ...A, id: 'independent-variant', title: 'Synthetic variant' });
const sourceKey = literalWording('multiple_choice', 'Choose a next step');
const selector = (filters = {}, range = '7') => ({ questionId: 'choice', wordingKey: sourceKey, range, filters: { source: 'utm:newsletter', campaign: 'value:Launch', version: '', ...filters } });
const attempt = (extra = {}) => ({ form: clone(A), startedAt: NOW - 2 * DAY, expiresAt: NOW + DAY, preview: false, reached: ['choice'], analyticsVersion: 1, lastSeenAt: NOW - 31 * MINUTE, lastQuestionId: 'choice', answers: { choice: PRIVATE }, attribution: { version: 1, source: 'newsletter', campaign: 'Launch' }, ...extra });
const add = (id, extra = {}, owner = OWNER) => put('attempts', id, attempt(extra), owner);
const cutoff = Date.parse('2026-10-06T00:00:00.000Z');
function seed() {
  memory.clear(); actor = OWNER; readHook = null; writeHook = null; failRemoval = false;
  for (const form of [A, B]) { put('forms', form.id, form); put('published', form.id, form); }
  add('boundary', { lastSeenAt: NOW - 30 * MINUTE });
  add('warm', { lastSeenAt: NOW - 30 * MINUTE + 1 });
  add('completed', { completed: true });
  add('retained-complete'); put('submissions', 'retained-complete', { id: 'retained-complete', formId: A.id, submittedAt: new Date(NOW).toISOString(), answers: { choice: PRIVATE }, contact: { email: PRIVATE } });
  add('legacy', { analyticsVersion: undefined });
  add('other-last', { reached: ['choice', 'other'], lastQuestionId: 'other' });
  add('cutoff', { startedAt: cutoff });
  add('before-cutoff', { startedAt: cutoff - 1 });
  add('preview', { preview: true });
  add('future', { startedAt: NOW + 1 });
  add('not-reached', { reached: ['other'], lastQuestionId: 'other' });
  add('different-source', { attribution: { version: 1, source: 'ads', campaign: 'Launch' } });
  add('different-campaign', { attribution: { version: 1, source: 'newsletter', campaign: 'Winter' } });
  add('unknown', { attribution: undefined });
  add('literal-unknown', { attribution: { version: 1, source: 'unknown', campaign: 'unknown' } });
  add('referral', { attribution: { version: 1, referrerHost: 'publisher.example', campaign: 'Launch' } });
  add('older-publication', { form: { ...clone(A), publishedAt: '2026-09-30T00:00:00.000Z' } });
  const changedOptions = clone(A); changedOptions.questions[0].options[0].label = 'Renamed answer';
  add('same-date-other-snapshot', { form: changedOptions });
  const changedWording = clone(A); changedWording.questions[0].title = 'Earlier wording';
  add('same-date-other-wording', { form: changedWording });
  add('unknown-publication', { form: { ...clone(A), publishedAt: undefined } });
  add('foreign-owner', {}, 'foreign-owner');
  add('foreign-quiz', { form: { ...clone(A), id: 'other-quiz' } });
}
let checks = 0;
async function test(name, run) { seed(); await run(); checks++; console.log('PASS ' + name); }
const counts = (evidence, expected) => assert.deepEqual(evidence.counts, expected);
const noPrivate = value => { const text = JSON.stringify(value); for (const forbidden of [PRIVATE, 'foreign-owner', 'answers', 'recipient', 'visitor', 'proof', 'signature']) assert.ok(!text.includes(forbidden), forbidden); };
const request = (body, extra = {}, url = `${BASE}/api/forms/${A.id}/experiment-evidence`) => new Request(url, { method: 'POST', headers: { Host: new URL(BASE).host, Origin: BASE, 'Content-Type': 'application/json', ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });

(async () => {
  try {
    const { prepareExperimentEvidence: prepare, verifyExperimentEvidence: verify } = require('../lib/experiment-evidence-server.ts');
    const { analyticsWordingKey, summarizeAnalytics } = require('../lib/analytics.ts');
    const { EXPERIMENT_EVIDENCE_HEADER: HEADER } = require('../lib/experiment-evidence.ts');
    const evidenceRoute = require('../app/api/forms/[id]/experiment-evidence/route.ts');
    const launchRoute = require('../app/api/experiments/route.ts');
    const patchRoute = require('../app/api/experiments/[id]/route.ts');
    const route = req => evidenceRoute.POST(req, { params: Promise.resolve({ id: A.id }) });
    const plan = { version: 1, hypothesis: 'Clarification may reduce effort.', intendedChange: 'Clarify one question without changing its answer mapping.', primaryMetric: 'completions' };
    const launchBody = () => ({ name: 'Independent reviewed test', a: A.id, b: B.id, plan, reviewedSnapshots: [digest(A), digest(B)] });
    const launch = (body, proof) => launchRoute.POST(request(body, proof ? { [HEADER]: proof } : {}, `${BASE}/api/experiments`));
    await test('literal 30-minute boundary, reached/measured denominators and retained completion', async () => {
      const { evidence, proof } = await prepare(A.id, OWNER, selector(), NOW);
      counts(evidence, { reached: 7, measured: 6, quiet: 2, completed: 2 });
      assert.equal(evidence.observedAt, new Date(NOW).toISOString()); assert.equal(evidence.cutoffAt, new Date(cutoff).toISOString()); assert.equal(evidence.quietThresholdMinutes, 30);
      assert.equal(evidence.sourceSnapshot, digest(A)); assert.equal(evidence.publishedAt, PUBLISHED); assert.equal(evidence.wordingKey, sourceKey);
      assert.equal(evidence.publicationNarrowed, true); assert.equal(evidence.requested.filters.version, ''); assert.equal(evidence.cohort.filters.version, 'published:' + PUBLISHED);
      assert.deepEqual(await verify(proof, OWNER, A.id, digest(A), NOW), evidence); noPrivate(evidence);
    });
    await test('literal source/campaign/unknown identities and no mixed-publication inflation', async () => {
      const cases = [
        [{ source: '', campaign: '' }, { reached: 12, measured: 11, quiet: 7, completed: 2 }],
        [{ source: 'utm:ads', campaign: 'value:Launch' }, { reached: 1, measured: 1, quiet: 1, completed: 0 }],
        [{ source: 'utm:newsletter', campaign: 'value:Winter' }, { reached: 1, measured: 1, quiet: 1, completed: 0 }],
        [{ source: 'unknown', campaign: 'unknown' }, { reached: 1, measured: 1, quiet: 1, completed: 0 }],
        [{ source: 'utm:unknown', campaign: 'value:unknown' }, { reached: 1, measured: 1, quiet: 1, completed: 0 }],
        [{ source: 'ref:publisher.example', campaign: 'value:Launch' }, { reached: 1, measured: 1, quiet: 1, completed: 0 }],
      ];
      for (const [filters, expected] of cases) counts((await prepare(A.id, OWNER, selector(filters), NOW)).evidence, expected);
      counts((await prepare(A.id, OWNER, selector({}, 'all'), NOW)).evidence, { reached: 8, measured: 7, quiet: 3, completed: 2 });
      const exact = (await prepare(A.id, OWNER, selector({ version: 'published:' + PUBLISHED }), NOW)).evidence;
      assert.equal(exact.publicationNarrowed, false); counts(exact, { reached: 7, measured: 6, quiet: 2, completed: 2 });
    });
    await test('stable wording keys survive cohort history while legacy row IDs remain compatible', async () => {
      assert.equal(analyticsWordingKey(A.questions[0]), sourceKey);
      const only = [{ id: 'one', payload: attempt() }], second = clone(A); second.questions[0].title = 'Earlier wording';
      const one = summarizeAnalytics(A, only, [], '7', NOW).questions.find(q => q.questionId === 'choice');
      const many = summarizeAnalytics(A, [...only, { id: 'two', payload: attempt({ form: second }) }], [], '7', NOW).questions.find(q => q.questionId === 'choice' && q.current);
      assert.equal(one.id, 'choice'); assert.notEqual(many.id, one.id); assert.equal(one.wordingKey, sourceKey); assert.equal(many.wordingKey, sourceKey);
      const reordered = Object.fromEntries(Object.entries(A).reverse()); add('canonical-reordered', { form: reordered });
      counts((await prepare(A.id, OWNER, selector(), NOW)).evidence, { reached: 8, measured: 7, quiet: 3, completed: 2 });
    });
    await test('snapshot provenance rejects old or unknown selected publication and wrong wording/type', async () => {
      for (const version of ['published:2026-09-30T00:00:00.000Z', 'unknown']) await assert.rejects(() => prepare(A.id, OWNER, selector({ version }), NOW));
      for (const invalid of [{ ...selector(), questionId: 'missing' }, { ...selector(), wordingKey: literalWording('multiple_choice', 'Earlier wording') }, { ...selector(), wordingKey: literalWording('short_answer', 'Choose a next step') }]) await assert.rejects(() => prepare(A.id, OWNER, invalid, NOW));
      const drafted = clone(A); drafted.title = 'Unpublished draft changed'; put('forms', A.id, drafted);
      assert.equal((await prepare(A.id, OWNER, selector(), NOW)).evidence.sourceSnapshot, digest(A));
      const { proof } = await prepare(A.id, OWNER, selector(), NOW);
      const published = clone(A); published.questions[0].options[0].label = 'Different immutable bytes'; put('published', A.id, published);
      await assert.rejects(() => verify(proof, OWNER, A.id, digest(A), NOW));
    });
    await test('signed evidence is exact, owner/purpose/source-bound, expires and cannot be tampered', async () => {
      const { evidence, proof } = await prepare(A.id, OWNER, selector(), NOW);
      await assert.rejects(() => verify(proof, 'foreign-owner', A.id, digest(A), NOW));
      await assert.rejects(() => verify(proof, OWNER, B.id, digest(A), NOW));
      await assert.rejects(() => verify(proof, OWNER, A.id, digest(B), NOW));
      await assert.rejects(() => verify(proof, OWNER, A.id, digest(A), NOW + 15 * MINUTE));
      assert.deepEqual(await verify(proof, OWNER, A.id, digest(A), NOW + 15 * MINUTE - 1), evidence);
      const [payload, signature] = proof.split('.'), decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      const altered = { ...decoded, independentInjectedCount: 999 };
      await assert.rejects(() => verify(Buffer.from(JSON.stringify(altered)).toString('base64url') + '.' + signature, OWNER, A.id, digest(A), NOW));
      await assert.rejects(() => verify(auth.signToken({ ...decoded, purpose: 'result-view' }), OWNER, A.id, digest(A), NOW));
      await assert.rejects(() => verify(proof + '.unexpected-trailer', OWNER, A.id, digest(A), NOW));
      noPrivate(evidence);
    });
    await test('new traffic cannot silently replace the reviewed evidence observation', async () => {
      const { evidence, proof } = await prepare(A.id, OWNER, selector(), NOW);
      add('later-quiet');
      assert.deepEqual(await verify(proof, OWNER, A.id, digest(A), NOW), evidence);
      counts((await prepare(A.id, OWNER, selector(), NOW)).evidence, { reached: 8, measured: 7, quiet: 3, completed: 2 });
    });
    await test('no quiet or uninstrumented-only cohorts do not manufacture an actionable hypothesis', async () => {
      await assert.rejects(() => prepare(A.id, OWNER, selector({ source: 'utm:unrecorded' }), NOW), error => error.status === 409);
      for (const [key, row] of memory) if (row.kind === 'attempts') { row.payload.analyticsVersion = undefined; memory.set(key, row); }
      await assert.rejects(() => prepare(A.id, OWNER, selector(), NOW), error => error.status === 409);
      for (const [key, row] of memory) if (row.kind === 'attempts') { row.payload.analyticsVersion = 1; row.payload.lastSeenAt = NOW - 30 * MINUTE + 1; memory.set(key, row); }
      await assert.rejects(() => prepare(A.id, OWNER, selector(), NOW), error => error.status === 409);
    });
    await test('publication or retirement during aggregation cannot yield a signed stale observation', async () => {
      const receipt = crypto.createHash('sha256').update(JSON.stringify([OWNER, A.id])).digest('hex');
      for (const change of ['publication', 'retirement']) {
        seed(); readHook = async (kind, id) => { if (kind === 'attempts' && id === null) {
          if (change === 'publication') { const changed = clone(A); changed.questions[0].options[0].label = 'Changed while scanning'; put('published', A.id, changed); }
          else put('result_report_revocations', receipt, { retiredAt: NOW });
        } };
        await assert.rejects(() => prepare(A.id, OWNER, selector(), NOW), error => error.status === (change === 'publication' ? 409 : 410));
      }
    });
    await test('durable retirement forbids same-ID recreation even with copied timestamps and bytes', async () => {
      const { proof } = await prepare(A.id, OWNER, selector(), NOW);
      const receipt = crypto.createHash('sha256').update(JSON.stringify([OWNER, A.id])).digest('hex');
      for (const retiredAt of [0, NOW - DAY, NOW, NOW + DAY]) {
        memory.delete('forms:' + A.id); memory.delete('published:' + A.id); put('result_report_revocations', receipt, { retiredAt });
        put('forms', A.id, A); put('published', A.id, A);
        await assert.rejects(() => prepare(A.id, OWNER, selector(), NOW), error => error.status === 410);
        await assert.rejects(() => verify(proof, OWNER, A.id, digest(A), NOW), error => error.status === 410);
      }
      for (const payload of [{}, { retiredAt: 'yesterday' }, { retiredAt: null }, { retiredAt: -1 }, { retiredAt: NOW, unexpected: 'field' }]) {
        put('result_report_revocations', receipt, payload); await assert.rejects(() => prepare(A.id, OWNER, selector(), NOW), error => error.status === 503);
      }
      put('result_report_revocations', receipt, { retiredAt: NOW }, 'foreign-owner'); await assert.rejects(() => prepare(A.id, OWNER, selector(), NOW), error => error.status === 503);
    });
    await test('owner/origin checks precede expensive reads and responses never expose bearer proof in JSON', async () => {
      actor = null; const before = reads; let response = await route(request(selector())); assert.equal(response.status, 401); assert.equal(reads, before); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      actor = OWNER; response = await route(request(selector(), { Origin: 'https://foreign.invalid' })); assert.equal(response.status, 403); assert.equal(reads, before);
      response = await route(request(selector())); assert.equal(response.status, 200, await response.clone().text()); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const proof = response.headers.get(HEADER); assert.ok(proof); const body = await response.json(); assert.deepEqual(Object.keys(body), ['evidence']); assert.ok(!JSON.stringify(body).includes(proof)); noPrivate(body);
      actor = 'foreign-owner'; response = await route(request(selector())); assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    });
    await test('strict bounded selector bodies reject counts, unknown fields and malformed values', async () => {
      const bad = [{ ...selector(), counts: { quiet: 999 } }, { ...selector(), proof: 'in-body' }, { ...selector(), range: '5' }, { ...selector(), wordingKey: 'x' }, { ...selector(), filters: { ...selector().filters, source: 'utm:private@example.invalid' } }, { ...selector(), filters: { ...selector().filters, extra: 'x' } }];
      const before = writes; for (const value of bad) { const response = await route(request(value)); assert.equal(response.status, 400, JSON.stringify(value)); assert.equal(response.headers.get('cache-control'), 'private, no-store'); }
      assert.equal((await route(request('{'))).status, 400);
      const huge = await route(request('x'.repeat(20000))); assert.equal(huge.status, 413); assert.equal(writes, before);
    });
    await test('evidence body byte limits cover declared/chunked/multibyte/invalid UTF-8 input', async () => {
      const endpoint = `${BASE}/api/forms/${A.id}/experiment-evidence`;
      const headers = { Host: new URL(BASE).host, Origin: BASE, 'Content-Type': 'application/json' };
      const raw = (body, extra = {}) => new Request(endpoint, { method: 'POST', headers: { ...headers, ...extra }, body });
      const before = reads;
      assert.equal((await route(raw('{}', { 'Content-Length': '4097' }))).status, 413); assert.equal(reads, before);
      assert.equal((await route(raw('"' + 'é'.repeat(2050) + '"'))).status, 413);
      assert.equal((await route(raw(new Uint8Array([0xc3, 0x28])))).status, 400);
      assert.equal((await route(raw('{}', { 'Content-Length': '-1' }))).status, 400);
      let cancelled = false; const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(3000)); controller.enqueue(new Uint8Array(1100)); }, cancel() { cancelled = true; } });
      assert.equal((await route(new Request(endpoint, { method: 'POST', headers, body: stream, duplex: 'half' }))).status, 413); assert.equal(cancelled, true);
      assert.equal((await route(request(selector(), {}, endpoint + '?proof=not-accepted'))).status, 400);
      assert.equal((await route(request(selector(), { Origin: 'https://127.0.0.1:3164' }))).status, 403);
      assert.equal((await route(new Request(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: JSON.stringify(selector()) }))).status, 400);
    });
    await test('selector handoffs contain no proof/counts and reject smuggling or duplicates', async () => {
      const { experimentEvidenceHref: href, parseExperimentEvidenceHandoff: handoff, parseExperimentEvidence } = require('../lib/experiment-evidence.ts');
      const url = new URL(href(A.id, selector()), BASE); assert.deepEqual(handoff(url.searchParams), { formId: A.id, selector: selector() });
      for (const forbidden of ['proof', 'signature', 'quiet', 'count', PRIVATE]) assert.ok(!url.href.includes(forbidden));
      for (const field of ['proof=token', 'quiet=9', 'evidenceForm=other']) { const params = new URLSearchParams(url.search); for (const [key, value] of new URLSearchParams(field)) params.append(key, value); assert.throws(() => handoff(params)); }
      const { evidence } = await prepare(A.id, OWNER, selector(), NOW);
      assert.throws(() => parseExperimentEvidence({ ...evidence, publicationNarrowed: false }));
    });
    await test('missing signing configuration fails optional evidence but leaves manual launch available', async () => {
      const { proof } = await prepare(A.id, OWNER, selector(), NOW); process.env.SESSION_SECRET = '';
      try {
        await assert.rejects(() => prepare(A.id, OWNER, selector(), NOW), error => error.status === 503);
        await assert.rejects(() => verify(proof, OWNER, A.id, digest(A), NOW), error => error.status === 503);
        assert.equal((await launch({ name: 'Manual without proof', a: A.id, b: B.id })).status, 201);
      } finally { process.env.SESSION_SECRET = 'independent-evidence-synthetic-only-secret-20261012'; }
    });
    await test('evidence launch freezes reviewed counts, manual launches stay unchanged, PATCH is status-only', async () => {
      const { evidence, proof } = await prepare(A.id, OWNER, selector(), NOW);
      const before = writes; let response = await launch(launchBody(), proof); assert.equal(response.status, 201, await response.clone().text()); const id = (await response.json()).id;
      assert.equal(writes, before + 1); const saved = clone(memory.get('experiments:' + id).payload); assert.deepEqual(saved.evidence, evidence); assert.deepEqual(saved.plan, plan); assert.ok(!JSON.stringify(saved).includes(proof));
      add('after-launch'); const listing = await (await launchRoute.GET()).json(), dto = listing.experiments.find(item => item.id === id); assert.deepEqual(dto.evidence, evidence); assert.ok(!JSON.stringify(dto).includes(proof)); noPrivate(dto.evidence);
      response = await launch({ name: 'Manual legacy path', a: A.id, b: B.id }); assert.equal(response.status, 201); assert.equal('evidence' in memory.get('experiments:' + (await response.json()).id).payload, false);
      const update = body => patchRoute.PATCH(new Request(`${BASE}/api/experiments/${id}`, { method: 'PATCH', headers: { Origin: BASE, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
      assert.notEqual((await update({ active: false, evidence: { ...evidence, counts: { reached: 999 } } })).status, 200); assert.deepEqual(memory.get('experiments:' + id).payload, saved);
      assert.equal((await update({ active: false })).status, 200); assert.deepEqual(memory.get('experiments:' + id).payload.evidence, evidence); assert.deepEqual(memory.get('experiments:' + id).payload.plan, plan);
      assert.notEqual((await launch({ ...launchBody(), a: B.id, b: A.id, reviewedSnapshots: [digest(B), digest(A)] }, proof)).status, 201);
      assert.notEqual((await launch({ name: 'Unplanned with proof', a: A.id, b: B.id }, proof)).status, 201);
    });
    await test('in-flight publication change removes only its newly created experiment', async () => {
      const { proof } = await prepare(A.id, OWNER, selector(), NOW);
      put('experiments', 'keep-existing', { name: 'Existing', createdAt: NOW - DAY, active: true, variants: [A, B] });
      writeHook = async kind => { if (kind === 'experiments') { const changed = clone(A); changed.questions[0].title = 'Published during write'; put('published', A.id, changed); } };
      const response = await launch(launchBody(), proof); assert.equal(response.status, 409); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.deepEqual([...memory.values()].filter(row => row.kind === 'experiments').map(row => row.id), ['keep-existing']); noPrivate(await response.json());
    });
    await test('in-flight retirement compensates, while cleanup failure stays visible and non-sensitive', async () => {
      const receipt = crypto.createHash('sha256').update(JSON.stringify([OWNER, A.id])).digest('hex');
      for (const failure of [false, true]) {
        seed(); failRemoval = failure; const { proof } = await prepare(A.id, OWNER, selector(), NOW);
        writeHook = async kind => { if (kind === 'experiments') put('result_report_revocations', receipt, { retiredAt: NOW }); };
        const originalError = console.error, diagnostics = []; let response;
        try { console.error = (...values) => diagnostics.push(values.map(String).join(' ')); response = await launch(launchBody(), proof); }
        finally { console.error = originalError; }
        assert.equal(response.status, failure ? 503 : 410); assert.equal(response.headers.get('cache-control'), 'private, no-store');
        const body = await response.json(); assert.ok(!JSON.stringify(body).includes(proof)); noPrivate(body);
        assert.equal([...memory.values()].filter(row => row.kind === 'experiments').length, failure ? 1 : 0);
        if (failure) {
          assert.match(body.error, /cleanup|Reload/); assert.equal(diagnostics.length, 1);
          const event = JSON.parse(diagnostics[0]); assert.deepEqual(Object.keys(event).sort(), ['event', 'reference', 'source', 'status', 'timestamp']); assert.equal(event.status, 503);
          assert.ok(!diagnostics[0].includes(proof)); assert.ok(!diagnostics[0].includes(OWNER)); noPrivate(event);
        } else assert.deepEqual(diagnostics, []);
      }
    });
    assert.equal(outbound, 0); console.log(`${checks} independent experiment evidence groups passed; literal counts, real signing/aggregation/routes, in-memory records, zero outbound requests.`);
  } finally { Date.now = originalNow; global.fetch = originalFetch; Module._load = originalLoad; }
})().catch(error => { console.error(error); process.exitCode = 1; });
