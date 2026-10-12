const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3165';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Local test URL required');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-creation-clarity-2026-10-12/auth-return');
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const actions = [];
  let exchangeNext = '/', immediate = false, aiRequests = 0, strippedBeforeExchange = false;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname.startsWith('/api/agent/')) { aiRequests++; return route.abort(); }
    if (url.pathname === '/api/auth/account') {
      const action = route.request().postDataJSON().action;
      actions.push(action);
      if (action === 'exchange') {
        strippedBeforeExchange = new URL(page.url()).search === '' && new URL(page.url()).hash === '';
        return route.fulfill({ json: { next: exchangeNext } });
      }
      if (action === 'signup' || action === 'resend') return route.fulfill({ json: immediate ? { next: '/' } : { message: 'Synthetic confirmation response; no email sent.' } });
      if (action === 'recover') return route.fulfill({ json: { message: 'Synthetic recovery response; no email sent.' } });
      if (action === 'reset') return route.fulfill({ json: { next: '/login?reset=success' } });
      throw Error('Unexpected account action');
    }
    if (url.pathname === '/api/auth') return route.fulfill({ json: { success: true } });
    return route.continue();
  });
  const fillSignup = async destination => {
    await page.goto(`${base}/signup?next=${encodeURIComponent(destination)}`);
    await page.getByLabel('Email address').fill('creation-test@example.test');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password-only');
    await page.getByLabel('Confirm password', { exact: true }).fill('synthetic-password-only');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
  };
  try {
    await page.goto(`${base}/create/ai`);
    await page.getByRole('heading', { name: 'A free account unlocks AI creation' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Create free account', exact: true }).getAttribute('href'), '/signup?next=%2Fcreate%2Fai');
    assert.equal(await page.getByRole('link', { name: 'Sign in to continue', exact: true }).getAttribute('href'), '/login?next=%2Fcreate%2Fai');
    assert.equal(await page.getByRole('button', { name: 'Generate knowledge quiz' }).count(), 0);
    await page.screenshot({ path: path.join(artifacts, 'ai-guest-mobile.png'), fullPage: true });
    await fillSignup('/create/ai');
    await page.getByRole('heading', { name: 'Your next step', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Sign in to your account', exact: true }).getAttribute('href'), '/login?next=%2Fcreate%2Fai');
    await page.goto(`${base}/auth/callback?code=synthetic-only#synthetic-fragment`);
    await page.waitForURL(`${base}/create/ai`);
    assert.equal(strippedBeforeExchange, true);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('pippi_creation_auth_return_v1')), null);
    immediate = true;
    await fillSignup('/create/marketing');
    await page.waitForURL(`${base}/create/marketing`);
    await page.getByRole('heading', { name: 'Create a marketing quiz', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Sign in to continue', exact: true }).getAttribute('href'), '/login?next=%2Fcreate%2Fmarketing');
    immediate = false;
    await fillSignup('/create/ai');
    await page.getByRole('heading', { name: 'Your next step', exact: true }).waitFor();
    exchangeNext = '/reset-password';
    await page.goto(`${base}/auth/callback?code=synthetic-recovery`);
    await page.waitForURL(`${base}/reset-password`);
    await page.getByLabel('New password', { exact: true }).fill('synthetic-new-password');
    await page.getByLabel('Confirm password', { exact: true }).fill('synthetic-new-password');
    await page.getByRole('button', { name: 'Save new password', exact: true }).click();
    await page.waitForURL(`${base}/login?reset=success`);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('pippi_creation_auth_return_v1')), null);
    await page.getByRole('status').filter({ hasText: 'password has been updated' }).waitFor();
    const local = page.getByRole('button', { name: 'Open local workspace', exact: true });
    if (await local.count()) await local.click();
    else {
      await page.getByLabel('Email', { exact: true }).fill('creation-test@example.test');
      await page.getByLabel('Password', { exact: true }).fill('synthetic-new-password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    }
    await page.waitForURL(base + '/');
    assert.equal(aiRequests, 0);
    assert.deepEqual(actions, ['signup', 'exchange', 'signup', 'signup', 'exchange', 'reset']);
    const result = { passed: true, groups: ['guest gate and no automatic AI', 'same-tab confirmation and stripped callback URL', 'immediate signup marketing return', 'recovery/reset destination precedence'], mockedAccountActions: actions.length, aiRequests, realEmails: 0 };
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(result, null, 2));
    console.log('PASS creation auth browser: 4 groups; six mocked account actions, zero AI requests, zero emails.');
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
