// Real beforeunload dismissal after a confirmed local guest claim. No emails,
// public starts or provider calls. Each server fixture is uniquely owned/removed.
const pw = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164', engine = process.env.BROWSER || 'chromium';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(process.env.HEYQUIZ_DATA_DIR);
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-11/guest-continuation/' + engine);
fs.mkdirSync(artifacts, { recursive: true });
const headers = { Origin: base }, defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const newerTitle = 'Newer work retained after Stay';
async function waitTitle(read, title) { const deadline = Date.now() + 20000; let actual; do { actual = (await read()).title; if (actual === title) return; await new Promise(resolve => setTimeout(resolve, 80)); } while (Date.now() < deadline); assert.equal(actual, title); }
(async () => {
 const browser = await pw[engine].launch(engine === 'chromium' ? { channel: 'chrome', headless: true } : { headless: true });
 const login = await browser.newContext();
 assert.equal((await login.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
 const cookies = await login.cookies(); await login.close();
 async function scenario(name, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await context.addCookies(cookies);
  const page = await context.newPage(), errors = [], requests = [], releases = []; let id;
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (['POST', 'PUT'].includes(request.method()) && new URL(request.url()).pathname.startsWith('/api/forms')) requests.push({ method: request.method(), body: request.postDataJSON() }); });
  const stayed = defer(); let dialogs = 0;
  page.on('dialog', async dialog => { assert.equal(dialog.type(), 'beforeunload'); dialogs++; if (dialogs === 1) { await dialog.dismiss(); stayed.resolve(); } else await dialog.accept(); });
  try {
   await page.goto(base + '/welcome'); await page.goto(base + '/create/guided'); await page.getByRole('button', { name: /^Test knowledge/ }).click();
   const title = page.getByRole('textbox', { name: /^Quiz (title|name)$/ }); await title.fill('Original claim ' + name);
   const form = await page.waitForFunction(() => { const id = localStorage.getItem('pippi-guest-draft'), text = id && sessionStorage.getItem('heyquiz-draft:' + id); if (!text) return null; const form = JSON.parse(text); return form.title.startsWith('Original claim ') ? form : null; }).then(handle => handle.jsonValue());
   id = form.id; assert.equal((await context.request.get(base + '/api/forms/' + id)).status(), 404);
   const key = 'heyquiz-draft:' + id, read = async () => { const response = await context.request.get(base + '/api/forms/' + id); assert.equal(response.status(), 200); return response.json(); };
   const backups = () => page.evaluate(key => ({ session: sessionStorage.getItem(key), local: localStorage.getItem(key), pointer: localStorage.getItem('pippi-guest-draft') }), key);
   async function claimAndStay(afterPost) {
    const entered = defer(), held = defer(); releases.push(held.resolve);
    await page.route(base + '/api/forms', async route => {
     if (route.request().method() !== 'POST') return route.continue();
     entered.resolve(); await held.promise; const response = await route.fetch(); assert.equal(response.status(), 201);
     const saved = await response.json(), replacement = afterPost && await afterPost(saved);
     await route.fulfill({ response, ...(replacement ? { json: replacement } : {}) });
    });
    await page.getByRole('button', { name: 'Save my quiz', exact: true }).click(); await entered.promise;
    await title.fill(newerTitle);
    await page.waitForFunction(({ key, newerTitle }) => window.__restoreBackup
      ? document.body.innerText.includes('Browser backup is unavailable.')
      : JSON.parse(sessionStorage.getItem(key) || '{}').title === newerTitle, { key, newerTitle });
    held.resolve(); await stayed.promise;
    assert.ok(dialogs >= 1, 'An actual beforeunload dialog was dismissed');
    assert.equal(page.url(), base + '/editor/' + id, 'Confirmed quiz has a reload-safe canonical URL');
    await page.getByText('Your quiz is now in your account.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save my quiz', exact: true }).count(), 0, 'Creation controls are no longer offered');
    assert.equal(await title.inputValue(), newerTitle);
    return read();
   }
   await run({ page, context, title, form, key, read, backups, requests, claimAndStay, releases });
   assert.equal(requests.filter(request => request.method === 'POST').length, 1, 'Confirmed claim never sends another POST');
   assert.deepEqual(errors, []); console.log('PASS ' + engine + ' ' + name);
  } catch (error) { await page.screenshot({ path: path.join(artifacts, name + '-failure.png') }).catch(() => {}); throw error; }
  finally { releases.forEach(release => release()); try { await page.close(); if (id) assert.ok([200, 404].includes((await context.request.delete(base + '/api/forms/' + id, { headers })).status())); } finally { await context.close(); } }
 }
 try {
  await scenario('stay-save-and-open', async ({ page, title, form, read, requests, claimAndStay }) => {
   const before = await claimAndStay();
   await waitTitle(read, newerTitle);
   assert.equal((await read()).title, newerTitle); assert.equal((await read()).createdAt, before.createdAt, 'Original server creation timestamp survives continued saves');
   const firstPut = requests.find(request => request.method === 'PUT'); assert.equal(firstPut.body.revision, 1);
   await page.screenshot({ path: path.join(artifacts, 'continued-editor.png') });
   await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
   const accessibility = [];
   for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const banner = page.getByRole('status').filter({ hasText: 'Your quiz is now in your account.' });
    await banner.waitFor();
    assert.ok(await banner.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Continuation banner does not overflow at ' + width);
    const report = await banner.evaluate(element => window.axe.run(element, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    accessibility.push({ width, violations: report.violations });
    await page.screenshot({ path: path.join(artifacts, 'continued-editor-' + width + '.png') });
    assert.deepEqual(report.violations, [], 'Continuation banner WCAG scan at ' + width);
   }
   fs.writeFileSync(path.join(artifacts, 'banner-accessibility.json'), JSON.stringify(accessibility, null, 2));
   await page.setViewportSize({ width: 1440, height: 1000 });
   await title.fill('Final changes before opening workspace');
   const opened = page.waitForEvent('domcontentloaded'); await page.getByRole('button', { name: 'Save & open quiz', exact: true }).click();
   await opened; await page.getByRole('textbox', { name: /^Quiz (title|name)$/ }).waitFor();
   assert.equal((await read()).title, 'Final changes before opening workspace');
   assert.equal(await page.getByText('Your quiz is now in your account.', { exact: false }).count(), 0);
   assert.equal(await page.getByText('Unsaved edits from your previous session are available.', { exact: false }).count(), 0);
  });

  await scenario('stay-conflict-and-reload', async ({ page, context, title, form, read, backups, requests, claimAndStay }) => {
   await claimAndStay(async saved => { const changed = await context.request.put(base + '/api/forms/' + form.id, { headers, data: { ...saved, title: 'Other tab server revision' } }); assert.equal(changed.status(), 200); });
   await page.locator('.hq-error').waitFor();
   assert.equal((await read()).title, 'Other tab server revision');
   assert.equal(JSON.parse((await backups()).session).title, newerTitle);
   const retried = page.waitForResponse(response => response.url() === base + '/api/forms/' + form.id && response.request().method() === 'PUT');
   await page.getByRole('button', { name: 'Save & open quiz', exact: true }).click(); assert.equal((await retried).status(), 409);
   assert.ok(requests.filter(request => request.method === 'PUT').every(request => request.body.revision === 1), 'Conflict never adopts an unconfirmed newer revision');
   await page.reload(); await page.getByRole('button', { name: 'Restore changes', exact: true }).waitFor();
   assert.equal(await page.getByRole('textbox', { name: /^Quiz (title|name)$/ }).inputValue(), 'Other tab server revision');
   await page.getByRole('button', { name: 'Restore changes', exact: true }).click(); await page.locator('[role="status"]:visible').filter({ hasText: /^Saved(?:\s*·|$)/ }).first().waitFor();
   assert.equal((await read()).title, newerTitle); assert.equal((await read()).revision, 3);
   assert.equal(await title.inputValue(), newerTitle);
  });

  await scenario('stay-back-forward', async ({ page, title, form, read, claimAndStay }) => {
   await claimAndStay();
   await waitTitle(read, newerTitle);
   await page.goBack(); await page.waitForURL(base + '/welcome');
   await page.goForward(); await page.waitForURL(base + '/editor/' + form.id);
   await title.waitFor(); assert.equal(await title.inputValue(), newerTitle);
   assert.equal((await read()).title, newerTitle);
   assert.equal(await page.getByRole('heading', { name: 'What should your quiz do?', exact: true }).count(), 0);
  });

  await scenario('stale-confirmed-revision', async ({ page, form, read, backups, requests, claimAndStay }) => {
   await claimAndStay(saved => ({ ...saved, revision: saved.revision + 50 }));
   await page.locator('.hq-error').waitFor(); assert.equal((await read()).title, form.title);
   assert.equal(JSON.parse((await backups()).session).title, newerTitle);
   assert.equal(requests.find(request => request.method === 'PUT').body.revision, 51, 'Uses only received revision; server rejects stale confirmation');
   await page.reload(); await page.getByRole('button', { name: 'Restore changes', exact: true }).waitFor();
   await page.getByRole('button', { name: 'Restore changes', exact: true }).click(); await page.locator('[role="status"]:visible').filter({ hasText: /^Saved(?:\s*·|$)/ }).first().waitFor();
   assert.equal((await read()).title, newerTitle); assert.equal((await read()).revision, 2);
  });

  for (const status of [401, 403, 503]) await scenario('stay-failed-put-' + status, async ({ page, title, form, read, backups, requests, claimAndStay }) => {
   await page.route(base + '/api/forms/' + form.id, route => route.request().method() === 'PUT' ? route.fulfill({ status, json: { error: 'Synthetic continuation failure ' + status } }) : route.continue());
   await claimAndStay();
   const failurePanel = status === 401 ? page.getByRole('dialog', { name: 'Pick up where you left off.', exact: true }) : page.locator('.hq-error');
   await failurePanel.waitFor();
   const retry = () => status === 401 ? failurePanel.getByRole('button', { name: 'Save changes', exact: true }) : page.getByRole('button', { name: 'Retry save', exact: true });
   const before = await backups(); assert.equal(JSON.parse(before.session).title, newerTitle);
   const retried = page.waitForResponse(response => response.url() === base + '/api/forms/' + form.id && response.request().method() === 'PUT');
   await retry().click(); assert.equal((await retried).status(), status);
   assert.deepEqual(await backups(), before); assert.equal((await read()).title, form.title);
   await page.unroute(base + '/api/forms/' + form.id);
   await retry().click();
   await waitTitle(read, newerTitle);
   assert.equal((await read()).title, newerTitle); assert.equal(await title.inputValue(), newerTitle);
   assert.ok(requests.filter(request => request.method === 'PUT').every(request => request.body.revision === 1));
  });

  await scenario('stay-without-working-backup', async ({ page, title, form, key, read, requests, claimAndStay }) => {
   await page.evaluate(() => { const set = Storage.prototype.setItem; window.__restoreBackup = () => Storage.prototype.setItem = set; Storage.prototype.setItem = function (key, value) { if (key.startsWith('heyquiz-draft:')) throw Error('Synthetic backup blocked'); return set.call(this, key, value); }; });
   await page.route(base + '/api/forms/' + form.id, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic continuation offline' } }) : route.continue());
   await claimAndStay(); await page.locator('.hq-error').waitFor(); await page.getByText('Browser backup is unavailable.', { exact: false }).waitFor();
   assert.equal(await title.inputValue(), newerTitle, 'Actual Stay preserves the only live copy');
   assert.equal((await read()).title, form.title);
   await page.evaluate(() => window.__restoreBackup()); await title.fill('Recovered after storage and network return');
   await page.waitForFunction(key => JSON.parse(sessionStorage.getItem(key) || '{}').title === 'Recovered after storage and network return', key);
   await page.unroute(base + '/api/forms/' + form.id); await page.getByRole('button', { name: 'Retry save', exact: true }).click();
   await waitTitle(read, 'Recovered after storage and network return'); assert.equal((await read()).title, 'Recovered after storage and network return');
   assert.equal(requests.filter(request => request.method === 'POST').length, 1);
  });

  // A successful but unverifiable response retains both backups and cannot be
  // retried as another POST or become an unguarded PUT with an invented revision.
  for (const invalid of ['wrong-id', 'zero-revision', 'string-revision', 'bad-json']) await scenario('unverified-' + invalid, async ({ page, form, backups, requests }) => {
   const before = await backups();
   await page.route(base + '/api/forms', route => invalid === 'bad-json' ? route.fulfill({ status: 201, contentType: 'application/json', body: '{broken' }) : route.fulfill({ status: 201, json: { ...form, id: invalid === 'wrong-id' ? 'wrong-quiz' : form.id, revision: invalid === 'zero-revision' ? 0 : invalid === 'string-revision' ? '1' : 1 } }));
   await page.getByRole('button', { name: 'Save my quiz', exact: true }).click(); await page.getByText('We could not verify the save confirmation.', { exact: false }).waitFor();
   await page.getByRole('button', { name: 'Retry save', exact: true }).click();
   assert.deepEqual(await backups(), before); assert.equal(page.url(), base + '/create/guided'); assert.equal(requests.length, 1);
  });
  console.log('PASS ' + engine + ' 12 guest continuation cases, including actual Stay, revision-safe PUT, reload/back-forward recovery, failed saves, blocked backup, invalid confirmations. Zero public starts/email.');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
