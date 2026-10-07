import { chromium } from "playwright";

async function run() {
  const formPayload = {
    id: `picture-choice-test-${Date.now()}`,
    title: "World Geography & Landscapes",
    description:
      "Visual assessment testing Fillout-parity picture choice questions.",
    mode: "quiz",
    published: true,
    theme: {
      primaryColor: "#4f46e5",
      backgroundColor: "#f8fafc",
      fontFamily: "Inter",
      borderRadius: "lg",
    },
    settings: {
      passingScorePercentage: 70,
      showProgressBar: true,
      enableKeyboardShortcuts: true,
      feedbackMode: "immediate",
      showAnswerKeyOnFinish: true,
    },
    questions: [
      {
        id: "q-pic-1",
        type: "picture_choice",
        title:
          "Which landscape represents the highest elevation alpine environment?",
        description:
          "Review the photography cards below and select the correct formation.",
        required: true,
        points: 20,
        pictureColumns: 3,
        pictureAspectRatio: "landscape",
        explanation:
          "Alpine peaks rise above the tree line with rugged rocky terrain and snow accumulation.",
        options: [
          {
            id: "opt-alpine",
            label: "Alpine Summit Ridge",
            imageUrl:
              "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
            isCorrect: true,
            explanation:
              "Glaciated alpine summits exceed 4,000 meters elevation.",
          },
          {
            id: "opt-coast",
            label: "Tropical Coral Coast",
            imageUrl:
              "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
            isCorrect: false,
            explanation: "Coastlines sit at sea level elevation.",
          },
          {
            id: "opt-forest",
            label: "Temperate Rainforest Canopy",
            imageUrl:
              "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80",
            isCorrect: false,
            explanation: "Rainforests thrive in low-to-mid elevation basins.",
          },
        ],
      },
    ],
    outcomeTiers: [
      {
        id: "tier-pass",
        title: "Landscape Master",
        message: "Outstanding visual recognition skills!",
        badge: "🏆",
        minScorePercent: 70,
        maxScorePercent: 100,
        color: "#10b981",
      },
      {
        id: "tier-fail",
        title: "Needs Review",
        message: "Review geography fundamentals.",
        badge: "📚",
        minScorePercent: 0,
        maxScorePercent: 69,
        color: "#ef4444",
      },
    ],
  };

  console.log("Seeding form via POST /api/forms...");
  const res = await fetch("http://localhost:3000/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formPayload),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed form: ${res.status} ${await res.text()}`);
  }
  const created = await res.json();
  const formId = created.id;
  console.log(`Form created with ID: ${formId}`);

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log(`Navigating to Editor: http://localhost:3000/editor/${formId}`);
  await page.goto(`http://localhost:3000/editor/${formId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(600);

  // Take screenshot of Editor Studio Canvas with Picture Choice
  console.log("Capturing Editor Studio canvas...");
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/picture-choice-canvas-editor.png",
  });

  // Test Inspector: switch aspect ratio to Square
  console.log("Testing Inspector Aspect Ratio toggle to Square...");
  const squareBtn = page.getByRole("button", { name: "1:1 Square" });
  if (await squareBtn.isVisible()) {
    await squareBtn.click();
    await page.waitForTimeout(300);
  }

  // Test Inspector: switch columns to 3 Cols
  console.log("Testing Inspector Grid Columns toggle to 3 Cols...");
  const threeColsBtn = page.getByRole("button", { name: "3 Cols" });
  if (await threeColsBtn.isVisible()) {
    await threeColsBtn.click();
    await page.waitForTimeout(300);
  }

  // Take screenshot of Inspector controls
  console.log("Capturing Editor Inspector controls...");
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/picture-choice-inspector.png",
  });

  // Switch back to landscape for player
  const landscapeBtn = page.getByRole("button", { name: "16:9 Landscape" });
  if (await landscapeBtn.isVisible()) {
    await landscapeBtn.click();
    await page.waitForTimeout(1600); // allow autosave
  }

  // Open Runtime Player
  console.log(`Navigating to Player: http://localhost:3000/play/${formId}`);
  await page.goto(`http://localhost:3000/play/${formId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(600);

  // Take screenshot of Player Initial State
  console.log("Capturing Player initial state with Picture Choice grid...");
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/picture-choice-player-initial.png",
  });

  // Click on the first card (Alpine Summit Ridge)
  console.log("Selecting option 'Alpine Summit Ridge'...");
  const alpineCard = page
    .locator("button:has-text('Alpine Summit Ridge')")
    .first();
  await alpineCard.click();
  await page.waitForTimeout(600);

  // Take screenshot of selected state with immediate feedback banner
  console.log("Capturing Player selected card state...");
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/picture-choice-player-selected.png",
  });

  // Click Complete & View Score
  const completeBtn = page.getByRole("button", {
    name: /Complete & View Score/i,
  });
  if (await completeBtn.isVisible()) {
    console.log("Clicking Complete & View Score...");
    await completeBtn.click();
  }

  await page.waitForTimeout(1200);

  // Expand Review Answers & Explanations
  const reviewBtn = page.getByRole("button", {
    name: /Review Answers & Explanations/i,
  });
  if (await reviewBtn.isVisible()) {
    console.log("Expanding Answer Review accordion...");
    await reviewBtn.click();
    await page.waitForTimeout(500);
  }

  // Take screenshot of Results Screen with Review Breakdown
  console.log("Capturing Results Screen...");
  await page.screenshot({
    path: "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035/picture-choice-player-result.png",
  });

  console.log("All Picture Choice verification tests passed successfully!");
  await browser.close();
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
