import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("Navigating to editor...");
  await page.goto("http://localhost:3000/editor/ts-pro-mastery", {
    waitUntil: "networkidle",
  });

  // Verify bottom bar has Logic button
  const logicBtn = page.getByRole("button", { name: "Logic" });
  await logicBtn.click();
  console.log("Clicked Logic button");

  await page.waitForTimeout(500);

  // Take screenshot of empty/initial logic modal
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step1-logic-modal-opened.png",
  });
  console.log("Saved step1-logic-modal-opened.png");

  // Click "+ Add Rule"
  const addRuleBtn = page.getByRole("button", { name: "Add Rule" }).first();
  await addRuleBtn.click();
  console.log("Clicked Add Rule button");

  await page.waitForTimeout(500);

  // Take screenshot of rule card in modal
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step1-logic-rule-added.png",
  });
  console.log("Saved step1-logic-rule-added.png");

  // Click Close & Save
  const closeBtn = page.getByRole("button", { name: "Close & Save" });
  await closeBtn.click();
  console.log("Clicked Close & Save");

  await page.waitForTimeout(1200);

  // Take screenshot of editor canvas showing the logic indicator badge
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step1-editor-with-logic-badge.png",
  });
  console.log("Saved step1-editor-with-logic-badge.png");

  await browser.close();
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
