/* Synthetic compiled-app accessibility smoke checks; not a screen-reader audit. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Use the isolated localhost application.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/editor-accessibility');
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const id = 'qa-editor-accessibility-' + Date.now(), headers = { Origin: base };
  const page = await owner.newPage(), scans = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function contactsReady() {
    await page.getByRole('heading', { name: 'Contacts (0)', exact: true }).waitFor();
    await page.getByRole('region', { name: 'Saved result links', exact: true }).getByText('0 matching responses · 0 retained responses. Status totals above include the whole quiz.', { exact: true }).waitFor();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Refresh' && !button.disabled));
  }
  async function scan(name) {
    // Inspect the settled enabled state, not the brief opacity interpolation
    // from a disabled loading button. Avoid hiding actual contrast failures.
    await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime < 2000).map(animation => animation.finished)));
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const results = await page.evaluate(async () => {
      const report = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return { violations: report.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, helpUrl: v.helpUrl, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })) })), incomplete: report.incomplete.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })) };
    });
    scans.push({ name, ...results });
    await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: false });
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(scans, null, 2));
  }
  try {
    assert.equal((await owner.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
    const created = await owner.request.post(base + '/api/forms', { data: { id, title: 'Accessible quiz workspace', mode: 'survey', questions: [{ id: 'question', type: 'multiple_choice', title: 'What would help you most?', options: [{ id: 'clarity', label: 'A clearer next step' }, { id: 'support', label: 'More support' }] }] }, headers });
    assert.equal(created.status(), 201, await created.text());
    await page.addInitScript(id => localStorage.setItem(`pippi-editor-mode:${id}`, 'advanced'), id);
    await page.goto(base + '/editor/' + id);
    await page.getByRole('button', { name: 'Contacts', exact: true }).click();
    await contactsReady();
    await scan('desktop-contacts');
    await page.getByRole('button', { name: 'Results', exact: true }).click();
    await page.getByRole('region', { name: 'Conversion analytics', exact: true }).getByRole('heading').first().waitFor();
    await scan('desktop-results');
    await page.getByRole('button', { name: 'Contacts', exact: true }).click();
    await contactsReady();
    await page.setViewportSize({ width: 390, height: 844 });
    await scan('mobile-contacts');
    if (process.env.QA_PRE_BATCH4 !== '1') {
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByRole('dialog', { name: 'Editor tools', exact: true }).waitFor();
      await scan('mobile-editor-tools');
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button', { name: 'More', exact: true }).evaluate(e => e === document.activeElement), true);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile viewport has no horizontal page overflow');
    assert.deepEqual(errors, []);
    const failures = scans.flatMap(s => s.violations.map(v => ({ scan: s.name, id: v.id, impact: v.impact, nodes: v.nodes.length })));
    console.log(JSON.stringify({ scans: scans.map(s => s.name), violations: failures, manualReviewItems: scans.map(s => ({ scan: s.name, count: s.incomplete.length })) }, null, 2));
    assert.equal(failures.length, 0, 'Automated WCAG A/AA violations require review');
  } finally {
    await owner.request.delete(base + '/api/forms/' + id, { headers }).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
