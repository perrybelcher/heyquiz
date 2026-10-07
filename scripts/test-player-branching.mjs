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

  // Open Logic Modal
  const logicBtn = page.getByRole("button", { name: "Logic" });
  await logicBtn.click();
  await page.waitForTimeout(400);

  // In the rule card, re-query selects dynamically
  const ruleCard = page
    .locator("div.p-4.rounded-xl.border.border-gray-200.bg-gray-50\\/70")
    .first();

  // 1. Source question -> q1
  await ruleCard.locator("select").nth(0).selectOption("q1");
  console.log("Selected source question: q1");
  await page.waitForTimeout(300);

  // 2. Operator -> equals
  await ruleCard.locator("select").nth(1).selectOption("equals");
  console.log("Selected operator: equals");
  await page.waitForTimeout(300);

  // 3. Value is already the first option of q1, or select index 1
  await ruleCard.locator("select").nth(2).selectOption({ index: 1 });
  console.log("Selected option value at index 1");
  await page.waitForTimeout(300);

  // 4. Action -> jump_to_question
  await ruleCard.locator("select").nth(3).selectOption("jump_to_question");
  console.log("Selected action: jump_to_question");
  await page.waitForTimeout(300);

  // 5. Target question -> q4
  await ruleCard.locator("select").nth(4).selectOption("q4");
  console.log("Selected target: q4");
  await page.waitForTimeout(300);

  // Take screenshot of configured modal
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step1-rule-q1-to-q4.png",
  });

  // Close & Save
  await page.getByRole("button", { name: "Close & Save" }).click();
  console.log("Saved branching rule");

  // Wait for autosave debounced request (1.5s)
  await page.waitForTimeout(2000);

  // Now navigate to the Quiz Player
  console.log("Navigating to Player...");
  await page.goto("http://localhost:3000/play/ts-pro-mastery", {
    waitUntil: "networkidle",
  });

  // Verify we are on Q1
  await page.waitForTimeout(500);
  const q1Title = await page.locator("h2").innerText();
  console.log(`Q1 Title: ${q1Title}`);

  // Take screenshot of Q1
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step1-player-before-jump.png",
  });

  // Click Option 1 ("It manages async form actions...")
  const opt1 = page.locator("button", {
    hasText: "It manages async form actions",
  });
  await opt1.click();
  console.log("Selected Option 1 on Q1");

  // Wait for auto-advance to trigger jump
  await page.waitForTimeout(700);

  // Check what question we are on now
  const jumpedTitle = await page.locator("h2").innerText();
  console.log(`After branching jump, on: ${jumpedTitle}`);

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step1-player-jumped-successfully.png",
  });

  if (
    jumpedTitle.includes("True or False: In TypeScript, 'unknown' is type-safe")
  ) {
    console.log(
      "SUCCESS: Conditional branching directly jumped from Q1 to Q4 (skipped Q2 and Q3)!",
    );
  } else {
    console.error("FAIL: Did not jump to Q4. Current title is:", jumpedTitle);
  }

  // Click Back button
  const backBtn = page.getByRole("button", { name: "Back" });
  await backBtn.click();
  await page.waitForTimeout(500);

  const backTitle = await page.locator("h2").innerText();
  console.log(`After Back button, on: ${backTitle}`);

  if (backTitle.includes("React 19")) {
    console.log("SUCCESS: Back button history returned accurately to Q1!");
  }

  await browser.close();
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
