// Independent real respondent API baseline. Synthetic local quizzes only.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { randomUUID, createHash } = require('node:crypto');
const { request } = require('playwright');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const { cloudEnabled, readRecord, removeRecord } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.HEYQUIZ_LOCAL_MODE, '1');
assert.ok(process.env.HEYQUIZ_DATA_DIR?.endsWith('/pippi-overnight-2026-10-12/release-test-data'));
assert.equal(cloudEnabled(), false);
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-16/respondent-baseline');
fs.mkdirSync(artifacts, { recursive: true });
const ids = ['qa-manual-runtime-' + randomUUID(), 'qa-manual-runtime-' + randomUUID()], attempts = [], headers = { Origin: base }, observations = [];
const choice = (id, patch = {}) => ({ id, title: id, type: 'multiple_choice', required: true, options: [{ id: 'yes', label: 'Yes', isCorrect: true }, { id: 'zero', label: 'Not yet' }, { id: 'unknown', label: 'Unsure' }], ...patch });
const knowledge = FormSchema.parse({ id: ids[0], title: 'Synthetic number and text grading', mode: 'quiz', questions: [
  { id: 'number', title: 'Synthetic number', type: 'number', required: true, minVal: -1, maxVal: 2, stepVal: 1, correctAnswerText: '1', points: 10 },
  { id: 'word', title: 'Synthetic word', type: 'short_answer', required: true, correctAnswerText: 'go', points: 10 },
  choice('detail', { points: 10 }),
], logicRules: [{ id: 'numeric-threshold', sourceQuestionId: 'number', operator: 'greater_than', value: '1', action: 'show_question', targetQuestionId: 'detail' }], outcomeTiers: [
  { id: 'low', title: 'Low', badge: '', message: '', minScorePercent: 0, maxScorePercent: 49 }, { id: 'mid', title: 'Mid', badge: '', message: '', minScorePercent: 50, maxScorePercent: 99 }, { id: 'high', title: 'High', badge: '', message: '', minScorePercent: 100, maxScorePercent: 100 },
] });
const scorecard = FormSchema.parse({ id: ids[1], title: 'Synthetic typed routing and coverage', mode: 'form', questions: [
  { id: 'number', title: 'Synthetic threshold', type: 'number', required: true }, { id: 'word', title: 'Synthetic route', type: 'short_answer', required: true }, choice('practice'), choice('confidence'),
], logicRules: [
  { id: 'numeric', sourceQuestionId: 'number', operator: 'greater_than', value: '10', action: 'show_question', targetQuestionId: 'practice' },
  { id: 'text', sourceQuestionId: 'word', operator: 'contains', value: 'vip', action: 'show_question', targetQuestionId: 'confidence' },
], marketing: { kind: 'scorecard', categories: [{ id: 'practice-category', title: 'Practice', minAnswers: 1 }, { id: 'confidence-category', title: 'Confidence', minAnswers: 1 }], scorecard: { title: 'Your synthetic score', bands: [{ id: 'low', title: 'Low', min: 0, max: 49 }, { id: 'high', title: 'High', min: 50, max: 100 }] }, rules: ['practice', 'confidence'].flatMap(id => ['yes', 'zero'].map((answerId, i) => ({ id: id + '-' + answerId, questionId: id, answerId, targetId: id + '-category', effect: 'add', points: i ? 0 : 2 }))) } });
async function json(response, expected) { assert.equal(response.status(), expected, 'Unexpected local API status'); return response.json(); }
(async () => {
  const owner = await request.newContext(), visitor = await request.newContext();
  const post = (context, route, data = {}) => context.post(base + route, { headers, data });
  let starts = 0, rejected = 0;
  async function start(form) {
    const data = await json(await post(visitor, '/api/forms/' + form.id + '/start'), 200); starts++;
    const claims = JSON.parse(Buffer.from(data.token.split('.')[0], 'base64url').toString());
    assert.equal(claims.formId, form.id); attempts.push(claims.id);
    return { token: data.token, id: claims.id };
  }
  async function submit(form, answers, session) {
    session ||= await start(form);
    const result = await json(await post(visitor, '/api/forms/' + form.id + '/submit', { token: session.token, answers }), 200);
    const stored = await readRecord('submissions', session.id, 'local'); assert.ok(stored && stored.owner_id === 'local');
    assert.equal(result.answers, undefined); assert.equal(result.contact, undefined); assert.equal(result.contactCaptured, false);
    return { result, retained: stored.payload.answers };
  }
  try {
    await json(await post(owner, '/api/auth', { local: true }), 200);
    for (const form of [knowledge, scorecard]) { await json(await post(owner, '/api/forms', form), 201); await json(await post(owner, '/api/forms/' + form.id + '/publish'), 200); }
    const cases = [
      ['1', ' GO ', 'yes', 100, 'high', false], ['1.0', 'go', 'yes', 50, 'mid', false], ['01', 'Go', 'yes', 50, 'mid', false],
      ['0', 'stop', 'yes', 0, 'low', false], ['1.01', 'go', 'yes', 67, 'mid', true], ['-1', 'go', 'yes', 50, 'mid', false],
      ['2', 'go', 'zero', 33, 'low', true], ['1e0', 'go', 'yes', 50, 'mid', false],
    ];
    for (const [number, word, detail, expectedScore, expectedTier, hasDetail] of cases) {
      const { result, retained } = await submit(knowledge, { number, word, detail });
      assert.equal(result.percentageScore, expectedScore); assert.equal(result.matchedTier?.id, expectedTier);
      const questionIds = hasDetail ? ['number', 'word', 'detail'] : ['number', 'word'];
      assert.deepEqual(result.grading.map(g => g.questionId), questionIds); assert.deepEqual(Object.keys(retained), questionIds);
      assert.equal(retained.number, number); assert.equal(retained.word, word);
      observations.push({ number, word, detail, score: result.percentageScore, resultId: result.matchedTier.id, questionIds });
    }
    const session = await start(knowledge);
    for (const answers of [{ number: '-1.01', word: 'go' }, { number: '2.01', word: 'go', detail: 'yes' }, { number: 'NaN', word: 'go' }, { number: '', word: 'go' }, { number: '1', word: ' ' }]) {
      const failed = await post(visitor, '/api/forms/' + knowledge.id + '/submit', { token: session.token, answers }); assert.equal(failed.status(), 422); rejected++;
      assert.equal(await readRecord('submissions', session.id, 'local'), null, 'Invalid answers must not save a result');
    }
    const corrected = await submit(knowledge, { number: '1', word: 'go' }, session); assert.equal(corrected.result.percentageScore, 100);
    const categoryCases = [
      { answers: { number: '10', word: 'regular', practice: 'yes', confidence: 'yes' }, scores: [null, null], answered: [0, 0], applicable: [0, 0], score: null, status: 'no_match', resultId: null },
      { answers: { number: '10.01', word: 'VIP', practice: 'zero', confidence: 'yes' }, scores: [0, 100], answered: [1, 1], applicable: [1, 1], score: 50, status: 'scored', resultId: 'high' },
      { answers: { number: '11', word: ' VIP ', practice: 'unknown', confidence: 'zero' }, scores: [null, 0], answered: [0, 1], applicable: [1, 1], score: null, status: 'scored', resultId: null },
      { answers: { number: '11', word: 'VIP', practice: 'yes', confidence: 'yes' }, scores: [100, 100], answered: [1, 1], applicable: [1, 1], score: 100, status: 'scored', resultId: 'high' },
    ];
    for (const expected of categoryCases) {
      const { result, retained } = await submit(scorecard, expected.answers), m = result.marketing;
      assert.equal(m.status, expected.status); assert.equal(m.overallScore, expected.score); assert.equal(m.outcomeId ?? null, expected.resultId);
      assert.deepEqual(m.categories.map(c => c.score), expected.scores); assert.deepEqual(m.categories.map(c => c.answered), expected.answered); assert.deepEqual(m.categories.map(c => c.applicable), expected.applicable);
      const questionIds = expected.applicable[0] ? ['number', 'word', 'practice', 'confidence'] : ['number', 'word']; assert.deepEqual(Object.keys(retained), questionIds);
      observations.push({ answers: expected.answers, status: m.status, score: m.overallScore, resultId: m.outcomeId ?? null, categories: m.categories.map(({ id, score, answered, applicable, minAnswers }) => ({ id, score, answered, applicable, minAnswers })), questionIds });
    }
    assert.equal(starts, 13); assert.equal(rejected, 5);
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ passed: true, starts, successfulSubmissions: 13, rejectedSubmissions: rejected, observations, scope: 'Actual isolated local published respondent API; no manual-composer UI, provider, inbox or production verification.' }, null, 2) + '\n');
    console.log('PASS13 actual local respondent starts/submissions and5 rejected corrections: numeric lexical grading, strict routing thresholds, inclusive bounds, unchanged step semantics, hidden-answer removal, trimmed/case-insensitive text and null/zero category coverage.');
  } finally {
    for (const id of attempts) { await removeRecord('submissions', id, 'local'); await removeRecord('attempts', id, 'local'); }
    for (const id of ids) { await owner.delete(base + '/api/forms/' + id, { headers }); const receipt = createHash('sha256').update(JSON.stringify(['local', id])).digest('hex'); await removeRecord('result_report_revocations', receipt, 'local'); }
    await owner.dispose(); await visitor.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
