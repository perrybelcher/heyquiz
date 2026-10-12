// Independent local creator acceptance. No respondent starts, providers or production data.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), browsers = require('playwright');
const { createHash } = require('node:crypto');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { readRecord, removeRecord, cloudEnabled } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164', engine = process.env.BROWSER || 'chromium';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !process.env.HEYQUIZ_DATA_DIR || cloudEnabled() || !['chromium', 'firefox', 'webkit'].includes(engine)) throw Error('Use the explicitly isolated loopback candidate and local synthetic data.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-18/guided-publication/' + engine);
fs.mkdirSync(artifacts, { recursive: true });
// Existing plain-HTML diagnostic established this native macOS WebKit preference.
const forwardKey = engine === 'webkit' ? 'Alt+Tab' : 'Tab', backwardKey = engine === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab';
const headers = { Origin: base }, ids = [], checks = [], scans = [], focusChecks = [], cleanup = []; let passed = false;
const activity = { publicStarts: 0, previewStarts: 0, experimentMutations: 0, providerRequests: 0, externalRequests: 0, publishRequests: 0, pauseRequests: 0 }, errors = [];
async function until(check, message) { for (let i = 0; i < 80; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw Error(message); }
(async () => {
  const browser = await browsers[engine].launch(engine === 'chromium' ? { channel: 'chrome', headless: true } : { headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
  page.setDefaultTimeout(18000);
  context.on('page', current => { current.on('pageerror', error => errors.push(error.message)); current.on('dialog', dialog => { if (dialog.type() !== 'beforeunload') errors.push('Unexpected native dialog: ' + dialog.type()); void dialog.accept(); }); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { if (dialog.type() !== 'beforeunload') errors.push('Unexpected native dialog: ' + dialog.type()); void dialog.accept(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    let blocked;
    if (/^https?:$/.test(url.protocol) && url.origin !== base) blocked = 'externalRequests';
    else if (/\/api\/forms\/[^/]+\/start$/.test(url.pathname)) blocked = request.postDataJSON()?.preview ? 'previewStarts' : 'publicStarts';
    else if (/\/api\/experiments/.test(url.pathname) && request.method() !== 'GET') blocked = 'experimentMutations';
    else if (/\/api\/(agent|integrations)\//.test(url.pathname) || /\/api\/forms\/[^/]+\/(result-email|integrations)(\/|$)/.test(url.pathname)) blocked = 'providerRequests';
    if (blocked) { activity[blocked]++; return route.abort(); }
    if (/\/api\/forms\/[^/]+\/publish$/.test(url.pathname)) activity[request.method() === 'DELETE' ? 'pauseRequests' : 'publishRequests']++;
    return route.continue();
  });
  const button = name => page.getByRole('button', { name, exact: true });
  const readiness = () => page.getByRole('dialog', { name: 'Ready to publish?', exact: true });
  const success = () => page.getByRole('dialog', { name: 'Your Quiz is Published!', exact: true });
  const publishButton = () => button('Review & publish');
  const goPublish = async () => { await button('5. Publish').click(); await page.getByRole('heading', { name: 'Check it. Try it. Share it.', exact: true }).waitFor(); };
  async function frames() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
  async function holdFrames() { await page.evaluate(() => { window.__qaOriginalFrames = [window.requestAnimationFrame, window.cancelAnimationFrame]; window.__qaHeldFrames = new Map(); let sequence = 1000000; window.requestAnimationFrame = callback => { const id = ++sequence; window.__qaHeldFrames.set(id, callback); return id; }; window.cancelAnimationFrame = id => window.__qaHeldFrames.delete(id); }); }
  async function releaseFrames() { await page.evaluate(() => { const held = [...window.__qaHeldFrames.values()]; [window.requestAnimationFrame, window.cancelAnimationFrame] = window.__qaOriginalFrames; delete window.__qaOriginalFrames; delete window.__qaHeldFrames; held.forEach(callback => requestAnimationFrame(callback)); }); await frames(); }
  async function focused(locator, label) {
    await locator.waitFor();
    try { await page.waitForFunction(el => el === document.activeElement, await locator.elementHandle(), { timeout: 3000 }); }
    catch (error) { const state = await page.evaluate(() => ({ activeTag: document.activeElement?.tagName, activeLabel: document.activeElement?.getAttribute('aria-label'), activeText: document.activeElement?.textContent?.slice(0, 180), sheet: document.querySelector('.guided-sheet')?.getAttribute('aria-label'), headingTabIndex: document.querySelector('.guided-sheet h1')?.getAttribute('tabindex') })); console.error('Focus failure', label, state); throw error; }
    assert.ok(await locator.evaluate(el => el === document.activeElement), label); focusChecks.push(label);
  }
  async function status(label) { await page.waitForFunction(text => [...document.querySelectorAll('body *')].some(el => el.getClientRects().length && el.children.length === 0 && el.textContent.includes(text)), label); }
  async function draft(id) { const response = await context.request.get(base + '/api/forms/' + id); assert.equal(response.status(), 200); return response.json(); }
  async function published(id) { return (await readRecord('published', id))?.payload || null; }
  async function openReview(trigger = publishButton()) { await trigger.focus(); await page.keyboard.press('Enter'); await readiness().waitFor(); }
  async function publish(trigger) { await openReview(trigger); await readiness().getByRole('button', { name: 'Publish now', exact: true }).click(); await success().waitFor(); await frames(); }
  async function dismiss(action = 'Escape') { if (action === 'Escape') await page.keyboard.press('Escape'); else await success().getByRole('button', { name: action, exact: true }).click(); await success().waitFor({ state: 'hidden' }); }
  async function preview(id, title) {
    const opened = context.waitForEvent('page'); await button('Save & preview').click(); const popup = await opened;
    await popup.waitForURL(base + '/play/' + id + '?preview=1');
    await popup.getByText('Preview · responses aren’t saved', { exact: false }).waitFor();
    await popup.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal((await draft(id)).title, title); await popup.close();
  }
  async function claim() {
    const id = await page.evaluate(() => localStorage.getItem('pippi-guest-draft')); assert.ok(id); ids.push(id);
    assert.equal((await context.request.get(base + '/api/forms/' + id)).status(), 404);
    await button('Save my quiz').click(); await page.waitForURL(base + '/editor/' + id);
    await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
    assert.equal(await published(id), null); return id;
  }
  async function copy(mode, id) {
    await page.evaluate(mode => { window.__qaCopied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'missing' ? undefined : { writeText: text => mode === 'reject' ? Promise.reject(new Error('Synthetic clipboard rejection')) : (window.__qaCopied.push(text), Promise.resolve()) } }); }, mode);
    await success().getByRole('button', { name: /^(Copy Link|Copied!)$/ }).click();
    if (mode === 'success') { await success().getByRole('button', { name: 'Copied!', exact: true }).waitFor(); assert.deepEqual(await page.evaluate(() => window.__qaCopied), [base + '/play/' + id]); }
    else {
      await success().getByText('Your browser could not copy the link. Select the quiz public URL above and copy it manually.', { exact: true }).waitFor();
      assert.equal(await success().getByRole('button', { name: 'Copied!', exact: true }).count(), 0);
      assert.ok(await success().getByRole('textbox', { name: 'Quiz public URL', exact: true }).evaluate(el => el === document.activeElement && el.selectionStart === 0 && el.selectionEnd === el.value.length));
    }
  }
  async function share(id) {
    await success().getByRole('button', { name: /Embed & Share/ }).click(); await success().waitFor({ state: 'hidden' });
    const heading = page.getByRole('heading', { name: 'Share Your Quiz', exact: true }); await focused(heading, 'Share navigation focuses actual destination');
    assert.equal(await page.getByRole('heading', { name: 'Check it. Try it. Share it.', exact: true }).count(), 0);
    const region = page.getByRole('region', { name: 'Embed your quiz', exact: true }); await region.waitFor();
    const url = page.getByRole('textbox', { name: 'Quiz public URL', exact: true }); assert.equal(await url.inputValue(), base + '/play/' + id);
    const code = region.getByRole('textbox', { name: 'Quiz embed code', exact: true }); assert.ok((await code.inputValue()).includes('/pippi-embed.js'));
    await region.getByRole('radio', { name: 'Fixed height (no script)', exact: true }).check(); assert.ok(!(await code.inputValue()).includes('<script'));
    await region.getByRole('radio', { name: 'Click-to-open popup', exact: true }).check(); assert.ok((await code.inputValue()).includes('data-pippi-popup')); assert.ok((await code.inputValue()).includes('/pippi-popup.css'));
    await region.getByRole('radio', { name: 'Automatic height', exact: true }).check();
    await page.screenshot({ path: path.join(artifacts, 'share-' + ids.indexOf(id) + '.png') });
    await button('Back to guided Publish').click(); await focused(page.getByRole('heading', { name: 'Check it. Try it. Share it.', exact: true }), 'Return focuses guided Publish step');
    assert.equal(await region.count(), 0); assert.equal(await button('5. Publish').getAttribute('aria-current'), 'step');
  }
  async function scan(label, locator) {
    if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const result = await locator.evaluate(el => window.axe.run(el, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    scans.push({ label, violations: result.violations, incomplete: result.incomplete.map(item => ({ id: item.id, nodes: item.nodes.length })) }); assert.deepEqual(result.violations, [], label);
  }
  try {
    assert.equal((await context.request.post(base + '/api/auth', { headers, data: { local: true } })).status(), 200);
    // A real blank start remains blank; the creator adds the only question through guided controls.
    await page.goto(base + '/create/blank'); await button('Guided setup').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('heyquiz-draft:' + localStorage.getItem('pippi-guest-draft'))).questions.length), 0);
    const blankTitle = 'Synthetic blank sharing ' + engine;
    await page.getByLabel('Quiz title', { exact: true }).fill(blankTitle); await button('2. Questions').click(); await button('Add question').click();
    await page.getByLabel('Question wording', { exact: true }).fill('Which example would help?');
    await page.getByLabel('Answer wording', { exact: true }).nth(0).fill('A short example'); await page.getByLabel('Answer wording', { exact: true }).nth(1).fill('A detailed example');
    await page.getByLabel('Correct answer 1', { exact: true }).check(); await button('1. Your quiz').click();
    const blankId = await claim(); await goPublish(); await preview(blankId, blankTitle);
    for (const action of ['Back to editor', 'Escape']) { const before = activity.publishRequests; await openReview(); if (action === 'Escape') await page.keyboard.press('Escape'); else await readiness().getByRole('button', { name: action, exact: true }).click(); await readiness().waitFor({ state: 'hidden' }); assert.equal(activity.publishRequests, before); assert.equal(await published(blankId), null); assert.equal(await success().count(), 0); }
    checks.push('Blank UI creation, choice editing, claim, saved owner preview and both publication cancellation paths');
    // Fail before a publication exists. Readiness closes without inventing success or a live snapshot.
    await page.route(base + '/api/forms/' + blankId + '/publish', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, json: { error: 'Synthetic publication unavailable' } }) : route.continue());
    await openReview(); await readiness().getByRole('button', { name: 'Publish now', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Synthetic publication unavailable' }).waitFor();
    assert.equal(await published(blankId), null); assert.equal(await success().count(), 0); await status('Draft · Not public');
    await page.unroute(base + '/api/forms/' + blankId + '/publish'); await page.getByRole('alert').getByRole('button', { name: 'Dismiss', exact: true }).click();
    // A malformed success receipt can follow a real server publication. Never guess what went live.
    await page.route(base + '/api/forms/' + blankId + '/publish', async route => { const response = await route.fetch(); assert.equal(response.status(), 200); await route.fulfill({ response, json: { success: true, url: '/play/' + blankId, publication: { version: 1, formId: blankId, fingerprint: 'unverified' } } }); });
    await openReview(); await readiness().getByRole('button', { name: 'Publish now', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Publication may have completed, but its confirmation could not be verified.' }).waitFor();
    assert.equal(await success().count(), 0); assert.equal((await published(blankId)).title, blankTitle); assert.equal((await draft(blankId)).title, blankTitle);
    await status('Publication status needs checking'); assert.ok(await publishButton().isDisabled());
    await page.getByRole('alert').getByRole('button', { name: 'Dismiss', exact: true }).click(); await status('Publication status needs checking'); assert.ok(await publishButton().isDisabled(), 'Dismissing an error cannot remove an unknown-publication guard');
    await page.unroute(base + '/api/forms/' + blankId + '/publish'); await page.reload(); await page.getByLabel('Quiz title', { exact: true }).waitFor(); await status('Published · Up to date'); await goPublish();
    await publish(); assert.equal((await published(blankId)).title, blankTitle); await copy('success', blankId); await copy('reject', blankId); await copy('missing', blankId);
    // Clipboard rejection arriving after deliberate focus movement must not steal it back.
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise((resolve, reject) => { window.__qaClipboardReject = reject; }) } }));
    await success().getByRole('button', { name: 'Copy Link', exact: true }).click(); await success().getByRole('button', { name: 'Copying…', exact: true }).waitFor();
    await success().getByRole('button', { name: 'Done', exact: true }).focus(); await page.evaluate(() => window.__qaClipboardReject(new Error('Held synthetic rejection')));
    await success().getByRole('button', { name: 'Copy Link', exact: true }).waitFor(); await focused(success().getByRole('button', { name: 'Done', exact: true }), 'Late clipboard rejection preserves newer focus');
    await share(blankId); await status('Published · Up to date'); checks.push('Failed publish stays draft; successful publication, truthful clipboard states, actual Share modes and guided return');
    // A pending return request must yield to a newer explicit guided navigation.
    await button('Embed & Share').click(); await focused(page.getByRole('heading', { name: 'Share Your Quiz', exact: true }), 'Existing guided Share shortcut focuses destination');
    await holdFrames(); await button('Back to guided Publish').evaluate(el => el.click()); await page.getByRole('heading', { name: 'Check it. Try it. Share it.', exact: true }).waitFor();
    await button('1. Your quiz').evaluate(el => el.click()); await page.getByLabel('Quiz title', { exact: true }).focus(); await releaseFrames(); await focused(page.getByLabel('Quiz title', { exact: true }), 'Newer guided navigation cancels queued return focus'); await goPublish();
    // Persisted draft edits must not be misrepresented as the frozen live title.
    await page.setViewportSize({ width: 390, height: 844 }); await button('1. Your quiz').click(); const editedTitle = blankTitle + ' edited'; await page.getByLabel('Quiz title', { exact: true }).fill(editedTitle);
    await status('Published · Unpublished changes'); await until(async () => (await draft(blankId)).title === editedTitle, 'Edited title was not saved'); assert.equal((await published(blankId)).title, blankTitle);
    await page.screenshot({ path: path.join(artifacts, 'unpublished-mobile.png') }); await page.reload(); await page.getByLabel('Quiz title', { exact: true }).waitFor(); await status('Published · Unpublished changes'); assert.equal(await page.getByLabel('Quiz title', { exact: true }).inputValue(), editedTitle);
    await goPublish(); await preview(blankId, editedTitle); await publish(); assert.equal((await published(blankId)).title, editedTitle); await dismiss('Done'); await focused(publishButton(), 'Done returns to guided publish opener'); await status('Published · Up to date');
    // Keep-published cancellation is nonmutating; pause then republish retains the exact URL.
    const beforePause = await published(blankId); await button('Pause publication').click(); const pauseDialog = page.getByRole('dialog', { name: 'Pause this quiz?', exact: true }); await pauseDialog.getByRole('button', { name: 'Keep published', exact: true }).click(); assert.deepEqual(await published(blankId), beforePause);
    await button('Pause publication').click(); await pauseDialog.getByRole('button', { name: 'Pause publication', exact: true }).click(); await status('Draft · Not public'); assert.equal(await published(blankId), null); assert.equal(await page.getByRole('link', { name: 'Open published quiz →', exact: true }).count(), 0);
    assert.equal((await context.request.get(base + '/play/' + blankId)).status(), 404); await publish(); assert.equal(await success().getByRole('textbox', { name: 'Quiz public URL', exact: true }).inputValue(), base + '/play/' + blankId); await dismiss();
    assert.equal((await context.request.get(base + '/play/' + blankId)).status(), 200); checks.push('Saved-vs-live title, reload and current preview; cancelled pause, actual pause and same-URL republish');
    // Keyboard traversal stays inside the actual native modal, including both boundary directions.
    for (const [width, targetWidth, close] of [[1440, 1440, 'Escape'], [320, 320, 'Close publication confirmation'], [390, 390, 'Done'], [1440, 320, 'Escape'], [320, 1440, 'Close publication confirmation']]) {
      await page.setViewportSize({ width, height: 844 }); await publish(width < 1024 ? button('Publish') : publishButton()); await focused(success().getByRole('button', { name: 'Close publication confirmation', exact: true }), 'Initial modal focus at ' + width);
      const dialog = success(); assert.ok(await dialog.evaluate(el => el.matches(':modal'))); assert.ok(await dialog.evaluate(el => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1; }));
      await dialog.getByRole('button', { name: 'Done', exact: true }).focus(); await page.keyboard.press(forwardKey); await focused(dialog.getByRole('button', { name: 'Close publication confirmation', exact: true }), 'Forward modal wrap at ' + width);
      await page.keyboard.press(backwardKey); await focused(dialog.getByRole('button', { name: 'Done', exact: true }), 'Backward modal wrap at ' + width);
      for (let i = 0; i < 9; i++) { await page.keyboard.press(forwardKey); assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'Keyboard remains inside modal'); }
      await scan('confirmation-' + width + '-to-' + targetWidth, dialog); await page.screenshot({ path: path.join(artifacts, 'confirmation-' + width + '-to-' + targetWidth + '.png') });
      await page.setViewportSize({ width: targetWidth, height: 844 }); await frames(); await dismiss(close);
      const restored = width < 1024 && targetWidth < 1024 ? button('Publish') : publishButton();
      await focused(restored, close + ' restores visible guided opener ' + width + '→' + targetWidth);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    checks.push('Five modal sessions: 1440/320/390, Escape/Close/Done, both resize directions, forward/back keyboard containment and accessibility');
    // An enriched campaign starts from the real library rather than an API-authored imitation.
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/templates'); await page.getByRole('textbox', { name: 'Search templates' }).fill('Find your meal-planning rhythm');
    await page.getByRole('button').filter({ hasText: 'Find your meal-planning rhythm' }).filter({ hasText: 'Preview template' }).click(); await button('Use this template').click();
    await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor(); const campaignTitle = 'Synthetic enriched sharing ' + engine; await page.getByLabel('Quiz title', { exact: true }).fill(campaignTitle);
    const campaignId = await claim(), before = await draft(campaignId); assert.equal(before.coverPage.sections.length, 5); assert.ok(before.marketing.resultSections.length > 0); await goPublish(); await preview(campaignId, campaignTitle); await publish();
    assert.deepEqual((await published(campaignId)).questions, before.questions); assert.deepEqual((await published(campaignId)).marketing, before.marketing); await share(campaignId); await status('Published · Up to date');
    for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 844 }); await status('Published · Up to date'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: path.join(artifacts, 'guided-published-' + width + '.png') }); }
    checks.push('Real enriched-template selection/edit/claim/preview/publication/Share/return preserves all questions, scoring and rich result sections');
    assert.deepEqual(errors, []); for (const key of ['publicStarts', 'previewStarts', 'experimentMutations', 'providerRequests', 'externalRequests']) assert.equal(activity[key], 0, key);
    passed = true;
    console.log('PASS ' + engine + ': ' + checks.length + ' grouped guided-publication checks, ' + focusChecks.length + ' focus assertions, ' + scans.length + ' scoped accessibility scans; two real creator entry paths, zero starts/providers.');
  } catch (error) { await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
  finally {
    for (const id of ids) { const response = await context.request.delete(base + '/api/forms/' + id, { headers }).catch(() => null); const key = createHash('sha256').update(JSON.stringify(['local', id])).digest('hex'); await removeRecord('result_report_revocations', key, 'local'); await removeRecord('contact_segments', key, 'local'); cleanup.push({ id, status: response?.status(), formRemoved: !(await readRecord('forms', id)), publicationRemoved: !(await readRecord('published', id)) }); }
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ passed, engine, forwardKey, backwardKey, checks, focusChecks, scans, activity, pageErrors: errors, cleanup }, null, 2)); await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
