const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3162';
const dialogName = 'See the conversation. Shape the next step.';
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], mutations = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).origin === new URL(base).origin && new URL(request.url()).pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  const draft = () => page.evaluate(() => JSON.parse(localStorage.getItem('heyquiz-draft:' + localStorage.getItem('pippi-guest-draft'))));
  const editorAction = async name => {
    if (page.viewportSize().width < 1024) await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const openMap = async () => {
    await editorAction('Conversation map');
    const map = page.getByRole('dialog', { name: dialogName, exact: true });
    await map.waitFor();
    return map;
  };
  const noOverflow = async map => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page must fit the viewport');
    assert.ok(await map.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Dialog contents must fit without horizontal scrolling');
  };
  try {
    // Exercise an ordinary guest-created template, not a special test route.
    await page.goto(base + '/templates');
    await page.getByRole('textbox', { name: 'Search templates' }).fill('coffee');
    await page.getByRole('button', { name: /Find your coffee style/ }).click();
    await page.getByRole('button', { name: 'Use this template', exact: true }).click();
    await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('heyquiz-draft:' + localStorage.getItem('pippi-guest-draft'))));
    assert.equal(await page.getByRole('button', { name: 'Restore changes', exact: true }).count(), 0, 'A fresh template must not report recovery merely because schema parsing reorders properties');
    const original = await draft();
    assert.equal(original.coverPage.imageUrl, '/template-images/coffee.webp');
    let map = await openMap();
    await noOverflow(map);
    await page.screenshot({ path: '/tmp/pippi-conversation-map-desktop.png', fullPage: true });
    await map.getByRole('region', { name: 'Conversation flow' }).getByRole('button', { name: new RegExp(escapeRegExp(original.questions[2].title)) }).click();
    await map.waitFor({ state: 'detached' });
    assert.equal(await page.getByLabel('Question wording', { exact: true }).inputValue(), original.questions[2].title, 'Map must open the chosen question, not the first one');

    const editedTitle = 'How would you enjoy this coffee most?';
    await page.getByLabel('Question wording', { exact: true }).fill(editedTitle);
    map = await openMap();
    await map.getByRole('button', { name: 'Run journey checks', exact: true }).click();
    await map.getByRole('status').filter({ hasText: '256 distinct paths checked · Partial coverage' }).waitFor();
    await map.getByRole('article').getByRole('button', { name: editedTitle, exact: true }).waitFor();
    assert.match(await map.getByRole('status').innerText(), /bounded sample/);
    await map.getByRole('combobox', { name: /^Filter paths/ }).selectOption('no_match');
    await map.getByRole('heading', { name: original.marketing.fallbackTitle, exact: true }).waitFor();
    assert.ok(await map.getByRole('combobox', { name: /^Inspect a path/ }).locator('option').count() > 0);
    await page.screenshot({ path: '/tmp/pippi-conversation-testing-desktop.png', fullPage: true });
    await map.getByRole('textbox', { name: 'Case name', exact: true }).fill('Coffee fallback for unscored answers');
    await map.getByRole('button', { name: 'Save expected result', exact: true }).click();
    const savedRegion = () => map.getByRole('region', { name: 'Saved regression cases', exact: true });
    await savedRegion().getByRole('heading', { name: 'Coffee fallback for unscored answers', exact: true }).waitFor();
    await map.getByRole('button', { name: 'Run saved cases', exact: true }).click();
    await savedRegion().getByText('Passed on current draft', { exact: true }).waitFor();
    await savedRegion().scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/pippi-regression-cases-desktop.png', fullPage: true });
    const originalLocalCases = await page.evaluate(id => JSON.parse(localStorage.getItem('pippi:journey-regressions:v1:' + id)), original.id);
    assert.equal(originalLocalCases.cases.length, 1);
    assert.equal(originalLocalCases.cases[0].expected.status, 'no_match');
    assert.ok(originalLocalCases.cases[0].expected.questionIds.length > 0);


    // Closing, editing, and reopening must not present a previous run as current.
    await map.getByRole('button', { name: 'Close conversation map', exact: true }).click();
    const newerTitle = 'Choose the coffee moment that matters to you.';
    await page.getByLabel('Question wording', { exact: true }).fill(newerTitle);
    map = await openMap();
    await map.getByRole('button', { name: 'Journey testing', exact: true }).click();
    await map.getByText('Ready when you are. The simulation uses your current draft, including unsaved edits.', { exact: true }).waitFor();
    await map.getByRole('region', { name: 'Saved regression cases', exact: true }).getByText('Not checked on this draft', { exact: true }).waitFor();
    await map.getByText(/Draft differs from the saved baseline/).waitFor();
    await map.getByRole('button', { name: 'Run journey checks', exact: true }).click();
    await map.getByRole('status').filter({ hasText: '256 distinct paths checked' }).waitFor();
    await map.getByRole('article').getByRole('button', { name: newerTitle, exact: true }).waitFor();
    await map.getByRole('region', { name: 'Saved regression cases', exact: true }).getByText('Passed on current draft', { exact: true }).waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(map);
    await page.screenshot({ path: '/tmp/pippi-conversation-testing-mobile.png', fullPage: true });
    await map.getByRole('region', { name: 'Saved regression cases', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/pippi-regression-cases-mobile.png', fullPage: true });
    await map.getByRole('button', { name: 'Conversation map', exact: true }).click();
    await page.screenshot({ path: '/tmp/pippi-conversation-map-mobile.png', fullPage: true });
    await page.keyboard.press('Escape');
    await map.waitFor({ state: 'detached' });
    await editorAction('Full editor & advanced tools');
    map = await openMap();
    await map.getByRole('region', { name: 'Conversation flow' }).getByRole('button', { name: new RegExp(escapeRegExp(original.questions[1].title)) }).click();
    await page.locator('.hq-properties.mobile-open').getByText(original.questions[1].title, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await page.waitForFunction(title => {
      const form = JSON.parse(localStorage.getItem('heyquiz-draft:' + localStorage.getItem('pippi-guest-draft')));
      return form?.questions[2]?.title === title;
    }, newerTitle);
    const saved = await draft();
    assert.equal(saved.id, original.id);
    assert.equal(saved.coverPage.imageUrl, original.coverPage.imageUrl);
    assert.deepEqual(saved.marketing, original.marketing, 'Mapping and simulation must leave scoring unchanged');
    assert.deepEqual(mutations, [], 'Guest mapping and journey checks must not save, submit, track, or send email');

    // A blank quiz should provide a route back to adding fields, with no crash.
    await page.goto(base + '/create/blank');
    await page.getByRole('button', { name: page.viewportSize().width < 1024 ? 'More' : 'Guided setup', exact: true }).waitFor();
    map = await openMap();
    await map.getByRole('button', { name: 'Add the first question to your conversation →', exact: true }).click();
    await page.locator('.hq-field-palette.mobile-open').waitFor();

    // The displayed score must reflect answers, and insufficient data is not zero.
    await page.goto(base + '/templates');
    await page.getByRole('textbox', { name: 'Search templates' }).fill('Website launch readiness');
    await page.getByRole('button', { name: /Website launch readiness/ }).click();
    await page.getByRole('button', { name: 'Use this template', exact: true }).click();
    await page.getByRole('heading', { name: 'Give your quiz a clear promise.', exact: true }).waitFor();
    map = await openMap();
    await map.getByRole('button', { name: 'Run journey checks', exact: true }).click();
    await map.getByRole('status').filter({ hasText: '256 distinct paths checked' }).waitFor();
    const detail = map.getByRole('article');
    await detail.getByText('Score: 100%', { exact: true }).waitFor();
    const pathPicker = map.getByRole('combobox', { name: /^Inspect a path/ });
    const chooseRepresentative = async label => {
      const id = await pathPicker.locator('option').evaluateAll((options, text) => options.find(option => option.textContent.includes(text))?.value, label);
      assert.ok(id, `Representative path must be selectable: ${label}`);
      await pathPicker.selectOption(id);
    };
    await chooseRepresentative('Explicit zero-point answers');
    await detail.getByText('Score: 0%', { exact: true }).waitFor();
    await chooseRepresentative('No-rule answers');
    assert.equal(await detail.getByText(/^Score:/).count(), 0, 'Unknown answers must withhold the overall score, not fabricate zero');
    await detail.getByText(/Representative checks:.*No-rule answers/).waitFor();
    await chooseRepresentative('Alternating low / high points');
    const scoreText = await detail.getByText(/^Score:/).innerText();
    const mixedScore = Number(scoreText.match(/(\d+)%/)[1]);
    assert.ok(mixedScore > 0 && mixedScore < 100, 'Mixed known answers produce an intermediate score');
    assert.equal(await map.getByRole('heading', { name: 'Coffee fallback for unscored answers', exact: true }).count(), 0, 'Saved cases are isolated per quiz');
    await map.getByRole('textbox', { name: 'Case name', exact: true }).fill('Mixed readiness answers');
    await map.getByRole('button', { name: 'Save expected result', exact: true }).click();
    await map.getByRole('button', { name: 'Run saved cases', exact: true }).click();
    await map.getByRole('region', { name: 'Saved regression cases', exact: true }).getByText('Passed on current draft', { exact: true }).waitFor();
    await map.getByRole('button', { name: 'Remove regression case Mixed readiness answers', exact: true }).click();
    assert.equal(await map.getByRole('heading', { name: 'Mixed readiness answers', exact: true }).count(), 0);
    await noOverflow(map);
    assert.deepEqual(mutations, [], 'Scorecard testing must also remain local');
    assert.deepEqual(errors, []);
    console.log('PASS guest local simulation, bounded coverage, fallback paths, current draft edits, precise guided/mobile editing, image/scoring preservation, no API mutations, blank recovery, numeric scores and unknown coverage, fresh-template recovery, local named regression persistence/staleness/removal, representative zero/unmapped/mixed scores, and no browser exceptions');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
