const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const root = path.resolve(__dirname, '..'), load = Module._load;
Module._load = function(request, parent, main) { return load.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, main); };
Object.assign(process.env, { SESSION_SECRET: 'isolated-copy-email-secret-not-for-production', HEYQUIZ_LOCAL_MODE: '1', HEYQUIZ_RESULT_EMAIL_MODE: 'synthetic', HEYQUIZ_RESULT_EMAIL_ORIGIN: 'http://127.0.0.1:3164', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_ANON_KEY: '', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', VERCEL: '', VERCEL_ENV: '' });
const records = require('../lib/records.ts'), memory = new Map();
records.readRecord = async (kind, id) => structuredClone(memory.get(`${kind}:${id}`) || null);
records.listRecords = async (kind, owner) => structuredClone([...memory.values()].filter(row => row.kind === kind && (!owner || row.owner_id === owner)));
records.writeRecord = async (kind, id, owner, payload, expected) => { const key = `${kind}:${id}`, old = memory.get(key); if (old && old.owner_id !== owner) throw Error('Wrong owner'); if (expected !== undefined && (old?.version || 0) !== expected) throw new records.ConflictError(); const row = { kind, id, owner_id: owner, payload: structuredClone(payload), version: (old?.version || 0) + 1 }; memory.set(key, row); return structuredClone(row); };
records.removeRecord = async (kind, id, owner) => memory.get(`${kind}:${id}`)?.owner_id === owner && memory.delete(`${kind}:${id}`);
const auth = require('../lib/auth.ts'); let user = 'copy-owner';
auth.requireUser = async () => { if (!user) throw new auth.HttpError(401, 'Sign in'); return { id: user }; };
const service = require('../lib/result-email.ts'), config = require('../lib/result-email-config.ts'), transport = require('../lib/result-email-transport.ts'), reports = require('../lib/result-reports.ts');
const { createAttempt } = require('../lib/attempts.ts'), { FormSchema } = require('../lib/schema.ts'), { DEFAULT_RESULT_EMAIL_COPY, resolveResultEmailCopy, renderResultEmailCopy } = require('../lib/result-email-copy.ts');
const formRoute = require('../app/api/forms/[id]/route.ts'), createRoute = require('../app/api/forms/route.ts'), publishRoute = require('../app/api/forms/[id]/publish/route.ts'), emailRoute = require('../app/api/forms/[id]/result-email/route.ts');
const owner = 'copy-owner', base = 'http://127.0.0.1:3164', context = id => ({ params: Promise.resolve({ id }) });
const req = (id, body, method = 'POST', origin = base) => new Request(`${base}/api/forms/${id}`, { method, headers: { Origin: origin }, body: JSON.stringify(body) });
const parsed = async (response, status) => { assert.equal(response.status, status); return response.json(); };
const originalCopy = { version: 1, subject: '{brand_name}: your requested link', introduction: 'ORIGINAL COPY: You asked for {quiz_title}.\n\nKeep this private.', signOff: 'Thanks,\n{brand_name}' };
let seq = 0, checks = 0; const pass = name => { checks++; console.log('PASS ' + name); };
async function fixture(copy = originalCopy) {
  const id = `email-copy-${++seq}`, form = FormSchema.parse({ id, mode: 'survey', title: 'Original quiz', theme: { primaryColor: '#123456', backgroundColor: '#ffffff', brandName: 'Original studio' }, questions: [{ id: 'q1', title: 'Choose', type: 'multiple_choice', options: [{ id: 'a', label: 'A' }] }], ...(copy ? { resultEmailCopy: copy } : {}) });
  await parsed(await createRoute.POST(req(id, form)), 201);
  await parsed(await publishRoute.POST(req(id, {}), context(id)), 200);
  const published = await records.readRecord('published', id), started = await createAttempt(published.payload, owner, false), responseId = JSON.parse(Buffer.from(started.token.split('.')[0], 'base64url')).id, row = await records.readRecord('attempts', responseId);
  const result = { id: responseId, formId: id, submittedAt: new Date().toISOString(), totalPointsEarned: 0, totalPointsPossible: 0, percentageScore: 100, answers: { private: 'NEVER-ANSWER-SECRET' }, contact: { email: 'separate-lead@example.test', marketingConsent: false }, grading: [] };
  await records.writeRecord('submissions', responseId, owner, result, 0);
  const attempt = await records.writeRecord('attempts', responseId, owner, { ...row.payload, completed: true, result }, row.version);
  return { id, a: attempt, token: started.token, jobId: service.resultEmailJobId(owner, id, responseId) };
}
async function edit(f, changed) {
  const form = await parsed(await formRoute.GET(new Request(base), context(f.id)), 200);
  return parsed(await formRoute.PUT(req(f.id, { ...form, ...changed }, 'PUT'), context(f.id)), 200);
}
async function artifact(f) { const row = await records.readRecord('result_email_tests', `test-${f.jobId}`); return { row, message: config.openResultEmail(row.payload.messageBox, `${owner}:${f.jobId}:artifact`) }; }
(async () => { try {
  const f = await fixture();
  assert.deepEqual((await parsed(await formRoute.GET(new Request(base), context(f.id)), 200)).resultEmailCopy, originalCopy);
  const originalPublished = (await records.readRecord('published', f.id)).payload;
  const newCopy = { ...originalCopy, subject: 'EDITED subject', introduction: 'EDITED introduction', signOff: 'EDITED signature' };
  await edit(f, { title: 'Edited quiz', theme: { ...originalPublished.theme, brandName: 'Edited studio' }, resultEmailCopy: newCopy });
  assert.deepEqual((await records.readRecord('published', f.id)).payload.resultEmailCopy, originalCopy);
  await parsed(await publishRoute.POST(req(f.id, {}), context(f.id)), 200);
  assert.deepEqual((await records.readRecord('published', f.id)).payload.resultEmailCopy, newCopy);
  assert.deepEqual((await records.readRecord('attempts', f.a.id)).payload.form.resultEmailCopy, originalCopy);
  pass('schema/API save and republish retain completed-attempt copy, quiz title and brand snapshot');

  const live = await parsed(await formRoute.GET(new Request(base), context(f.id)), 200), liveVersion = (await records.readRecord('forms', f.id)).version;
  user = 'other-owner'; assert.equal((await formRoute.PUT(req(f.id, live, 'PUT'), context(f.id))).status, 404);
  user = null; assert.equal((await formRoute.PUT(req(f.id, live, 'PUT'), context(f.id))).status, 401); user = owner;
  assert.equal((await formRoute.PUT(req(f.id, live, 'PUT', 'https://wrong.example'), context(f.id))).status, 403);
  for (const bad of [{ ...newCopy, subject: 'Subject\r\nBcc: injected' }, { ...newCopy, introduction: '{email}' }, { ...newCopy, html: '<script>' }, { ...newCopy, version: 2 }]) assert.equal((await formRoute.PUT(req(f.id, { ...live, resultEmailCopy: bad }, 'PUT'), context(f.id))).status, 400);
  assert.equal((await records.readRecord('forms', f.id)).version, liveVersion);
  pass('existing owner/origin boundary and copy schema reject malicious updates without mutation');

  const queued = await parsed(await emailRoute.POST(req(f.id, { action: 'request', token: f.token, email: 'copy@example.test', requested: true, resultEmailCopy: newCopy, brandName: 'BODY INJECTION' }), context(f.id)), 202);
  assert.equal(queued.job.state, 'queued');
  let job = await records.readRecord('result_email_jobs', f.jobId), frozen = config.openResultEmail(job.payload.copyBox, `${owner}:${f.jobId}:copy:v1`);
  assert.deepEqual(frozen, { renderingVersion: '1', subject: 'Original studio: your requested link', introduction: 'ORIGINAL COPY: You asked for Original quiz.\n\nKeep this private.', signOff: 'Thanks,\nOriginal studio' });
  for (const text of ['ORIGINAL COPY', 'Original studio', 'copy@example.test', '/result/', 'NEVER-ANSWER-SECRET']) assert.ok(!JSON.stringify(job).includes(text));
  for (const purpose of [`other:${f.jobId}:copy:v1`, `${owner}:other-job:copy:v1`, `${owner}:${f.jobId}:copy:v2`, `${owner}:${f.jobId}:recipient`, `${owner}:${f.jobId}:artifact`]) assert.throws(() => config.openResultEmail(job.payload.copyBox, purpose));
  assert.throws(() => config.openResultEmail(job.payload.recipientBox, `${owner}:${f.jobId}:copy:v1`));
  pass('request ignores body copy, encrypts resolved completed-attempt text and isolates purpose/owner/job/version');

  const initialBox = job.payload.copyBox;
  await Promise.all([service.requestResultEmail(f.a, 'COPY@example.test', true), service.requestResultEmail(f.a, 'copy@example.test ', true)]);
  const competing = await Promise.allSettled([service.requestResultEmail(f.a, 'copy@example.test', true), service.requestResultEmail(f.a, 'other@example.test', true)]);
  assert.equal(competing[0].status, 'fulfilled'); assert.equal(competing[1].reason.status, 409);
  assert.equal((await records.readRecord('result_email_jobs', f.jobId)).payload.copyBox, initialBox);
  assert.deepEqual((await records.readRecord('submissions', f.a.id)).payload.contact, { email: 'separate-lead@example.test', marketingConsent: false });
  const concurrent = await fixture(); await Promise.all([service.requestResultEmail(concurrent.a, 'same@example.test', true), service.requestResultEmail(concurrent.a, 'same@example.test', true)]);
  assert.equal((await records.readRecord('result_email_jobs', concurrent.jobId)).version, 1);
  pass('concurrent first creation/replay preserves one recipient/copy and leaves lead consent unchanged');

  assert.equal((await service.prepareResultEmail(f.jobId, owner, async () => { throw new transport.ResultEmailTransportError(422); })).state, 'failed');
  await edit(f, { resultEmailCopy: { ...newCopy, introduction: 'NEW RETRY COPY' } });
  await parsed(await publishRoute.POST(req(f.id, {}), context(f.id)), 200);
  assert.equal((await service.retryResultEmail(f.a)).state, 'queued');
  await Promise.all([service.prepareResultEmail(f.jobId, owner), service.prepareResultEmail(f.jobId, owner)]);
  const prepared = await artifact(f), link = await reports.issueResultReport(f.a), report = await reports.readResultReport(link.path.slice('/result/'.length));
  assert.deepEqual(prepared.message, { to: 'copy@example.test', ...renderResultEmailCopy(resolveResultEmailCopy(originalCopy, { quizTitle: 'Original quiz', brandName: 'Original studio' }), { privateUrl: base + link.path, expiresOn: new Date(report.expiresAt).toISOString().slice(0, 10) }) });
  for (const badPath of ['https://foreign.example' + link.path, 'http://127.0.0.1:9999' + link.path, link.path + '?copy=bad', '/other']) assert.throws(() => service.resultEmailMessage('copy@example.test', report, badPath, resolveResultEmailCopy(originalCopy, {})));
  assert.equal(prepared.row.version, 1); assert.equal((await records.readRecord('result_email_jobs', f.jobId)).payload.copyBox, initialBox);
  for (const forbidden of ['EDITED', 'NEW RETRY COPY', 'Edited studio', 'BODY INJECTION', 'NEVER-ANSWER-SECRET', 'separate-lead@example.test']) assert.ok(!JSON.stringify(prepared.message).includes(forbidden));
  for (const privateText of ['Original studio', '/result/', 'copy@example.test']) assert.ok(!JSON.stringify(prepared.row).includes(privateText));
  pass('failure/manual retry and concurrent preparation use immutable encrypted text after draft and publication edits');

  const safe = await parsed(await emailRoute.POST(req(f.id, { action: 'status', token: f.token }), context(f.id)), 200);
  assert.equal(safe.job.state, 'prepared'); assert.equal(safe.sent, false);
  for (const secret of ['copyBox', 'recipientBox', 'subject', 'introduction', 'signOff', 'Original studio', 'copy@example.test', '/result/', 'NEVER-ANSWER']) assert.ok(!JSON.stringify(safe).includes(secret));
  pass('status DTO remains unchanged and contains no copy, ciphertext, address, raw answer or bearer link');

  const legacy = await fixture(null); await service.requestResultEmail(legacy.a, 'legacy@example.test', true);
  assert.equal((await records.readRecord('result_email_jobs', legacy.jobId)).payload.copyBox, undefined);
  await edit(legacy, { resultEmailCopy: originalCopy, title: 'Later title' }); await parsed(await publishRoute.POST(req(legacy.id, {}), context(legacy.id)), 200);
  await service.prepareResultEmail(legacy.jobId, owner);
  const legacyArtifact = await artifact(legacy), legacyLink = await reports.issueResultReport(legacy.a), legacyReport = await reports.readResultReport(legacyLink.path.slice('/result/'.length)), expiry = new Date(legacyReport.expiresAt).toISOString().slice(0, 10), url = base + legacyLink.path;
  assert.deepEqual(legacyArtifact.message, { to: 'legacy@example.test', subject: 'Your requested quiz result — local test', text: `LOCAL TEST ONLY — no email was sent.\n\nYou requested a private result link for Original quiz.\n\n${url}\n\nThis link expires on ${expiry} (UTC). Anyone with the link can view the saved result. This request does not subscribe you to marketing emails.`, html: `<p><strong>LOCAL TEST ONLY — no email was sent.</strong></p><p>You requested a private result link for Original quiz.</p><p><a href="${url}">Open your saved result</a></p><p>This link expires on ${expiry} (UTC). Anyone with the link can view the saved result.</p><p>This request does not subscribe you to marketing emails.</p>` });
  assert.deepEqual(service.resultEmailMessage('legacy@example.test', legacyReport, legacyLink.path), legacyArtifact.message);
  pass('absent configuration creates no copy box and old jobs retain exact legacy subject/text/HTML after edits');

  const corrupt = await fixture(); await service.requestResultEmail(corrupt.a, 'corrupt@example.test', true);
  job = await records.readRecord('result_email_jobs', corrupt.jobId);
  await records.writeRecord('result_email_jobs', corrupt.jobId, owner, { ...job.payload, copyBox: config.sealResultEmail({ renderingVersion: '2', subject: 'wrong', introduction: 'wrong', signOff: '' }, `${owner}:${corrupt.jobId}:copy:v1`) }, job.version);
  let called = false; assert.equal((await service.prepareResultEmail(corrupt.jobId, owner, async () => { called = true; throw Error('must not call'); })).state, 'failed'); assert.equal(called, false);
  pass('unsupported frozen rendering version fails closed without default-copy fallback or transport');

  const malicious = await fixture(); await service.requestResultEmail(malicious.a, 'revoked@example.test', true);
  await records.writeRecord('result_report_link_revocations', reports.resultLinkReceiptId(malicious.id, owner, malicious.a.id), owner, { formId: malicious.id, submissionId: malicious.a.id, revokedAt: Date.now() }, 0);
  assert.equal((await service.prepareResultEmail(malicious.jobId, owner)).state, 'cancelled'); assert.equal(await records.readRecord('result_email_tests', `test-${malicious.jobId}`), null);
  const oversize = await fixture({ ...DEFAULT_RESULT_EMAIL_COPY, subject: '{quiz_title}' });
  oversize.a.payload.form.title = 'x'.repeat(121);
  await assert.rejects(() => service.requestResultEmail(oversize.a, 'badcopy@example.test', true), error => error.status === 422 && !error.message.includes('xxxx'));
  assert.equal(await records.readRecord('result_email_jobs', oversize.jobId), null);
  pass('revoked jobs cancel and invalid expanded snapshot copy returns safe error before queue creation');

  const gate = process.env.HEYQUIZ_RESULT_EMAIL_MODE; process.env.HEYQUIZ_RESULT_EMAIL_MODE = '';
  assert.equal((await emailRoute.POST(req(f.id, { action: 'request', token: f.token, email: 'copy@example.test', requested: true, mode: 'synthetic', resultEmailCopy: originalCopy }), context(f.id))).status, 503);
  process.env.HEYQUIZ_RESULT_EMAIL_MODE = gate;
  pass('creator copy and request body cannot enable unavailable delivery');
  console.log(`${checks} result-email-copy API/service groups passed; in-memory records only, no filesystem/cloud/provider/email.`);
} finally { Module._load = load; } })().catch(error => { console.error(error); process.exitCode = 1; });
