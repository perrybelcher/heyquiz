// Seven final original campaigns: isolated browser creation, publication and report parity.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { createHash } = require('node:crypto'), { execFileSync } = require('node:child_process');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { launchTemplate, launchTemplates } = require('../lib/launch-templates.ts');
const { templateCampaignDetails } = require('../lib/template-campaigns.ts');
const { evaluateMarketing } = require('../lib/marketing.ts');
const { readRecord, removeRecord, listRecords, cloudEnabled } = require('../lib/records.ts');
const fixtures = require('./template-campaigns-batch14.cjs');
const campaignTemplateIds=fixtures.ids;
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR || cloudEnabled()) throw Error('Use dedicated isolated localhost data.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-14/campaigns');
fs.mkdirSync(artifacts, { recursive: true });
// PDF extraction can insert whitespace before kerned punctuation. Normalize that
// spacing only; all words and their order must still match the complete copy.
const normalize = text => text.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
async function json(response, status) { assert.equal(response.status(), status, `Local API status ${response.status()}, expected ${status}`); return response.json(); }
async function until(check, description) {
  for (let n = 0; n < 60; n++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw Error(description);
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), visitor = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await owner.newPage(), publicPage = await visitor.newPage(), errors = [], created = [], reports = [], checks = [], headers = { Origin: base };
  for (const current of [page, publicPage]) current.on('pageerror', error => errors.push(error.message));
  const post = (context, url, data = {}) => context.request.post(base + url, { headers, data });
  const getDraft = async id => json(await owner.request.get(base + '/api/forms/' + id), 200);
  let activePage = page;
  try {
    await page.goto(base + '/templates');
    await page.getByRole('button',{name:'Browse additional existing templates',exact:true}).click();
    await page.getByRole('status').filter({ hasText: '43 templates found' }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Prefer a blank quiz/ }).getAttribute('href'), '/create/blank');
    for (const id of campaignTemplateIds) {
      const entry = launchTemplates.find(template => template.id === id), details = templateCampaignDetails(id);
      await page.getByRole('textbox', { name: 'Search templates' }).fill(entry.name);
      await page.getByRole('button').filter({ hasText: entry.name }).filter({ hasText: 'Preview template' }).click();
      const panel = page.getByRole('region', { name: 'Template details', exact: true });
      await panel.getByText('Landing and result content included', { exact: true }).waitFor();
      for (const item of details.checklist) assert.ok(await panel.getByText(item, { exact: true }).isVisible());
      assert.ok(await panel.getByText('5 landing sections', { exact: true }).isVisible());
      if (id === 'candles' || id === 'scorecard') {
        await page.setViewportSize(id === 'candles' ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Template details fit viewport');
        await panel.screenshot({ path: path.join(artifacts, `template-${id}.png`) });
      }
      await panel.getByRole('button', { name: 'Close template preview', exact: true }).click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('textbox', { name: 'Search templates' }).fill('Find your home fragrance');
    await page.getByRole('button').filter({ hasText: 'Find your home fragrance' }).filter({ hasText: 'Preview template' }).click();
    await page.getByRole('button', { name: 'Use this template', exact: true }).click();
    await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
    const guest = await page.evaluate(() => JSON.parse(localStorage.getItem('heyquiz-draft:' + localStorage.getItem('pippi-guest-draft'))));
    assert.equal(guest.title, 'Find your home fragrance'); assert.equal(guest.coverPage.sections.length, 5);
    assert.equal(guest.marketing.presentation.layout, 'stacked'); assert.equal(guest.marketing.outcomes.length, 3);
    checks.push('Seven additional detail previews and specific checklists, blank start, independent fragrance guest draft');
    await json(await post(owner, '/api/auth', { local: true }), 200);

    for (const [index, kind] of campaignTemplateIds.entries()) {
      const id = `qa-campaign-${kind}-${Date.now()}`, form = launchTemplate(kind, id), details = templateCampaignDetails(kind);
      const expected = fixtures.cases(kind)[fixtures.browserCase[kind]];
      const answers = fixtures.answers(form, expected), expectedResult = evaluateMarketing(form, answers);
      await json(await post(owner, '/api/forms', form), 201); created.push(id);
      let saved = await getDraft(id);
      assert.deepEqual(saved.coverPage.sections, form.coverPage.sections); assert.deepEqual(saved.marketing.presentation, form.marketing.presentation);
      if (kind === 'candles') {
        await page.goto(base + '/editor/' + id);
        await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
        await page.getByLabel('Start button label', { exact: true }).fill('Discover my fragrance direction');
        await until(async () => (await getDraft(id)).coverPage.buttonText === 'Discover my fragrance direction', 'Guided campaign edit did not autosave');
        await page.reload();
        await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
        assert.equal(await page.getByLabel('Start button label', { exact: true }).inputValue(), 'Discover my fragrance direction');
        saved = await getDraft(id);
      }
      await json(await post(owner, `/api/forms/${id}/publish`), 200);
      const latest = await getDraft(id);
      await json(await owner.request.put(base + '/api/forms/' + id, { headers, data: { ...latest, coverPage: { ...latest.coverPage, title: 'Unpublished campaign wording' }, marketing: { ...latest.marketing, fallbackTitle: 'Unpublished neutral wording', resultSections: latest.marketing.resultSections.map(section => ({ ...section, body: 'Unpublished guidance: ' + section.body })) } } }), 200);
      activePage = publicPage;
      await publicPage.setViewportSize(index % 2 ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await publicPage.goto(base + '/play/' + id);
      await publicPage.getByRole('heading', { name: details.title, exact: true }).waitFor();
      assert.equal(await publicPage.getByText('Unpublished campaign wording', { exact: true }).count(), 0);
      assert.equal(await publicPage.locator('[data-landing-layout]').getAttribute('data-landing-layout'), details.coverLayout);
      for (const section of form.coverPage.sections) if (section.title) assert.ok(await publicPage.getByText(section.title, { exact: true }).count() > 0);
      const startLabel = saved.coverPage.buttonText;
      // Repeated Start keeps its original configured label; both use the same player callback.
      assert.ok(await publicPage.getByRole('button', { name: startLabel, exact: false }).count() > 0);
      assert.equal(await publicPage.locator('[data-landing-layout] details').count(), 2);
      assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Published campaign fits viewport');
      await publicPage.screenshot({ path: path.join(artifacts, `landing-${kind}.png`), fullPage: true });
      let savedLink, submission;
      if (kind === 'candles') {
        await publicPage.getByRole('button', { name: startLabel, exact: false }).first().click();
        for (const [questionIndex, question] of form.questions.entries()) {
          await publicPage.getByRole('heading', { name: question.title, exact: true }).waitFor();
          await publicPage.getByRole('radio', { name: question.options.find(option => option.id === answers[question.id]).label, exact: true }).check();
          const name = questionIndex < form.questions.length - 1 ? 'Continue' : form.settings.showReviewBeforeSubmit ? 'Review answers' : 'Submit response';
          await publicPage.getByRole('button', { name, exact: true }).click();
        }
        if (form.settings.showReviewBeforeSubmit) await publicPage.getByRole('button', { name: 'Submit response', exact: true }).click();
        await publicPage.getByRole('button', { name: 'Skip for now', exact: true }).waitFor();
        const submitResponse = publicPage.waitForResponse(response => response.url().endsWith(`/api/forms/${id}/submit`) && response.request().method() === 'POST');
        await publicPage.getByRole('button', { name: 'Skip for now', exact: true }).click();
        submission = await json(await submitResponse, 200);
        await publicPage.getByRole('heading', { name: expectedResult.title, level: 1, exact: true }).waitFor();
        assert.deepEqual(await publicPage.locator('[data-result-section]').evaluateAll(elements => elements.map(element => element.getAttribute('data-result-section'))), expected.sections);
        const linkResponse = publicPage.waitForResponse(response => response.url().endsWith(`/api/forms/${id}/result-link`) && response.request().method() === 'POST');
        await publicPage.getByRole('button', { name: 'Create private result link', exact: true }).click();
        savedLink = await json(await linkResponse, 200);
        await publicPage.getByRole('link', { name: /Open saved result/ }).waitFor();
      } else {
        const started = await json(await post(visitor, `/api/forms/${id}/start`), 200);
        submission = await json(await post(visitor, `/api/forms/${id}/submit`, { token: started.token, answers, contact: null }), 200);
        savedLink = await json(await post(visitor, `/api/forms/${id}/result-link`, { token: started.token }), 200);
      }
      assert.equal(submission.marketing.status, expected.status); assert.equal(submission.marketing.outcomeId ?? null, expected.resultId); assert.equal(submission.marketing.title, expected.titleIndex === null ? form.marketing.scorecard.title : fixtures.titles[kind][expected.titleIndex]); assert.equal(submission.marketing.overallScore ?? null, expected.score);
      assert.deepEqual(submission.marketing.resultSections.map(section => section.id), expected.sections);
      assert.deepEqual(submission.marketing.categories.map(({ id, score, answered, applicable, minAnswers }) => ({ id, score, answered, applicable, minAnswers })), expected.categories);
      const token = savedLink.path.split('/').pop(), claims = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
      reports.push({ reportId: claims.id, formId: id, responseId: claims.id.slice('result-'.length) });
      const report = await readRecord('result_reports', claims.id);
      assert.deepEqual(report.payload.result.marketing, submission.marketing);
      // A saved report retains its original content even after the revised draft is republished.
      await json(await post(owner, `/api/forms/${id}/publish`), 200);
      await publicPage.goto(base + '/play/' + id);
      await publicPage.getByRole('heading', { name: 'Unpublished campaign wording', exact: true }).waitFor();
      assert.deepEqual((await readRecord('result_reports', claims.id)).payload.result.marketing, submission.marketing);
      await publicPage.goto(base + savedLink.path);
      await publicPage.getByRole('heading', { name: expectedResult.title, level: 1, exact: true }).waitFor();
      assert.equal(await publicPage.locator('[data-result-layout]').getAttribute('data-result-layout'), details.layout);
      assert.deepEqual(await publicPage.locator('[data-result-section]').evaluateAll(elements => elements.map(element => element.getAttribute('data-result-section'))), expected.sections);
      await publicPage.locator('[data-result-section] details').evaluateAll(elements => elements.forEach(element => element.open = true));
      await publicPage.locator('details[data-result-section]').evaluateAll(elements => elements.forEach(element => element.open = true));
      for (const section of expectedResult.resultSections) assert.ok((await publicPage.locator(`[data-result-section="${section.id}"]`).innerText()).includes(section.body));
      assert.equal(await publicPage.locator('[data-result-block="primary-action"]').count(), 0, 'No placeholder result links');
      assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Saved report fits viewport');
      await publicPage.screenshot({ path: path.join(artifacts, `report-${kind}.png`), fullPage: true });
      const downloading = publicPage.waitForEvent('download');
      await publicPage.getByRole('button', { name: 'Download PDF', exact: true }).click();
      const download = await downloading, filename = path.join(artifacts, `${kind}.pdf`); await download.saveAs(filename);
      assert.equal(fs.readFileSync(filename).subarray(0, 5).toString(), '%PDF-');
      const python = process.env.PDF_TEST_PYTHON || '/Users/perry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
      const pdfText = normalize(execFileSync(python, ['-c', 'import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages))', filename], { encoding: 'utf8' }));
      assert.ok(pdfText.includes(normalize(form.title))); assert.ok(pdfText.includes(normalize(expectedResult.title)));
      for (const section of expectedResult.resultSections) { assert.ok(pdfText.includes(normalize(section.title)), `${kind} PDF heading`); assert.ok(pdfText.includes(normalize(section.body)), `${kind} PDF complete guidance`); }
      for (const category of expectedResult.categories) { assert.ok(pdfText.includes(normalize(category.title)), `${kind} PDF category title`); assert.ok(pdfText.includes(normalize(category.description)), `${kind} PDF category context`); }
      for (const section of form.marketing.resultSections.filter(section => !expected.sections.includes(section.id))) assert.ok(!pdfText.includes(normalize(section.body)), `${kind} PDF excludes unmatched advice`);
      for (const forbidden of [token, id, 'Unpublished campaign wording', 'Unpublished neutral wording', 'Unpublished guidance:']) assert.ok(!pdfText.includes(forbidden));
      checks.push(`${kind}: saved/reloaded, frozen publication, ${details.coverLayout} landing, ${expected.name}, ${details.layout} saved report retained after republish and complete native PDF parity`);
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ passed: true, campaigns: campaignTemplateIds.length, publicStarts: campaignTemplateIds.length, checks }, null, 2));
    console.log('PASS batch14 seven additional campaign details/checklists, guest draft, guided autosave, save/reload, frozen publications and immutable reports after republish, desktop/mobile landings, optional capture skip, literal matched/neutral/mixed preferences and partial scorecard coverage, all three saved-report layouts and seven complete native PDFs; no page errors.');
  } catch (error) { await activePage.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
  finally {
    for (const id of created) await owner.request.delete(base + '/api/forms/' + id, { headers }).catch(() => {});
    // Only IDs created by this run are removed; shared synthetic fixtures stay intact.
    for (const { reportId, responseId } of reports) {
      await removeRecord('result_reports', reportId, 'local');
      await removeRecord('attempts', responseId, 'local'); await removeRecord('submissions', responseId, 'local');
    }
    for (const id of created) await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', id])).digest('hex'), 'local');
    for (const kind of ['attempts', 'submissions']) for (const row of await listRecords(kind, 'local')) if (created.includes(row.payload.formId || row.payload.form?.id)) await removeRecord(kind, row.id, 'local');
    for (const row of await listRecords('landing_visits', 'local')) if (created.includes(row.payload.formId)) await removeRecord('landing_visits', row.id, 'local');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
