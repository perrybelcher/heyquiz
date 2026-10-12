/* Synthetic compiled-browser checks, not a production or screen-reader audit.
 * 640 CSS px approximates 1280px at 200% zoom; browser zoom is not changed. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { launchTemplate } = require('../lib/launch-templates.ts');
const { removeRecord, cloudEnabled } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !process.env.HEYQUIZ_DATA_DIR || process.env.HEYQUIZ_LOCAL_MODE !== '1' || cloudEnabled()) throw Error('Isolated local server/data only.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/batch8-accessibility');
fs.mkdirSync(artifacts, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guest = await browser.newContext();
  const page = await owner.newPage();
  const prefix = 'qa-batch8-a11y-' + Date.now(), ids = [prefix + '-a', prefix + '-b'], headers = { Origin: base };
  const attempts = [], experiments = [], scans = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  async function activate(control) { await control.focus(); assert.equal(await control.evaluate(el => document.activeElement === el), true); await page.keyboard.press('Enter'); }
  async function scan(name, focus) {
    await focus.scrollIntoViewIfNeeded();
    await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime < 2000).map(a => a.finished)));
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const report = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      const keep = values => values.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary, html: n.html })) }));
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, violations: keep(r.violations), incomplete: keep(r.incomplete) };
    });
    scans.push({ name, ...report });
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(scans, null, 2));
    await page.screenshot({ path: path.join(artifacts, name + '.png') });
    assert.ok(report.documentWidth <= report.width + 1, name + ': no page overflow');
  }
  async function widths(name, focus) { for (const width of [1440, 640, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await scan(name + '-' + width, focus); } }
  try {
    assert.equal((await owner.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
    const forms = ids.map(id => launchTemplate('website-readiness', id));
    for (const [i, f] of forms.entries()) {
      f.title = 'Synthetic accessible version ' + (i ? 'B' : 'A');
      f.capture = { ...f.capture, enabled: true, required: false, placement: 'before_results' };
      const saved = await owner.request.post(base + '/api/forms', { data: f, headers });
      assert.equal(saved.status(), 201, await saved.text());
      assert.equal((await owner.request.post(base + `/api/forms/${f.id}/publish`, { data: {}, headers })).status(), 200);
    }
    const started = await guest.request.post(base + `/api/forms/${ids[0]}/start`, { data: { attribution: { version: 1, source: 'accessible-campaign', campaign: 'Synthetic local campaign' } }, headers });
    assert.equal(started.status(), 200, await started.text());
    const { token } = await started.json();
    attempts.push(JSON.parse(Buffer.from(token.split('.')[0], 'base64url')).id);
    const completed = await guest.request.post(base + `/api/forms/${ids[0]}/submit`, { data: { token, answers: Object.fromEntries(forms[0].questions.map(q => [q.id, 'a0'])), contact: { name: 'Synthetic Participant', email: 'batch8-accessibility@example.com', marketingConsent: false } }, headers });
    assert.equal(completed.status(), 200, await completed.text());
    assert.equal((await guest.request.post(base + `/api/forms/${ids[0]}/progress`, { data: { token, event: 'result_view' }, headers })).status(), 200);
    await page.addInitScript(id => localStorage.setItem('pippi-editor-mode:' + id, 'advanced'), ids[0]);
    await page.goto(base + '/editor/' + ids[0]);
    await activate(page.getByRole('button', { name: 'Contacts', exact: true }));
    const directory = page.getByRole('region', { name: 'Contact directory', exact: true });
    await directory.getByRole('heading', { name: 'Contacts (1)', exact: true }).waitFor();
    await activate(directory.getByRole('button', { name: /^More filters/ }));
    await directory.getByLabel('Filter start source', { exact: true }).selectOption('utm:accessible-campaign');
    const category = directory.getByLabel('Filter saved category', { exact: true });
    await category.selectOption(await category.locator('option').nth(1).getAttribute('value'));
    await widths('contact-filters', directory.getByRole('button', { name: /^More filters/ }));
    await category.focus(); await page.keyboard.press('Escape');
    assert.equal(await directory.getByRole('button', { name: /^More filters/ }).evaluate(el => el === document.activeElement), true);
    assert.equal(await directory.getByRole('button', { name: /^More filters/ }).getAttribute('aria-expanded'), 'false');
    await activate(directory.locator('[data-contact-row] > summary'));
    const activity = directory.getByRole('region', { name: 'Recorded response activity', exact: true });
    await activity.getByText('First recorded result interaction', { exact: true }).waitFor();
    await widths('contact-activity', activity);

    await page.goto(base + '/experiments');
    await page.getByLabel('Test name', { exact: true }).fill('Synthetic accessible plan ' + prefix);
    await page.getByLabel('Version A', { exact: true }).selectOption(ids[0]);
    await page.getByLabel('Version B', { exact: true }).selectOption(ids[1]);
    await page.getByRole('checkbox', { name: 'Record a test plan before launch (recommended)', exact: true }).check();
    await page.getByLabel('Hypothesis', { exact: true }).fill('Clearer questions may help visitors finish their quiz.');
    await page.getByLabel('Intended one change', { exact: true }).fill('Make the first question shorter while preserving the answer choices.');
    await page.getByRole('combobox', { name: /^Primary metric/ }).selectOption('leads');
    await page.getByLabel('Completion floor (%) — optional', { exact: false }).fill('60');
    await page.getByLabel('Review date (UTC) — optional', { exact: false }).fill('2026-10-20');
    await widths('experiment-plan', page.getByRole('heading', { name: 'Create an A/B test', exact: true }));
    await activate(page.getByRole('button', { name: 'Review test plan', exact: true }));
    const review = page.getByRole('region', { name: 'Review before launching', exact: true });
    await review.waitFor();
    assert.equal(await review.getByRole('heading').evaluate(el => el === document.activeElement), true);
    await widths('experiment-review', review);
    await review.getByRole('heading').focus(); await page.keyboard.press('Escape');
    await review.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.textContent === 'Review test plan', null, { timeout: 2000 });
    assert.equal(await page.getByRole('button', { name: 'Review test plan', exact: true }).evaluate(el => el === document.activeElement), true);
    await activate(page.getByRole('button', { name: 'Review test plan', exact: true }));
    const created = page.waitForResponse(r => r.url() === base + '/api/experiments' && r.request().method() === 'POST');
    await activate(page.getByRole('button', { name: 'Confirm and launch test', exact: true }));
    const response = await created; assert.equal(response.status(), 201, await response.text());
    experiments.push((await response.json()).id);
    const title = page.getByRole('heading', { name: 'Synthetic accessible plan ' + prefix, exact: true });
    await title.waitFor();
    await widths('experiment-results', title);
    const table = page.getByRole('region', { name: 'Results for Synthetic accessible plan ' + prefix, exact: true });
    await table.focus(); const before = await table.evaluate(el => el.scrollLeft); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(name => [...document.querySelectorAll('[role="region"]')].some(el => el.getAttribute('aria-label') === name && el.scrollLeft > 0), 'Results for Synthetic accessible plan ' + prefix);
    assert.ok(await table.evaluate(el => el.scrollLeft) > before, 'Narrow experiment table scrolls by keyboard');
    assert.deepEqual(errors, []);
    const violations = scans.flatMap(s => s.violations.map(v => ({ name: s.name, ...v })));
    console.log(JSON.stringify({ scans: scans.length, violations, incomplete: scans.filter(s => s.incomplete.length).map(s => ({ name: s.name, findings: s.incomplete })) }, null, 2));
    assert.equal(violations.length, 0, 'Review automated A/AA findings');
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(artifacts, 'failure.txt'), await page.locator('body').innerText().catch(() => ''));
    throw error;
  } finally {
    for (const id of experiments) await removeRecord('experiments', id, 'local');
    for (const id of attempts) { await removeRecord('submissions', id, 'local'); await removeRecord('attempts', id, 'local'); }
    for (const id of ids) await owner.request.delete(base + '/api/forms/' + id, { headers }).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
