// Final local integration rehearsal. UI-created quizzes; literal expected results.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { chromium } = require('playwright'), { createHash } = require('node:crypto'), { execFileSync } = require('node:child_process');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { readRecord, listRecords, removeRecord, cloudEnabled } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL, dataDir = process.env.HEYQUIZ_DATA_DIR, expectedDataDir = process.env.EXPECTED_TEST_DATA_DIR;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/, 'Explicit isolated loopback server required');
assert.ok(dataDir && expectedDataDir && path.isAbsolute(dataDir) && path.resolve(dataDir) === path.resolve(expectedDataDir), 'Explicit matching synthetic-data directory required');
assert.equal(cloudEnabled(), false);
for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) assert.ok(!process.env[key], 'Cloud aliases must be blank');
const originalFetch = global.fetch; global.fetch = () => { throw Error('No Node outbound requests are allowed'); };
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '/tmp/pippi-creator-reconciliation'); fs.mkdirSync(artifacts, { recursive: true });
const headers = { Origin: base }, ownerId = 'local', ids = [], checks = [], cleanup = [], snapshots = [], errors = [], blocked = [];
const activity = { publicStarts: 0, previewStarts: 0, resultLinks: 0, pdfs: 0, emailStatusReads: 0, submits: 0 };
let passed = false, activePage, reportPath;
const normalize = text => text.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
const safeError = value => String(value).replace(/\/(?:api\/)?result\/[^\s'"<>]+/g, '/result/[redacted]');
async function until(check, description) { for (let n = 0; n < 100; n++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw Error(description); }
function parseCsv(text) {
  text = text.replace(/^\ufeff/, ''); // Contacts intentionally exports a UTF-8 BOM for spreadsheet tools.
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; } else if (c === ',' && !quoted) { row.push(cell); cell = ''; } else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c; }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); } assert.equal(quoted, false); return rows;
}
async function json(response, status = 200) { assert.equal(response.status(), status, 'Local API status'); return response.json(); }
// Arm before clicking without permitting an abandoned wait to escape cleanup.
// The original promise is still awaited strictly at its intended assertion.
function guardedWait(promise) { promise.catch(() => {}); return promise; }
function childOf(row) { return row.owner_id === ownerId && ids.includes(row.payload?.formId || row.payload?.form?.id); }
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }), visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await owner.newPage(), respondent = await visitor.newPage(); activePage = page;
  for (const context of [owner, visitor]) {
    const watch = p => { p.setDefaultTimeout(15000); p.on('pageerror', e => errors.push(safeError(e.message))); p.on('dialog', d => { if (d.type() !== 'beforeunload') errors.push('Unexpected dialog: ' + d.type()); void d.accept(); }); };
    context.pages().forEach(watch); context.on('page', watch);
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()); let deny;
      if (/^https?:$/.test(url.protocol) && url.origin !== base) deny = 'external';
      else if (/\/api\/(agent|integrations)(\/|$)/.test(url.pathname) || /\/api\/forms\/[^/]+\/integrations(\/|$)/.test(url.pathname) || (/\/api\/experiments/.test(url.pathname) && request.method() !== 'GET')) deny = 'provider-or-experiment';
      else if (/\/api\/forms\/[^/]+\/result-email$/.test(url.pathname)) { if (request.method() === 'POST' && request.postDataJSON()?.action === 'status') activity.emailStatusReads++; else deny = 'email-mutation'; }
      else if (/\/api\/forms\/[^/]+\/start$/.test(url.pathname)) { const key = request.postDataJSON()?.preview === true ? 'previewStarts' : 'publicStarts'; if (++activity[key] > 2) deny = 'start-budget'; }
      else if (/\/api\/forms\/[^/]+\/submit$/.test(url.pathname)) activity.submits++;
      else if (/\/api\/forms\/[^/]+\/result-link$/.test(url.pathname)) { if (++activity.resultLinks > 1) deny = 'result-link-budget'; }
      else if (/\/api\/result\/[^/]+\/pdf$/.test(url.pathname)) { if (++activity.pdfs > 1) deny = 'pdf-budget'; }
      if (deny) { blocked.push(deny); return route.abort(); } return route.continue();
    });
  }
  const button = name => page.getByRole('button', { name, exact: true });
  const draft = id => owner.request.get(base + '/api/forms/' + id).then(json);
  const recordList = async (kind, id) => (await listRecords(kind, ownerId)).filter(row => row.owner_id === ownerId && (row.payload?.formId || row.payload?.form?.id) === id);
  const status = text => page.getByRole('status').filter({ hasText: text }).first().waitFor();
  async function claim() {
    const id = await page.evaluate(() => localStorage.getItem('pippi-guest-draft')); assert.match(id, /^quiz-[A-Za-z0-9_-]+$/);
    assert.equal((await owner.request.get(base + '/api/forms/' + id)).status(), 404); ids.push(id);
    await button('Save my quiz').click(); await page.waitForURL(base + '/editor/' + id);
    await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
    const stored = await readRecord('forms', id); assert.equal(stored?.owner_id, ownerId, 'Server and local assertions use the same synthetic data'); return id;
  }
  async function play(p, form, preview, capture) {
    activePage = p; await p.getByRole('heading', { name: form.coverPage?.title || form.title, exact: true }).waitFor();
    const starting = guardedWait(p.waitForResponse(r => r.url() === base + `/api/forms/${form.id}/start` && r.request().method() === 'POST'));
    await p.getByRole('button', { name: form.coverPage?.buttonText || 'Let’s begin', exact: true }).first().click();
    const start = await json(await starting), claims = JSON.parse(Buffer.from(start.token.split('.')[0], 'base64url').toString());
    const attempt = await readRecord('attempts', claims.id); assert.equal(attempt?.owner_id, ownerId); assert.equal(attempt.payload.form.id, form.id); assert.equal(attempt.payload.preview, preview); assert.equal(attempt.payload.form.title, form.title); assert.equal(attempt.payload.form.publishedAt, form.publishedAt); assert.deepEqual(attempt.payload.form.questions, form.questions); assert.deepEqual(attempt.payload.form.marketing, form.marketing);
    const submitting = guardedWait(p.waitForResponse(r => r.url() === base + `/api/forms/${form.id}/submit` && r.request().method() === 'POST'));
    for (const [index, question] of form.questions.entries()) {
      await p.getByRole('heading', { name: question.title, exact: true }).waitFor();
      const answer = form.marketing ? question.options.find(o => o.id === 'a0') : question.options[0]; assert.ok(answer, 'Literal chosen answer exists');
      await p.getByRole('radio', { name: answer.label, exact: true }).check();
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Question fits viewport');
      await p.getByRole('button', { name: index + 1 < form.questions.length ? 'Continue' : form.settings.showReviewBeforeSubmit ? 'Review answers' : 'Submit response', exact: true }).click();
    }
    if (form.settings.showReviewBeforeSubmit) await p.getByRole('button', { name: 'Submit response', exact: true }).click();
    if (form.capture?.enabled) {
      await p.getByRole('heading', { name: form.capture.title, exact: true }).waitFor();
      if (capture) { await p.getByRole('textbox', { name: 'Name (optional)', exact: true }).fill('Synthetic reconciliation'); await p.getByRole('textbox', { name: 'Email', exact: true }).fill('reconciliation@example.test'); assert.equal(await p.getByRole('checkbox').count(), 0, 'Marketing opt-in is not offered'); await p.getByRole('button', { name: form.capture.buttonText, exact: true }).click(); }
      else await p.getByRole('button', { name: 'Skip for now', exact: true }).click();
    }
    const result = await json(await submitting);
    if (form.marketing) { assert.equal(result.marketing.status, 'matched'); assert.equal(result.marketing.outcomeId, 'path0'); assert.equal(result.marketing.title, 'Build a rotating menu'); assert.equal(result.marketing.overallScore ?? null, null); assert.deepEqual(result.marketing.categories, []); assert.deepEqual(result.marketing.resultSections.map(x => x.id), ['campaign-path0', 'campaign-reflection', 'campaign-result-faq']); await p.getByRole('heading', { name: 'Build a rotating menu', exact: true }).waitFor(); }
    else { assert.equal(result.percentageScore, 100); assert.equal(result.grading.length, 1); assert.equal(result.grading[0].isCorrect, true); assert.equal(result.marketing ?? null, null); await p.getByText('Response received', { exact: true }).waitFor(); }
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Result fits viewport');
    if (preview) assert.equal(await readRecord('submissions', claims.id), null, 'Completed preview creates no retained submission');
    else { const saved = await readRecord('submissions', claims.id); assert.equal(saved.owner_id, ownerId); assert.equal(saved.payload.formId, form.id); assert.equal(Boolean(saved.payload.contact), Boolean(capture)); assert.deepEqual(saved.payload.answers, Object.fromEntries(form.questions.map(q => [q.id, form.marketing ? 'a0' : q.options[0].id]))); if (capture) { assert.equal(saved.payload.contact.email, 'reconciliation@example.test'); assert.equal(saved.payload.contact.marketingConsent, false); } }
    return { responseId: claims.id, result };
  }
  async function publishAndPreview(id, label) {
    const form = await draft(id); await button('5. Publish').click();
    const opened = guardedWait(owner.waitForEvent('page')); await button('Save & preview').click(); const preview = await opened;
    await preview.waitForURL(base + `/play/${id}?preview=1`); await preview.getByText('Preview · responses aren’t saved', { exact: false }).waitFor();
    await play(preview, form, true, false); await preview.close(); activePage = page;
    assert.equal((await recordList('submissions', id)).length, 0);
    const empty = await json(await owner.request.get(base + `/api/forms/${id}/analytics?range=all`)); assert.equal(empty.starts, 0); assert.equal(empty.completions, 0);
    await button('Review & publish').click(); await page.getByRole('dialog', { name: 'Ready to publish?', exact: true }).getByRole('button', { name: 'Publish now', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Your Quiz is Published!', exact: true }); await confirmation.waitFor();
    const url = await confirmation.getByRole('textbox', { name: 'Quiz public URL', exact: true }).inputValue(); assert.equal(url, base + '/play/' + id);
    await confirmation.getByRole('button', { name: 'Embed & Share', exact: true }).click(); await page.getByRole('heading', { name: 'Share Your Quiz', exact: true }).waitFor(); await page.getByRole('region', { name: 'Embed your quiz', exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, label + '-creator-share.png') });
    const published = (await readRecord('published', id)).payload; assert.deepEqual(published.questions, form.questions); assert.equal(published.title, form.title);
    await button('Back to guided Publish').click(); await button('1. Your quiz').click(); await page.getByLabel('Quiz title', { exact: true }).fill(form.title + ' — unpublished draft');
    await until(async () => (await draft(id)).title === form.title + ' — unpublished draft', 'Unpublished edit saved'); await status('Published · Unpublished changes');
    await respondent.goto(url); const completed = await play(respondent, published, false, Boolean(form.marketing));
    await respondent.screenshot({ path: path.join(artifacts, label + '-mobile-result.png'), fullPage: true });
    snapshots.push({ label, formId: id, responseId: completed.responseId, publishedTitle: form.title, expectedResult: form.marketing ? 'Build a rotating menu' : '100%', contact: Boolean(form.marketing) });
    return { form: published, ...completed };
  }
  async function reconcile(fixture, label) {
    const { form, responseId } = fixture, lead = form.marketing ? 1 : 0; activePage = page;
    await until(async () => { const data = await json(await owner.request.get(base + `/api/forms/${form.id}/analytics?range=all`)); return data.starts === 1 && data.completions === 1 && data.questions.every(q => q.reached === 1 && q.completed === 1); }, 'Real tracking and completion settle without artificial events');
    const analytics = await json(await owner.request.get(base + `/api/forms/${form.id}/analytics?range=all`));
    assert.equal(analytics.starts, 1); assert.equal(analytics.completions, 1); assert.equal(analytics.completionRate, 100); assert.equal(analytics.leads, lead); assert.equal(analytics.consentedLeads, 0); assert.equal(analytics.questions.length, form.questions.length);
    const attempts = await recordList('attempts', form.id); assert.equal(attempts.filter(r => !r.payload.preview).length, 1); assert.equal(attempts.filter(r => r.payload.preview).length, 1); assert.ok(attempts.every(r => r.payload.completed));
    const submissions = await recordList('submissions', form.id); assert.equal(submissions.length, 1); assert.equal(submissions[0].id, responseId);
    const directory = await json(await owner.request.get(base + `/api/forms/${form.id}/contacts`)); assert.equal(directory.contacts.length, lead); if (lead) assert.equal(directory.contacts[0].id, responseId);
    await page.goto(base + '/editor/' + form.id); await page.getByRole('button', { name: 'Full editor & advanced tools', exact: true }).click(); await button('Contacts').click();
    const contacts = page.getByRole('region', { name: 'Contact directory', exact: true }); await contacts.getByRole('heading', { name: `Contacts (${lead})`, exact: true }).waitFor();
    if (lead) {
      const summary = contacts.locator('[data-contact-row] > summary'); await summary.click(); await contacts.getByText(responseId, { exact: true }).waitFor(); assert.ok((await summary.innerText()).includes('No marketing consent'));
      const downloading = guardedWait(page.waitForEvent('download')); await contacts.getByRole('button', { name: 'Export CSV', exact: true }).click(); const file = await downloading; await file.saveAs(path.join(artifacts, 'campaign-contacts.csv'));
      const rows = parseCsv(fs.readFileSync(await file.path(), 'utf8')); assert.equal(rows.length, 2); const row = Object.fromEntries(rows[0].map((key, i) => [key, rows[1][i]])); assert.equal(row.responseId, responseId); assert.equal(row.email, 'reconciliation@example.test'); assert.equal(row.marketingConsent, 'false'); assert.equal(JSON.parse(row.result).title, 'Build a rotating menu');
    }
    await contacts.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(artifacts, label + '-owner-contacts.png') });
    await button('Results').click(); const report = page.getByRole('region', { name: 'Conversion analytics', exact: true }); await report.getByRole('heading', { name: 'Question performance', exact: true }).waitFor();
    for (const [label, expected] of [['Quiz starts', '1'], ['Completion rate', '100%'], ['Captured leads', String(lead)]]) assert.equal(await report.locator('.report-metric').filter({ hasText: label }).locator(':scope > p').nth(1).innerText(), expected);
    const downloading = guardedWait(page.waitForEvent('download')); await report.getByRole('button', { name: 'Export question performance', exact: true }).click(); const file = await downloading; await file.saveAs(path.join(artifacts, label + '-questions.csv')); const rows = parseCsv(fs.readFileSync(await file.path(), 'utf8'));
    assert.deepEqual(rows[0].slice(0, 5), ['Question', 'Reached', 'Completed quiz', 'Quiet at this step', 'Measured sessions']); assert.equal(rows.length, form.questions.length + 1); for (const [i, question] of form.questions.entries()) assert.deepEqual(rows[i + 1].slice(0, 5), [question.title, '1', '1', '0', '1']);
    await report.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(artifacts, label + '-owner-analytics.png') });
    checks.push(label + ': actual UI preview/public completion; frozen publication; literal result; retained rows, visible Contacts/Results and CSV reconcile');
  }
  try {
    await json(await owner.request.post(base + '/api/auth', { headers, data: { local: true } }));
    await page.goto(base + '/create/blank'); await button('Guided setup').click();
    await page.getByLabel('Quiz title', { exact: true }).fill('Synthetic knowledge reconciliation'); await button('2. Questions').click(); await button('Add question').click(); await page.getByLabel('Question wording', { exact: true }).fill('Which example is shorter?');
    await page.getByLabel('Answer wording', { exact: true }).nth(0).fill('One sentence'); await page.getByLabel('Answer wording', { exact: true }).nth(1).fill('A full chapter'); await page.getByLabel('Correct answer 1', { exact: true }).check(); await button('1. Your quiz').click();
    const blank = await publishAndPreview(await claim(), 'blank'); await reconcile(blank, 'blank');
    await page.goto(base + '/templates'); await page.getByRole('textbox', { name: 'Search templates' }).fill('Find your meal-planning rhythm'); await page.getByRole('button').filter({ hasText: 'Find your meal-planning rhythm' }).filter({ hasText: 'Preview template' }).click(); await button('Use this template').click();
    await page.getByLabel('Quiz title', { exact: true }).fill('Synthetic meal planning reconciliation'); const campaignId = await claim(); const campaignDraft = await draft(campaignId); assert.equal(campaignDraft.questions.length, 5); assert.equal(campaignDraft.capture.enabled, true); assert.equal(campaignDraft.capture.marketingEnabled, false);
    const campaign = await publishAndPreview(campaignId, 'campaign');
    activePage = respondent; const linking = guardedWait(respondent.waitForResponse(r => r.url() === base + `/api/forms/${campaignId}/result-link` && r.request().method() === 'POST')); await respondent.getByRole('button', { name: 'Create private result link', exact: true }).click(); const link = await json(await linking); reportPath = link.path;
    const claims = JSON.parse(Buffer.from(reportPath.split('/').pop().split('.')[0], 'base64url').toString()), saved = await readRecord('result_reports', claims.id); assert.equal(saved.owner_id, ownerId); assert.equal(saved.payload.formId, campaignId); assert.equal(saved.payload.submissionId, campaign.responseId); assert.equal(saved.payload.quizTitle, campaign.form.title); assert.deepEqual(saved.payload.result.marketing, campaign.result.marketing);
    await respondent.goto(base + reportPath); await respondent.getByRole('heading', { name: 'Build a rotating menu', exact: true }).waitFor(); assert.equal(await respondent.getByText(campaign.form.title + ' — unpublished draft', { exact: true }).count(), 0);
    const downloading = guardedWait(respondent.waitForEvent('download')); await respondent.getByRole('button', { name: 'Download PDF', exact: true }).click(); const pdf = await downloading, pdfPath = path.join(artifacts, 'campaign-private-result.pdf'); await pdf.saveAs(pdfPath); assert.equal(fs.readFileSync(pdfPath).subarray(0, 5).toString(), '%PDF-');
    const python = process.env.PDF_TEST_PYTHON || '/Users/perry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
    const text = normalize(execFileSync(python, ['-c', 'import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages))', pdfPath], { encoding: 'utf8' }));
    assert.ok(text.includes(campaign.form.title)); assert.ok(text.includes('Build a rotating menu')); let at = -1; for (const section of campaign.result.marketing.resultSections) { const next = text.indexOf(normalize(section.title), at + 1); assert.ok(next > at, 'Printed section order'); at = next; assert.ok(text.includes(normalize(section.body)), 'Complete saved guidance printed'); } for (const forbidden of [campaignId, reportPath.split('/').pop(), 'unpublished draft', 'reconciliation@example.test']) assert.ok(!text.includes(forbidden), 'PDF omits private identifiers/contact and later draft text');
    await respondent.screenshot({ path: path.join(artifacts, 'campaign-private-report.png'), fullPage: true });
    checks.push('Campaign private result and native PDF retain the same literal result/guidance, without contact/token/later-draft leakage');
    await reconcile(campaign, 'campaign');
    assert.equal(activity.publicStarts, 2); assert.equal(activity.previewStarts, 2); assert.equal(activity.submits, 4); assert.equal(activity.resultLinks, 1); assert.equal(activity.pdfs, 1); assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    passed = true; console.log('PASS two real creator→preview→publication→anonymous completion→owner reconciliation journeys; one private report/PDF; no provider or email mutation.');
  } catch (error) { await activePage?.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true, mask: [activePage.getByLabel('Private result link', { exact: true })] }).catch(() => {}); throw error; }
  finally {
    for (const context of [owner, visitor]) for (const p of context.pages()) await p.close().catch(() => {});
    try {
      const ownedChildren = []; for (const kind of ['attempts', 'submissions', 'landing_visits', 'result_reports', 'result_report_link_revocations', 'result_email_jobs']) for (const row of await listRecords(kind, ownerId)) if (childOf(row)) ownedChildren.push({ kind, id: row.id, formId: row.payload.formId || row.payload.form.id });
      for (const id of ids) { const row = await readRecord('forms', id); if (row) { assert.equal(row.owner_id, ownerId); await json(await owner.request.delete(base + '/api/forms/' + id, { headers })); } }
      for (const child of ownedChildren) { const row = await readRecord(child.kind, child.id); if (row) { assert.ok(childOf(row)); await removeRecord(child.kind, child.id, ownerId); } cleanup.push({ ...child, removed: !(await readRecord(child.kind, child.id)) }); }
      for (const id of ids) { const key = createHash('sha256').update(JSON.stringify([ownerId, id])).digest('hex'); for (const kind of ['result_report_revocations', 'contact_segments']) { const row = await readRecord(kind, key); if (row) { assert.equal(row.owner_id, ownerId); assert.equal(row.kind, kind); assert.equal(row.id, key); if (kind === 'contact_segments') assert.equal(row.payload.formId, id); else { assert.deepEqual(Object.keys(row.payload), ['retiredAt']); assert.ok(Number.isSafeInteger(row.payload.retiredAt)); } await removeRecord(kind, key, ownerId); } cleanup.push({ kind, id: key, formId: id, removed: !(await readRecord(kind, key)) }); } cleanup.push({ kind: 'form', id, removed: !(await readRecord('forms', id)) && !(await readRecord('published', id)) }); }
      assert.ok(cleanup.every(item => item.removed));
    } catch (error) { passed = false; errors.push('Cleanup: ' + safeError(error.message)); process.exitCode = 1; }
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ passed, engine: 'Chrome', checks, activity, blocked, errors, fixtureLedger: snapshots, createdFormIds: ids, cleanup }, null, 2)); await browser.close(); global.fetch = originalFetch;
  }
})().catch(error => { console.error(safeError(error.stack || error)); process.exitCode = 1; });
