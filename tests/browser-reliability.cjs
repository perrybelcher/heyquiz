// Compiled local application only. No provider credentials or live data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/, 'Explicit isolated loopback server required');
assert.ok(process.env.HEYQUIZ_DATA_DIR, 'Explicit isolated records directory required');
const artifacts = process.env.ARTIFACT_DIR;
assert.ok(artifacts, 'Explicit artifact directory required');
fs.mkdirSync(artifacts, { recursive: true });
const headers = { Origin: base };
let browser, context, checks = 0;
const created = [];
const title = page => page.getByRole('textbox', { name: 'Quiz name', exact: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function read(id) { const response = await context.request.get(`${base}/api/forms/${id}`); assert.equal(response.status(), 200); return response.json(); }
async function waitSaved(id, expected) {
  for (let n = 0; n < 120; n++) {
    const response = await context.request.get(`${base}/api/forms/${id}`);
    if (response.status() === 200 && (await response.json()).title === expected) return;
    assert.ok([200, 401, 503].includes(response.status()), 'Unexpected account read status');
    await pause(100);
  }
  assert.fail(`Expected saved title ${expected}`);
}
async function signOutFromProfile(page) {
  const button = page.getByRole('button', { name: 'Sign out', exact: true });
  if (!(await button.isVisible())) await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await button.click();
}
async function login() { const response = await context.request.post(base + '/api/auth', { headers, data: { local: true } }); assert.equal(response.status(), 200); }
async function fixture(label, extra = {}) {
  const id = 'qa-reliability-' + label + '-' + Date.now();
  const response = await context.request.post(base + '/api/forms', { headers, data: { id, title: 'Original ' + label, mode: 'survey', questions: [{ id: 'q', title: 'Question', type: 'short_answer' }], ...extra } });
  assert.equal(response.status(), 201, await response.text()); created.push(id);
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(id => localStorage.setItem('pippi-editor-mode:' + id, 'advanced'), id);
  await page.goto(`${base}/editor/${id}`);
  await title(page).waitFor();
  return { id, page };
}
async function check(name, fn) { await fn(); checks++; console.log('PASS', name); }
(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext();
  context.setDefaultTimeout(12000);
  await login();
  await check('normal saves acknowledge current draft without publication', async () => {
    const { id, page } = await fixture('normal');
    await title(page).fill('Normal saved edits'); await waitSaved(id, 'Normal saved edits');
    await page.getByText(/^Saved to your account/).filter({visible:true}).first().waitFor();
    assert.equal((await context.request.get(`${base}/play/${id}`)).status(), 404);
    await page.close();
  });
  await check('expired sign-in pauses editing; inline sign-in resumes the same draft only', async () => {
    const { id, page } = await fixture('expired');
    await context.clearCookies();
    await title(page).fill('Edits before authentication recovery');
    const dialog = page.getByRole('dialog').filter({ hasText: 'Sign in to continue editing' });
    await dialog.waitFor();
    assert.equal(await page.locator('[aria-label="Quiz editor"]').getAttribute('inert'), '');
    assert.ok(await page.evaluate(id => Object.keys(localStorage).some(key => key.startsWith('pippi-draft:v2:') && key.includes(id)), id));
    await page.screenshot({ path: path.join(artifacts, 'paused-sign-in.png'), fullPage: false });
    await dialog.getByRole('button', { name: 'Open local workspace', exact: true }).click();
    await waitSaved(id, 'Edits before authentication recovery');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(page.url(), `${base}/editor/${id}`);
    assert.equal((await context.request.get(`${base}/play/${id}`)).status(), 404);
    await page.close();
  });
  await check('temporary save failure retains a persistent copy and hidden tabs do not retry', async () => {
    const { id, page } = await fixture('outage'); let writes = 0;
    await page.route(`**/api/forms/${id}`, route => {
      if (route.request().method() !== 'PUT') return route.continue();
      writes++; return route.fulfill({ status: 503, headers: { 'Retry-After': '2' }, json: { error: 'Synthetic storage outage' } });
    });
    await title(page).fill('Protected during outage');
    await page.getByText('Synthetic storage outage', { exact: false }).first().waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Sign in to continue editing' }).count(), 0);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const before = writes; await pause(2500); assert.equal(writes, before);
    await page.screenshot({ path: path.join(artifacts, 'protected-storage-outage.png'), fullPage: false });
    await page.unroute(`**/api/forms/${id}`);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await waitSaved(id, 'Protected during outage'); await page.close();
  });
  await check('closing and reopening restores one matching-revision device draft automatically', async () => {
    const { id, page } = await fixture('reopen');
    const block = route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic reopen outage' } }) : route.continue();
    await context.route(`**/api/forms/${id}`, block);
    await title(page).fill('Recover after closing');
    await page.getByText('Synthetic reopen outage', { exact: false }).first().waitFor();
    await page.close();
    const reopened = await context.newPage(); reopened.on('dialog', dialog => dialog.accept());
    await reopened.goto(`${base}/editor/${id}`);
    await title(reopened).waitFor();
    await assert.doesNotReject(async () => { for (let n = 0; n < 80; n++) { if (await title(reopened).inputValue() === 'Recover after closing') return; await pause(100); } assert.fail('Device draft was not restored'); });
    await context.unroute(`**/api/forms/${id}`, block);
    await reopened.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitSaved(id, 'Recover after closing'); await reopened.close();
  });
  await check('newer server revision is not overwritten by a recovered older draft', async () => {
    const { id, page } = await fixture('conflict');
    await page.route(`**/api/forms/${id}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic pending draft' } }) : route.continue());
    await title(page).fill('Older pending device edits'); await page.getByText('Synthetic pending draft', { exact: false }).first().waitFor();
    const original = await read(id);
    const update = await context.request.put(`${base}/api/forms/${id}`, { headers, data: { ...original, title: 'Newer server edits' } }); assert.equal(update.status(), 200);
    await page.reload(); await title(page).waitFor();
    await page.getByRole('button', { name: 'Restore changes', exact: true }).waitFor();
    assert.equal(await title(page).inputValue(), 'Newer server edits'); assert.equal((await read(id)).title, 'Newer server edits');
    await page.screenshot({ path: path.join(artifacts, 'recovery-conflict.png'), fullPage: false }); await page.close();
  });
  await check('response lost after commit is reconciled without a duplicate write', async () => {
    const { id, page } = await fixture('receipt'); let writes = 0;
    await page.route(`**/api/forms/${id}`, async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      writes++; await route.fetch(); await route.abort('failed');
    });
    await title(page).fill('Committed despite lost acknowledgment');
    await waitSaved(id, 'Committed despite lost acknowledgment'); await page.getByText(/^Saved to your account/).filter({visible:true}).first().waitFor();
    assert.equal(writes, 1); await page.close();
  });
  await check('different signed-in account pauses without writing the original draft', async () => {
    const { id, page } = await fixture('account'); let writes = 0;
    await page.route(`**/api/forms/${id}`, route => { if (route.request().method() === 'PUT') writes++; return route.continue(); });
    await page.route('**/api/auth/session', route => route.fulfill({ status: 200, json: { state: 'authenticated', accountKey: 'different-account', expiresAt: Date.now() + 3600000 } }));
    await title(page).fill('Original account pending draft');
    await page.getByText('A different account is signed in.', { exact: false }).waitFor();
    assert.equal(writes, 0); assert.equal((await read(id)).title, 'Original account');
    await page.unroute('**/api/auth/session');
    await page.getByRole('button', { name: 'Check sign-in again', exact: true }).click();
    await waitSaved(id, 'Original account pending draft'); await page.close();
  });
  await check('unavailable persistent storage is reported and draft export remains available', async () => {
    const { id, page } = await fixture('storage');
    await page.addInitScript(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (this === localStorage && (key.startsWith('pippi-draft:') || key.startsWith('heyquiz-draft:'))) throw new DOMException('Synthetic quota', 'QuotaExceededError'); return set.call(this, key, value); }; });
    await page.reload();
    await page.route(`**/api/forms/${id}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic tab-only outage' } }) : route.continue());
    await title(page).fill('Tab-only protected edits');
    await page.getByRole('button', { name: /Export.*draft/i }).waitFor();
    await context.clearCookies();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const dialog = page.getByRole('dialog').filter({ hasText: 'Sign in to continue editing' });
    await dialog.waitFor();
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export draft', exact: true }).click();
    const download = await downloadPromise; const exported = await download.path();
    assert.equal(JSON.parse(fs.readFileSync(exported, 'utf8')).title, 'Tab-only protected edits');
    await page.screenshot({ path: path.join(artifacts, 'backup-warning.png'), fullPage: false }); await page.close(); await login();
  });
  await check('temporarily invalid numeric edits remain recoverable and do not crash the editor', async () => {
    const { id, page } = await fixture('numeric', { questions: [{ id: 'q', type: 'image_upload', title: 'Image upload', maxFileSizeMB: 10 }] });
    const size = page.getByText('Max MB', { exact: true }).locator('..').getByRole('spinbutton');
    await size.fill('');
    await title(page).fill('Other edits during numeric correction');
    await pause(850);
    assert.equal(await page.getByRole('heading', { name: 'Something interrupted this page.' }).count(), 0);
    assert.equal(await title(page).inputValue(), 'Other edits during numeric correction');
    assert.ok(await page.evaluate(id => Object.keys(localStorage).some(key => key.startsWith('pippi-draft:v2:') && key.includes(id) && (localStorage.getItem(key) || '').includes('Other edits during numeric correction')), id));
    await size.fill('5'); await waitSaved(id, 'Other edits during numeric correction');
    assert.equal((await read(id)).questions[0].maxFileSizeMB, 5); await page.close();
  });
  await check('cross-tab logout can be cancelled or retain an unsynced original-account draft', async () => {
    await context.close(); context = await browser.newContext(); context.setDefaultTimeout(12000); await login();
    const { id, page } = await fixture('logout-retain');
    await page.route(`**/api/forms/${id}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic logout outage' } }) : route.continue());
    await title(page).fill('Retained through explicit logout'); await page.getByText('Synthetic logout outage', { exact: false }).first().waitFor();
    const dashboard = await context.newPage(); await dashboard.goto(base + '/');
    await signOutFromProfile(dashboard);
    const choice = dashboard.getByRole('dialog', { name: 'Unsynced changes before sign-out' });
    await choice.waitFor(); await choice.getByRole('button', { name: 'Cancel logout', exact: true }).click();
    assert.equal((await context.request.get(`${base}/api/forms/${id}`)).status(), 200);
    assert.equal(await title(page).inputValue(), 'Retained through explicit logout');
    await signOutFromProfile(dashboard); await choice.waitFor();
    await choice.getByRole('button', { name: 'Sign out and retain the device draft', exact: true }).click();
    await dashboard.waitForURL(base + '/login');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const auth = page.getByRole('dialog').filter({ hasText: 'Sign in to continue editing' }); await auth.waitFor();
    assert.ok(await page.evaluate(id => Object.keys(localStorage).some(key => key.startsWith('pippi-draft:v2:') && key.includes(id)), id));
    await page.unroute(`**/api/forms/${id}`);
    await auth.getByRole('button', { name: 'Open local workspace', exact: true }).click(); await waitSaved(id, 'Retained through explicit logout');
    await page.close(); await dashboard.close();
  });
  await check('logout retry finishes saving before clearing authentication', async () => {
    await context.close(); context = await browser.newContext(); context.setDefaultTimeout(12000); await login();
    const { id, page } = await fixture('logout-retry');
    await page.route(`**/api/forms/${id}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic retry logout outage' } }) : route.continue());
    await title(page).fill('Saved before confirmed logout'); await page.getByText('Synthetic retry logout outage', { exact: false }).first().waitFor();
    const dashboard = await context.newPage(); await dashboard.goto(base + '/');
    await signOutFromProfile(dashboard);
    const choice = dashboard.getByRole('dialog', { name: 'Unsynced changes before sign-out' }); await choice.waitFor();
    await page.unroute(`**/api/forms/${id}`);
    await choice.getByRole('button', { name: 'Retry', exact: true }).click();
    await dashboard.waitForURL(base + '/login');
    await login(); assert.equal((await read(id)).title, 'Saved before confirmed logout');
    await page.close(); await dashboard.close();
  });
  await check('a fully expired reload returns to the original editor after sign-in', async () => {
    const { id, page } = await fixture('reload-login');
    await page.route(`**/api/forms/${id}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic expired reload outage' } }) : route.continue());
    await title(page).fill('Recover after full-session expiry'); await page.getByText('Synthetic expired reload outage', { exact: false }).first().waitFor();
    await context.clearCookies(); await page.reload();
    await page.waitForURL(base + '/login?next=' + encodeURIComponent('/editor/' + id));
    await page.getByRole('button', { name: 'Open local workspace', exact: true }).click();
    await page.waitForURL(`${base}/editor/${id}`); await title(page).waitFor();
    for (let n = 0; n < 80 && await title(page).inputValue() !== 'Recover after full-session expiry'; n++) await pause(100);
    assert.equal(await title(page).inputValue(), 'Recover after full-session expiry');
    await page.unroute(`**/api/forms/${id}`); await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitSaved(id, 'Recover after full-session expiry'); await page.close();
  });
  await check('guest drafts remain device-only and survive reload without a false account save', async () => {
    await context.close(); context = await browser.newContext(); context.setDefaultTimeout(12000);
    const page = await context.newPage(); page.on('dialog', dialog => dialog.accept());
    await page.goto(base + '/create/blank'); await page.getByRole('button', { name: 'Advanced', exact: true }).click();
    await title(page).fill('Guest device recovery');
    await page.getByText('Saved on this device · Not synced', { exact: false }).filter({visible:true}).first().waitFor();
    assert.equal(await page.getByText(/^Saved to your account/).count(), 0);
    await page.reload(); await page.getByRole('button', { name: 'Advanced', exact: true }).click();
    await title(page).waitFor(); assert.equal(await title(page).inputValue(), 'Guest device recovery');
    assert.equal(await page.getByText(/^Saved to your account/).count(), 0); await page.close();
  });
  console.log(`${checks} compiled-browser reliability journeys passed; local synthetic records only.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (context) { await context.unrouteAll({ behavior: 'ignoreErrors' }); await login().catch(() => {}); for (const id of created) await context.request.delete(`${base}/api/forms/${id}`, { headers }).catch(() => {}); }
  if (browser) await browser.close();
});
