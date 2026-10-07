import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR =
  "/Users/perry/.gemini/antigravity/brain/c3af3cee-6470-4bf6-8466-9b1fb4652035";

async function run() {
  console.log("=== STARTING MULTI-PAGE & 51-FIELD PLAYWRIGHT QC ===");

  // 1. Create a rich multi-page test form via API
  const formId = `multi-page-test-${Date.now()}`;
  const testFormPayload = {
    id: formId,
    title: "Leadership & Strategy Certification",
    description: "Multi-page executive assessment with 51-field architecture.",
    mode: "quiz",
    theme: {
      primaryColor: "#4f46e5",
      backgroundColor: "#f8fafc",
      cardColor: "#ffffff",
      textColor: "#0f172a",
      font: "sans",
      layout: "step",
      borderRadius: "lg",
    },
    coverPage: {
      enabled: true,
      title: "Welcome to Executive Assessment",
      subtitle:
        "Comprehensive assessment evaluating modern leadership, tactical problem solving, and analytical acumen.",
      buttonText: "Begin Assessment",
      imageUrl:
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80",
      estimatedMinutes: 4,
      showQuestionCount: true,
    },
    pages: [
      {
        id: "page-1",
        title: "Core Competencies",
        questionIds: ["q-like", "q-img-multi"],
      },
      {
        id: "page-2",
        title: "Execution & Matrix",
        questionIds: ["q-matrix-multi", "q-faq"],
      },
    ],
    settings: {
      showProgressBar: true,
      progressBarMode: "pages",
      enablePageJumps: true,
      showReviewBeforeSubmit: true,
      feedbackMode: "end",
      passingScorePercentage: 70,
      allowRetake: true,
    },
    questions: [
      {
        id: "q-like",
        type: "like_dislike",
        title: "Do you support asynchronous-first operating models?",
        description:
          "Select Like or Dislike based on your operational preference.",
        required: true,
        points: 10,
        pageId: "page-1",
        options: [
          { id: "like", label: "Like", isCorrect: true },
          { id: "dislike", label: "Dislike", isCorrect: false },
        ],
      },
      {
        id: "q-img-multi",
        type: "image_multiselect",
        title:
          "Select all architectural designs suitable for high availability:",
        description: "Pick all relevant infrastructure diagrams.",
        required: true,
        points: 15,
        pageId: "page-1",
        pictureColumns: 3,
        pictureAspectRatio: "landscape",
        options: [
          {
            id: "opt-cloud",
            label: "Multi-Region Cloud Mesh",
            imageUrl:
              "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
            isCorrect: true,
          },
          {
            id: "opt-datacenter",
            label: "Hybrid Edge Nodes",
            imageUrl:
              "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
            isCorrect: true,
          },
          {
            id: "opt-single",
            label: "Single-Zone Monolith",
            imageUrl:
              "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80",
            isCorrect: false,
          },
        ],
      },
      {
        id: "q-matrix-multi",
        type: "matrix_multiselect",
        title: "Platform Feature Tiers Allocation",
        description:
          "Check all subscription tiers that should include each capability.",
        required: true,
        points: 20,
        pageId: "page-2",
        rows: ["SSO & SAML", "Real-Time Webhooks", "Dedicated Account Manager"],
        columns: ["Starter", "Professional", "Enterprise"],
      },
      {
        id: "q-faq",
        type: "accordion",
        title: "Executive Policy & Regulatory Accordion",
        description: "Review accordion guidance items before completing.",
        points: 0,
        pageId: "page-2",
        accordionItems: [
          {
            id: "acc-1",
            title: "What compliance standards are applied?",
            content:
              "SOC-2 Type II, ISO 27001, and GDPR strict data residency.",
          },
          {
            id: "acc-2",
            title: "How are leadership scores calculated?",
            content:
              "Scores represent percentage of weighted criteria achieved across all sections.",
          },
        ],
      },
    ],
    outcomeTiers: [
      {
        id: "tier-pass",
        minScorePercent: 70,
        maxScorePercent: 100,
        badge: "Certified Strategist",
        title: "Outstanding Strategic Acumen",
        message:
          "You demonstrated exemplary mastery across asynchronous operations and multi-tier architectures.",
      },
      {
        id: "tier-fail",
        minScorePercent: 0,
        maxScorePercent: 69,
        badge: "Review Required",
        title: "Assessment Under Review",
        message:
          "Consider reviewing high-availability patterns and retaking the assessment.",
      },
    ],
  };

  const createRes = await fetch("http://localhost:3000/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testFormPayload),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create form (${createRes.status}): ${errText}`);
  }

  const createdData = await createRes.json();
  const actualFormId = createdData.id || formId;
  console.log("Successfully created test form with ID:", actualFormId);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // ----------------------------------------------------
  // TEST 1: EDITOR STUDIO - MULTI-PAGE & COVER PAGE WYSIWYG
  // ----------------------------------------------------
  console.log(
    "Visiting Editor Studio at http://localhost:3000/editor/" + actualFormId,
  );
  await page.goto(`http://localhost:3000/editor/${actualFormId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);

  // Take screenshot of multi-page canvas
  const multiPageEditorPath = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-multi-page-editor.png",
  );
  await page.screenshot({ path: multiPageEditorPath });
  console.log("Saved screenshot:", multiPageEditorPath);

  // Click "Cover" tab in page bar
  console.log("Clicking Cover Tab in Editor...");
  const coverTabBtn = page.locator('button:has-text("Cover")').first();
  await coverTabBtn.click();
  await page.waitForTimeout(600);

  const coverEditorPath = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-cover-editor.png",
  );
  await page.screenshot({ path: coverEditorPath });
  console.log("Saved screenshot:", coverEditorPath);

  // Click back to "Page 1"
  console.log("Clicking Page 1 Tab...");
  const page1Tab = page.locator('button:has-text("Core Competencies")').first();
  await page1Tab.click();
  await page.waitForTimeout(500);

  // Click on "Do you support asynchronous-first" question card to open Inspector
  console.log("Selecting Question Card in Editor...");
  const qCard = page.locator("text=Do you support asynchronous-first").first();
  await qCard.click();
  await page.waitForTimeout(500);

  const inspectorPath = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-field-inspector.png",
  );
  await page.screenshot({ path: inspectorPath });
  console.log("Saved screenshot:", inspectorPath);

  // Click "+ Add Page" in page bar to verify dynamic page creation
  console.log("Clicking + Add Page...");
  const addPageBtn = page.locator('button:has-text("Add Page")').first();
  await addPageBtn.click();
  await page.waitForTimeout(500);

  const dynamicPagePath = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-dynamic-page-added.png",
  );
  await page.screenshot({ path: dynamicPagePath });
  console.log("Saved screenshot:", dynamicPagePath);

  // ----------------------------------------------------
  // TEST 2: RUNTIME PLAYER - COVER SCREEN, STEP JUMPS & REVIEW SCREEN
  // ----------------------------------------------------
  console.log(
    "Visiting Quiz Player at http://localhost:3000/play/" + actualFormId,
  );
  await page.goto(`http://localhost:3000/play/${actualFormId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(800);

  // 2a. Verify Cover Page Screen
  const playerCoverPath = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-player-cover.png",
  );
  await page.screenshot({ path: playerCoverPath });
  console.log("Saved player cover screenshot:", playerCoverPath);

  // Click "Begin Assessment" button
  console.log("Clicking Begin Assessment on Cover Screen...");
  const startBtn = page.locator('button:has-text("Begin Assessment")').first();
  await startBtn.click();
  await page.waitForTimeout(600);

  // 2b. Page 1: Like/Dislike Question
  const playerQ1Path = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-player-q1-like.png",
  );
  await page.screenshot({ path: playerQ1Path });
  console.log("Saved player Q1 screenshot:", playerQ1Path);

  // Click "Like" button
  console.log("Clicking Like button...");
  const likeBtn = page.locator('button:has-text("Like")').first();
  await likeBtn.click();
  await page.waitForTimeout(600);

  // 2c. Page 1: Image Multi-Select Question
  const playerQ2Path = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-player-q2-img-multi.png",
  );
  await page.screenshot({ path: playerQ2Path });
  console.log("Saved player Q2 screenshot:", playerQ2Path);

  // Select two picture choices
  console.log("Selecting Image Multi-Select options...");
  const imgOpt1 = page
    .locator('button:has-text("Multi-Region Cloud Mesh")')
    .first();
  await imgOpt1.click();
  await page.waitForTimeout(200);

  const imgOpt2 = page.locator('button:has-text("Hybrid Edge Nodes")').first();
  await imgOpt2.click();
  await page.waitForTimeout(200);

  // Click Continue to move to Page 2
  console.log("Clicking Continue to go to Page 2...");
  const continueBtn = page.locator('button:has-text("Continue")').first();
  await continueBtn.click();
  await page.waitForTimeout(600);

  // 2d. Page 2: Matrix Multi-Select Question
  const playerQ3Path = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-player-q3-matrix-multi.png",
  );
  await page.screenshot({ path: playerQ3Path });
  console.log("Saved player Q3 screenshot:", playerQ3Path);

  // Select matrix multi-select cells
  console.log("Selecting matrix multi-select checkboxes...");
  const matrixBtns = await page.locator("table button").all();
  if (matrixBtns.length >= 3) {
    await matrixBtns[2].click(); // Row 1 Enterprise
    await matrixBtns[4].click(); // Row 2 Professional
    await matrixBtns[8].click(); // Row 3 Enterprise
  }
  await page.waitForTimeout(300);

  // Click Continue to go to Accordion question
  const continueBtn2 = page.locator('button:has-text("Continue")').first();
  await continueBtn2.click();
  await page.waitForTimeout(600);

  // 2e. Expand Accordion item
  console.log("Testing Accordion expand...");
  const accordionBtn = page
    .locator('button:has-text("What compliance standards are applied?")')
    .first();
  await accordionBtn.click();
  await page.waitForTimeout(400);

  const playerQ4Path = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-player-q4-accordion.png",
  );
  await page.screenshot({ path: playerQ4Path });
  console.log("Saved player Q4 accordion screenshot:", playerQ4Path);

  // Click Complete to trigger Pre-Submit Review Screen!
  console.log("Clicking Complete to trigger Review Screen...");
  const completeBtn = page.locator('button:has-text("Complete")').first();
  await completeBtn.click();
  await page.waitForTimeout(600);

  // 2f. Pre-Submit Review Screen!
  const playerReviewPath = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-player-review.png",
  );
  await page.screenshot({ path: playerReviewPath });
  console.log("Saved player review screenshot:", playerReviewPath);

  // Click "Confirm & Submit" on Review screen
  console.log("Clicking Confirm & Submit on Review Screen...");
  const submitBtn = page.locator('button:has-text("Confirm & Submit")').first();
  await submitBtn.click();
  await page.waitForTimeout(1000);

  // 2g. Outcome Screen
  const playerOutcomePath = path.join(
    ARTIFACTS_DIR,
    "fillout-parity-player-outcome.png",
  );
  await page.screenshot({ path: playerOutcomePath });
  console.log("Saved player outcome screenshot:", playerOutcomePath);

  await browser.close();
  console.log("=== PLAYWRIGHT QC COMPLETE SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
