const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--disable-gpu"],
    }),
    ctx = await b.newContext(),
    p = await ctx.newPage(),
    base = process.env.TEST_BASE_URL || "http://127.0.0.1:3130",
    errors = [],
    writes = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/forms"))
      writes.push(r.url());
  });
  assert.equal(new URL(base).hostname, "127.0.0.1", "Local-only test");
  const out = require("node:path").resolve(process.cwd(), "../salespage");
  fs.mkdirSync(out, { recursive: true });
  try {
    await p.goto(base + "/welcome");
    await p.getByRole("heading", { level: 1 }).waitFor();
    for (const img of await p.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      // Lazy images can change loading state during hydration; wait for pixels.
      for (let attempt = 0; attempt < 40 && !(await img.evaluate(i => i.complete && i.naturalWidth > 0)); attempt++) await p.waitForTimeout(100);
      assert.ok(await img.evaluate(i => i.complete && i.naturalWidth > 0), "Image failed: " + await img.getAttribute("src"));
    }
    await p.evaluate(() => scrollTo(0, 0));
    await p
      .getByRole("button", { name: "Find their path", exact: true })
      .click();
    await p
      .locator(".journey-outcome")
      .getByRole("heading", { name: "Your first-loaf path" })
      .waitFor();
    await p
      .getByRole("button", { name: "Reveal an opportunity", exact: true })
      .click();
    assert.equal(await p.locator(".journey-scores>div").count(), 2);
    await p
      .getByRole("button", { name: "Recommend a product", exact: true })
      .click();
    await p
      .locator(".journey-outcome")
      .getByRole("heading", { name: "The Workday Pack" })
      .waitFor();
    await p.evaluate(() => scrollTo(0, 0));
    console.log("Product tour modes passed");
    console.log("Images loaded");
    for (const w of [320, 390, 768, 1024, 1440, 2560]) {
      await p.setViewportSize({ width: w, height: 1000 });
      await p.evaluate(() => document.fonts.ready);
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow ${w}`,
      );
      if (w === 1440) {
        await p.screenshot({
          path: out + "/sales-desktop.png",
          fullPage: true,
        });
        await p.screenshot({ path: out + "/sales-hero.png" });
      }
      if (w === 390)
        await p.screenshot({ path: out + "/sales-mobile.png", fullPage: true });
    }
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p
      .getByRole("link", { name: "Create your first quiz", exact: false })
      .first().click();
    await p.waitForURL(base + "/create");
    await p.goto(base + "/welcome#demo");
    console.log("Responsive screenshots passed");
    const demo = p.locator("#demo");
    for (const [use, priority, result] of [
      ["A few daily essentials", "Keeping things light", "The Everyday Sling"],
      [
        "A laptop and work essentials",
        "Having a place for everything",
        "The Workday Pack",
      ],
      [
        "Clothes for a short trip",
        "Room for a change of plans",
        "The Weekend Tote",
      ],
    ]) {
      await demo.getByRole("button", { name: use, exact: false }).click();
      await demo.getByRole("button", { name: priority, exact: false }).click();
      await demo.getByRole("button", { name: "B No", exact: true }).click();
      await demo.getByRole("heading", { name: result, exact: true }).waitFor();
      await demo.getByRole("button", { name: "Start again" }).click();
    }
    await demo
      .getByRole("button", { name: "A A few daily essentials", exact: true })
      .click();
    await demo
      .getByRole("button", { name: "A Keeping things light", exact: true })
      .click();
    await demo.getByRole("button", { name: "A Yes", exact: true }).click();
    await demo
      .getByRole("heading", { name: "Let’s check the fit first" })
      .waitFor();
    await demo.getByRole("button", { name: "Back", exact: true }).click();
    await demo.getByRole("button", { name: "B No", exact: true }).click();
    await demo.getByRole("heading", { name: "The Everyday Sling" }).waitFor();
    await demo.getByRole("button", { name: "Start again" }).click();
    await demo
      .getByRole("heading", {
        name: "What does your bag usually need to carry?",
      })
      .waitFor();
    await demo.getByRole("button").first().focus();
    await p.keyboard.press("Enter");
    await demo
      .getByRole("heading", {
        name: "What would make getting out the door easier?",
      })
      .waitFor();
    assert(
      await demo.locator("h2").evaluate((e) => e === document.activeElement),
    );
    await p
      .locator("summary")
      .filter({ hasText: "How do I get access?" })
      .click();
    await p
      .getByText(
        "Start creating a quiz without signing up.",
        { exact: false },
      )
      .waitFor();
    console.log("Demo and FAQ passed");
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    // Navigation above creates fresh lazy images; exercise their viewport before
    // asserting pixels, just as on the initial visit (do not ignore failures).
    for (const img of await p.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(i => i.decode());
      assert.ok(await img.evaluate(i => i.complete && i.naturalWidth > 0),
        "Image failed after return navigation: " + await img.getAttribute("src"));
    }
    await p.goto(base);
    await p.getByRole("heading", { level: 1 }).waitFor();
    await ctx.request.post(base + "/api/auth", {
      data: { local: true },
      headers: { Origin: base },
    });
    await p.goto(base);
    await p
      .getByRole("heading", {
        name: "Don’t just collect leads. Understand them.",
      })
      .waitFor();
    await p.goto(base + "/welcome");
    await p.getByRole("heading", { level: 1 }).waitFor();
    await p.getByRole("link", { name: "Sign in", exact: true }).first().click();
    assert(p.url().endsWith("/login"));
    console.log(
      "PASS: six responsive widths; all images; three recommendations; exclusion fallback; back/restart; keyboard and focus; FAQ; guest homepage/authenticated workspace; public welcome; login links; no submission requests or page errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
