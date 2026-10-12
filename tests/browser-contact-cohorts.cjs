// No public starts or provider requests: all contact/history records are synthetic.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { randomUUID, createHash } = require('node:crypto');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { writeRecord, removeRecord, cloudEnabled } = require('../lib/records.ts');
const { contactCategoryKey } = require('../lib/contact-filters.ts');
const { defaultCapture } = require('../lib/contacts.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3163';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR || cloudEnabled()) throw Error('Dedicated isolated local data only.');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-8/contact-cohorts'); fs.mkdirSync(artifacts, { recursive: true });
function csvRows(csv) { const rows = []; let row = [], cell = '', quoted = false; for (let i = 0; i < csv.length; i++) { const c = csv[i]; if (c === '"') { if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; } else if (c === ',' && !quoted) { row.push(cell); cell = ''; } else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c; } if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); } return rows; }
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }), owner = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/London', acceptDownloads: true });
  const page = await owner.newPage(), formId = 'qa-contact-cohorts-' + Date.now(), headers = { Origin: base }, records = [], errors = [];
  page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(12000);
  const categoryKey = contactCategoryKey({ id: 'focus', title: 'Focus' });
  try {
    assert.equal((await owner.request.post(base + '/api/auth', { headers, data: { local: true } })).status(), 200);
    const created = await owner.request.post(base + '/api/forms', { headers, data: { id: formId, title: 'Synthetic contact cohorts', mode: 'survey', capture: { ...defaultCapture, enabled: true }, questions: [{ id: 'q', type: 'short_answer', title: 'What matters most?' }] } });
    assert.equal(created.status(), 201); const form = await created.json(), rows = [], t = Date.now() - 300000;
    for (let index = 0; index < 38; index++) {
      const id = randomUUID(), completed = t + index * 1000, score = index === 30 ? 0 : index === 31 ? null : 50;
      const category = { id: index === 34 ? 'other' : 'focus', title: index === 33 ? 'Earlier focus' : 'Focus', score, answered: score === null ? 0 : 2, applicable: 2, minAnswers: 2, description: 'Saved category guidance' };
      const row = { id, formId, submittedAt: new Date(completed).toISOString(), totalQuestions: 1, totalPointsPossible: 0, totalPointsEarned: 0, percentageScore: 100, passed: true, grading: [{ questionId: 'q', questionTitle: 'What matters most?', userAnswer: 'A practical next step', type: 'short_answer', earnedPoints: 0, maxPoints: 0, isCorrect: true }], answers: { q: 'A practical next step' }, contact: { email: 'synthetic-repeat@example.test', name: index === 0 ? '=FORMULA()' : `Cohort ${index}`, marketingConsent: true, recordedAt: new Date(completed + (index === 0 ? 150 : -10)).toISOString(), placement: index === 0 ? 'after_results' : 'before_results', consentText: 'Optional updates', purposeText: 'Connect the response', privacyUrl: '', formRevision: 1 }, marketing: { kind: index === 32 ? 'product_finder' : 'scorecard', status: index === 32 ? 'matched' : 'scored', title: 'Saved direction', message: 'Historical result', reasons: [], overallScore: index === 32 ? undefined : 75, categories: index === 32 ? [] : [category] } };
      await writeRecord('submissions', id, 'local', row, 0); records.push({ kind: 'submissions', id, owner: 'local' }); rows.push(row);
      if (index === 35) continue;
      const attribution = index === 30 ? { version: 1, source: 'Search', campaign: 'Spring' } : index === 32 ? { version: 1, referrerHost: 'referral.example.test' } : index === 34 ? { version: 1, source: 'unknown', campaign: 'all' } : { version: 1, source: 'Newsletter', campaign: 'Autumn' };
      const who = index === 36 ? 'other-owner' : 'local';
      await writeRecord('attempts', id, who, { form, preview: index === 37, startedAt: completed - 1000, expiresAt: completed + 86400000, reached: ['q'], completed: true, completedAt: completed + 1, resultViewedAt: completed + 100, offerClickedAt: completed + 200, attribution }, 0); records.push({ kind: 'attempts', id, owner: who });
    }
    const endpoint = base + `/api/forms/${formId}/contacts`;
    const initial = await (await owner.request.get(endpoint)).json(); assert.equal(initial.contacts.length, 38);
    assert.equal(initial.contextByResponse[rows[36].id].history, 'unavailable'); assert.equal(initial.contextByResponse[rows[37].id].history, 'unavailable');
    await page.goto(base + '/editor/' + formId); await page.getByRole('button', { name: 'Contacts', exact: true }).click();
    const directory = page.getByRole('region', { name: 'Contact directory', exact: true });
    await directory.getByRole('heading', { name: 'Contacts (38)', exact: true }).waitFor();
    await directory.getByRole('button', { name: 'More filters', exact: true }).focus(); await page.keyboard.press('Enter');
    const source = directory.getByLabel('Filter start source', { exact: true }), campaign = directory.getByLabel('Filter start campaign', { exact: true });
    assert.ok(await source.locator('option[value="utm:unknown"]').count()); assert.ok(await source.locator('option[value="unknown"]').count());
    await source.selectOption('utm:Newsletter'); await campaign.selectOption('value:Autumn');
    await directory.getByLabel('Filter saved category', { exact: true }).selectOption(categoryKey);
    await directory.getByLabel('Minimum category percent', { exact: true }).fill('50'); await directory.getByLabel('Maximum category percent', { exact: true }).fill('50');
    await directory.getByRole('heading', { name: 'Contacts (30)', exact: true }).waitFor(); assert.equal(await directory.locator('[data-contact-row]').count(), 25);
    await directory.getByRole('button', { name: 'Next', exact: true }).click(); assert.equal(await directory.locator('[data-contact-row]').count(), 5);
    const downloading = page.waitForEvent('download'); await directory.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const download = await downloading, csvPath = path.join(artifacts, 'matching.csv'); await download.saveAs(csvPath);
    const csv = csvRows(fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')), columns = csv[0]; assert.equal(csv.length, 31);
    const field = (r, name) => r[columns.indexOf(name)];
    assert.deepEqual(new Set(csv.slice(1).map(r => field(r, 'responseId'))), new Set(rows.slice(0, 30).map(r => r.id)));
    assert.ok(csv.slice(1).every(r => field(r, 'startSource') === 'Newsletter · UTM source' && field(r, 'startCampaign') === 'Autumn · UTM campaign' && field(r, 'marketingConsent') === 'true'));
    assert.ok(csv.some(r => field(r, 'name') === "'=FORMULA()")); assert.ok(columns.indexOf('answers') < columns.indexOf('startSource'));
    await directory.getByLabel('Maximum category percent', { exact: true }).fill('10'); await directory.getByRole('alert').filter({ hasText: 'maximum category score' }).waitFor(); assert.ok(await directory.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled());
    await directory.getByLabel('Category score availability', { exact: true }).selectOption('unscored');
    await directory.getByRole('heading', { name: 'Contacts (1)', exact: true }).waitFor(); assert.ok(await directory.getByLabel('Minimum category percent', { exact: true }).isDisabled());
    await directory.getByLabel('Category score availability', { exact: true }).focus(); await page.keyboard.press('Escape'); assert.equal(await source.isVisible(), false);
    assert.ok(await directory.getByRole('button', { name: /^More filters/ }).evaluate(element => element === document.activeElement));
    await directory.getByRole('button', { name: 'Clear filters', exact: true }).click(); await directory.getByRole('button', { name: 'More filters', exact: true }).click();
    await directory.getByLabel('Filter saved category', { exact: true }).selectOption(categoryKey); await directory.getByLabel('Category score availability', { exact: true }).selectOption('missing');
    await directory.getByRole('heading', { name: 'Contacts (3)', exact: true }).waitFor();
    assert.equal(await directory.getByLabel('Filter saved category', { exact: true }).locator('option').filter({ hasText: 'Focus · Saved category' }).count(), 2);
    await directory.getByRole('button', { name: 'Clear filters', exact: true }).click(); await source.selectOption('unknown'); await directory.getByRole('heading', { name: 'Contacts (3)', exact: true }).waitFor();
    await directory.getByLabel('Search contacts', { exact: true }).fill('Cohort 35'); await directory.locator('[data-contact-row] summary').click(); await directory.getByText('Start and interaction history is unavailable.', { exact: false }).waitFor();
    await directory.getByRole('button', { name: 'Clear filters', exact: true }).click(); await directory.getByLabel('Search contacts', { exact: true }).fill('FORMULA'); await directory.locator('[data-contact-row] summary').click();
    const activity = directory.getByRole('region', { name: 'Recorded response activity', exact: true });
    assert.deepEqual(await activity.locator('ol li p').allTextContents(), ['Quiz started', 'Response recorded', 'First recorded result interaction', 'Contact details recorded', 'First result-action click recorded']);
    assert.equal(await activity.getByText('Quiz completed', { exact: true }).count(), 0);
    await activity.screenshot({ path: path.join(artifacts, 'activity-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await activity.screenshot({ path: path.join(artifacts, 'activity-mobile.png') });
    await directory.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await directory.locator('#contact-more-filters').screenshot({ path: path.join(artifacts, 'filters-mobile.png') });
    // A malformed success is a retryable failure, never a complete-looking unknown cohort.
    await page.route(endpoint, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contacts: initial.contacts }) }));
    await directory.getByRole('button', { name: 'Refresh', exact: true }).click(); await directory.getByText('The contact history could not be read. Please refresh.', { exact: true }).waitFor();
    assert.ok(await directory.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled()); await page.unroute(endpoint);
    await directory.getByRole('button', { name: 'Try loading again', exact: true }).click(); await directory.getByRole('heading', { name: 'Contacts (38)', exact: true }).waitFor();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Export CSV')?.disabled);
    // An aborted old Contacts mount must not replace a newly loaded directory.
    let held, releaseSeen; const intercepted = new Promise(resolve => releaseSeen = resolve);
    await page.route(endpoint, async route => { held = route; releaseSeen(); });
    await directory.getByRole('button', { name: 'Refresh', exact: true }).click(); await intercepted;
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.getByRole('button', { name: 'Results', exact: true }).click();
    await page.unroute(endpoint); await page.getByRole('button', { name: 'Contacts', exact: true }).click();
    await directory.getByRole('heading', { name: 'Contacts (38)', exact: true }).waitFor();
    await held.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contacts: [], contextByResponse: {} }) }).catch(() => {});
    assert.ok(await directory.getByRole('heading', { name: 'Contacts (38)', exact: true }).isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS 38 synthetic contacts: source/campaign/category AND filters, null versus absent/zero categories, all30 matching CSV rows and consent/formula/column safety, honest after-results activity, missing/foreign/preview history, malformed refresh retry, stale mount cancellation, Escape/focus and390px layout. Zero public starts or provider calls.');
  } catch (error) { await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
  finally {
    for (const record of records) await removeRecord(record.kind, record.id, record.owner);
    await owner.request.delete(base + '/api/forms/' + formId, { headers }).catch(() => {});
    await removeRecord('result_report_revocations', createHash('sha256').update(JSON.stringify(['local', formId])).digest('hex'), 'local');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
