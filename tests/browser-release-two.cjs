const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { chromium } = require("playwright");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(
  fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, file);
const { scorecardForm } = require("./fixtures/result-layouts.cjs");
const base = process.env.TEST_BASE_URL || "";
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/, "Use an isolated local test server");
const headers = { Origin: base };

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const visitor = await browser.newContext();
  const editor = await owner.newPage();
  const ids = [];
  const post = (path, data) => owner.request.post(base + path, { headers, data });
  const read = async id => (await owner.request.get(base + "/api/forms/" + id)).json();
  async function seed(form) {
    const response = await post("/api/forms", form);
    assert.equal(response.status(), 201, await response.text());
    ids.push(form.id);
  }
  async function publish(id) {
    const response = await post(`/api/forms/${id}/publish`, {});
    assert.equal(response.status(), 200, await response.text());
  }
  async function until(check) {
    for (let i = 0; i < 80; i++) {
      if (await check()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail("Expected draft changes to save");
  }
  try {
    assert.equal((await post("/api/auth", { local: true })).status(), 200);
    const score = scorecardForm("release-two-score-" + Date.now());
    await seed(score);
    await editor.goto(base + "/editor/" + score.id);
    const steps = editor.getByRole("navigation", { name: "Quiz setup steps" });
    await steps.getByRole("button", { name: /Results$/ }).click();
    const sections = editor.getByRole("region", { name: "Result page sections" });
    await sections.getByRole("button", { name: "Helpful advice", exact: true }).click();
    const section = sections.locator("details").last();
    await section.getByLabel("Heading", { exact: true }).fill("Answer-specific guidance");
    await section.getByLabel("Content", { exact: true }).fill("Follow this specific next step.");
    const bodyField = section.getByLabel("Content", { exact: true });
    await bodyField.press("End");
    await bodyField.press("Space");
    const variable = bodyField.locator("..");
    await variable.getByText("Insert answer", { exact: true }).click();
    await variable.getByRole("combobox").selectOption("capture");
    await variable.getByLabel("Fallback wording").fill("Your next priority");
    await variable.getByRole("button", { name: "Insert variable", exact: true }).click();
    await section.getByLabel("Show this section").selectOption("answer");
    const answerSelectors = section.getByRole("combobox");
    assert.equal(await answerSelectors.count(), 3, "The answer condition shows question and answer selectors");
    await answerSelectors.nth(1).selectOption("capture");
    await answerSelectors.nth(2).selectOption("a2");
    await until(async () => (await read(score.id)).marketing.resultSections.at(-1).condition?.optionId === "a2");
    const conditioned = (await read(score.id)).marketing.resultSections.at(-1);

    const display = editor.getByRole("group", { name: "Show on web results" });
    const toggles = [
      ["Overall score", "showOverallScore", '[data-result-block="overall"]'],
      ["Category scores", "showCategoryScores", "[data-category-id] .tabular-nums"],
      ["Scoring coverage", "showScoringCoverage", "applicable questions scored"],
    ];
    const report = await visitor.newPage();
    for (const [layout, label] of [["stacked","Stacked"], ["score_overview","Score overview"], ["action_plan","Action plan"]]) {
      await editor.getByRole("radio", { name: new RegExp("^" + label) }).check();
      for (const hide of [[], [0], [1], [2], [0,1,2]]) {
        for (let i = 0; i < toggles.length; i++) await display.getByRole("checkbox", { name: toggles[i][0], exact: true }).setChecked(!hide.includes(i));
        await until(async () => {
          const p = (await read(score.id)).marketing.presentation;
          return p.layout === layout && toggles.every(([, key], i) => (p[key] === false) === hide.includes(i));
        });
        await publish(score.id);
        const session = await (await post(`/api/forms/${score.id}/start`, {})).json();
        const response = await post(`/api/forms/${score.id}/submit`, { token: session.token, answers: { capture: "a2", followup: "a2", measure: "a0" } });
        assert.equal(response.status(), 200, await response.text());
        const result = await response.json();
        assert.equal(result.marketing.overallScore, 50);
        assert.deepEqual(result.marketing.categories.map(category => category.score), [0, 100]);
        assert.equal(result.marketing.title, "Make one useful improvement");
        const link = await (await post(`/api/forms/${score.id}/result-link`, { token: session.token })).json();
        await report.goto(base + link.path);
        const card = report.locator(`[data-result-layout="${layout}"]`);
        await card.waitFor();
        for (let i = 0; i < toggles.length; i++) {
          const marker = toggles[i][2];
          const visible = marker.startsWith("[") ? card.locator(marker) : card.getByText(marker, { exact: false });
          assert.equal((await visible.count()) > 0, !hide.includes(i), `${layout}: ${toggles[i][0]}`);
        }
        assert.equal(await card.locator(`[data-result-section="${conditioned.id}"]`).count(), 1);
        assert.ok((await card.locator(`[data-result-section="${conditioned.id}"]`).textContent()).includes("Follow this specific next step. Not yet"));
        assert.equal(await card.getByText("Make this area easier to repeat.", { exact: true }).count(), 1);
      }
    }
    await report.close();

    const flowId = "release-two-flow-" + Date.now();
    const page = id => ({ kind: "page", id });
    const route = destination => ({ rules: [], default: destination });
    const choice = (id, pageId, title) => ({
      id, pageId, title, type: "multiple_choice", required: true,
      options: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }],
    });
    const questions = [
      choice("source", "start", "Choose a route"),
      choice("detail", "conditional", "Optional branch detail"),
      { id: "note", pageId: "join", title: "Shared end", type: "heading" },
      choice("extra", "join", "Conditional question"),
    ];
    await seed({
      id: flowId, title: "Release two flow", mode: "survey", settings: { presentation: "page" },
      questions, pages: [
        { id: "start", title: "Start page", questionIds: ["source"] },
        { id: "conditional", title: "Conditional page", questionIds: ["detail"] },
        { id: "join", title: "Join page", questionIds: ["note", "extra"] },
      ],
      routing: { version: 1, entry: page("start"), routes: { start: route(page("conditional")), conditional: route(page("join")), join: route({ kind: "automatic" }) } },
    });
    await editor.goto(base + "/editor/" + flowId);
    await editor.getByRole("button", { name: "Flow (Beta)", exact: true }).click();
    const dialog = editor.getByRole("dialog");
    const pageRules = id => editor.locator(`.react-flow__node[data-id="page:${id}"]`).getByRole("button", { name: "Rules", exact: true });
    const closeInspector = () => dialog.getByRole("button", { name: "Close question editor", exact: true }).click();
    async function visibility(pageId, title, value) {
      await pageRules(pageId).click();
      const rule = dialog.getByText(new RegExp("^Show or hide this element · " + title)).locator("..");
      await rule.locator("summary").click();
      await rule.getByRole("button", { name: "Add visibility rule" }).click();
      await rule.getByLabel("Earlier question").selectOption("source");
      await rule.getByRole("combobox").nth(3).selectOption("equals");
      await rule.getByRole("combobox").nth(4).selectOption(value);
      await closeInspector();
    }
    await visibility("conditional", "Optional branch detail", "a");
    await visibility("join", "Conditional question", "a");
    await pageRules("start").click();
    const routes = dialog.getByText(/^Conditions and priority/).locator("..");
    await routes.locator("summary").click();
    await routes.getByRole("button", { name: "Add rule", exact: true }).click();
    await routes.getByRole("combobox").nth(2).selectOption("equals");
    await routes.getByRole("combobox").nth(3).selectOption("b");
    await routes.getByRole("combobox").last().selectOption("page:join");
    await closeInspector();
    await until(async () => {
      const saved = (await read(flowId)).routing;
      return saved.visibility?.extra?.[0]?.conditions[0]?.value === "a" && saved.routes.start.rules[0]?.destination.id === "join";
    });
    await publish(flowId);
    const live = await visitor.newPage();
    await live.goto(base + "/play/" + flowId);
    await live.getByRole("button", { name: "Let’s begin", exact: true }).click();
    const next = () => live.getByRole("button", { name: "Next", exact: true }).click();
    await live.getByRole("radio", { name: "Alpha" }).check();
    await next();
    await live.getByRole("heading", { name: "Optional branch detail" }).waitFor();
    await live.getByRole("radio", { name: "Alpha" }).check();
    await next();
    await live.getByRole("heading", { name: "Conditional question" }).waitFor();
    await live.getByRole("radio", { name: "Alpha" }).check();
    const back = () => live.getByRole("button", { name: "Back", exact: true }).click();
    await back();
    await back();
    await live.getByRole("radio", { name: "Beta" }).check();
    await next();
    await live.getByRole("heading", { name: "Shared end" }).waitFor();
    assert.equal(await live.getByRole("heading", { name: "Conditional question" }).count(), 0);
    const submitted = live.waitForResponse(response => response.url().endsWith(`/api/forms/${flowId}/submit`));
    await live.getByRole("button", { name: "Finish", exact: true }).click();
    assert.deepEqual((await submitted).request().postDataJSON().answers, { source: "b" });
    console.log("PASS Release 2: authoring and persistence, all score toggles and layouts, saved result links, grouped page routing, field visibility, and backtracking");
  } finally {
    try {
      for (const id of ids) await owner.request.delete(base + "/api/forms/" + id, { headers }).catch(() => {});
    } finally {
      await browser.close();
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
