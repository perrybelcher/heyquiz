const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = process.env.TEST_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || "")) throw Error("Use an isolated loopback test server.");
const headers = { Origin: base };
const options = ["Alpha", "Beta", "Gamma", "Delta"].map((label, i) => ({ id: String(i), label }));
const intro = { id: "intro", pageId: "main", type: "heading", title: "Introduction" };
const text = {
  id: "text", pageId: "main", type: "rich_text", title: "Instructions",
  richTextContent: "# Details\n**Important** and *optional*\n- First bullet\n- Second bullet\n[Safe](https://example.com) [Unsafe](javascript:alert)\n<b>literal</b>",
};
const choice = { id: "choice", pageId: "main", type: "segmented", title: "Choose a segment", required: true, options };
const coverPage = { enabled: true, title: "Release one", buttonText: "Begin", estimatedMinutes: 1 };

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const owner = await browser.newContext();
  const visitor = await browser.newContext();
  const ids = [];
  try {
    assert.equal((await owner.request.post(base + "/api/auth", { headers, data: { local: true } })).status(), 200);
    async function seed(questions, settings, logicRules = []) {
      const id = "release-one-" + Date.now() + "-" + ids.length;
      ids.push(id);
      const created = await owner.request.post(base + "/api/forms", {
        headers,
        data: { id, title: "Release one", mode: "survey", coverPage, questions, settings, logicRules,
          pages: [{ id: "main", title: "Main", questionIds: questions.map(q => q.id) }] },
      });
      assert.equal(created.status(), 201, await created.text());
      const saved = await owner.request.get(base + "/api/forms/" + id);
      assert.deepEqual((await saved.json()).settings, settings);
      const published = await owner.request.post(base + "/api/forms/" + id + "/publish", { headers, data: {} });
      assert.equal(published.status(), 200, await published.text());
      return id;
    }
    async function start(id, context = visitor, preview = false) {
      const page = await context.newPage();
      await page.goto(base + "/play/" + id + (preview ? "?preview=1" : ""));
      await page.getByText("About 1 minute", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Begin", exact: true }).click();
      return page;
    }
    const id = await seed([intro, text, choice], { feedbackMode: "immediate", progressBarMode: "questions" });
    const page = await start(id);
    await page.getByText("0 of 1", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: "Details" }).waitFor();
    assert.equal(await page.locator("strong").filter({ hasText: "Important" }).count(), 1);
    assert.equal(await page.locator("em").filter({ hasText: "optional" }).count(), 1);
    assert.equal(await page.locator("ul li").count(), 2);
    assert.equal(await page.getByRole("link", { name: "Safe", exact: true }).getAttribute("href"), "https://example.com/");
    assert.equal(await page.getByRole("link", { name: "Unsafe", exact: true }).count(), 0);
    await page.getByText("<b>literal</b>", { exact: true }).waitFor();
    await page.getByText("0 of 1", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByText("1 of 1", { exact: true }).waitFor();
    await page.getByRole("radio", { name: "Alpha" }).focus();
    await page.keyboard.press("Space");
    await page.getByText("Your answers have been saved successfully.", { exact: true }).waitFor();
    await page.close();

    const branch = await seed([
      choice,
      { id: "extra", pageId: "main", type: "short_answer", title: "Extra question" },
      { ...intro, title: "Shared ending" },
    ], { progressBarMode: "questions" }, [{
      id: "skip-extra", sourceQuestionId: "choice", operator: "equals", value: "0",
      action: "jump_to_question", targetQuestionId: "intro",
    }]);
    const branchPage = await start(branch);
    await branchPage.getByText("1 of 2", { exact: true }).waitFor();
    await branchPage.getByRole("radio", { name: "Alpha" }).check();
    await branchPage.getByRole("heading", { name: "Shared ending" }).waitFor();
    await branchPage.getByText("1 of 1", { exact: true }).waitFor();
    await branchPage.getByRole("button", { name: "Back", exact: true }).click();
    await branchPage.getByRole("radio", { name: "Beta" }).check();
    await branchPage.getByRole("heading", { name: "Extra question" }).waitFor();
    await branchPage.getByText("2 of 2", { exact: true }).waitFor();
    await branchPage.close();

    const grouped = await seed([intro, text, choice], { presentation: "page", progressBarMode: "bar_only" });
    for (const [context, preview] of [[owner, true], [visitor, false]]) {
      const current = await start(grouped, context, preview);
      await current.getByRole("heading", { name: "Introduction" }).waitFor();
      await current.getByRole("heading", { name: "Instructions" }).waitFor();
      await current.getByRole("radio", { name: "Alpha" }).waitFor();
      assert.equal(await current.getByRole("progressbar", { name: "Quiz progress" }).getAttribute("aria-valuenow"), "100");
      assert.equal(await current.getByText("100%", { exact: true }).count(), 0);
      await current.close();
    }

    for (const review of [false, true]) {
      const contentOnly = await seed([intro], { feedbackMode: "immediate", progressBarMode: "questions", showReviewBeforeSubmit: review });
      const current = await start(contentOnly);
      assert.equal(await current.getByRole("progressbar").getAttribute("aria-valuenow"), "0");
      await current.getByRole("button", { name: review ? "Review answers" : "Finish", exact: true }).click();
      if (review) await current.getByRole("button", { name: "Submit response", exact: true }).click();
      await current.getByText("Your answers have been saved successfully.", { exact: true }).waitFor();
      await current.close();
    }

    for (const [type, desktop] of [["picture_choice", 2], ["image_multiselect", 4]]) {
      const picture = await seed([{ ...choice, type, pictureColumns: desktop }], {});
      const current = await start(picture);
      const group = current.getByRole("group", { name: choice.title });
      await current.setViewportSize({ width: 1280, height: 800 });
      assert.equal(await group.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length), desktop);
      await current.setViewportSize({ width: 390, height: 800 });
      assert.equal(await group.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length), 2);
      await current.close();
    }

    const binary = { ...choice, id: "binary", type: "switch", title: "Binary question",
      options: [{ id: "true", label: "True", isCorrect: true }, { id: "false", label: "False" }] };
    const editable = await seed([{ ...text, richTextContent: "Hello" }, choice, binary], {});
    const editor = await owner.newPage();
    await editor.goto(base + "/editor/" + editable);
    const steps = editor.getByRole("navigation", { name: "Quiz setup steps" });
    await steps.getByRole("button", { name: /Questions$/ }).click();
    await editor.getByRole("navigation", { name: "Questions", exact: true }).getByRole("button", { name: /Instructions/ }).click();
    const content = editor.getByLabel("Rich text content");
    await content.selectText();
    await editor.getByRole("button", { name: "Bold", exact: true }).click();
    assert.equal(await content.inputValue(), "**Hello**");
    await editor.getByRole("navigation", { name: "Questions", exact: true }).getByRole("button", { name: /Choose a segment/ }).click();
    await editor.getByLabel("Answer wording").first().fill("First segment");
    await editor.getByRole("button", { name: "Add answer", exact: true }).click();
    await editor.getByLabel("Answer wording").last().fill("New segment");
    editor.once("dialog", dialog => dialog.accept());
    await editor.getByRole("button", { name: "Remove answer 5", exact: true }).click();
    await editor.getByRole("navigation", { name: "Questions", exact: true }).getByRole("button", { name: /Binary question/ }).click();
    await editor.getByLabel("Answer wording").first().fill("Yes");
    await editor.getByLabel("Answer wording").last().fill("No");
    await steps.getByRole("button", { name: /Publish$/ }).click();
    const saving = editor.waitForResponse(response => response.url().endsWith("/api/forms/" + editable) && response.request().method() === "PUT" && response.ok());
    await editor.getByRole("button", { name: "Save draft", exact: true }).click();
    await saving;
    await editor.reload();
    const saved = await (await owner.request.get(base + "/api/forms/" + editable)).json();
    assert.equal(saved.questions[0].richTextContent, "**Hello**");
    assert.deepEqual(saved.questions[1].options.map(({ id, label }) => [id, label]), options.map(({ id, label }, index) => [id, index === 0 ? "First segment" : label]));
    assert.deepEqual(saved.questions[2].options.map(({ id, label, isCorrect }) => [id, label, isCorrect]), [["true", "Yes", true], ["false", "No", false]]);
    console.log("PASS Release 1: preview, publication, branch progress, formatting, keyboard choices, responsive columns, and saved editor changes");
  } finally {
    for (const id of ids) await owner.request.delete(base + "/api/forms/" + id, { headers });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
