const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const base = "http://127.0.0.1:3130",
  id = "qa-nango-browser-" + Date.now(),
  dir = path.resolve("../../outputs/integrations");
(async () => {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const c = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let checks = 0;
  try {
    await c.request.post(base + "/api/auth", {
      data: { local: true },
      headers: { Origin: base },
    });
    const cr = await c.request.post(base + "/api/forms", {
      data: {
        id,
        title: "QA Nango workflow",
        mode: "survey",
        questions: [{ id: "q", type: "short_answer", title: "Your priority" }],
      },
      headers: { Origin: base },
    });
    assert.equal(cr.status(), 201);
    const endpoint = `${base}/api/forms/${id}/integrations`;
    const unauth = await b.newContext();
    assert.equal(
      (
        await unauth.request.post(endpoint + "/hubspot", {
          data: { action: "start" },
        })
      ).status(),
      401,
    );
    await unauth.close();
    checks++;
    assert.equal(
      (
        await c.request.post(endpoint + "/hubspot", {
          data: { action: "start" },
          headers: { Origin: "https://elsewhere.example" },
        })
      ).status(),
      403,
    );
    checks++;
    assert.equal(
      (
        await c.request.post(endpoint + "/hubspot", {
          data: { action: "start" },
          headers: { Origin: base },
        })
      ).status(),
      503,
    );
    checks++;
    await p.goto(base + "/editor/" + id);
    await p.getByRole("button", { name: "Integrate", exact: true }).click();
    await p
      .getByRole("heading", { name: "Lead integrations", exact: true })
      .waitFor();
    await p.getByText("Server setup pending.", { exact: false }).waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "Connect HubSpot", exact: true })
        .isEnabled(),
      false,
    );
    checks++;
    // Simulated Nango responses exercise the client without authorizing a real CRM.
    const connection = {
      id: "hubspot-fixture",
      provider: "hubspot",
      name: "HubSpot QA",
      revision: 1,
      enabled: false,
      consentOnly: true,
      locationId: "",
      tags: [],
      resultTag: false,
      mappings: [],
      destination: "HubSpot via Nango",
      credentialsSaved: true,
    };
    let connected = false,
      saved;
    await p.route("**/api/forms/" + id + "/integrations", async (route) => {
      if (route.request().method() === "PUT") {
        saved = route.request().postDataJSON();
        return route.fulfill({ json: { ...saved, revision: 2 } });
      }
      return route.fulfill({
        json: {
          connections: connected ? [connection] : [],
          deliveries: [],
          schedulerConfigured: true,
          schedulerCadence: "minute",
          deliveryAllowed: true,
          nangoConfigured: true,
        },
      });
    });
    await p.route(
      "**/api/forms/" + id + "/integrations/hubspot",
      async (route) => {
        const data = route.request().postDataJSON();
        if (data.action === "start")
          return route.fulfill({
            json: {
              attemptId: "test-attempt",
              connectLink: "https://connect.nango.dev/?session_token=synthetic",
              expiresAt: Date.now() + 1800000,
            },
          });
        connected = true;
        return route.fulfill({ json: { connected: true, connection } });
      },
    );
    await p.reload();
    await p.getByRole("button", { name: "Integrate", exact: true }).click();
    await p
      .getByRole("button", { name: "Connect HubSpot", exact: true })
      .click();
    await p
      .getByRole("link", { name: "Authorize HubSpot ↗", exact: true })
      .waitFor();
    assert.equal(
      await p
        .getByRole("link", { name: "Authorize HubSpot ↗", exact: true })
        .getAttribute("rel"),
      "noopener noreferrer",
    );
    checks++;
    await p
      .getByRole("button", { name: "Check connection", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Edit HubSpot", exact: true })
      .waitFor();
    assert.equal(
      await p.getByLabel("Only send leads who opt in to marketing").isEnabled(),
      false,
    );
    assert.equal(
      await p.getByLabel("Enable delivery for new leads").isChecked(),
      false,
    );
    checks++;
    await p
      .getByRole("button", { name: "Add field mapping", exact: true })
      .click();
    await p.getByLabel("Source field 1", { exact: true }).selectOption("score");
    await p
      .getByLabel("Destination field 1", { exact: true })
      .fill("heyquiz_score");
    fs.mkdirSync(dir, { recursive: true });
    await p.screenshot({
      path: path.join(dir, "hubspot-desktop.png"),
      fullPage: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await p.screenshot({
      path: path.join(dir, "hubspot-mobile.png"),
      fullPage: true,
    });
    checks++;
    await p
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await p
      .getByText("Connection saved and paused.", { exact: false })
      .waitFor();
    assert.deepEqual(saved.mappings, [
      { source: "score", target: "heyquiz_score" },
    ]);
    assert.equal(saved.token, undefined);
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      `${checks} Nango API/browser checks passed; screenshots saved. OAuth UI responses were mocked.`,
    );
  } finally {
    await c.request.delete(base + "/api/forms/" + id, {
      headers: { Origin: base },
    });
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
