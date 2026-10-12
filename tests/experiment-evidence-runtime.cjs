// Independent compiled analytics/experiment baseline; isolated synthetic records only.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { randomUUID, createHash } = require('node:crypto'), { request } = require('playwright');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts'), { cloudEnabled, readRecord, writeRecord, removeRecord } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/); assert.equal(process.env.HEYQUIZ_LOCAL_MODE, '1'); assert.equal(cloudEnabled(), false);
assert.ok(process.env.HEYQUIZ_DATA_DIR?.endsWith('/pippi-overnight-2026-10-12/release-test-data'));
const out = path.resolve(process.env.ARTIFACT_DIR); fs.mkdirSync(out, { recursive: true });
const ids = [0, 1].map(() => 'qa-evidence-runtime-' + randomUUID()), attempts = [], experiments = [], observations = [], headers = { Origin: base };
const make = id => FormSchema.parse({ id, title: 'Synthetic analytics baseline', mode: 'survey', questions: [{ id: 'q', title: 'Choose a route', type: 'multiple_choice', options: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }] }] });
const expect = async (res, code) => { assert.equal(res.status(), code, 'Unexpected local response status'); return res.json(); };
(async () => {
  const owner = await request.newContext(), anonymous = await request.newContext();
  const post = (url, data) => owner.post(base + url, { headers, data });
  try {
    await expect(await post('/api/auth', { local: true }), 200);
    for (const id of ids) { await expect(await post('/api/forms', make(id)), 201); await expect(await post('/api/forms/' + id + '/publish', {}), 200); }
    const current = (await readRecord('published', ids[0], 'local')).payload, other = (await readRecord('published', ids[1], 'local')).payload;
    const now = Date.now(), hour = 3600000, old = { ...structuredClone(current), publishedAt: new Date(now - 86400000).toISOString() }; old.questions[0].title = 'Earlier route';
    const test = await expect(await post('/api/experiments', { name: 'Synthetic baseline test', a: ids[0], b: ids[1] }), 201); experiments.push(test.id);
    const attribution = { version: 1, source: 'newsletter', campaign: 'launch' };
    async function seed(n, patch, submission) {
      const id = 'qa-evidence-attempt-' + randomUUID(); attempts.push(id);
      const value = { form: current, startedAt: now - 3 * hour + n * 1000, expiresAt: now + hour, preview: false, reached: ['q'], analyticsVersion: 1, attribution, lastSeenAt: now - hour, lastQuestionId: 'q', ...patch };
      await writeRecord('attempts', id, 'local', value, 0);
      if (submission) await writeRecord('submissions', id, 'local', { id, formId: value.form.id, submittedAt: new Date(now - hour).toISOString(), answers: { q: 'a' }, grading: [], totalScore: 0, maxScore: 0, percentageScore: 0, passed: true, ...submission }, 0);
    }
    await seed(1, { experiment: { id: test.id, visitor: 'synthetic-one', variant: 0 } });
    await seed(2, { lastSeenAt: now - 10 * 60000, experiment: { id: test.id, visitor: 'synthetic-two', variant: 1 } });
    await seed(3, { completed: true, completedAt: now - hour, experiment: { id: test.id, visitor: 'synthetic-one', variant: 0 } }, { contact: { email: 'synthetic@example.invalid' } });
    await seed(4, { analyticsVersion: undefined });
    await seed(5, { attribution: { version: 1, source: 'ads', campaign: 'other' }, experiment: { id: test.id, visitor: 'synthetic-two', variant: 0 } });
    await seed(6, { attribution: undefined });
    await seed(7, { preview: true });
    await seed(8, { startedAt: now + hour });
    await seed(9, { form: old });
    await seed(10, { form: old, startedAt: now - 40 * 86400000, lastSeenAt: now - 40 * 86400000 });
    await seed(11, {}, {}); // Retained submission makes this complete even without an attempt flag.
    await seed(12, { form: other });
    const scopes = [
      ['all', { range: 'all' }, [9, 2, 1, 8, 5]],
      ['30-days', { range: '30' }, [8, 2, 1, 7, 4]],
      ['current-newsletter', { range: 'all', source: 'utm:newsletter', campaign: 'value:launch', version: 'published:' + current.publishedAt }, [5, 2, 1, 4, 1]],
      ['unknown', { range: 'all', source: 'unknown' }, [1, 0, 0, 1, 1]],
      ['ads', { range: 'all', source: 'utm:ads', campaign: 'value:other' }, [1, 0, 0, 1, 1]],
      ['older-publication', { range: 'all', version: 'published:' + old.publishedAt }, [2, 0, 0, 2, 2]],
    ];
    for (const [name, selectors, expected] of scopes) {
      const response = await owner.get(base + '/api/forms/' + ids[0] + '/analytics?' + new URLSearchParams(selectors)); assert.equal(response.headers()['cache-control'], 'private, no-store');
      const data = await expect(response, 200), totals = [data.starts, data.completions, data.leads, data.measuredSessions, data.quietSessions]; assert.deepEqual(totals, expected, name);
      const questions = data.questions.map(({ id, questionId, title, current, reached, completed, quiet, measured, quietRate }) => ({ id, questionId, title, current, reached, completed, quiet, measured, quietRate }));
      assert.equal(questions.reduce((sum, q) => sum + q.reached, 0), data.starts);
      assert.equal(questions.reduce((sum, q) => sum + q.quiet, 0), data.quietSessions);
      assert.equal(JSON.stringify(data).includes('synthetic@example.invalid'), false);
      observations.push({ name, totals, questions });
    }
    const listing = await expect(await owner.get(base + '/api/experiments'), 200), dto = listing.experiments.find(row => row.id === test.id);
    assert.deepEqual(dto.stats, [{ visitors: 1, completions: 1, leads: 1, clicks: 0 }, { visitors: 1, completions: 0, leads: 0, clicks: 0 }]);
    assert.equal(dto.plan, undefined); assert.equal(dto.evidence, undefined); assert.equal(JSON.stringify(dto).includes('@'), false);
    assert.equal((await anonymous.get(base + '/api/forms/' + ids[0] + '/analytics')).status(), 401);
    const result = { passed: true, observations, assignedBrowserStats: dto.stats, syntheticAttempts: attempts.length, publicStarts: 0, scope: 'Actual local compiled analytics/experiment GETs with independently seeded synthetic records; no production or new-evidence-endpoint claim.' };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2)); console.log('PASS six literal compiled analytics cohorts and assigned-browser deduplication baseline; no public starts.');
  } finally {
    for (const id of experiments) await removeRecord('experiments', id, 'local');
    for (const id of attempts) { await removeRecord('submissions', id, 'local'); await removeRecord('attempts', id, 'local'); }
    for (const id of ids) {
      await owner.delete(base + '/api/forms/' + id, { headers }).catch(() => {});
      await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', id])).digest('hex'), 'local');
    }
    await owner.dispose(); await anonymous.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
