/* Local synthetic automated A/AA/reflow checks, not a screen-reader certification. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), ts = require('typescript'), { randomUUID } = require('node:crypto');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { writeRecord, removeRecord, cloudEnabled } = require('../lib/records.ts');
const { historicalAnswerVersionId } = require('../lib/contact-answer-cohort-server.ts');
const { quizPopupCode } = require('../lib/embed.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !process.env.HEYQUIZ_DATA_DIR || process.env.HEYQUIZ_LOCAL_MODE !== '1' || cloudEnabled()) throw Error('Isolated local server/data only');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-9/accessibility');
fs.mkdirSync(artifacts, { recursive: true });
const formId = 'qa-batch9-a11y-' + Date.now(), headers = { Origin: base }, scans = [], errors = [], records = [];
const question = { id: 'support', type: 'multiple_choice', title: 'Which kind of support would make your next step easier?', options: [{ id: 'plan', label: 'A clear plan I can follow myself' }, { id: 'help', label: 'A practical conversation with someone who can help' }] };
const longTitle = 'An intentionally long quiz title that still needs readable controls on a small screen: ' + 'abcdefghij'.repeat(12);
const host = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local popup accessibility fixture</title><style>body{margin:0;color:#172033;background:#f1f4f8;font:18px/1.5 system-ui}main{max-width:1000px;padding:24px}a{color:#174097}.space{height:500px}</style></head><body><main><h1>Find your next step</h1><p>A synthetic website containing a quiz popup.</p><div class="space"></div>${quizPopupCode(base, formId, longTitle, 'Open the quiz')}<p>Other website content remains available after closing.</p></main></body></html>`);
});
async function scan(page, name, focus) {
  if (focus) await focus.scrollIntoViewIfNeeded();
  await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime < 2000).map(a => a.finished)));
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const result = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    const keep = values => values.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })) }));
    return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, violations: keep(r.violations), incomplete: keep(r.incomplete) };
  });
  scans.push({ name, ...result });
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(scans, null, 2));
  if (page.screenshot) await page.screenshot({ path: path.join(artifacts, name + '.png') });
  assert.ok(result.documentWidth <= result.width + 1, name + ': no page overflow');
}
(async () => {
  await new Promise(resolve => host.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(12000);
  try {
    assert.equal((await context.request.post(base + '/api/auth', { headers, data: { local: true } })).status(), 200);
    const response = await context.request.post(base + '/api/forms', { headers, data: { id: formId, title: 'A practical next step', mode: 'survey', questions: [question], coverPage: { enabled: true, title: 'Find a useful place to start', subtitle: 'A quick question can help you choose your next step.', buttonText: 'Start my quiz' } } });
    assert.equal(response.status(), 201, await response.text()); const form = await response.json();
    assert.equal((await context.request.post(base + '/api/forms/' + formId + '/publish', { headers, data: {} })).status(), 200);
    for (const option of ['plan', 'help']) {
      const id = randomUUID(), now = Date.now() - 60000;
      await writeRecord('submissions', id, 'local', { id, formId, submittedAt: new Date(now).toISOString(), totalQuestions: 1, totalPointsPossible: 0, totalPointsEarned: 0, percentageScore: 0, passed: true, grading: [], answers: { support: option }, contact: { name: 'Synthetic ' + option, email: option + '@example.test', marketingConsent: false } }, 0);
      await writeRecord('attempts', id, 'local', { form, preview: false, completed: true, startedAt: now - 1000, expiresAt: now + 86400000, reached: [] }, 0);
      records.push(id);
    }
    await page.addInitScript(id => localStorage.setItem('pippi-editor-mode:' + id, 'advanced'), formId);
    await page.goto(base + '/editor/' + formId);
    await page.getByRole('button', { name: 'Contacts', exact: true }).click();
    const directory = page.getByRole('region', { name: 'Contact directory', exact: true });
    await directory.getByRole('heading', { name: 'Contacts (2)', exact: true }).waitFor();
    await directory.getByRole('button', { name: 'More filters', exact: true }).click();
    const savedQuestion = directory.getByLabel('Filter saved question version', { exact: true }), selectedAnswer = directory.getByLabel('Filter selected answer', { exact: true });
    await savedQuestion.selectOption(historicalAnswerVersionId(question));
    for (const width of [1440, 640, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await scan(page, 'answer-incomplete-' + width, savedQuestion); }
    await selectedAnswer.selectOption('plan');
    await directory.getByRole('heading', { name: 'Contacts (1)', exact: true }).waitFor();
    for (const width of [1440, 640, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await scan(page, 'answer-selected-' + width, savedQuestion); }
    await selectedAnswer.focus(); await page.keyboard.press('Escape');
    assert.ok(await directory.getByRole('button', { name: /^More filters/ }).evaluate(el => el === document.activeElement));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:' + host.address().port);
    const trigger = page.locator('a[data-pippi-popup]');
    await page.waitForFunction(() => document.querySelector('a[data-pippi-popup]')?.getAttribute('role') === 'button');
    await scan(page, 'popup-before-open', trigger);
    await trigger.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog'), close = dialog.getByRole('button', { name: 'Close quiz', exact: true });
    await dialog.waitFor();
    await dialog.frameLocator('iframe').getByRole('heading', { name: 'Find a useful place to start', exact: true }).waitFor();
    for (const [width, height] of [[1440, 1000], [640, 1000], [390, 844], [320, 640], [320, 320], [568, 256]]) {
      await page.setViewportSize({ width, height }); await scan(page, `popup-open-${width}-${height}`);
      for (const control of [close, dialog.getByRole('link', { name: 'Open quiz in a new tab', exact: true })]) {
        const bounds = await control.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, `Controls visible at ${width}×${height}`);
      }
      assert.ok((await dialog.locator('.pippi-popup-body').boundingBox()).height >= 60, `Usable scroll area at ${width}×${height}`);
      await close.focus(); await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)); assert.ok(inside, 'Tab remains within dialog');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const child = page.frames().find(frame => frame.url().includes('/play/' + formId));
    await scan(child, 'popup-child-landing-390');
    await close.focus(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.ok(await trigger.evaluate(el => el === document.activeElement));
    await scan(page, 'popup-after-close', trigger);
    assert.deepEqual(errors, []);
    const violations = scans.flatMap(s => s.violations.map(v => ({ name: s.name, ...v })));
    console.log(JSON.stringify({ scans: scans.length, violations, incomplete: scans.filter(s => s.incomplete.length).map(s => ({ name: s.name, findings: s.incomplete })) }, null, 2));
    assert.equal(violations.length, 0, 'Review automated A/AA findings');
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
  } finally {
    for (const id of records) { await removeRecord('submissions', id, 'local'); await removeRecord('attempts', id, 'local'); }
    await context.request.delete(base + '/api/forms/' + formId, { headers }).catch(() => {});
    await browser.close(); await new Promise(resolve => host.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
