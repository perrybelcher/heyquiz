// Local editor-only email copy. No queue, recipient, capability or provider call.
const playwright = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { readRecord, removeRecord, cloudEnabled } = require('../lib/records.ts');
const { DEFAULT_RESULT_EMAIL_COPY } = require('../lib/result-email-copy.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164', engine = process.env.BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(process.env.HEYQUIZ_DATA_DIR); assert.equal(cloudEnabled(), false);
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-12/email-copy-editor'); fs.mkdirSync(artifacts, { recursive: true });
const id = 'qa-email-copy-editor-' + Date.now(), headers = { Origin: base }, attempts = [], errors = [], calls = [];
async function until(check, message) { for (let n = 0; n < 100; n++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw Error(message); }
(async () => {
 const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'chrome', headless: true } : { headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }), page = await context.newPage();
 page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message)); page.on('request', request => calls.push(new URL(request.url()).pathname));
 let dialogs = 0; page.on('dialog', async dialog => { assert.equal(dialog.type(), 'beforeunload'); dialogs++; await dialog.accept(); });
 const post = (url, data = {}) => context.request.post(base + url, { headers, data });
 const draft = async () => { const response = await context.request.get(base + '/api/forms/' + id); assert.equal(response.status(), 200); return response.json(); };
 const panel = page.getByRole('region', { name: 'Result email copy settings', exact: true });
 const summary = () => page.locator('summary').filter({ hasText: 'Result email copy' });
 const open = async () => { if (!(await panel.isVisible())) await summary().click(); await panel.waitFor(); };
 const field = name => panel.getByRole('textbox', { name, exact: true });
 const getFields = () => Promise.all(['Email subject', 'Email introduction', 'Email sign-off (optional)'].map(name => field(name).inputValue()));
 async function setCopy(copy) { for (const [name, key] of [['Email subject', 'subject'], ['Email introduction', 'introduction'], ['Email sign-off (optional)', 'signOff']]) await field(name).fill(copy[key]); }
 const apply = () => panel.getByRole('button', { name: 'Apply email copy', exact: true }).click();
 const valid = { version: 1, subject: 'Your next step with {brand_name}', introduction: 'Thanks for exploring {quiz_title}.\n\nYour private result is ready to review.', signOff: 'Take your time,\n{brand_name}' };
 try {
  assert.equal((await post('/api/auth', { local: true })).status(), 200);
  assert.equal((await post('/api/forms', { id, title: 'Synthetic copy editor survey', mode: 'survey', questions: [{ id: 'q', type: 'multiple_choice', title: 'Choose an answer', required: true, options: [{ id: 'a', label: 'First answer' }, { id: 'b', label: 'Second answer' }] }], theme: { brandName: 'Synthetic studio' }, settings: { showReviewBeforeSubmit: false } })).status(), 201);
  const initial = await draft(); await page.goto(base + '/'); await page.evaluate(() => window.__emailCopyNavigation = true); await page.locator('a[href="/editor/' + id + '"]').first().click(); await page.waitForURL(base + '/editor/' + id); assert.equal(await page.evaluate(() => window.__emailCopyNavigation), true, 'Real Next Link navigation kept the document'); await page.getByRole('button', { name: 'Ending', exact: true }).first().click(); await open();
  assert.deepEqual(await getFields(), [DEFAULT_RESULT_EMAIL_COPY.subject, DEFAULT_RESULT_EMAIL_COPY.introduction, '']);
  await summary().focus(); await page.keyboard.press('Enter'); assert.equal(await panel.isVisible(), false); await page.keyboard.press('Enter'); await panel.waitFor();
  await field('Email subject').focus(); await page.keyboard.press('Tab'); assert.ok(await field('Email introduction').evaluate(element => element === document.activeElement));
  assert.ok((await panel.innerText()).includes('Sending requires configured delivery; this editor previews wording only and never sends a message.'));
  const preview = panel.getByRole('region', { name: 'Sample email preview', exact: true }); assert.equal(await preview.locator('a').count(), 0);
  assert.equal(await preview.getByRole('combobox', { name: 'Preview wording for' }).inputValue(), 'resend');
  assert.ok(!(await preview.innerText()).includes('LOCAL TEST ONLY'));
  await preview.getByRole('combobox', { name: 'Preview wording for' }).selectOption('synthetic');
  assert.ok((await preview.innerText()).includes('LOCAL TEST ONLY'));
  await preview.getByRole('combobox', { name: 'Preview wording for' }).selectOption('resend');
  assert.ok(!(await preview.innerText()).includes('LOCAL TEST ONLY'));
  for (const text of ['Your sample quiz', 'Anyone with the link', 'does not subscribe', '2030-01-31']) assert.ok((await preview.innerText()).includes(text));
  assert.equal((await draft()).resultEmailCopy, undefined);

  for (const [name, value] of [['Email subject', 'x'.repeat(121)], ['Email introduction', '{contact.email}'], ['Email introduction', 'x'.repeat(1201)], ['Email sign-off (optional)', 'x'.repeat(161)], ['Email subject', ''], ['Email subject', '{quiz_title} {quiz_title} {quiz_title} {quiz_title} {quiz_title}']]) {
   await setCopy(DEFAULT_RESULT_EMAIL_COPY); await field(name).fill(value); assert.equal(await field(name).getAttribute('aria-invalid'), 'true'); assert.equal(await panel.getByRole('button', { name: 'Apply email copy', exact: true }).isDisabled(), true); assert.equal((await draft()).revision, initial.revision, 'Invalid local copy does not autosave');
  }
  await setCopy(DEFAULT_RESULT_EMAIL_COPY);
  await page.getByRole('textbox', { name: 'Quiz name', exact: true }).fill('Q'); await until(async () => (await draft()).title === 'Q', 'Short title did not autosave');
  const nearBound = { ...DEFAULT_RESULT_EMAIL_COPY, subject: Array(9).fill('{quiz_title}').join(' ') }; await setCopy(nearBound);
  await preview.getByText('The fixed sample names make this preview too long.', { exact: false }).waitFor(); assert.equal(await panel.getByRole('button', { name: 'Apply email copy', exact: true }).isDisabled(), false);
  await apply(); await until(async () => (await draft()).resultEmailCopy?.subject === nearBound.subject, 'Valid actual-title expansion could not apply');
  await panel.getByRole('button', { name: 'Apply default copy', exact: true }).click(); await page.getByRole('textbox', { name: 'Quiz name', exact: true }).fill(initial.title);
  await until(async () => { const row = await draft(); return !row.resultEmailCopy && row.title === initial.title; }, 'Near-bound fixture reset failed');
  await setCopy(valid); await field('Email introduction').fill('<img src=x onerror=alert(1)> Read {quiz_title}. https://example.test');
  assert.ok((await preview.innerText()).includes('<img src=x onerror=alert(1)>')); assert.equal(await preview.locator('img,a').count(), 0);
  await setCopy(valid);
  await summary().click(); await summary().click(); assert.deepEqual(await getFields(), [valid.subject, valid.introduction, valid.signOff]);
  await page.getByRole('button', { name: 'Guided setup', exact: true }).click(); await page.getByRole('button', { name: '3. Results', exact: true }).click(); await open(); assert.deepEqual(await getFields(), [valid.subject, valid.introduction, valid.signOff]);
  await page.getByRole('button', { name: '1. Your quiz', exact: true }).click(); await page.getByRole('button', { name: '3. Results', exact: true }).click(); await open(); assert.deepEqual(await getFields(), [valid.subject, valid.introduction, valid.signOff]);
  await page.goBack(); await page.waitForURL(base + '/'); await page.goForward(); await page.waitForURL(base + '/editor/' + id);
  await page.getByRole('button', { name: '3. Results', exact: true }).click(); await open(); assert.deepEqual(await getFields(), [valid.subject, valid.introduction, valid.signOff]);
  await page.reload(); await page.getByRole('button', { name: '3. Results', exact: true }).click(); await open();
  await panel.getByText('Unapplied copy was recovered in this browser tab.', { exact: false }).waitFor(); assert.deepEqual(await getFields(), [valid.subject, valid.introduction, valid.signOff]); assert.ok(dialogs >= 1, 'Pending copy warns on document unload');
  await apply(); await until(async () => JSON.stringify((await draft()).resultEmailCopy) === JSON.stringify(valid), 'Applied copy did not autosave');
  assert.equal(await page.evaluate(id => sessionStorage.getItem('pippi-result-email-copy:' + id), id), null, 'Applied pending copy cleared');
  await page.reload(); await page.getByRole('button', { name: '3. Results', exact: true }).click(); await open(); assert.deepEqual(await getFields(), [valid.subject, valid.introduction, valid.signOff]);

  const scans = [];
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  for (const width of [320, 390, 1440]) {
   await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Editor fits ' + width);
   const scan = await panel.evaluate(element => window.axe.run(element, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
   scans.push({ width, violations: scan.violations }); await panel.screenshot({ path: path.join(artifacts, 'email-copy-' + width + '.png') }); assert.deepEqual(scan.violations, []);
   await panel.getByRole('button', { name: 'Apply default copy', exact: true }).scrollIntoViewIfNeeded();
   await page.screenshot({ path: path.join(artifacts, 'email-controls-' + width + '.png') });
   await preview.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(artifacts, 'email-preview-' + width + '.png') });
  }
  fs.writeFileSync(path.join(artifacts, 'accessibility.json'), JSON.stringify(scans, null, 2));
  assert.equal((await post('/api/forms/' + id + '/publish')).status(), 200);
  const started = await (await post('/api/forms/' + id + '/start')).json(), attemptId = JSON.parse(Buffer.from(started.token.split('.')[0], 'base64url')).id; attempts.push(attemptId);
  assert.equal(started.form.resultEmailCopy, undefined, 'Creator copy is not exposed in public form'); assert.deepEqual((await readRecord('attempts', attemptId)).payload.form.resultEmailCopy, valid);
  const changed = { ...valid, subject: 'A later subject', signOff: 'A later sign-off' }; await setCopy(changed); await apply(); await until(async () => (await draft()).resultEmailCopy.subject === changed.subject, 'Later draft did not save');
  assert.deepEqual((await readRecord('published', id)).payload.resultEmailCopy, valid, 'Draft does not change published copy'); assert.equal((await post('/api/forms/' + id + '/publish')).status(), 200);
  assert.deepEqual((await readRecord('attempts', attemptId)).payload.form.resultEmailCopy, valid, 'Existing attempt copy stays frozen after republish');
  const later = await (await post('/api/forms/' + id + '/start')).json(), laterId = JSON.parse(Buffer.from(later.token.split('.')[0], 'base64url')).id; attempts.push(laterId); assert.deepEqual((await readRecord('attempts', laterId)).payload.form.resultEmailCopy, changed);

  await page.route(base + '/api/forms/' + id, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'Synthetic save unavailable' } }) : route.continue());
  await field('Email subject').fill('Retry-safe copy'); await apply(); await page.locator('.hq-error').waitFor(); assert.equal((await draft()).resultEmailCopy.subject, changed.subject); assert.equal(await field('Email subject').inputValue(), 'Retry-safe copy');
  await page.unroute(base + '/api/forms/' + id); await page.getByRole('button', { name: 'Retry save', exact: true }).click(); await until(async () => (await draft()).resultEmailCopy.subject === 'Retry-safe copy', 'Retry did not persist copy');
  await panel.getByRole('button', { name: 'Apply default copy', exact: true }).click(); await until(async () => (await draft()).resultEmailCopy === undefined, 'Default reset did not autosave');
  assert.deepEqual((await readRecord('published', id)).payload.resultEmailCopy, changed, 'Reset remains a draft until published');
  // An external form revision makes recovered pending copy explicitly stale.
  await setCopy(valid); const fresh = await draft(); assert.equal((await context.request.put(base + '/api/forms/' + id, { headers, data: { ...fresh, resultEmailCopy: changed } })).status(), 200);
  await page.reload(); await page.getByRole('button', { name: '3. Results', exact: true }).click(); await open();
  await panel.getByText('The saved copy changed while you were editing.', { exact: false }).waitFor(); assert.equal(await panel.getByRole('button', { name: 'Apply email copy', exact: true }).isDisabled(), true);
  assert.equal(await field('Email subject').inputValue(), valid.subject); await panel.getByRole('button', { name: 'Reload current copy', exact: true }).click(); assert.equal(await field('Email subject').inputValue(), changed.subject);
  await panel.getByRole('button', { name: 'Apply default copy', exact: true }).click(); await until(async () => !(await draft()).resultEmailCopy, 'Reset after conflict did not save');
  // Failed pending-backup writes remain visible and never imply account saving.
  await page.evaluate(id => { const set = Storage.prototype.setItem; window.__restoreEmailCopyStorage = () => Storage.prototype.setItem = set; Storage.prototype.setItem = function (key, value) { if (key === 'pippi-result-email-copy:' + id) throw Error('Synthetic session storage failure'); return set.call(this, key, value); }; }, id);
  await field('Email subject').fill('Pending without a backup'); await panel.getByRole('alert').filter({ hasText: 'Pending copy could not be backed up' }).waitFor(); assert.equal((await draft()).resultEmailCopy, undefined);
  await page.evaluate(() => window.__restoreEmailCopyStorage()); await panel.getByRole('button', { name: 'Discard unapplied changes', exact: true }).click();
  // Invalid/foreign session records cannot automatically change the quiz.
  for (const record of [JSON.stringify({ version: 1, quizId: 'another-quiz', draft: { baseline: 'null', copy: valid } }), '{broken', 'x'.repeat(18001)]) {
   await page.evaluate(({ id, record }) => sessionStorage.setItem('pippi-result-email-copy:' + id, record), { id, record });
   await page.reload(); await page.getByRole('button', { name: '3. Results', exact: true }).click(); await open(); assert.deepEqual(await getFields(), [DEFAULT_RESULT_EMAIL_COPY.subject, DEFAULT_RESULT_EMAIL_COPY.introduction, '']);
  }
  await page.evaluate(id => sessionStorage.removeItem('pippi-result-email-copy:' + id), id);
  const final = await draft(); for (const key of ['questions', 'theme', 'settings', 'capture', 'mode']) assert.deepEqual(final[key], initial[key], 'Unrelated quiz field unchanged: ' + key);
  assert.ok(!calls.some(url => /result-email|result-link/.test(url)), 'Editor never creates private capabilities or queues'); assert.deepEqual(errors, []);
  console.log('PASS ' + engine + ' result-email editor: invalid copy isolated, apply/reset/retry, safe sample/footer, guided/full/collapse and actual Next back/forward retention, session reload/stale/failed recovery, publication and frozen attempts,320/390/desktop accessibility. Two synthetic starts; no queue or email.');
 } catch (error) { await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); throw error; }
 finally { await page.close(); await context.request.delete(base + '/api/forms/' + id, { headers }); for (const attempt of attempts) await removeRecord('attempts', attempt, 'local'); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
