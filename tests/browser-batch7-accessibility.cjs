/* Local synthetic smoke checks: automated A/AA, keyboard access and CSS reflow.
 * 640 CSS px approximates a 1280px viewport at 200% zoom; it is not a real
 * browser-zoom or screen-reader certification. Functional cases live elsewhere.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { launchTemplate } = require('../lib/launch-templates.ts');
const { removeRecord } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !process.env.HEYQUIZ_DATA_DIR || process.env.HEYQUIZ_LOCAL_MODE !== '1') throw Error('Use the isolated local server and its synthetic data directory.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/batch7-accessibility');
fs.mkdirSync(artifacts, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await owner.newPage(), visitor = await guest.newPage();
  const id = 'qa-batch7-accessibility-' + Date.now(), headers = { Origin: base }, attempts = [], scans = [], errors = [];
  for (const p of [page, visitor]) p.on('pageerror', error => errors.push(error.message));
  async function scan(p, name) {
    await p.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime < 2000).map(a => a.finished)));
    await p.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const report = await p.evaluate(async () => {
      const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return { violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), incomplete: result.incomplete.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })) };
    });
    const reflow = await p.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    scans.push({ name, ...reflow, ...report });
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(scans, null, 2));
    await p.screenshot({ path: path.join(artifacts, name + '.png') });
    assert.ok(reflow.documentWidth <= reflow.width + 1, name + ': no page-level horizontal overflow');
  }
  async function keyboardActivate(control, p = page) {
    await control.focus();
    assert.equal(await control.evaluate(el => el === document.activeElement), true);
    await p.keyboard.press('Enter');
  }
  try {
    assert.equal((await owner.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
    const form = launchTemplate('website-readiness', id);
    assert.equal((await owner.request.post(base + '/api/forms', { data: form, headers })).status(), 201);
    assert.equal((await owner.request.post(base + '/api/forms/' + id + '/publish', { data: {}, headers })).status(), 200);
    const started = await guest.request.post(base + '/api/forms/' + id + '/start', { data: { attribution: { version: 1, source: 'accessibility-test', campaign: 'Synthetic campaign' } }, headers });
    assert.equal(started.status(), 200, await started.text());
    const start = await started.json();
    attempts.push(JSON.parse(Buffer.from(start.token.split('.')[0], 'base64url')).id);
    const completed = await guest.request.post(base + '/api/forms/' + id + '/submit', { data: { token: start.token, answers: Object.fromEntries(form.questions.map(q => [q.id, 'a0'])) }, headers });
    assert.equal(completed.status(), 200, await completed.text());
    await page.addInitScript(id => localStorage.setItem('pippi-editor-mode:' + id, 'advanced'), id);
    await page.goto(base + '/editor/' + id);
    await keyboardActivate(page.getByRole('button', { name: 'Results', exact: true }));
    const report = page.getByRole('region', { name: 'Conversion analytics', exact: true });
    await report.getByRole('combobox', { name: 'Filter by source', exact: true }).selectOption('utm:accessibility-test');
    await report.getByText('Landing visits are hidden for this cohort.', { exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Export question performance' && !b.disabled));
    for (const width of [1440, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await report.scrollIntoViewIfNeeded();
      await scan(page, 'analytics-cohort-' + width);
    }
    await keyboardActivate(report.getByRole('button', { name: 'Clear cohort filters', exact: true }));
    await report.getByRole('region', { name: 'Landing visit performance', exact: true }).waitFor();
    assert.equal(await report.getByRole('combobox', { name: 'Filter by source', exact: true }).inputValue(), '');

    await visitor.goto(base + '/templates');
    await visitor.getByRole('textbox', { name: 'Search templates', exact: true }).fill('coffee');
    const card = visitor.getByRole('button', { name: /Find your coffee style/ });
    await keyboardActivate(card, visitor);
    const details = visitor.getByRole('region', { name: 'Template details', exact: true });
    await details.getByText('Landing and result content included', { exact: true }).waitFor();
    for (const width of [1440, 640, 390, 320]) {
      await visitor.setViewportSize({ width, height: 1000 });
      await details.scrollIntoViewIfNeeded();
      await scan(visitor, 'template-details-' + width);
    }
    await keyboardActivate(details.getByRole('button', { name: 'Use this template', exact: true }), visitor);
    await visitor.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
    if (visitor.viewportSize().width < 1024) await keyboardActivate(visitor.getByRole('button', { name: 'More', exact: true }), visitor);
    await keyboardActivate(visitor.getByRole('button', { name: 'Conversation map', exact: true }), visitor);
    const map = visitor.getByRole('dialog', { name: 'See the conversation. Shape the next step.', exact: true });
    await keyboardActivate(map.getByRole('button', { name: 'Run journey checks', exact: true }), visitor);
    await map.getByRole('status').filter({ hasText: 'distinct paths checked' }).waitFor();
    await map.getByRole('textbox', { name: 'Case name', exact: true }).fill('Accessible campaign expectation');
    await keyboardActivate(map.getByRole('button', { name: 'Save expected result', exact: true }), visitor);
    await map.getByRole('heading', { name: 'Accessible campaign expectation', exact: true }).waitFor();
    for (const width of [1440, 640, 390, 320]) {
      await visitor.setViewportSize({ width, height: 1000 });
      await map.getByRole('region', { name: 'Saved regression cases', exact: true }).scrollIntoViewIfNeeded();
      await scan(visitor, 'journey-expectations-' + width);
      assert.ok(await map.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Journey panel fits viewport at ' + width);
    }
    await visitor.keyboard.press('Escape');
    await map.waitFor({ state: 'detached' });
    // Crossing the desktop breakpoint remounts the mobile opener. Exercise
    // normal same-viewport focus restoration with that current connected control.
    await keyboardActivate(visitor.getByRole('button', { name: 'More', exact: true }), visitor);
    await keyboardActivate(visitor.getByRole('button', { name: 'Conversation map', exact: true }), visitor);
    await map.waitFor();
    await visitor.keyboard.press('Escape');
    await map.waitFor({ state: 'detached' });
    assert.equal(await visitor.getByRole('button', { name: 'More', exact: true }).evaluate(el => el === document.activeElement), true, 'Keyboard focus returns to the mobile tools opener');
    assert.deepEqual(errors, []);
    const violations = scans.flatMap(s => s.violations.map(v => ({ name: s.name, ...v })));
    console.log(JSON.stringify({ scans: scans.length, violations, manualReview: scans.map(s => ({ name: s.name, incomplete: s.incomplete })) }, null, 2));
    assert.equal(violations.length, 0, 'Automated A/AA findings require review');
  } finally {
    await owner.request.delete(base + '/api/forms/' + id, { headers }).catch(() => {});
    for (const attempt of attempts) {
      await removeRecord('submissions', attempt, 'local');
      await removeRecord('attempts', attempt, 'local');
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
