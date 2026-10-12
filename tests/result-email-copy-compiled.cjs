// Compiled local boundaries: creator-only copy, publication and immutable jobs.
// Uses synthetic fixtures only; no email/provider transport or real account.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ts = require('typescript'), { request } = require('playwright'), { createHash } = require('node:crypto');
const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.HEYQUIZ_DATA_DIR);
assert.equal(process.env.HEYQUIZ_RESULT_EMAIL_MODE, 'synthetic');
for (const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','VERCEL','VERCEL_ENV']) assert.ok(!process.env[key]);
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { listRecords, readRecord, removeRecord } = require('../lib/records.ts');
const { openResultEmail } = require('../lib/result-email-config.ts');
const id = 'qa-copy-boundary-' + Date.now(), headers = { Origin: base }, checks = [];
const initial = { version: 1, subject: 'PRIVATE-COPY {quiz_title}', introduction: 'FIRST-COPY for {quiz_title}.\n\nFrom {brand_name}.', signOff: 'PRIVATE-SIGNOFF' };
const pass = text => { checks.push(text); console.log('PASS ' + text); };
(async () => {
  const owner = await request.newContext({ baseURL: base, extraHTTPHeaders: headers });
  const visitor = await request.newContext({ baseURL: base, extraHTTPHeaders: headers });
  const post = (client, route, data = {}) => client.post(route, { data });
  async function edit(change) {
    const response = await owner.get('/api/forms/' + id); assert.equal(response.status(), 200);
    const put = await owner.put('/api/forms/' + id, { data: { ...await response.json(), ...change } });
    assert.equal(put.status(), 200); return put.json();
  }
  async function start() {
    const response = await post(visitor, `/api/forms/${id}/start`); assert.equal(response.status(), 200);
    const body = await response.json(); assert.equal(body.form.resultEmailCopy, undefined);
    assert.ok(!JSON.stringify(body.form).includes('PRIVATE-COPY'));
    return body;
  }
  async function finish(token) { assert.equal((await post(visitor, `/api/forms/${id}/submit`, { token, answers: { q: 'a' } })).status(), 200); }
  const email = (token, action, extra = {}) => post(visitor, `/api/forms/${id}/result-email`, { token, action, ...extra });
  try {
    assert.equal((await post(owner, '/api/auth', { local: true })).status(), 200);
    const created = await post(owner, '/api/forms', { id, title: 'Original quiz', mode: 'survey', resultEmailCopy: initial, theme: { brandName: 'Original brand' }, questions: [{ id: 'q', type: 'multiple_choice', title: 'Choose', required: true, options: [{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }] }], settings: { showReviewBeforeSubmit: false } });
    assert.equal(created.status(), 201);
    assert.equal((await post(owner, `/api/forms/${id}/publish`)).status(), 200);
    const originalPublished = await readRecord('published', id);
    const html = await (await visitor.get('/play/' + id)).text();
    assert.ok(!html.includes('PRIVATE-COPY')); assert.ok(!html.includes('PRIVATE-SIGNOFF'));
    const session = await start();
    pass('Public SSR and start omit creator copy; server publication retains it');

    // Expanded copy may become invalid after a title edit, but the draft must
    // remain recoverable and a rejected publish must not replace live content.
    await edit({ title: 'L'.repeat(160) });
    const rejected = await post(owner, `/api/forms/${id}/publish`);
    assert.equal(rejected.status(), 422); assert.match((await rejected.json()).error, /Review result-email copy/);
    assert.deepEqual(await readRecord('published', id), originalPublished);
    assert.equal((await (await owner.get('/api/forms/' + id)).json()).title, 'L'.repeat(160));
    pass('Expanded overlength copy rejects publication while retaining draft and prior live snapshot');

    await edit({ title: 'Changed quiz', resultEmailCopy: { ...initial, subject: 'SECOND-COPY {quiz_title}', introduction: 'New campaign text' } });
    assert.equal((await post(owner, `/api/forms/${id}/publish`)).status(), 200);
    await finish(session.token);
    const replies = await Promise.all([email(session.token, 'request', { email: 'boundary@example.test', requested: true }), email(session.token, 'request', { email: 'boundary@example.test', requested: true })]);
    for (const response of replies) {
      assert.equal(response.status(), 202); const body = JSON.stringify(await response.json());
      for (const text of ['PRIVATE-COPY','FIRST-COPY','boundary@example.test','copyBox','recipientBox','/result/']) assert.ok(!body.includes(text));
    }
    let jobs = (await listRecords('result_email_jobs', 'local')).filter(row => row.payload.formId === id);
    assert.equal(jobs.length, 1); const job = jobs[0], scope = `local:${job.id}`;
    const copy = openResultEmail(job.payload.copyBox, `${scope}:copy:v1`);
    assert.deepEqual(copy, { renderingVersion: '1', subject: 'PRIVATE-COPY Original quiz', introduction: 'FIRST-COPY for Original quiz.\n\nFrom Original brand.', signOff: 'PRIVATE-SIGNOFF' });
    assert.throws(() => openResultEmail(job.payload.copyBox, `${scope}:recipient`));
    for (const text of ['PRIVATE-COPY','FIRST-COPY','boundary@example.test','/result/']) assert.ok(!JSON.stringify(job).includes(text));
    pass('Concurrent requests freeze completed-attempt copy in a separate encrypted purpose; diagnostics stay private');

    await edit({ resultEmailCopy: { ...initial, subject: 'THIRD-COPY', introduction: 'Changed again before preparing' } });
    assert.equal((await post(owner, `/api/forms/${id}/publish`)).status(), 200);
    const prepared = await email(session.token, 'prepare'); assert.equal(prepared.status(), 200);
    assert.equal((await prepared.json()).job.state, 'prepared');
    let artifacts = (await listRecords('result_email_tests', 'local')).filter(row => row.payload.formId === id);
    assert.equal(artifacts.length, 1);
    const artifact = artifacts[0], message = openResultEmail(artifact.payload.messageBox, `${scope}:artifact`);
    assert.equal(message.subject, 'PRIVATE-COPY Original quiz — local test');
    assert.match(message.text, /FIRST-COPY for Original quiz/); assert.ok(!message.text.includes('Changed again'));
    assert.match(message.text, /LOCAL TEST ONLY/); assert.match(message.text, /This request does not subscribe you/);
    assert.equal((message.html.match(/<a /g) || []).length, 1);
    const link = message.text.match(/http:\/\/127\.0\.0\.1:\d+\/result\/[A-Za-z0-9_.-]+/)[0];
    assert.equal(new URL(link).origin, base);
    const reportPage = await visitor.get(link); assert.equal(reportPage.status(), 200);
    assert.ok(!(await reportPage.text()).includes('PRIVATE-COPY'));
    assert.equal((await email(session.token, 'request', { email: 'other@example.test', requested: true })).status(), 409);
    assert.equal((await email(session.token, 'prepare')).status(), 200);
    assert.deepEqual(await readRecord('result_email_tests', artifact.id), artifact);
    pass('Later publication does not change prepared copy; canonical link, recipient and artifact remain immutable');

    await edit({ resultEmailCopy: undefined });
    assert.equal((await post(owner, `/api/forms/${id}/publish`)).status(), 200);
    const legacy = await start(); await finish(legacy.token);
    assert.equal((await email(legacy.token, 'request', { email: 'legacy@example.test', requested: true })).status(), 202);
    jobs = (await listRecords('result_email_jobs', 'local')).filter(row => row.payload.formId === id);
    const legacyJob = jobs.find(row => row.id !== job.id); assert.ok(legacyJob); assert.equal(legacyJob.payload.copyBox, undefined);
    assert.equal((await email(legacy.token, 'prepare')).status(), 200);
    artifacts = (await listRecords('result_email_tests', 'local')).filter(row => row.payload.formId === id);
    const legacyArtifact = artifacts.find(row => row.id !== artifact.id);
    assert.equal(openResultEmail(legacyArtifact.payload.messageBox, `local:${legacyJob.id}:artifact`).subject, 'Your requested quiz result — local test');
    pass('Removing custom copy preserves exact legacy subject and no-copy job format');
    const destination = path.resolve(process.env.ARTIFACT_DIR); fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'results.json'), JSON.stringify({ passed: true, checks, publicStarts: 2, localArtifacts: 2, realEmails: 0 }, null, 2));
  } finally {
    await owner.delete('/api/forms/' + id);
    for (const kind of ['result_email_jobs','result_email_tests','result_reports','result_report_link_revocations','result_report_expirations','attempts','submissions']) {
      for (const row of await listRecords(kind, 'local')) if (row.payload.formId === id || row.payload.form?.id === id) await removeRecord(kind, row.id, 'local');
    }
    await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local',id])).digest('hex'), 'local');
    await owner.dispose(); await visitor.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
