// Synthetic owner quiz + mocked contact responses only. No public starts, emails, or providers.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { randomUUID, createHash } = require('node:crypto');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { removeRecord, cloudEnabled } = require('../lib/records.ts');
const { contactResultKey } = require('../lib/contact-filters.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR || cloudEnabled()) throw Error('Dedicated local synthetic data only.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-13/contact-result-retention');
fs.mkdirSync(artifacts, { recursive: true });
function csvRows(csv) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') { if (quoted && csv[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (char === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage(), formId = 'qa-result-retention-' + randomUUID(), headers = { Origin: base };
  const endpoint = base + '/api/forms/' + formId + '/contacts', errors = [], downloads = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', download => downloads.push(download));
  const rows = [0, 1, 2].map(index => ({
    id: randomUUID(), formId, submittedAt: new Date(Date.now() - 60000 + index * 1000).toISOString(),
    totalQuestions: 1, totalPointsPossible: 1, totalPointsEarned: 1, percentageScore: 100, grading: [], answers: {},
    contact: { name: `Synthetic contact ${index}`, email: `contact-${index}@example.test`, marketingConsent: false },
    matchedTier: { id: index < 2 ? 'earlier' : 'other', title: index < 2 ? 'Earlier plan' : 'Another plan', message: 'Synthetic retained result' },
  }));
  const selectedKey = contactResultKey(rows[0]);
  const payload = contacts => ({
    contacts,
    contextByResponse: Object.fromEntries(contacts.map(row => [row.id, { source: 'unknown', campaign: 'unknown', history: 'unavailable', incomplete: false, activity: [] }])),
    answerCohort: { versions: [], omittedVersions: 0, unavailableSnapshots: contacts.length, selection: null, counts: null, matchingIds: [] },
  });
  let responseBody = payload(rows), responseStatus = 200, heldRoute, releaseSeen;
  await page.route(endpoint, route => {
    if (releaseSeen) { heldRoute = route; const seen = releaseSeen; releaseSeen = null; seen(); return; }
    return route.fulfill({ status: responseStatus, json: responseBody });
  });
  const directory = page.getByRole('region', { name: 'Contact directory', exact: true });
  const resultSelect = directory.getByLabel('Filter saved result', { exact: true });
  const exportButton = directory.getByRole('button', { name: 'Export CSV', exact: true });
  const warning = directory.getByText('The selected result is no longer present in loaded contact history. This filter is still active; clear or change it to see other contacts.', { exact: true });
  async function waitLoaded(count) {
    await directory.getByRole('heading', { name: `Contacts (${count})`, exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Contact directory"]')?.getAttribute('aria-busy') === 'false');
  }
  async function assertExactCsv(filename) {
    const downloaded = page.waitForEvent('download'); await exportButton.click();
    const download = await downloaded, file = path.join(artifacts, filename); await download.saveAs(file);
    const csv = csvRows(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(csv.length, 3, 'CSV contains only the two selected historical-result contacts');
    assert.deepEqual(new Set(csv.slice(1).map(row => row[csv[0].indexOf('responseId')])), new Set(rows.slice(0, 2).map(row => row.id)));
  }
  async function refreshMissing() {
    responseBody = payload([rows[2]]); responseStatus = 200;
    await directory.getByRole('button', { name: 'Refresh', exact: true }).click(); await waitLoaded(0);
    assert.equal(await directory.locator('[data-contact-row]').count(), 0);
    assert.equal(await resultSelect.inputValue(), selectedKey, 'missing historical result must remain the visibly selected value');
    assert.equal(await resultSelect.locator('option:checked').textContent(), 'Previously selected result (0)');
    await warning.waitFor(); assert.ok(await exportButton.isDisabled());
  }
  try {
    assert.equal((await context.request.post(base + '/api/auth', { headers, data: { local: true } })).status(), 200);
    assert.equal((await context.request.post(base + '/api/forms', { headers, data: { id: formId, title: 'Historical result retention QA', mode: 'survey', questions: [{ id: 'q', type: 'short_answer', title: 'Synthetic question' }] } })).status(), 201);
    await page.goto(base + '/editor/' + formId); await page.getByRole('button', { name: 'Contacts', exact: true }).click(); await waitLoaded(3);
    await resultSelect.selectOption(selectedKey); await waitLoaded(2); await assertExactCsv('before-refresh.csv');
    // Hold a refresh to prove no stale CSV can be downloaded during replacement.
    const intercepted = new Promise(resolve => releaseSeen = resolve);
    await directory.getByRole('button', { name: 'Refresh', exact: true }).click(); await intercepted;
    assert.ok(await exportButton.isDisabled()); assert.equal(await resultSelect.inputValue(), selectedKey);
    await heldRoute.fulfill({ status: 200, json: payload([rows[2]]) }); heldRoute = null; await waitLoaded(0);
    assert.equal(await resultSelect.inputValue(), selectedKey, 'missing historical result must remain the visibly selected value');
    assert.equal(await resultSelect.locator('option:checked').textContent(), 'Previously selected result (0)');
    await warning.waitFor(); assert.equal(await directory.locator('[data-contact-row]').count(), 0); assert.ok(await exportButton.isDisabled());
    assert.equal(downloads.length, 1, 'refresh/missing selection never starts an export');
    await directory.getByRole('group', { name: 'Contact filters', exact: true }).screenshot({ path: path.join(artifacts, 'missing-result-desktop.png') });
    responseBody = payload(rows); await directory.getByRole('button', { name: 'Refresh', exact: true }).click(); await waitLoaded(2);
    assert.equal(await resultSelect.inputValue(), selectedKey); assert.equal(await resultSelect.locator('option:checked').textContent(), 'Earlier plan (2)');
    assert.equal(await warning.count(), 0); assert.equal(await exportButton.isDisabled(), false); await assertExactCsv('restored.csv');
    // Failed and malformed refreshes retain the selection but keep the existing export gate closed.
    responseStatus = 503; responseBody = { error: 'Synthetic contact refresh failure' };
    await directory.getByRole('button', { name: 'Refresh', exact: true }).click(); await directory.getByText('Synthetic contact refresh failure', { exact: true }).waitFor();
    assert.equal(await resultSelect.inputValue(), selectedKey); assert.equal(await directory.locator('[data-contact-row]').count(), 2); assert.ok(await exportButton.isDisabled());
    responseStatus = 200; responseBody = { contacts: [rows[2]] };
    await directory.getByRole('button', { name: 'Try loading again', exact: true }).click(); await directory.getByText('The contact history could not be read. Please refresh.', { exact: true }).waitFor();
    assert.equal(await resultSelect.inputValue(), selectedKey); assert.ok(await exportButton.isDisabled());
    responseBody = payload(rows); await directory.getByRole('button', { name: 'Try loading again', exact: true }).click(); await waitLoaded(2);
    assert.equal(await exportButton.isDisabled(), false);
    // Late response from an unmounted directory cannot overwrite the newer mount or its chosen filter.
    const staleIntercepted = new Promise(resolve => releaseSeen = resolve);
    await directory.getByRole('button', { name: 'Refresh', exact: true }).click(); await staleIntercepted; assert.ok(await exportButton.isDisabled());
    await page.getByRole('button', { name: 'Results', exact: true }).click(); await page.getByRole('button', { name: 'Contacts', exact: true }).click(); await waitLoaded(3);
    await resultSelect.selectOption(selectedKey); await waitLoaded(2);
    await heldRoute.fulfill({ status: 200, json: payload([rows[2]]) }).catch(() => {}); heldRoute = null;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await waitLoaded(2); assert.equal(await resultSelect.inputValue(), selectedKey); assert.equal(await warning.count(), 0); await assertExactCsv('after-stale-response.csv');
    await page.setViewportSize({ width: 390, height: 844 }); await refreshMissing();
    await directory.getByRole('group', { name: 'Contact filters', exact: true }).screenshot({ path: path.join(artifacts, 'missing-result-mobile.png') });
    assert.ok(await resultSelect.evaluate(element => element.getBoundingClientRect().width <= window.innerWidth));
    assert.equal(downloads.length, 3); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ passed: true, syntheticContacts: 3, publicStarts: 0, downloads: 3, pageErrors: errors, checks: ['missing selection retained visibly', 'zero matches cannot broaden/export', 'option restoration', 'loading/failed/malformed refresh export gates', 'stale unmounted response ignored', 'exact CSV membership before/restored/after-stale', 'mobile selection'] }, null, 2));
    console.log('PASS historical result retention: missing selected option stays explicit, zero rows/no CSV broadening, restored exact membership, loading/503/malformed/stale refresh gates, three exact CSV exports and 390px view. Three synthetic mocked contacts; zero public starts.');
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
  } finally {
    if (heldRoute) await heldRoute.abort().catch(() => {});
    await context.request.delete(base + '/api/forms/' + formId, { headers }).catch(() => {});
    await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', formId])).digest('hex'), 'local');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
