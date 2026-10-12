/* Local guest account prompt acceptance. No real signup, provider, email or respondent start. */
const { chromium, firefox, webkit } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ts = require('typescript'), { createHash } = require('node:crypto');
require.extensions['.ts'] = (loaded, file) => loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { cloudEnabled, readRecord, removeRecord } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.HEYQUIZ_DATA_DIR, 'Explicit isolated data directory required');
assert.equal(cloudEnabled(), false);
for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) assert.ok(!process.env[key], 'Clear all cloud aliases');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-account-prompt-review-2026-10-12/browser');
fs.mkdirSync(artifacts, { recursive: true });
const engine = process.env.QA_BROWSER || 'chromium', browsers = { chromium, firefox, webkit };
assert.ok(browsers[engine]);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const savedText = 'A copy of your draft is saved on this device. It isn’t synced to your account yet.';
const warningText = 'A browser backup hasn’t been confirmed. Keep this tab open until your quiz is saved to your account.';
const results = [], scans = [];
(async () => {
  const browser = await browsers[engine].launch({ ...(engine === 'chromium' ? { channel: 'chrome' } : {}), headless: true });
  async function scenario(name, run, authenticated = false) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [], forbidden = [], requests = [], popups = [], releases = [];
    let cleanupId;
    page.setDefaultTimeout(15000);
    context.on('page', popup => { if (popup !== page) popups.push(popup); });
    context.on('page', current => current.on('pageerror', error => errors.push(error.message)));
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      if ((url.origin !== base && !['data:', 'blob:', 'about:'].includes(url.protocol)) || /^\/api\/(agent|ai)(?:\/|$)/.test(url.pathname) || /\/(start|submit|result-email)(?:\/|$)/.test(url.pathname)) {
        forbidden.push({ origin: url.origin, path: url.pathname }); return route.abort();
      }
      return route.continue();
    });
    page.on('request', req => { const url = new URL(req.url()); if (url.pathname === '/api/forms' && req.method() === 'POST') requests.push(req); });
    const headers = { Origin: base };
    try {
      if (authenticated) assert.equal((await context.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
      await page.goto(base + '/create/blank');
      const title = page.getByRole('textbox', { name: 'Quiz name', exact: true }); await title.waitFor();
      await title.fill('Account prompt ' + name + ' ' + engine);
      const draft = await page.waitForFunction(name => {
        const id = localStorage.getItem('pippi-guest-draft'), raw = id && localStorage.getItem('heyquiz-draft:' + id);
        return raw && JSON.parse(raw).title === name ? JSON.parse(raw) : null;
      }, 'Account prompt ' + name + ' ' + engine).then(handle => handle.jsonValue());
      cleanupId = draft.id;
      assert.equal(draft.questions.length, 0, 'An empty guest draft must reach account guidance before publish readiness');
      const snapshots = () => page.evaluate(id => ({ pointer: localStorage.getItem('pippi-guest-draft'), local: localStorage.getItem('heyquiz-draft:' + id), session: sessionStorage.getItem('heyquiz-draft:' + id) }), draft.id);
      const publish = () => page.locator('[data-publication-action="publish"]:visible').first();
      const account = () => page.locator('dialog[open]').filter({ has: page.getByRole('button', { name: 'Close account prompt', exact: true }) });
      async function unauthorized(trigger, expectedTitle) {
        const before = requests.length, response = page.waitForResponse(r => r.url() === base + '/api/forms' && r.request().method() === 'POST');
        await trigger.click(); assert.equal((await response).status(), 401);
        const modal = page.getByRole('dialog', { name: expectedTitle, exact: true }); await modal.waitFor();
        assert.equal(requests.length, before + 1); assert.equal(await page.locator('dialog[open]').count(), 1);
        assert.equal(await page.getByRole('dialog', { name: 'Ready to publish?', exact: true }).count(), 0);
        assert.equal(await page.locator('.hq-error').count(), 0); assert.equal(popups.length, 0, 'Auth tabs open only on explicit link click');
        return modal;
      }
      await run({ context, page, title, draft, headers, snapshots, publish, account, unauthorized, requests, popups, releases });
      assert.deepEqual(errors, [], 'No application errors'); assert.deepEqual(forbidden, [], 'No provider/generation/respondent traffic');
      results.push({ name, status: 'passed', claimRequests: requests.length, explicitAccountTabs: popups.length });
      console.log('PASS ' + name);
    } catch (error) {
      await page.screenshot({ path: path.join(artifacts, name + '-failure.png'), fullPage: true }).catch(() => {});
      const focus = await page.evaluate(() => ({ activeTag: document.activeElement?.tagName, activeText: document.activeElement?.textContent?.slice(0, 120), visible: !!document.activeElement?.getClientRects().length })).catch(() => null);
      fs.writeFileSync(path.join(artifacts, name + '-failure-focus.json'), JSON.stringify(focus, null, 2));
      throw error;
    } finally {
      releases.forEach(release => release());
      await page.close().catch(() => {});
      for (const popup of popups) await popup.close().catch(() => {});
      try {
        const row = cleanupId && await readRecord('forms', cleanupId);
        if (row) {
          assert.equal(row.owner_id, 'local');
          const removed = await context.request.delete(base + '/api/forms/' + cleanupId, { headers }); assert.equal(removed.status(), 200);
          const receiptId = createHash('sha256').update(JSON.stringify(['local', cleanupId])).digest('hex');
          const receipt = await readRecord('result_report_revocations', receiptId);
          if (receipt) { assert.equal(receipt.owner_id, 'local'); assert.deepEqual(Object.keys(receipt.payload), ['retiredAt']); assert.equal(await readRecord('forms', cleanupId), null); await removeRecord('result_report_revocations', receiptId, 'local'); }
        }
      } finally { await context.close(); }
    }
  }
  try {
    await scenario('guest-publish-save-return', async ({ context, page, draft, headers, snapshots, publish, account, unauthorized, requests, popups, releases }) => {
      const baseline = await snapshots();
      let modal = await unauthorized(publish(), 'Let your quiz meet its audience.');
      await modal.getByText(savedText, { exact: true }).waitFor();
      const primary = modal.getByRole('link', { name: /^Create free account/ });
      assert.equal(await primary.evaluate(el => el === document.activeElement), true);
      const controlCount = await modal.locator('button:not(:disabled), a[href]').count();
      for (let n = 0; n < controlCount; n++) { await page.keyboard.press('Tab'); assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true); }
      assert.equal(await primary.evaluate(el => el === document.activeElement), true, 'Tab wraps around every modal control');
      await page.keyboard.press('Shift+Tab'); assert.equal(await modal.getByRole('button', { name: 'Close account prompt', exact: true }).evaluate(el => el === document.activeElement), true);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        const appearance = await modal.evaluate(el => { const style = getComputedStyle(el); return { width: el.getBoundingClientRect().width, overflow: el.scrollWidth > el.clientWidth + 1, radius: parseFloat(style.borderTopLeftRadius), background: style.backgroundColor }; });
        assert.ok(appearance.width <= Math.min(width, 540) && !appearance.overflow, 'Modal is constrained to its designed width without horizontal overflow');
        assert.ok(appearance.radius >= 18, 'Account dialog stylesheet is applied'); assert.equal(appearance.background, 'rgb(255, 253, 249)', 'Account dialog has its intended warm paper background');
        const a11y = await modal.evaluate(el => window.axe.run(el, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
        scans.push({ width, violations: a11y.violations.map(v => v.id), incomplete: a11y.incomplete.map(v => v.id) }); assert.deepEqual(a11y.violations, []);
        await page.screenshot({ path: path.join(artifacts, 'publish-account-' + width + '.png') });
      }
      await page.keyboard.press('Escape'); await modal.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.matches('[data-publication-action="publish"]') && !!document.activeElement.getClientRects().length);
      assert.deepEqual(await snapshots(), baseline);
      await page.setViewportSize({ width: 1440, height: 1000 });
      modal = await unauthorized(page.getByRole('button', { name: 'Save my quiz', exact: true }), 'Keep your quiz moving.');
      await modal.getByRole('button', { name: 'Close account prompt', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.textContent === 'Save my quiz'); assert.deepEqual(await snapshots(), baseline);
      modal = await unauthorized(publish(), 'Let your quiz meet its audience.');
      await modal.getByRole('button', { name: 'Keep editing', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.matches('[data-publication-action="publish"]')); assert.deepEqual(await snapshots(), baseline);
      modal = await unauthorized(publish(), 'Let your quiz meet its audience.');
      // Duplicate clicks while a retry is pending share one request. A new 503 must not remain classified as 401.
      const held = deferred(), release = deferred(); releases.push(release.resolve); let hits = 0;
      await page.route(base + '/api/forms', async route => { if (route.request().method() !== 'POST') return route.continue(); hits++; held.resolve(); await release.promise; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic temporary save failure.' }) }); });
      await modal.getByRole('button', { name: 'Save to my account', exact: true }).evaluate(el => { el.click(); el.click(); }); await held.promise;
      assert.equal(hits, 1); assert.equal(await account().count(), 1); assert.equal(await modal.getByRole('button', { name: 'Saving…', exact: true }).isDisabled(), true);
      release.resolve(); await page.locator('.hq-error').getByText('Synthetic temporary save failure.', { exact: false }).waitFor(); assert.equal(await account().count(), 0); assert.deepEqual(await snapshots(), baseline);
      await page.unroute(base + '/api/forms');
      let response = page.waitForResponse(r => r.url() === base + '/api/forms' && r.request().method() === 'POST'); await page.locator('.hq-error').getByRole('button', { name: 'Retry save', exact: true }).click(); assert.equal((await response).status(), 401);
      modal = page.getByRole('dialog', { name: 'Keep your quiz moving.', exact: true }); await modal.waitFor(); assert.equal(await page.locator('.hq-error').count(), 0);
      await page.route(base + '/api/forms', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
      await modal.getByRole('button', { name: 'Save to my account', exact: true }).click(); await page.locator('.hq-error').getByRole('button', { name: 'Retry save', exact: true }).waitFor(); assert.equal(await account().count(), 0); assert.deepEqual(await snapshots(), baseline);
      await page.unroute(base + '/api/forms');
      response = page.waitForResponse(r => r.url() === base + '/api/forms' && r.request().method() === 'POST'); await page.locator('.hq-error').getByRole('button', { name: 'Retry save', exact: true }).click(); assert.equal((await response).status(), 401); await modal.waitFor();
      for (const [name, target] of [[/^Create free account/, '/signup'], [/^Sign in/, '/login']]) {
        const link = modal.getByRole('link', { name }); assert.equal(await link.getAttribute('href'), target); assert.equal(await link.getAttribute('target'), '_blank'); assert.match(await link.getAttribute('rel'), /noopener/);
        const opened = context.waitForEvent('page'); await link.click(); const popup = await opened; await popup.waitForURL(base + target); assert.equal(await popup.evaluate(() => window.opener === null), true);
        assert.equal(page.url(), base + '/create/blank'); assert.deepEqual(await snapshots(), baseline); await popup.close(); await page.bringToFront();
      }
      assert.equal(popups.length, 2); await modal.getByRole('heading', { name: 'Come back here to finish saving', exact: true }).waitFor();
      assert.equal((await context.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
      assert.equal((await context.request.get(base + '/api/forms/' + draft.id)).status(), 404);
      let publishWrites = 0; page.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/publish')) publishWrites++; });
      const oldDocument = await page.evaluate(() => performance.timeOrigin);
      const beforeClaim = requests.length, pending = deferred(), complete = deferred(); releases.push(complete.resolve);
      await page.route(base + '/api/forms', async route => { if (route.request().method() !== 'POST') return route.continue(); pending.resolve(route.request().postDataJSON()); await complete.promise; await route.fulfill({ response: await route.fetch() }); });
      await modal.getByRole('button', { name: 'Save to my account', exact: true }).evaluate(el => { el.click(); el.click(); });
      const submitted = await pending.promise; assert.equal(submitted.id, draft.id); assert.equal(submitted.title, draft.title); assert.deepEqual(submitted.questions, draft.questions); complete.resolve();
      await page.waitForURL(base + '/editor/' + draft.id); await page.waitForFunction(old => performance.timeOrigin !== old, oldDocument); await page.getByRole('textbox', { name: 'Quiz name', exact: true }).waitFor(); assert.equal(requests.length, beforeClaim + 1); assert.equal(publishWrites, 0);
      assert.equal(await readRecord('published', draft.id), null, 'Claiming after Publish does not implicitly publish');
      const saved = await context.request.get(base + '/api/forms/' + draft.id); assert.equal(saved.status(), 200); const form = await saved.json(); assert.equal(form.id, draft.id); assert.equal(form.title, draft.title); assert.deepEqual(form.questions, draft.questions); assert.deepEqual(form.endingPage, draft.endingPage);
      assert.equal(await account().count(), 0); assert.equal(await page.getByRole('dialog', { name: 'Ready to publish?', exact: true }).count(), 0); assert.equal(await page.locator('.hq-error').count(), 0);
      assert.equal(await page.getByText('Unsaved edits from your previous session are available.', { exact: false }).count(), 0); await page.screenshot({ path: path.join(artifacts, 'exact-draft-claimed.png') });
    });
    await scenario('unconfirmed-backup', async ({ page, title, draft, unauthorized }) => {
      await page.evaluate(id => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'heyquiz-draft:' + id) throw new Error('Synthetic unavailable browser storage'); return original.call(this, key, value); }; }, draft.id);
      await title.fill('Unconfirmed latest edits'); await page.getByRole('alert').getByText('Browser backup is unavailable.', { exact: false }).waitFor();
      await page.setViewportSize({ width: 320, height: 844 });
      const modal = await unauthorized(page.getByRole('button', { name: 'Save my quiz', exact: true }), 'Keep your quiz moving.');
      await modal.getByText(warningText, { exact: true }).waitFor(); assert.equal(await modal.getByText(savedText, { exact: true }).count(), 0);
      await page.screenshot({ path: path.join(artifacts, 'unconfirmed-backup-320.png') });
      await modal.getByRole('button', { name: 'Keep editing', exact: true }).click(); assert.equal(await title.inputValue(), 'Unconfirmed latest edits'); assert.equal(await readRecord('forms', draft.id), null);
    });
    await scenario('signed-in-guest-publish-claims-only', async ({ page, context, draft, publish, requests }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const oldDocument = await page.evaluate(() => performance.timeOrigin);
      await publish().click(); await page.waitForURL(base + '/editor/' + draft.id); await page.waitForFunction(old => performance.timeOrigin !== old, oldDocument); await page.getByRole('textbox', { name: 'Quiz name', exact: true }).waitFor(); assert.equal(requests.length, 1);
      const response = await context.request.get(base + '/api/forms/' + draft.id); assert.equal(response.status(), 200); assert.equal((await response.json()).title, draft.title);
      assert.equal(await readRecord('published', draft.id), null); assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(await page.locator('.hq-error').count(), 0);
    }, true);
    await scenario('owner-session-expired', async ({ context, page, title, draft, snapshots, requests }) => {
      const oldDocument = await page.evaluate(() => performance.timeOrigin);
      await page.getByRole('button', { name: 'Save my quiz', exact: true }).click(); await page.waitForURL(base + '/editor/' + draft.id); await page.waitForFunction(old => performance.timeOrigin !== old, oldDocument); await title.waitFor();
      assert.equal(requests.length, 1); let denied = 401, updateRequests = 0;
      await page.route(base + '/api/forms/' + draft.id, route => {
        if (route.request().method() !== 'PUT') return route.continue();
        updateRequests++; return route.fulfill({ status: denied, contentType: 'application/json', body: JSON.stringify({ error: denied === 401 ? 'Sign in to manage your quizzes.' : 'Quiz not found or unavailable to this account.' }) });
      });
      await title.fill('Owner edits retained after session expiry');
      let modal = page.getByRole('dialog', { name: 'Pick up where you left off.', exact: true }); await modal.waitFor();
      assert.equal(await modal.getByRole('link', { name: /^Create free account/ }).count(), 0); assert.equal(await modal.getByRole('link').count(), 1);
      const login = modal.getByRole('link', { name: /^Sign in/ }); assert.equal(await login.getAttribute('href'), '/login'); assert.equal(await login.getAttribute('target'), '_blank');
      await modal.getByText(savedText, { exact: true }).waitFor(); assert.equal(await page.locator('.hq-error').count(), 0);
      const beforeDismiss = await snapshots(); assert.equal(JSON.parse(beforeDismiss.local).title, 'Owner edits retained after session expiry');
      await modal.getByRole('button', { name: 'Keep editing', exact: true }).click(); await modal.waitFor({ state: 'hidden' }); assert.deepEqual(await snapshots(), beforeDismiss); assert.equal(await title.inputValue(), 'Owner edits retained after session expiry');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await modal.waitFor(); assert.equal(await page.locator('.hq-error').count(), 0);
      denied = 404; await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.locator('.hq-error').getByText('Quiz not found or unavailable to this account.', { exact: false }).waitFor(); assert.equal(await modal.count(), 0);
      assert.equal(requests.length, 1, 'Expired owner session never clones the quiz through POST'); assert.ok(updateRequests >= 3); assert.deepEqual(await snapshots(), beforeDismiss);
      const saved = await context.request.get(base + '/api/forms/' + draft.id); assert.equal(saved.status(), 200); assert.equal((await saved.json()).title, draft.title, 'Rejected owner edits remain a backup and do not overwrite server data');
      await page.screenshot({ path: path.join(artifacts, 'owner-ownership-error.png') });
    }, true);
    fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify({ engine, status: 'passed', scenarios: results, scans, realSignups: 0, publicStarts: 0, publishedQuizzes: 0, providerRequests: 0 }, null, 2));
    console.log('PASS account prompt desktop/mobile, focus/dismiss/reopen, explicit isolated tabs, 401-to-503/network classification, duplicate retry protection, truthful backup, exact local claims without publication, expired owner 401-to-404 without cloning; three accessibility scans');
  } finally { await browser.close(); }
})().catch(error => { console.error(error?.stack || 'Account prompt acceptance failed'); process.exitCode = 1; });
