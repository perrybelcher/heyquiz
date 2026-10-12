// Synthetic owner workflow: select a contact without copying an internal ID.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID, createHash } = require('node:crypto'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { readRecord, writeRecord, removeRecord, cloudEnabled } = require('../lib/records.ts');
const { makeResultReport, resultLinkReceiptId } = require('../lib/result-reports.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR || cloudEnabled()) throw Error('Dedicated local fixture directory required.');
const artifactDir = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/contact-result-links'); fs.mkdirSync(artifactDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }), owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await owner.newPage();
  const formId = 'qa-contact-link-' + Date.now(), headers = { Origin: base }, ids = [randomUUID(), randomUUID()], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    assert.equal((await owner.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
    assert.equal((await owner.request.post(base + '/api/forms', { data: { id: formId, title: 'Contact link selection', mode: 'survey', questions: [{ id: 'q', type: 'short_answer', title: 'What would help?' }] }, headers })).status(), 201);
    const form = (await readRecord('forms', formId)).payload;
    for (let i = 0; i < ids.length; i++) {
      const label = i ? 'Casey Example' : 'Avery Example', result = { id: ids[i], formId, submittedAt: new Date(Date.now() - i * 60000).toISOString(), totalQuestions: 1, totalPointsPossible: 0, totalPointsEarned: 0, percentageScore: 0, grading: [], answers: {}, contact: { name: label, email: `${i ? 'casey' : 'avery'}@example.test`, marketingConsent: false } };
      await writeRecord('submissions', ids[i], 'local', result, 0);
      await writeRecord('result_reports', 'result-' + ids[i], 'local', makeResultReport(form, result, ids[i]), 0);
    }
    const firstListing = await (await owner.request.get(`${base}/api/forms/${formId}/report-links?responseId=${ids[0]}`)).json();
    await page.goto(base + '/editor/' + formId);
    await page.getByRole('button', { name: 'Contacts', exact: true }).click();
    const directory = page.getByRole('region', { name: 'Contact directory', exact: true }), manager = page.getByRole('region', { name: 'Saved result links', exact: true });
    await directory.getByRole('heading', { name: 'Contacts (2)', exact: true }).waitFor();
    await manager.getByText('2 matching responses · 2 retained responses. Status totals above include the whole quiz.', { exact: true }).waitFor();
    let held, holdReady; const pendingRoute = new Promise(resolve => { holdReady = resolve; });
    await page.route('**/report-links?*', route => {
      if (new URL(route.request().url()).searchParams.get('responseId') === ids[0] && !held) { held = route; holdReady(); return; }
      return route.continue();
    });
    await directory.getByLabel('Search contacts', { exact: true }).fill('Avery');
    await directory.locator('[data-contact-row] summary').click();
    const manage = directory.getByRole('button', { name: 'Manage saved result link', exact: true });
    await manage.focus(); await page.keyboard.press('Enter'); await pendingRoute;
    await manager.getByText('Selected contact: Avery Example', { exact: true }).waitFor();
    assert.ok(await manager.getByRole('heading', { name: 'Saved result links', exact: true }).evaluate(e => e === document.activeElement));
    await directory.locator('[data-contact-row] summary').click();
    assert.equal(await directory.locator('[data-contact-row]').evaluate(e => e.open), false);
    await manager.getByRole('button', { name: 'Back to contact details', exact: true }).click();
    assert.equal(await directory.locator('[data-contact-row]').evaluate(e => e.open), true);
    assert.ok(await manage.evaluate(e => e === document.activeElement));
    assert.equal(await directory.getByLabel('Search contacts', { exact: true }).inputValue(), 'Avery');
    await directory.getByLabel('Search contacts', { exact: true }).fill('Casey');
    await directory.locator('[data-contact-row] summary').click(); await manage.click();
    await manager.getByText('Selected contact: Casey Example', { exact: true }).waitFor();
    await manager.locator(`[data-result-link-row="${ids[1]}"]`).waitFor();
    await held.fulfill({ status: 200, json: firstListing }).catch(() => {});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await manager.locator('[data-result-link-row]').count(), 1);
    assert.equal(await manager.locator('[data-result-link-row]').getAttribute('data-result-link-row'), ids[1]);
    page.once('dialog', dialog => { assert.ok(dialog.message().includes('Casey Example')); return dialog.dismiss(); });
    await manager.getByRole('button', { name: /Revoke link for response/ }).click();
    assert.equal(await readRecord('result_report_link_revocations', resultLinkReceiptId(formId, 'local', ids[1])), null);
    page.once('dialog', dialog => dialog.accept()); await manager.getByRole('button', { name: /Revoke link for response/ }).click();
    await manager.getByText('Saved link permanently revoked. The quiz response is still available.', { exact: true }).waitFor();
    assert.ok(await readRecord('result_report_link_revocations', resultLinkReceiptId(formId, 'local', ids[1])));
    assert.equal(await readRecord('result_report_link_revocations', resultLinkReceiptId(formId, 'local', ids[0])), null);
    assert.ok(await readRecord('submissions', ids[1]));
    await page.setViewportSize({ width: 390, height: 844 });
    await manager.getByRole('heading', { name: 'Saved result links', exact: true }).scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(artifactDir, 'selected-contact-mobile.png') });
    await manager.getByRole('button', { name: 'Show all responses', exact: true }).click();
    await manager.getByText('2 matching responses · 2 retained responses. Status totals above include the whole quiz.', { exact: true }).waitFor();
    assert.equal(await manager.getByText('Selected contact: Casey Example', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS contact-to-result selection, keyboard focus/return, preserved contact filters, delayed previous response isolation, named cancel/confirm target, other response protection and mobile width.');
  } catch (error) { await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
  finally {
    await owner.request.delete(base + '/api/forms/' + formId, { headers }).catch(() => {});
    for (const id of ids) { await removeRecord('submissions', id, 'local'); await removeRecord('result_reports', 'result-' + id, 'local'); await removeRecord('result_report_link_revocations', resultLinkReceiptId(formId, 'local', id), 'local'); }
    await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', formId])).digest('hex'), 'local');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
