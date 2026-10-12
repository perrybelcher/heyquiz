// Actual dialog parity before/after extraction. Only disposable local owner quizzes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { FormSchema } = require('../lib/schema.ts');
const { defaultCapture } = require('../lib/contacts.ts');
const { readRecord, removeRecord, cloudEnabled } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL, dataDir = process.env.HEYQUIZ_DATA_DIR;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(dataDir && path.resolve(dataDir).endsWith('/pippi-overnight-2026-10-12/release-test-data'));
assert.equal(cloudEnabled(), false); assert.equal(process.env.HEYQUIZ_LOCAL_MODE, '1');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-15/readiness-after');
fs.mkdirSync(artifacts, { recursive: true });
const prefix = 'qa-readiness-parity-' + randomUUID(), ids = [0, 1, 2, 3].map(index => prefix + '-' + index);
const capture = { ...defaultCapture, enabled: true, required: false, marketingEnabled: false };
const privacyWarning = 'Lead capture is enabled without a privacy-policy link. Review this before collecting personal details.';
const fixtures = [
  { id: ids[0], title: '', mode: 'survey', questions: [], capture },
  { id: ids[1], title: 'Two incomplete questions', mode: 'survey', questions: ['first', 'second'].map(id => ({ id, type: 'short_answer', title: '' })) },
  { id: ids[2], title: 'Recommendations are optional', mode: 'survey', capture,
    questions: [{ id: 'choice', title: 'Choose a direction', type: 'multiple_choice', required: true, options: [{ id: 'a', label: 'One' }, { id: 'b', label: '' }] }],
    marketing: { kind: 'segmentation', outcomes: [{ id: 'direction', title: 'One direction', description: 'A synthetic recommendation', minPoints: 1 }],
      rules: ['a', 'b'].map(answerId => ({ id: 'rule-' + answerId, questionId: 'choice', answerId, targetId: 'direction', effect: 'add', points: 1 })) } },
  { id: ids[3], title: 'Complete simple survey', mode: 'survey', questions: [{ id: 'plain', title: 'What matters?', type: 'short_answer' }] },
].map(value => FormSchema.parse(value));
const expected = [
  { blockers: ['Add at least one question.', 'Give your quiz a title.'], warnings: [privacyWarning] },
  { blockers: ['Give every question a title.'], warnings: [] },
  { blockers: [], warnings: ['1 results have no destination link. Respondents can read the result but cannot follow an offer button.', privacyWarning] },
  { blockers: [], warnings: [] },
];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await owner.newPage(), headers = { Origin: base }, errors = [], observations = [];
  let publishRequests = 0;
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/forms\/[^/]+\/publish$/.test(request.url())) publishRequests++; });
  await page.addInitScript(ids => { for (const id of ids) localStorage.setItem('pippi-editor-mode:' + id, 'advanced'); }, ids);
  try {
    assert.equal((await owner.request.post(base + '/api/auth', { headers, data: { local: true } })).status(), 200);
    for (let index = 0; index < fixtures.length; index++) {
      const response = await owner.request.post(base + '/api/forms', { headers, data: fixtures[index] });
      assert.equal(response.status(), 201, await response.text());
      await page.setViewportSize({ width: index === 0 ? 320 : 390, height: 844 });
      await page.goto(base + '/editor/' + ids[index]);
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Ready to publish?', exact: true });
      await dialog.waitFor();
      const blockers = await dialog.locator('section').nth(0).locator('li').allTextContents();
      const warningHeading = dialog.getByRole('heading', { name: 'Review before sharing', exact: true });
      const warnings = await warningHeading.count() ? await warningHeading.locator('..').locator('li').allTextContents() : [];
      assert.deepEqual({ blockers, warnings }, expected[index]);
      const publish = dialog.getByRole('button', { name: 'Publish now', exact: true });
      assert.equal(await publish.isDisabled(), blockers.length > 0);
      assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth && element.getBoundingClientRect().width <= innerWidth));
      if (!blockers.length) await dialog.getByText('Required structure checks passed.', { exact: true }).waitFor();
      if (index === 0 || index === 2) await dialog.getByText('Optional capture. Marketing opt-in is off.', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(artifacts, `dialog-${index}.png`) });
      observations.push({ blockers, warnings, disabled: await publish.isDisabled() });
      if (index === 2) {
        assert.equal(publishRequests, 0, 'Opening/cancelling checks never publishes');
        const confirmation = page.waitForResponse(response => response.url() === `${base}/api/forms/${ids[index]}/publish` && response.request().method() === 'POST');
        await publish.click(); assert.equal((await confirmation).status(), 200);
        await page.getByRole('button', { name: 'Close publication confirmation', exact: true }).click();
        const snapshot = await readRecord('published', ids[index]); assert.ok(snapshot);
        assert.equal(snapshot.payload.marketing.outcomes[0].ctaUrl, '');
        assert.equal(snapshot.payload.capture.privacyUrl, '');
        assert.equal(snapshot.payload.questions[0].options[1].label, '');
      } else {
        if (index === 0) await page.keyboard.press('Escape');
        else await dialog.getByRole('button', { name: 'Back to editor', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' }); assert.equal(await readRecord('published', ids[index]), null);
      }
    }
    assert.equal(publishRequests, 1); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ passed: true, observations, actualWarningOnlyPublications: 1, publicStarts: 0, pageErrors: errors }, null, 2));
    console.log('PASS four real readiness dialogs: exact blocker/warning order, grouped blank questions, unchanged optional answer/link/privacy policy, narrow reflow, Escape/back cancellation and one explicit warning-only publication. Zero public starts or emails.');
  } catch (error) { await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); throw error; }
  finally {
    for (const id of ids) {
      await owner.request.delete(base + '/api/forms/' + id, { headers }).catch(() => {});
      await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', id])).digest('hex'), 'local');
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
