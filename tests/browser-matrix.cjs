const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const { QuestionTypeEnum } = require("../lib/schema.ts");
const { singleTypes, multiTypes, displayTypes } = require("../lib/engine.ts");
const base = "http://127.0.0.1:3130",
  results = [],
  created = [];
const dir = require("node:path").resolve("../../outputs/browser-matrix");
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const owner = await browser.newContext();
  const login = await owner.request.post(base + "/api/auth", {
    data: { local: true },
    headers: { Origin: base },
  });
  assert.equal(login.status(), 200);
  const visitor = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await visitor.newPage();
  p.setDefaultTimeout(5000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const type of QuestionTypeEnum.options.filter(
      (t) =>
        !process.env.QA_TYPES || process.env.QA_TYPES.split(",").includes(t),
    )) {
      await new Promise((r) => setTimeout(r, 1800));
      const id = "browser-qa-" + type + "-" + Date.now();
      created.push(id);
      const q = {
        id: "q",
        type,
        title: "Test " + type,
        required: !displayTypes.has(type),
        options: [
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
        ],
        rows: ["Row one", "Row two"],
        columns: ["Agree", "Disagree"],
        items: ["Alpha", "Beta"],
        timeSlots: ["09:00", "10:00"],
        accordionItems: [
          { id: "a", title: "Details", content: "Test explanation" },
        ],
        richTextContent: "Test content",
        calculationFormula: "2 + 3",
      };
      try {
        const cr = await owner.request.post(base + "/api/forms", {
          data: { id, title: "QA " + type, mode: "survey", questions: [q] },
          headers: { Origin: base },
        });
        assert.equal(cr.status(), 201, await cr.text());
        const pub = await owner.request.post(
          base + `/api/forms/${id}/publish`,
          { data: {}, headers: { Origin: base } },
        );
        if (type === "captcha") {
          assert.equal(pub.status(), 422);
          results.push({
            type,
            status: "configuration guard passed; live CAPTCHA not tested",
          });
          continue;
        }
        assert.equal(pub.status(), 200, await pub.text());
        await p.goto(base + "/play/" + id);
        await p
          .getByRole("button", { name: "Let’s begin", exact: true })
          .click();
        if (type === "hidden") {
          await p
            .getByText(
              "No questions are available. Please contact the quiz owner.",
              { exact: true },
            )
            .waitFor();
          results.push({
            type,
            status: "hidden-only form has no visible questions; guard verified",
          });
          continue;
        } else
          await p
            .getByRole("heading", { name: "Test " + type, exact: true })
            .waitFor();
        if (type === "dropdown")
          await p.getByRole("combobox").selectOption("a");
        else if (singleTypes.has(type))
          await p.getByRole("radio", { name: "Alpha", exact: true }).check();
        else if (multiTypes.has(type))
          await p.getByRole("checkbox", { name: "Alpha", exact: true }).check();
        else if (["checkbox", "terms"].includes(type))
          await p.getByRole("checkbox").check();
        else if (["choice_matrix", "matrix_multiselect"].includes(type)) {
          await p.getByLabel("Row one: Agree", { exact: true }).check();
          await p.getByLabel("Row two: Disagree", { exact: true }).check();
        } else if (type === "ranking")
          await p
            .getByRole("button", { name: "Move Alpha down", exact: true })
            .click();
        else if (
          ["rating", "opinion_scale", "nps", "emoji_rating"].includes(type)
        )
          await p
            .getByRole("button", {
              name:
                type === "rating"
                  ? "3 stars"
                  : type === "nps"
                    ? "3 out of 10"
                    : "3 out of 5",
              exact: true,
            })
            .click();
        else if (type === "slider") await p.getByRole("slider").fill("42");
        else if (type === "scheduler")
          await p.getByRole("button", { name: "09:00", exact: true }).click();
        else if (type === "full_name") {
          await p.getByLabel("First name").fill("QA");
          await p.getByLabel("Last name").fill("Tester");
        } else if (type === "address") {
          for (const [label, v] of Object.entries({
            "Street address": "1 Test Way",
            City: "Testville",
            "State / region": "QA",
            "Postal code": "12345",
          }))
            await p.getByLabel(label, { exact: true }).fill(v);
        } else if (type === "datetime") {
          await p.getByLabel("Date", { exact: true }).fill("2026-10-08");
          await p.getByLabel("Time", { exact: true }).fill("09:00");
        } else if (type === "date_range") {
          await p.getByLabel("Start date").fill("2026-10-08");
          await p.getByLabel("End date").fill("2026-10-09");
        } else if (
          ["file_upload", "image_upload", "audio_recorder"].includes(type)
        ) {
          const img = type === "image_upload",
            audio = type === "audio_recorder";
          await p
            .locator("input[type=file]")
            .setInputFiles({
              name: img ? "qa.png" : audio ? "qa.wav" : "qa.txt",
              mimeType: img ? "image/png" : audio ? "audio/wav" : "text/plain",
              buffer: img
                ? Buffer.from(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
                    "base64",
                  )
                : audio
                  ? Buffer.from("RIFF0000WAVEfmt ")
                  : Buffer.from("QA attachment"),
            });
          await p
            .getByText(img ? "qa.png" : audio ? "qa.wav" : "qa.txt", {
              exact: true,
            })
            .waitFor();
        } else if (!displayTypes.has(type)) {
          const values = {
            email: "qa@example.com",
            website: "https://example.com",
            number: "42",
            currency: "12.50",
            date: "2026-10-08",
            time: "09:00",
            color_picker: "#123456",
          };
          await p
            .getByLabel("Test " + type, { exact: true })
            .fill(values[type] || "QA test answer");
        }
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(overflow, false, "Mobile page overflows horizontally");
        const review = p.getByRole("button", {
          name: "Review answers",
          exact: true,
        });
        if (await review.count()) await review.click();
        await p
          .getByRole("button", { name: "Submit response", exact: true })
          .click();
        await p
          .getByText("Your answers have been saved successfully.", {
            exact: true,
          })
          .waitFor();
        const r = await owner.request.get(
          base + `/api/forms/${id}/submissions`,
        );
        const rows = (await r.json()).submissions;
        assert.equal(rows.length, 1);
        results.push({ type, status: "passed", responseSaved: true });
      } catch (e) {
        results.push({
          type,
          status: "failed",
          error: e.message.split("Call log:")[0],
        });
        await p.screenshot({ path: dir + "/" + type + ".png" }).catch(() => {});
      }
      console.log(JSON.stringify(results.at(-1)));
    }
  } finally {
    for (const id of created)
      await owner.request.delete(base + "/api/forms/" + id, {
        headers: { Origin: base },
      });
    await browser.close();
    fs.writeFileSync(
      dir + "/report.json",
      JSON.stringify({ results, errors }, null, 2),
    );
  }
  if (results.some((r) => r.status === "failed") || errors.length)
    process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
