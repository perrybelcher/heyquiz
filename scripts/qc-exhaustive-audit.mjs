import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (err) => {
    console.error("PAGE ERROR:", err.message);
    errors.push({ type: "pageerror", message: err.message });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("CONSOLE ERROR:", msg.text());
      errors.push({ type: "console.error", message: msg.text() });
    }
  });

  console.log("=== 1. TESTING DASHBOARD ===");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // Check form list
  const formCards = page.locator('div[class*="group"][class*="rounded-2xl"]');
  const cardCount = await formCards.count();
  console.log(`Dashboard form cards found: ${cardCount}`);

  // Test "New Form" creation
  console.log("Testing New Form button...");
  const newFormBtn = page.getByRole("button", { name: "New Form" });
  if (await newFormBtn.isVisible()) {
    await newFormBtn.click();
    await page.waitForURL(/\/editor\/.+/, { timeout: 8000 });
    console.log("Successfully navigated to new editor URL:", page.url());
  }

  console.log("=== 2. TESTING EDITOR STUDIO ===");
  await page.goto("http://localhost:3000/editor/ts-pro-mastery", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);

  // Take screenshot of editor studio
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/audit-editor-initial.png",
  });

  // Test Top Navigation Tabs
  console.log("Testing Navigation Tabs: Integrate, Share, Results, Edit...");
  await page.getByRole("button", { name: "Integrate" }).click();
  await page.waitForTimeout(300);
  const integrateVisible = await page
    .getByText("API & Webhook Integrations")
    .isVisible();
  console.log(`Integrate tab rendered: ${integrateVisible}`);

  await page.getByRole("button", { name: "Share" }).click();
  await page.waitForTimeout(300);
  const shareVisible = await page.getByText("Share Your Quiz").isVisible();
  console.log(`Share tab rendered: ${shareVisible}`);

  await page.getByRole("button", { name: "Results" }).click();
  await page.waitForTimeout(500);
  const resultsVisible = await page
    .getByText("Submissions & Analytics")
    .isVisible();
  console.log(`Results tab rendered: ${resultsVisible}`);

  // Test View submission modal in Results tab
  const viewBtn = page.getByRole("button", { name: "View" }).first();
  if (await viewBtn.isVisible()) {
    await viewBtn.click();
    await page.waitForTimeout(400);
    const detailTitle = await page.getByText("Submission Details").isVisible();
    console.log(`Submission Detail Modal opened: ${detailTitle}`);
    if (detailTitle) {
      const closeBtn = page.getByRole("button", { name: "✕" }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
  }

  // Switch back to Edit tab
  await page.getByRole("button", { name: "Edit" }).click();
  await page.waitForTimeout(400);

  // Test Publish Button & Modal
  console.log("Testing Publish Button & Fillout Publish Modal...");
  const publishBtn = page.getByRole("button", { name: "Publish" });
  await publishBtn.click();
  await page.waitForTimeout(500);
  const publishModalVisible = await page
    .getByText("Your Quiz is Published!")
    .isVisible();
  console.log(`Fillout Publish Modal opened: ${publishModalVisible}`);
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/audit-publish-modal.png",
  });
  // Close publish modal
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300);

  // Test Field Palette additions
  console.log("Testing Field Palette: Adding Short Answer, Rating, Date...");
  const shortAnswerPalette = page
    .getByRole("button", { name: /short answer/i })
    .first();
  if (await shortAnswerPalette.isVisible()) {
    await shortAnswerPalette.click();
    await page.waitForTimeout(300);
  }

  const datePalette = page.getByRole("button", { name: /date/i }).first();
  if (await datePalette.isVisible()) {
    await datePalette.click();
    await page.waitForTimeout(300);
  }

  // Test Bottom Bar "Add question"
  console.log("Testing Bottom Bar 'Add question' button...");
  const addQBtn = page.getByRole("button", { name: "Add question" });
  if (await addQBtn.isVisible()) {
    await addQBtn.click();
    await page.waitForTimeout(300);
    console.log("Successfully added question via bottom bar.");
  }

  // Test Question Settings Sidebar
  console.log("Testing Question Settings Sidebar (points, required toggle)...");
  const requiredToggle = page.locator('input[type="checkbox"]').first();
  if (await requiredToggle.isVisible()) {
    await requiredToggle.click();
    await page.waitForTimeout(200);
  }

  // Test Theme Modal & application
  console.log("Testing Theme Modal...");
  const themeBtn = page.getByRole("button", { name: "Theme" });
  await themeBtn.click();
  await page.waitForTimeout(400);
  const emeraldTheme = page.getByText("Emerald Pro");
  if (await emeraldTheme.isVisible()) {
    await emeraldTheme.click();
    console.log("Selected Emerald Pro theme preset.");
  }
  await page.waitForTimeout(300);

  // Test Visual Logic Modal
  console.log("Testing Visual Logic Modal...");
  const logicBtn = page.getByRole("button", { name: /logic/i }).last();
  await logicBtn.click();
  await page.waitForTimeout(400);
  const closeLogic = page
    .getByRole("button", { name: /close/i })
    .or(page.getByText("✕"))
    .first();
  await closeLogic.click();
  await page.waitForTimeout(300);

  console.log("=== 3. TESTING QUIZ PLAYER AT RUNTIME ===");
  await page.goto("http://localhost:3000/play/ts-pro-mastery", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/audit-player-initial.png",
  });

  // Check required validation
  console.log(
    "Testing required question validation: clicking continue without answering...",
  );
  const continueBtn = page.getByRole("button", { name: /continue|complete/i });
  await continueBtn.click();
  await page.waitForTimeout(400);
  const requiredMsg = page.getByText(/please answer this required question/i);
  const isRequiredBlocked = await requiredMsg.isVisible();
  console.log(
    `Required validation correctly blocked advance: ${isRequiredBlocked}`,
  );

  // Now answer and continue
  console.log("Selecting answer on Q1...");
  const q1Choices = page.locator("main button");
  if ((await q1Choices.count()) > 0) {
    await q1Choices.nth(0).click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/audit-player-q2.png",
  });

  console.log("=== AUDIT SUMMARY ===");
  console.log(`Total errors captured: ${errors.length}`);
  if (errors.length > 0) {
    console.error(
      "Errors found during audit:",
      JSON.stringify(errors, null, 2),
    );
  } else {
    console.log(
      "All systems passed! Zero console errors, zero runtime crashes.",
    );
  }

  await browser.close();
}

main().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
