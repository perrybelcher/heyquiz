// Isolated local-only guest claim races; no public quiz starts or real email.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.HEYQUIZ_DATA_DIR, 'Explicit isolated data directory required');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-10/release-final/guest-claim');
fs.mkdirSync(artifacts, { recursive: true });
const headers = { Origin: base };
const recoveryText = 'Unsaved edits from your previous session are available.';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function scenario(label, test, authenticated = true) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [], releases = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    let cleanupId;
    try {
      if (authenticated) assert.equal((await context.request.post(base + '/api/auth', { data: { local: true }, headers })).status(), 200);
      await page.goto(base + '/create');
      await page.getByRole('button', { name: /^Test knowledge/ }).click();
      const title = page.getByRole('textbox', { name: /^Quiz (title|name)$/ });
      await title.fill('Claim snapshot ' + label);
      const draft = await page.waitForFunction(() => {
        const id = localStorage.getItem('pippi-guest-draft'), text = id && sessionStorage.getItem('heyquiz-draft:' + id);
        if (!text) return null;
        const form = JSON.parse(text);
        return form.title.startsWith('Claim snapshot ') ? form : null;
      }).then(handle => handle.jsonValue());
      const key = 'heyquiz-draft:' + draft.id;
      if (authenticated) {
        assert.equal((await context.request.get(base + '/api/forms/' + draft.id)).status(), 404);
        cleanupId = draft.id;
      }
      const snapshots = () => page.evaluate(key => ({ session: sessionStorage.getItem(key), local: localStorage.getItem(key), pointer: localStorage.getItem('pippi-guest-draft') }), key);
      const read = async () => { const response = await context.request.get(base + '/api/forms/' + draft.id); assert.equal(response.status(), 200); return response.json(); };
      async function holdClaim() {
        const started = deferred(), release = deferred(); releases.push(release.resolve);
        await page.route(base + '/api/forms', async route => {
          if (route.request().method() !== 'POST') return route.continue();
          started.resolve(route.request().postDataJSON());
          await release.promise;
          const response = await route.fetch();
          await route.fulfill({ response });
        });
        await page.getByRole('button', { name: 'Save my quiz', exact: true }).click();
        const submitted = await started.promise;
        assert.equal(submitted.title, draft.title);
        return release.resolve;
      }
      await test({ context, page, title, draft, key, snapshots, read, holdClaim });
      assert.deepEqual(errors, [], 'No application/hydration errors');
      console.log('PASS ' + label);
    } catch (error) {
      await page.screenshot({ path: path.join(artifacts, label + '-failure.png') }).catch(() => {});
      throw error;
    } finally {
      releases.forEach(release => release());
      try {
        // Quiesce client autosave/held routes before removing only this fixture.
        await page.close();
        if (cleanupId) assert.ok([200, 404].includes((await context.request.delete(base + '/api/forms/' + cleanupId, { headers })).status()));
      } finally { await context.close(); }
    }
  }
  try {
    await scenario('newer-in-flight-edit', async ({ page, title, draft, key, snapshots, read, holdClaim }) => {
      const release = await holdClaim();
      await title.fill('Newer work while claiming');
      await page.waitForFunction(key => JSON.parse(sessionStorage.getItem(key)).title === 'Newer work while claiming', key);
      release(); await page.waitForURL(base + '/editor/' + draft.id);
      await page.getByRole('button', { name: 'Restore changes', exact: true }).waitFor();
      assert.equal((await read()).title, draft.title, 'Only the submitted snapshot reached the server');
      const copies = await snapshots();
      assert.equal(JSON.parse(copies.session).title, 'Newer work while claiming');
      assert.equal(JSON.parse(copies.local).title, 'Newer work while claiming');
      assert.equal(copies.pointer, draft.id, 'Newer same-ID guest work keeps its resume pointer');
      await page.getByRole('button', { name: 'Restore changes', exact: true }).click();
      await page.getByText('Saved', { exact: true }).waitFor();
      assert.equal((await read()).title, 'Newer work while claiming');
      await page.reload(); await page.getByRole('textbox', { name: 'Quiz name', exact: true }).waitFor();
      assert.equal(await page.getByText(recoveryText, { exact: false }).count(), 0);
    });

    for (const differentPointer of [false, true]) await scenario(differentPointer ? 'other-tab-new-pointer' : 'other-tab-same-pointer', async ({ context, page, draft, key, snapshots, read, holdClaim }) => {
      const release = await holdClaim(), other = await context.newPage();
      await other.goto(base + '/welcome');
      const pointer = differentPointer ? draft.id + '-other' : draft.id;
      await other.evaluate(({ draft, key, pointer }) => {
        localStorage.setItem(key, JSON.stringify({ ...draft, title: 'Other tab retained work' }));
        if (pointer !== draft.id) localStorage.setItem('heyquiz-draft:' + pointer, JSON.stringify({ ...draft, id: pointer, title: 'Different guest draft' }));
        localStorage.setItem('pippi-guest-draft', pointer);
      }, { draft, key, pointer });
      release(); await page.waitForURL(base + '/editor/' + draft.id);
      await page.getByRole('button', { name: 'Restore changes', exact: true }).waitFor();
      const copies = await snapshots();
      assert.equal(copies.session, null, 'The matching tab-local claim backup was cleared');
      assert.equal(JSON.parse(copies.local).title, 'Other tab retained work');
      assert.equal(copies.pointer, pointer, 'Another tab retains its same-ID or different-ID resume pointer');
      assert.equal((await read()).title, draft.title);
      await other.close();
    });

    await scenario('blocked-local-cleanup', async ({ page, draft, key, snapshots, read }) => {
      await page.evaluate(key => {
        const remove = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function (name) {
          if (this === localStorage && (name === key || name === 'pippi-guest-draft')) throw Error('Synthetic local-storage cleanup blocked');
          return remove.call(this, name);
        };
      }, key);
      await page.getByRole('button', { name: 'Save my quiz', exact: true }).click();
      await page.waitForURL(base + '/editor/' + draft.id);
      await page.getByRole('textbox', { name: 'Quiz name', exact: true }).waitFor();
      const saved = await read(), copies = await snapshots();
      assert.ok(saved.createdAt, 'Server adds creation metadata');
      assert.equal(copies.session, null, 'Local-storage failure did not block session cleanup');
      assert.equal(JSON.parse(copies.local).title, draft.title, 'Blocked local copy was retained');
      assert.equal(await page.getByText(recoveryText, { exact: false }).count(), 0, 'Server metadata alone is not unsaved work');
    });

    for (const status of [401, 409, 503]) await scenario('failed-claim-' + status, async ({ page, draft, snapshots }) => {
      const before = await snapshots();
      await page.route(base + '/api/forms', route => route.fulfill({ status, json: { error: 'Synthetic claim failure ' + status } }));
      await page.getByRole('button', { name: 'Save my quiz', exact: true }).click();
      if (status === 401) await page.getByText('Sign in to save your quiz', { exact: true }).waitFor();
      else await page.getByText('Synthetic claim failure ' + status, { exact: false }).waitFor();
      assert.equal(page.url(), base + '/create');
      assert.deepEqual(await snapshots(), before, 'Failed claim does not clear either draft copy or pointer');
      assert.equal(before.pointer, draft.id);
    }, false);
    console.log('PASS seven guest-claim safety scenarios; zero public starts or email; owned server fixtures deleted.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
