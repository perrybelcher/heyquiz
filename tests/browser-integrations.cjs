const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
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
const { listRecords, removeRecord } = require("../lib/records.ts");
const base = "http://127.0.0.1:3130",
  id = "qa-browser-integrations-" + Date.now(),
  dir = path.resolve("../../outputs/integrations");
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const b = await chromium.launch({ channel: "chrome", headless: true }),
    context = await b.newContext({ viewport: { width: 1280, height: 1000 } }),
    p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.setDefaultTimeout(10000);
  try {
    await context.request.post(base + "/api/auth", {
      data: { local: true },
      headers: { Origin: base },
    });
    const cr = await context.request.post(base + "/api/forms", {
      data: {
        id,
        title: "QA integration setup",
        mode: "survey",
        questions: [
          {
            id: "campaign",
            type: "hidden",
            title: "Campaign",
            hiddenParamName: "utm_campaign",
          },
          { id: "q", type: "short_answer", title: "Your answer" },
        ],
      },
      headers: { Origin: base },
    });
    assert.equal(cr.status(), 201);
    await p.goto(base + "/editor/" + id);
    await p.getByRole("button", { name: "Integrate", exact: true }).click();
    await p
      .getByRole("heading", { name: "Lead integrations", exact: true })
      .waitFor();
    await p
      .locator("article")
      .filter({
        has: p.getByRole("heading", { name: "Webhooks", exact: true }),
      })
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    await p.getByLabel("Connection name", { exact: true }).fill("QA webhook");
    await p
      .getByLabel("Webhook URL", { exact: true })
      .fill("https://hooks.example.com/private-synthetic-path");
    await p
      .getByLabel("Signing secret (optional)", { exact: true })
      .fill("synthetic-webhook-secret");
    await p
      .getByRole("button", { name: "Add field mapping", exact: true })
      .click();
    await p
      .getByLabel("Source field 1", { exact: true })
      .selectOption("answers.campaign");
    await p.getByLabel("Destination field 1", { exact: true }).fill("campaign");
    await p
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "saved and paused" })
      .waitFor();
    let api = await (
      await context.request.get(base + `/api/forms/${id}/integrations`)
    ).json();
    assert.equal(api.connections[0].enabled, false);
    assert.deepEqual(api.connections[0].mappings, [
      { source: "answers.campaign", target: "campaign" },
    ]);
    assert.ok(!JSON.stringify(api).includes("private-synthetic-path"));
    assert.ok(!JSON.stringify(api).includes("synthetic-webhook-secret"));
    await p.reload();
    await p.getByRole("button", { name: "Integrate", exact: true }).click();
    await p
      .getByRole("heading", { name: "QA webhook", exact: false })
      .waitFor();
    await p
      .locator("article")
      .filter({
        has: p.getByRole("heading", { name: "QA webhook", exact: false }),
      })
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    assert.equal(
      await p.getByLabel("Webhook URL", { exact: true }).inputValue(),
      "",
    );
    await p
      .getByLabel("Connection name", { exact: true })
      .fill("QA webhook renamed");
    await p
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "saved and paused" })
      .waitFor();
    await p
      .locator("article")
      .filter({
        has: p.getByRole("heading", { name: "GoHighLevel", exact: true }),
      })
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    await p.getByLabel("Location ID", { exact: true }).fill("qa-location");
    await p
      .getByLabel("Private integration token", { exact: true })
      .fill("synthetic-private-token");
    await p
      .getByLabel("Tags to add (comma separated)", { exact: true })
      .fill("quiz-lead,beginner");
    assert.equal(
      await p
        .getByLabel("Only send leads who opt in to marketing", { exact: true })
        .isDisabled(),
      true,
    );
    await p
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "saved and paused" })
      .waitFor();
    api = await (
      await context.request.get(base + `/api/forms/${id}/integrations`)
    ).json();
    assert.equal(api.connections.length, 2);
    assert.deepEqual(
      api.connections.find((c) => c.provider === "gohighlevel").tags,
      ["quiz-lead", "beginner"],
    );
    assert.equal(api.deliveries.length, 0);
    await p.screenshot({
      path: dir + "/integrations-desktop.png",
      fullPage: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await p.screenshot({
      path: dir + "/integrations-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          passed: [
            "Webhook setup and mapping",
            "Secret redaction on reload",
            "Credential-preserving edit",
            "HighLevel setup and consent guard",
            "No outbound calls from paused connections",
            "Mobile viewport without page overflow",
          ],
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await context.request.delete(base + "/api/forms/" + id, {
      headers: { Origin: base },
    });
    for (const kind of ["integrations", "deliveries"])
      for (const r of await listRecords(kind, "local"))
        if (r.payload.formId === id) await removeRecord(kind, r.id, "local");
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
