const { chromium } = require("playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  ts = require("typescript");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const { marketingTemplate } = require("../lib/marketing-templates.ts");
(async () => {
  const base = "http://127.0.0.1:3130",
    b = await chromium.launch({ channel: "chrome", headless: true }),
    owner = await b.newContext(),
    visitor = await b.newContext();
  let ids = [],
    checks = [];
  await owner.request.post(base + "/api/auth", {
    data: { local: true },
    headers: { Origin: base },
  });
  const p = await visitor.newPage();
  p.setDefaultTimeout(10000);
  async function publish(f) {
    ids.push(f.id);
    let r = await owner.request.post(base + "/api/forms", {
      data: f,
      headers: { Origin: base },
    });
    assert.equal(r.status(), 201);
    r = await owner.request.post(base + `/api/forms/${f.id}/publish`, {
      data: {},
      headers: { Origin: base },
    });
    assert.equal(r.status(), 200);
    await p.goto(base + "/play/" + f.id);
    await p.getByRole("button", { name: "Let’s begin", exact: true }).click();
  }
  try {
    for (const kind of ["scorecard", "segmentation"]) {
      const f = marketingTemplate(
        kind,
        "browser-journey-" + kind + "-" + Date.now(),
      );
      await publish(f);
      for (let i = 0; i < f.questions.length; i++) {
        const q = f.questions[i];
        await p.getByRole("heading", { name: q.title, exact: true }).waitFor();
        await p
          .getByRole("radio", { name: q.options[0].label, exact: true })
          .check();
        await p
          .getByRole("button", {
            name: i === f.questions.length - 1 ? "Review answers" : "Continue",
            exact: true,
          })
          .click();
      }
      await p
        .getByRole("button", { name: "Submit response", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Take it again", exact: true })
        .waitFor();
      const data = await (
        await owner.request.get(base + `/api/forms/${f.id}/submissions`)
      ).json();
      assert.equal(data.submissions.length, 1);
      checks.push({ kind, marketing: data.submissions[0].marketing });
      await p.screenshot({
        path: "../../outputs/browser-matrix/" + kind + ".png",
        fullPage: true,
      });
    }
    const id = "browser-journey-branch-" + Date.now();
    const q = (id) => ({
      id,
      title: id,
      type: "multiple_choice",
      required: true,
      points: 10,
      options: [
        { id: "a", label: "Skip ahead", isCorrect: true },
        { id: "b", label: "Full path" },
      ],
    });
    await publish({
      id,
      title: "QA branching",
      mode: "quiz",
      settings: { showReviewBeforeSubmit: true, allowRetake: true },
      questions: [q("First"), q("Middle"), q("Last")],
      logicRules: [
        {
          id: "jump",
          sourceQuestionId: "First",
          operator: "equals",
          value: "a",
          action: "jump_to_question",
          targetQuestionId: "Last",
        },
      ],
    });
    await p.getByRole("radio", { name: "Skip ahead", exact: true }).check();
    await p.getByRole("button", { name: "Continue", exact: true }).click();
    await p.getByRole("heading", { name: "Last", exact: true }).waitFor();
    checks.push("Forward jump skips middle required question");
    await p.getByRole("button", { name: "Back", exact: true }).click();
    await p.getByRole("radio", { name: "Full path", exact: true }).check();
    await p.getByRole("button", { name: "Continue", exact: true }).click();
    await p.getByRole("heading", { name: "Middle", exact: true }).waitFor();
    checks.push("Changing source answer restores skipped question");
    await p.getByRole("radio", { name: "Skip ahead", exact: true }).check();
    await p.getByRole("button", { name: "Continue", exact: true }).click();
    await p.getByRole("radio", { name: "Skip ahead", exact: true }).check();
    await p
      .getByRole("button", { name: "Review answers", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Submit response", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Take it again", exact: true })
      .waitFor();
    checks.push("Revised branch completes");
    console.log(JSON.stringify(checks, null, 2));
    fs.writeFileSync(
      "../../outputs/browser-matrix/journeys.json",
      JSON.stringify(checks, null, 2),
    );
  } finally {
    for (const id of ids)
      await owner.request.delete(base + "/api/forms/" + id, {
        headers: { Origin: base },
      });
    await b.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
