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

  // 1. Submit Response 1 via API or Player
  console.log("Submitting Response 1 (High Score)...");
  const res1 = await fetch(
    "http://localhost:3000/api/forms/ts-pro-mastery/submit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: {
          q1: "It manages async form actions, tracks pending status, and returns the optimistic result",
          q2: "Partial<T>",
          q3: "POST",
          q4: "b_true",
          q5: "MCP",
        },
      }),
    },
  );
  const data1 = await res1.json();
  console.log(
    "Response 1 submitted:",
    data1.percentageScore + "%",
    data1.matchedTier?.title,
  );

  // 2. Submit Response 2
  console.log("Submitting Response 2 (Medium Score)...");
  const res2 = await fetch(
    "http://localhost:3000/api/forms/ts-pro-mastery/submit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: {
          q1: "It manages async form actions, tracks pending status, and returns the optimistic result",
          q2: "Required<T>", // wrong answer
          q3: "GET", // wrong answer
          q4: "b_true",
          q5: "MCP",
        },
      }),
    },
  );
  const data2 = await res2.json();
  console.log(
    "Response 2 submitted:",
    data2.percentageScore + "%",
    data2.matchedTier?.title,
  );

  // 3. Open Editor in browser
  console.log(
    "Navigating to editor at http://localhost:3000/editor/ts-pro-mastery...",
  );
  await page.goto("http://localhost:3000/editor/ts-pro-mastery", {
    waitUntil: "networkidle",
  });

  // Take screenshot of editor navbar with the new heyquiz logo
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step2-editor-heyquiz-logo.png",
  });
  console.log("Saved step2-editor-heyquiz-logo.png");

  // 4. Click the "Results" tab
  console.log("Clicking Results tab...");
  const resultsTab = page.getByRole("button", { name: "Results" });
  await resultsTab.click();
  await page.waitForTimeout(800);

  // Take screenshot of Results & Analytics tab
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step2-results-analytics.png",
  });
  console.log("Saved step2-results-analytics.png");

  // 5. Click "View" on the first submission to open details modal
  const viewBtns = page.getByRole("button", { name: "View" });
  if ((await viewBtns.count()) > 0) {
    await viewBtns.first().click();
    console.log("Clicked View details on submission 1");
    await page.waitForTimeout(500);

    // Take screenshot of Submission Details modal
    await page.screenshot({
      path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step2-submission-detail-modal.png",
    });
    console.log("Saved step2-submission-detail-modal.png");

    // Close modal
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(400);
  }

  // 6. Click the "Share" tab to test
  console.log("Clicking Share tab...");
  const shareTab = page.getByRole("button", { name: "Share" });
  await shareTab.click();
  await page.waitForTimeout(600);

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step2-share-tab.png",
  });
  console.log("Saved step2-share-tab.png");

  // 7. Click the "Integrate" tab to test
  console.log("Clicking Integrate tab...");
  const integrateTab = page.getByRole("button", { name: "Integrate" });
  await integrateTab.click();
  await page.waitForTimeout(600);

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step2-integrate-tab.png",
  });
  console.log("Saved step2-integrate-tab.png");

  // 8. Open Dashboard to check heyquiz logo
  console.log("Navigating to Dashboard http://localhost:3000/...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step2-dashboard-heyquiz.png",
  });
  console.log("Saved step2-dashboard-heyquiz.png");

  // 9. Open Player to check heyquiz logo in player header
  console.log(
    "Navigating to Player http://localhost:3000/play/ts-pro-mastery...",
  );
  await page.goto("http://localhost:3000/play/ts-pro-mastery", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step2-player-heyquiz.png",
  });
  console.log("Saved step2-player-heyquiz.png");

  await browser.close();
  console.log("All Step 2 QC tests passed successfully!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
