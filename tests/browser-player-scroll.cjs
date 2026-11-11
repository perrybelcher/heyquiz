const assert = require("node:assert/strict");
const { chromium, webkit, devices } = require("playwright");

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3196";
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const headers = { Origin: base };
const browserName = process.env.QA_BROWSER || "chromium";
const engine = { chromium, webkit }[browserName];
assert.ok(engine, "Use chromium or webkit");
const id = `qa-player-scroll-${Date.now()}`;
const description = "Choose the answer that fits your everyday experience. ".repeat(40);

async function run() {
  const browser = await engine.launch();
  const owner = await browser.newContext();
  const visitor = await browser.newContext(devices[browserName === "webkit" ? "iPhone 13" : "Pixel 7"]);
  const page = await visitor.newPage();
  page.setDefaultTimeout(10000);

  async function assertQuestionAtTop(title) {
    const heading = page.getByRole("heading", { name: title, exact: true });
    await heading.waitFor();
    assert.ok(await heading.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return scrollY === 0 && bounds.top >= 0 && bounds.bottom <= innerHeight;
    }), `Expected "${title}" to be visible at the top after navigation`);
  }

  try {
    assert.equal((await owner.request.post(base + "/api/auth", { headers, data: { local: true } })).status(), 200);
    const created = await owner.request.post(base + "/api/forms", {
      headers,
      data: {
        id,
        title: "Mobile quiz navigation",
        mode: "quiz",
        settings: { feedbackMode: "immediate", showReviewBeforeSubmit: false },
        questions: [
          {
            id: "first", title: "Pick a starting point", type: "multiple_choice", description, required: true,
            options: [{ id: "a", label: "First choice" }, { id: "b", label: "Second choice" }],
          },
          {
            id: "second", title: "Pick all that apply", type: "multiselect", description, required: true, points: 1,
            options: [{ id: "a", label: "One option", isCorrect: true }, { id: "b", label: "Another option" }],
          },
          { id: "third", title: "One last question", type: "short_answer", description },
        ],
      },
    });
    assert.equal(created.status(), 201, await created.text());
    const published = await owner.request.post(base + `/api/forms/${id}/publish`, { headers, data: {} });
    assert.equal(published.status(), 200, await published.text());

    await page.goto(base + "/play/" + id);
    await page.getByRole("button", { name: "Let’s begin", exact: true }).tap();
    await assertQuestionAtTop("Pick a starting point");

    await page.getByRole("radio", { name: "First choice" }).tap();
    assert.ok(await page.evaluate(() => scrollY > innerHeight), "The first answer requires scrolling");
    await assertQuestionAtTop("Pick all that apply");

    await page.getByRole("checkbox", { name: "One option" }).tap();
    assert.ok(await page.evaluate(() => scrollY > innerHeight), "Selecting a checkbox keeps the current scroll position");
    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    await continueButton.tap();
    await page.getByText("Correct!", { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => scrollY > innerHeight), "Showing feedback keeps the current scroll position");
    await continueButton.tap();
    await assertQuestionAtTop("One last question");

    await page.getByRole("button", { name: "Back", exact: true }).tap();
    await assertQuestionAtTop("Pick all that apply");
    assert.equal(await page.getByRole("checkbox", { name: "One option" }).isChecked(), true);
    console.log(`PASS ${browserName}: published mobile quiz scrolls to each question after auto-advance, Continue, and Back`);
  } finally {
    await owner.request.delete(base + "/api/forms/" + id, { headers });
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
