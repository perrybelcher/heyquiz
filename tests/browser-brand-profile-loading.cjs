// Isolated UI regression: all brand-profile responses are synthetic browser routes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164';
if (new URL(base).hostname !== '127.0.0.1') throw Error('Local test server required.');
const brief = { audience: 'Home office workers', offer: 'Desk accessories with clear fit guidance', goal: 'Explore a suitable accessory', concerns: 'Limited desk space', voice: 'Warm and practical', kind: 'segmentation', numQuestions: 3, ctaLabel: 'Explore my setup', ctaUrl: '', targets: [{ title: 'Compact desk', description: 'People with limited workspace', ctaUrl: '' }, { title: 'Large desk', description: 'People with a larger home office', ctaUrl: '' }] };
const original = { id: 'synthetic-profile', name: 'Synthetic workspace', brief, revision: 1, updatedAt: '2026-10-12T12:00:00.000Z' };
const wait = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let nextGet = { status: 503, body: { error: 'Synthetic loading failure' }, gate: wait(), arrived: wait() };
  let saveFails = true, saved;
  await page.route('**/api/brand-profiles', async route => {
    if (route.request().method() === 'GET') {
      const reply = nextGet; reply.arrived.resolve();
      if (reply.gate) await reply.gate.promise;
      return route.fulfill({ status: reply.status, json: reply.body });
    }
    assert.equal(route.request().method(), 'POST');
    if (saveFails) return route.fulfill({ status: 503, json: { error: 'Synthetic save failure' } });
    saved = { ...route.request().postDataJSON(), id: 'synthetic-saved', revision: 1, updatedAt: original.updatedAt };
    return route.fulfill({ status: 201, json: saved });
  });
  const setReply = (status, body, held = false) => { nextGet = { status, body, arrived: wait(), ...(held ? { gate: wait() } : {}) }; };
  try {
    assert.equal((await context.request.post(base + '/api/auth', { headers: { Origin: base }, data: { local: true } })).status(), 200);
    await page.goto(base + '/create/marketing');
    await nextGet.arrived.promise;
    const panel = page.getByRole('region', { name: 'Brand and offer profiles', exact: true });
    const refresh = panel.getByRole('button', { name: 'Refresh profiles', exact: true });
    await panel.getByRole('status').filter({ hasText: 'Working…' }).waitFor();
    assert.ok(await refresh.isDisabled());
    assert.ok(await panel.getByLabel('Saved profile', { exact: true }).isDisabled());
    assert.ok(await panel.getByLabel('Profile name', { exact: true }).isDisabled());
    nextGet.gate.resolve();
    await panel.getByRole('alert').filter({ hasText: 'Synthetic loading failure' }).waitFor();
    assert.ok(await refresh.isEnabled(), 'failed initial load remains retryable');

    setReply(200, { profiles: [original] }, true);
    await refresh.click(); await nextGet.arrived.promise;
    assert.equal(await panel.getByRole('alert').count(), 0, 'retry clears prior load error');
    assert.ok(await refresh.isDisabled()); nextGet.gate.resolve();
    await panel.getByRole('option', { name: original.name, exact: true }).waitFor({ state: 'attached' });
    await panel.getByLabel('Saved profile', { exact: true }).selectOption(original.id);
    await panel.getByRole('button', { name: 'Use selected profile', exact: true }).click();
    setReply(503, { error: 'Synthetic refresh failure' });
    await refresh.click();
    await panel.getByRole('alert').filter({ hasText: 'Synthetic refresh failure' }).waitFor();
    assert.equal(await panel.getByRole('button', { name: 'Replace brief', exact: true }).count(), 0, 'refresh cancels pending replacement');
    assert.equal(await panel.getByLabel('Saved profile', { exact: true }).inputValue(), original.id);
    assert.equal(await panel.getByLabel('Profile name', { exact: true }).inputValue(), original.name);

    const updated = { ...original, revision: 2, brief: { ...brief, audience: 'A refreshed audience' } };
    setReply(200, { profiles: [updated] });
    await refresh.click();
    await panel.getByRole('status').filter({ hasText: 'Working…' }).waitFor({ state: 'detached' });
    await panel.getByRole('button', { name: 'Use selected profile', exact: true }).click();
    await panel.getByRole('button', { name: 'Replace brief', exact: true }).click();
    assert.equal(await page.getByLabel('Who is this quiz for?').inputValue(), updated.brief.audience, 'refresh applies latest saved brief');
    await panel.getByLabel('Profile name', { exact: true }).fill('New synthetic profile');
    await panel.getByRole('button', { name: 'Save as new profile', exact: true }).click();
    await panel.getByRole('alert').filter({ hasText: 'Synthetic save failure' }).waitFor();
    assert.equal(await panel.getByLabel('Profile name', { exact: true }).inputValue(), 'New synthetic profile');
    assert.equal(await page.getByLabel('Who is this quiz for?').inputValue(), updated.brief.audience);
    saveFails = false;
    await panel.getByRole('button', { name: 'Save as new profile', exact: true }).click();
    await panel.getByRole('status').filter({ hasText: 'Profile saved to your account.' }).waitFor();
    assert.equal(await panel.getByLabel('Saved profile', { exact: true }).inputValue(), saved.id);
    setReply(200, { profiles: [saved, updated] });
    await refresh.click();
    await panel.getByRole('status').filter({ hasText: 'Working…' }).waitFor({ state: 'detached' });
    assert.equal(await panel.getByLabel('Saved profile', { exact: true }).inputValue(), saved.id, 'refresh preserves newly saved selection');
    assert.equal(await panel.getByRole('alert').count(), 0);

    setReply(503, { error: 'A departed page must not show this failure' }, true);
    const departedLoad = nextGet;
    await page.reload(); await departedLoad.arrived.promise;
    await page.getByLabel('Who is this quiz for?').fill('Keep this draft across navigation');
    await page.getByRole('link', { name: 'Back to workspace', exact: true }).click();
    await panel.waitFor({ state: 'detached' });
    departedLoad.gate.resolve();
    setReply(200, { profiles: [saved, updated] });
    await page.goto(base + '/create/marketing');
    await panel.getByRole('option', { name: saved.name, exact: true }).waitFor({ state: 'attached' });
    assert.equal(await page.getByLabel('Who is this quiz for?').inputValue(), 'Keep this draft across navigation');
    assert.equal(await panel.getByRole('alert').count(), 0, 'departed loading response does not pollute a new mount');
    assert.ok(await refresh.isEnabled());
    assert.deepEqual(errors, []);
    console.log('PASS brand-profile initial busy/disabled state, failed-load retry, pending replacement cleared on refresh, selection retained on errors, refreshed brief applied, save failure retains inputs, saved selection survives refresh and navigation during loading preserves the draft without late errors; no profile API writes or page errors');
  } finally { nextGet.gate?.resolve(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
