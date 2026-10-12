const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const base = process.env.BASE_URL || 'http://127.0.0.1:3162';
const artifactDir = process.env.ARTIFACT_DIR || '/tmp/pippi-guided-creation';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Use an isolated local test server.');
(async () => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), id = `qa-guided-create-${Date.now()}`, headers = { Origin: base }, errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const fixture = FormSchema.parse({
    id, title: 'Guided creation test', mode: 'survey',
    questions: ['q1', 'q2'].map(id => ({ id, title: id === 'q1' ? 'What fits you?' : 'What comes next?', type: 'multiple_choice', options: [{ id: 'a', label: 'Ready' }, { id: 'b', label: 'Later' }, { id: 'c', label: 'Not sure' }] })),
    logicRules: [{ id: 'branch', sourceQuestionId: 'q1', operator: 'equals', value: 'a', action: 'jump_to_question', targetQuestionId: 'q2' }],
    marketing: { kind: 'segmentation', outcomes: [{ id: 'result', title: 'Your next step', description: 'A helpful route' }], rules: [{ id: 'score', questionId: 'q1', answerId: 'a', targetId: 'result', points: 2 }] },
  });
  try {
    assert.equal((await context.request.post(`${base}/api/auth`, { data: { local: true }, headers })).status(), 200);
    assert.equal((await context.request.post(`${base}/api/forms`, { data: fixture, headers })).status(), 201);
    await page.goto(`${base}/editor/${id}`);
    await page.getByRole('heading', { name: 'Give your quiz a clear promise.' }).waitFor();
    await page.getByRole('button', { name: '2. Questions', exact: true }).click();
    await page.getByRole('button', { name: 'Move question down', exact: true }).click();
    assert.match(await page.getByRole('alert').filter({ hasText: 'branch destination' }).innerText(), /branch destination/);
    // Cancel first, then remove with dependencies explicitly disclosed.
    let review = '';
    page.once('dialog', async dialog => { review = dialog.message(); await dialog.dismiss(); });
    await page.getByRole('button', { name: 'Remove answer 1', exact: true }).click();
    assert.match(review, /answer scoring rule/); assert.match(review, /branch rule/);
    assert.equal(await page.getByLabel('Answer wording', { exact: true }).count(), 3);
    page.once('dialog', async dialog => { await dialog.accept(); });
    await page.getByRole('button', { name: 'Remove answer 1', exact: true }).click();
    assert.equal(await page.getByLabel('Answer wording', { exact: true }).count(), 2);
    // Once dependencies are removed, moving and creating remain in guided view.
    await page.getByRole('button', { name: 'Move question down', exact: true }).click();
    assert.equal(await page.getByLabel('Question', { exact: true }).inputValue(), '1');
    await page.getByLabel('New question type', { exact: true }).selectOption('multiselect');
    await page.getByRole('button', { name: 'Add question', exact: true }).click();
    await page.getByLabel('Question wording', { exact: true }).fill('Choose what matters');
    await page.getByLabel('Answer wording', { exact: true }).nth(0).fill('Clarity');
    await page.getByLabel('Answer wording', { exact: true }).nth(1).fill('Support');
    await page.getByRole('button', { name: 'Add answer', exact: true }).click();
    await page.getByLabel('Answer wording', { exact: true }).nth(2).fill('Time');
    await page.getByRole('button', { name: 'Move answer 3 up', exact: true }).click();
    assert.equal(await page.getByLabel('Answer wording', { exact: true }).nth(1).inputValue(), 'Time');
    await page.getByText('Connect answers to results', { exact: true }).click();
    await page.getByLabel('Clarity: Your next step points', { exact: true }).fill('7');
    assert.equal(await page.getByLabel('Points for answer 1 toward Your next step', { exact: true }).inputValue(), '7');
    await page.getByRole('button', { name: '5. Publish', exact: true }).click();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: /^Saved ·/ }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: '2. Questions', exact: true }).click();
    await page.getByLabel('Question', { exact: true }).selectOption('2');
    assert.equal(await page.getByLabel('Question wording', { exact: true }).inputValue(), 'Choose what matters');
    assert.equal(await page.getByLabel('Points for answer 1 toward Your next step', { exact: true }).inputValue(), '7');
    assert.equal(await page.getByRole('button', { name: 'Move question up', exact: true }).isDisabled(), false);
    assert.equal(await page.getByRole('button', { name: 'Move question down', exact: true }).isDisabled(), true);
    const saved = await (await context.request.get(`${base}/api/forms/${id}`)).json();
    assert.deepEqual(saved.questions.map(q => q.id).slice(0, 2), ['q2', 'q1']);
    assert.equal(saved.questions[2].type, 'multiselect'); assert.equal(saved.logicRules.length, 0);
    assert.equal(saved.marketing.rules.some(r => r.id === 'score'), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(artifactDir, 'guided-editing-mobile.png'), fullPage: false });
    // The AI chooser makes the business brief the obvious marketing path.
    await page.goto(base);
    await page.getByRole('button', { name: 'Start with AI', exact: true }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByRole('link', { name: /Recommend, segment, or assess/ }).getAttribute('href'), '/create/marketing');
    assert.equal(await dialog.getByRole('link', { name: 'Browse templates', exact: true }).getAttribute('href'), '/templates');
    await dialog.getByRole('button', { name: /Test knowledge/ }).click();
    await page.getByRole('heading', { name: 'Create a knowledge quiz', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Generate knowledge quiz', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Choose a different goal', exact: false }).click();
    await page.screenshot({ path: path.join(artifactDir, 'ai-goal-chooser-mobile.png'), fullPage: false });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'Start blank', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS mobile guided creation, guarded reorder, reviewed/cancelled deletion, stable scoring, saved recovery, AI goal routing, blank/template access; no AI request made');
  } catch (error) {
    await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: false }).catch(() => {});
    fs.writeFileSync(path.join(artifactDir, 'failure.txt'), await page.locator('body').innerText().catch(() => 'No page'));
    throw error;
  } finally { await context.request.delete(`${base}/api/forms/${id}`, { headers }); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
