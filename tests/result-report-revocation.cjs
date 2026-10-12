const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const { request } = require('playwright');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { readRecord, writeRecord, removeRecord } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3162';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR || process.env.SUPABASE_URL) throw Error('Isolated local server/data only.');

(async () => {
  const owner = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const visitor = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const id = 'qa-report-revocation-' + Date.now(), attempts = [];
  const fixture = { id, title: 'Disposable report revocation quiz', mode: 'survey', questions: [{ id: 'choice', title: 'Pick one', type: 'multiple_choice', options: [{ id: 'a', label: 'Option A' }] }] };
  const send = async (ctx, path, data, status = 200) => {
    const response = await ctx.post(path, { data });
    assert.equal(response.status(), status, await response.text());
    return response.json();
  };
  const start = async () => {
    const session = await send(visitor, `/api/forms/${id}/start`, {});
    attempts.push(JSON.parse(Buffer.from(session.token.split('.')[0], 'base64url')).id);
    return session;
  };
  const complete = session => send(visitor, `/api/forms/${id}/submit`, { token: session.token, answers: { choice: 'a' } });
  const link = (session, status = 200) => send(visitor, `/api/forms/${id}/result-link`, { token: session.token }, status);
  try {
    await send(owner, '/api/auth', { local: true });
    await send(owner, '/api/forms', fixture, 201);
    await send(owner, `/api/forms/${id}/publish`, {});
    const originalSnapshot = (await readRecord('published', id)).payload;
    const completed = await start(), unfinished = await start();
    await complete(completed);
    const old = await link(completed);
    assert.equal((await visitor.get(old.path)).status(), 200);
    // Public callers cannot delete the quiz or revoke another owner's results.
    assert.equal((await visitor.delete(`/api/forms/${id}`)).status(), 401);
    assert.equal((await visitor.get(old.path)).status(), 200);
    assert.equal((await owner.delete(`/api/forms/${id}`)).status(), 200);
    assert.equal((await visitor.get(old.path)).status(), 404);
    await link(completed, 404);
    // Deliberately restore the exact ID. Neither a link nor the old attempt can revive it.
    await send(owner, '/api/forms', fixture, 201);
    await send(owner, `/api/forms/${id}/publish`, {});
    assert.equal((await visitor.get(old.path)).status(), 404);
    await link(completed, 410);
    await complete(unfinished);
    await link(unfinished, 410);
    // Simulate an in-flight start that already read the old published snapshot
    // before deletion but persisted its attempt after the deletion cutoff.
    const late = await start(), lateId = attempts[attempts.length - 1];
    const lateRow = await readRecord('attempts', lateId);
    await writeRecord('attempts', lateId, 'local', { ...lateRow.payload, form: originalSnapshot }, lateRow.version);
    await complete(late);
    await link(late, 410);
    const fresh = await start();
    await complete(fresh);
    const current = await link(fresh);
    assert.notEqual(current.path, old.path);
    assert.equal((await visitor.get(current.path)).status(), 200);
    assert.equal((await visitor.get(old.path)).status(), 404);
    console.log('PASS permanent report revocation after quiz deletion/recreation, old unfinished attempt replay, fresh responses and anonymous deletion rejection');
  } finally {
    await owner.delete(`/api/forms/${id}`);
    for (const attempt of attempts) {
      for (const kind of ['attempts', 'submissions']) await removeRecord(kind, attempt, 'local');
      await removeRecord('result_reports', `result-${attempt}`, 'local');
    }
    await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', id])).digest('hex'), 'local');
    await owner.dispose();
    await visitor.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
