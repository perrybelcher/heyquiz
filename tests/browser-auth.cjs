const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.AUTH_TEST_URL || "http://127.0.0.1:3138";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Local test URL required");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-gpu"],
  });
  const context = await browser.newContext(),
    page = await context.newPage();
  let count = 0;
  try {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/signup");
      await page
        .getByRole("heading", { name: "Create your Quiznick account" })
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      count++;
    }
    await page.getByLabel("Email address").fill("synthetic@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("long-test-password");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("different-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("alert").filter({ hasText: "don’t match" }).waitFor();
    count++;
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Password", { exact: true }).getAttribute("type"),
      "text",
    );
    count++;
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("long-test-password");
    await page.route("**/api/auth/account", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Check your inbox to confirm your email.",
        }),
      }),
    );
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
    count++;
    await page.goto(base + "/forgot-password");
    await page.getByLabel("Email address").fill("synthetic@example.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
    count++;
    await page.unroute("**/api/auth/account");
    await page.goto(base + "/reset-password");
    await page
      .getByLabel("New password", { exact: true })
      .fill("new-long-password");
    await page.getByLabel("Confirm password").fill("new-long-password");
    await page.getByRole("button", { name: "Save new password" }).click();
    await page.getByRole("alert").filter({ hasText: "expired" }).waitFor();
    count++;
    await page.goto(base + "/auth/callback?code=invalid-test-code");
    await page.getByRole("alert").filter({ hasText: "same browser" }).waitFor();
    assert.equal(new URL(page.url()).search, "");
    count++;
    await page.goto(base + "/signup");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "../quiznick/signup-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({
      path: "../quiznick/signup-mobile.png",
      fullPage: true,
    });
    if (process.env.AUTH_TEST_PRODUCTION === "1") {
      await page.goto(base + "/login?reset=success");
      await page.getByRole("status").filter({hasText: "password has been updated"}).waitFor(); count++;
      await page.getByRole("link", {name: "Create an account"}).click();
      await page.getByRole("heading", {name: "Create your Quiznick account"}).waitFor(); count++;
      await page.goto(base + "/login");
      await page.getByRole("link", {name: "Forgot your password?"}).click();
      await page.getByRole("heading", {name: "Forgot your password?"}).waitFor(); count++;
      await page.goto(base + "/welcome");
      await page.getByRole("link", {name: "Create account", exact: true}).click();
      await page.getByRole("heading", {name: "Create your Quiznick account"}).waitFor(); count++;
    }
    console.log(
      `${count} browser checks passed. Simulated success messages; no real signup/email.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
