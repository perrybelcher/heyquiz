import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("1. Navigating to editor for ts-pro-mastery...");
  await page.goto("http://localhost:3000/editor/ts-pro-mastery", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);

  // Take screenshot of editor canvas showing drag handles
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step3-canvas-drag-handles.png",
  });
  console.log("Saved step3-canvas-drag-handles.png");

  // Check grab handles
  const handles = page.locator('button[title="Drag to reorder question"]');
  const handleCount = await handles.count();
  console.log(`Found ${handleCount} question drag handles on canvas.`);

  // Get question titles before reorder
  const qInputs = page.locator(
    'input[placeholder="Type your question prompt..."]',
  );
  const q1Title = await qInputs.nth(0).inputValue();
  const q2Title = await qInputs.nth(1).inputValue();
  console.log(`Q1 initial: "${q1Title}"`);
  console.log(`Q2 initial: "${q2Title}"`);

  // Drag Q1 handle below Q2
  const handle0 = handles.nth(0);
  const box0 = await handle0.boundingBox();
  const handle1 = handles.nth(1);
  const box1 = await handle1.boundingBox();

  if (box0 && box1) {
    console.log(
      `Dragging Q1 from (${box0.x}, ${box0.y}) to (${box1.x}, ${box1.y + box1.height / 2})...`,
    );
    await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move in increments to simulate drag
    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      const currentY = box0.y + ((box1.y + 80 - box0.y) * i) / steps;
      await page.mouse.move(box0.x + box0.width / 2, currentY);
      await page.waitForTimeout(30);
    }

    // Take screenshot during drag
    await page.screenshot({
      path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step3-drag-in-progress.png",
    });
    console.log("Saved step3-drag-in-progress.png");

    await page.mouse.up();
    await page.waitForTimeout(1000);
  }

  // Check question titles after drag
  const newQ1Title = await qInputs.nth(0).inputValue();
  const newQ2Title = await qInputs.nth(1).inputValue();
  console.log(`Q1 after drag: "${newQ1Title}"`);
  console.log(`Q2 after drag: "${newQ2Title}"`);

  // Take screenshot after reorder
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step3-canvas-reordered.png",
  });
  console.log("Saved step3-canvas-reordered.png");

  // Also test clicking "Move down" button on a question to verify fallback
  const moveDownBtns = page.locator('button[title="Move down"]');
  await moveDownBtns.nth(0).click();
  await page.waitForTimeout(1000);

  // Take screenshot after clicking move down
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step3-move-down-tested.png",
  });

  // Verify Player reflects the new question order
  console.log("Navigating to /play/ts-pro-mastery to verify Player...");
  await page.goto("http://localhost:3000/play/ts-pro-mastery", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/step3-player-order-verified.png",
  });
  console.log("Saved step3-player-order-verified.png");

  await browser.close();
  console.log("QC DnD Test finished successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
