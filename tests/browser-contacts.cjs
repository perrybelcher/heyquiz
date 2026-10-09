const { chromium, firefox, webkit } = require("playwright");
const browserType = process.env.QA_BROWSER || "chrome";
const engine = { chrome: chromium, firefox, webkit }[browserType];
if (!engine) throw new Error("Unsupported QA_BROWSER");
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
const { defaultCapture } = require("../lib/contacts.ts");
(async () => {
  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3130",
    id = "browser-contacts-" + Date.now(),
    checks = [];
  const b = await engine.launch({
    ...(browserType === "chrome" ? { channel: "chrome" } : {}),
    headless: true,
  });
  const owner = await b.newContext({ acceptDownloads: true });
  const visitor = await b.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await owner.request.post(base + "/api/auth", {
      data: { local: true },
      headers: { Origin: base },
    });
    const f = marketingTemplate("product_finder", id);
    f.capture = {
      ...defaultCapture,
      enabled: true,
      placement: "after_results",
    };
    assert.equal(
      (
        await owner.request.post(base + "/api/forms", {
          data: f,
          headers: { Origin: base },
        })
      ).status(),
      201,
    );
    assert.equal(
      (
        await owner.request.post(base + `/api/forms/${id}/publish`, {
          data: {},
          headers: { Origin: base },
        })
      ).status(),
      200,
    );
    const p = await visitor.newPage();
    p.setDefaultTimeout(10000);
    await p.goto(base + "/play/" + id);
    await p.getByRole("button", { name: "Let’s begin", exact: true }).click();
    await p
      .getByRole("radio", { name: "A few daily essentials", exact: true })
      .check();
    await p.getByRole("button", { name: "Continue", exact: true }).click();
    await p
      .getByRole("radio", { name: "Keeping things light", exact: true })
      .check();
    await p.getByRole("button", { name: "Continue", exact: true }).click();
    await p.getByRole("radio", { name: "No", exact: true }).check();
    await p
      .getByRole("button", { name: "Review answers", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Submit response", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "The Everyday Sling", exact: true })
      .waitFor();
    checks.push("After-results capture shows recommendation before contact");
    await p
      .getByRole("textbox", { name: "Name (optional)", exact: true })
      .fill("QA Opt In");
    await p
      .getByRole("textbox", { name: "Email", exact: true })
      .fill("qa-optin@example.com");
    await p.getByRole("checkbox").check();
    await p
      .getByRole("button", { name: f.capture.buttonText, exact: true })
      .click();
    await p
      .getByText("Your results are ready below.", { exact: true })
      .waitFor();
    checks.push("After-results positive opt-in accepted");
    const edit = await owner.newPage();
    await edit.goto(base + "/editor/" + id);
    await edit.getByRole("button", { name: "Contacts", exact: true }).click();
    await edit
      .getByRole("heading", { name: "Contacts (1)", exact: true })
      .waitFor();
    await edit
      .getByText("QA Opt In · The Everyday Sling · Marketing opted in", {
        exact: true,
      })
      .waitFor();
    checks.push("Opt-in consent persisted");
    const waiting = edit.waitForEvent("download", { timeout: 10000 });
    await edit.getByRole("button", { name: "Export CSV", exact: true }).click();
    const download = await waiting;
    const file = await download.path();
    const csv = fs.readFileSync(file, "utf8");
    assert.ok(csv.includes("qa-optin@example.com"));
    assert.ok(csv.includes("QA Opt In"));
    assert.ok(csv.includes("true"));
    checks.push("CSV download contains expected contact and consent");
    await edit.setViewportSize({ width: 390, height: 844 });
    const overflow = await edit.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    checks.push({ mobileContactsViewport: overflow });
    await edit.screenshot({
      path: "../../outputs/browser-matrix/contacts-mobile.png",
      fullPage: true,
    });
    console.log(JSON.stringify(checks, null, 2));
    fs.writeFileSync(
      "../../outputs/browser-matrix/contacts.json",
      JSON.stringify(checks, null, 2),
    );
  } finally {
    await owner.request.delete(base + "/api/forms/" + id, {
      headers: { Origin: base },
    });
    await b.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
