// Compiled native PDF download, using isolated synthetic results only.
const { chromium, firefox, webkit } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { readRecord, writeRecord, removeRecord, cloudEnabled } = require('../lib/records.ts');
const { resultLinkReceiptId } = require('../lib/result-reports.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163', engine = process.env.BROWSER || 'chromium';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR || cloudEnabled()) throw Error('Use dedicated isolated local data.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || `../pippi-overnight-2026-10-12/native-pdf-browser/${engine}`); fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await ({ chromium, firefox, webkit }[engine]).launch(engine === 'chromium' ? { channel: 'chrome' } : {});
  const owner = await browser.newContext(), visitor = await browser.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true }), page = await visitor.newPage();
  const formId = `qa-native-pdf-${engine}-${Date.now()}`, headers = { Origin: base }, errors = []; let responseId;
  page.on('pageerror', e => errors.push(e.message));
  const post = (url, data = {}) => owner.request.post(base + url, { headers, data });
  try {
    assert.equal((await post('/api/auth', { local: true })).status(), 200);
    assert.equal((await post('/api/forms', { id: formId, title: 'Clarity assessment', mode: 'quiz', theme: { brandName: 'Clarity Studio', hidePippiBranding: true }, questions: [{ id: 'q', type: 'multiple_choice', title: 'Choose your next step', required: true, points: 10, options: [{ id: 'a', label: 'Build a clear plan', isCorrect: true }, { id: 'b', label: 'Explore options' }] }, { id: 'private', title: 'Optional private note', type: 'short_answer' }], settings: { showReviewBeforeSubmit: false }, endingPage: { title: 'Your next step is clear', message: 'Choose one practical action for this week. Café, Αθήνα, Москва.', buttonText: 'Explore your options', redirectUrl: 'https://example.test/next' } })).status(), 201);
    assert.equal((await post(`/api/forms/${formId}/publish`)).status(), 200);
    const started = await (await post(`/api/forms/${formId}/start`)).json();
    assert.equal((await post(`/api/forms/${formId}/submit`, { token: started.token, answers: { q: 'a', private: 'never-print-private@example.test' } })).status(), 200);
    const saved = await (await post(`/api/forms/${formId}/result-link`, { token: started.token })).json();
    const token = saved.path.split('/').pop(), claims = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    responseId = claims.id.slice('result-'.length);
    const endpoint = base + `/api/result/${token}/pdf`;
    await page.goto(base + saved.path);
    await page.getByRole('heading', { name: 'Your next step is clear', exact: true }).waitFor();
    assert.ok(await page.getByText('Download a print-friendly report.', { exact: false }).isVisible());
    // A recoverable network/server error must not claim success or hide print.
    await page.route(endpoint, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'temporarily unavailable' }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Print / Save as PDF', exact: true }).isEnabled());
    await page.unroute(endpoint);
    await page.getByRole('button', { name: 'Download PDF', exact: true }).focus();
    const downloadEvent = page.waitForEvent('download'), responseEvent = page.waitForResponse(r => r.url() === endpoint);
    await page.keyboard.press('Enter');
    const [download, response] = await Promise.all([downloadEvent, responseEvent]);
    assert.equal(response.status(), 200); assert.equal(download.suggestedFilename(), 'pippi-result.pdf');
    const h = response.headers();
    assert.ok(h['cache-control'].includes('no-store')); assert.equal(h['content-type'], 'application/pdf'); assert.equal(h['referrer-policy'], 'no-referrer'); assert.equal(h['x-content-type-options'], 'nosniff'); assert.ok(h['x-robots-tag'].includes('noindex'));
    const filename = path.join(artifacts, 'download.pdf'); await download.saveAs(filename);
    const bytes = fs.readFileSync(filename); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); assert.ok(bytes.length < 3 * 1024 * 1024);
    const python = process.env.PDF_TEST_PYTHON || '/Users/perry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
    const text = execFileSync(python, ['-c', 'import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages))', filename], { encoding: 'utf8' });
    for (const required of ['Clarity Studio', 'Clarity assessment', 'Your next step is clear', '100%', '10 of 10', 'Café', 'Αθήνα', 'Москва']) assert.ok(text.includes(required), required);
    for (const excluded of ['never-print-private@example.test', token, responseId]) assert.ok(!text.includes(excluded), 'private data excluded');
    await page.getByRole('button', { name: 'Download PDF', exact: true }).waitFor();
    assert.equal(await page.locator('.result-report-actions').getByRole('alert').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(artifacts, 'download-mobile.png') });
    // Unsupported script is explicit and leaves browser printing available.
    const snapshot = await readRecord('result_reports', claims.id);
    await writeRecord('result_reports', claims.id, 'local', { ...snapshot.payload, message: '中文 result text' }, snapshot.version);
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: "browser's print layout" }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Print / Save as PDF', exact: true }).isEnabled());
    await page.screenshot({ path: path.join(artifacts, 'unsupported-print-fallback.png') });
    assert.equal((await owner.request.delete(base + `/api/forms/${formId}/report-links`, { headers, data: { responseId } })).status(), 200);
    const revoked = await visitor.request.get(endpoint); assert.equal(revoked.status(), 404); assert.ok(revoked.headers()['cache-control'].includes('no-store'));
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: native download, exact filename/MIME/privacy headers, PDF content/Unicode/score and private-field exclusion, keyboard/error recovery, unsupported-text print fallback, revocation,390px layout.`);
  } catch (error) { await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
  finally {
    await owner.request.delete(base + '/api/forms/' + formId, { headers }).catch(() => {});
    if (responseId) {
      await removeRecord('result_reports', 'result-' + responseId, 'local'); await removeRecord('attempts', responseId, 'local');
      await removeRecord('result_report_link_revocations', resultLinkReceiptId(formId, 'local', responseId), 'local');
    }
    await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', formId])).digest('hex'), 'local');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
