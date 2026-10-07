const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Module = require("node:module");
const ts = require("typescript");
require.extensions[".ts"] = (m, file) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...rest) {
  return resolve.call(
    this,
    name.startsWith("@/") ? path.join(process.cwd(), name.slice(2)) : name,
    ...rest,
  );
};
const { gradeQuizSubmission: grade } = require("../lib/scoring.ts");
const {
  resolvePath,
  evaluateCondition,
  validationError,
  publicForm,
  validateFormReferences,
} = require("../lib/engine.ts");
const { calculate } = require("../lib/calculation.ts");
const form = (questions, extra = {}) => ({
  id: "fixture",
  title: "Fixture",
  mode: "quiz",
  theme: {},
  settings: { passingScorePercentage: 70 },
  questions,
  outcomeTiers: [],
  ...extra,
});
const choice = (id, type = "multiple_choice") => ({
  id,
  title: id,
  type,
  required: true,
  points: 10,
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: type === "multiselect" },
    { id: "c", label: "C" },
  ],
});
const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
  }
}
(async () => {
  await test("Duplicate multiselect selections cannot inflate score", () => {
    const r = grade(form([choice("q", "multiselect")]), {
      q: ["a", "a", "a", "a"],
    });
    assert.equal(r.totalPointsEarned, 5);
    assert.equal(r.percentageScore, 50);
  });
  await test("Hidden and jumped questions do not reduce scores", () => {
    const f = form([choice("q1"), choice("q2")], {
      logicRules: [
        {
          id: "r",
          sourceQuestionId: "q1",
          operator: "equals",
          value: "a",
          action: "hide_question",
          targetQuestionId: "q2",
        },
      ],
    });
    assert.equal(grade(f, { q1: "a" }).percentageScore, 100);
  });
  await test("Page order is consistent after appending to an earlier page", () => {
    const f = form(
      [
        { ...choice("q1"), pageId: "p1" },
        { ...choice("q2"), pageId: "p2" },
        { ...choice("q3"), pageId: "p1" },
      ],
      {
        pages: [
          { id: "p1", title: "One", questionIds: [] },
          { id: "p2", title: "Two", questionIds: [] },
        ],
      },
    );
    assert.deepEqual(
      resolvePath(f, {}).questions.map((q) => q.id),
      ["q1", "q3", "q2"],
    );
  });
  await test("Matrix survey fields do not cause automatic failure", () => {
    const q = {
      id: "m",
      type: "choice_matrix",
      title: "Matrix",
      points: 10,
      rows: ["A"],
      columns: ["Good"],
    };
    assert.equal(grade(form([q]), { m: { A: "Good" } }).totalPointsPossible, 0);
    assert.equal(
      grade(form([{ ...q, matrixAnswerKey: { A: "Good" } }]), {
        m: { A: "Good" },
      }).percentageScore,
      100,
    );
  });
  await test("Display fields never block required validation", () => {
    for (const type of ["video_embed", "calculation", "heading", "hidden"])
      assert.equal(
        validationError(
          { id: "q", title: "Display", type, required: true },
          undefined,
        ),
        null,
      );
  });
  await test("Exact equality does not perform substring matching", () => {
    assert.equal(
      evaluateCondition("equals", ["no"], "Interested", {
        options: [{ id: "no", label: "Not interested" }],
      }),
      false,
    );
  });
  await test("Show rules start hidden and become visible only on a match", () => {
    const f = form([choice("q1"), choice("q2")], {
      logicRules: [
        {
          id: "r",
          sourceQuestionId: "q1",
          operator: "equals",
          value: "a",
          action: "show_question",
          targetQuestionId: "q2",
        },
      ],
    });
    assert.equal(resolvePath(f, {}).questions.length, 1);
    assert.equal(resolvePath(f, { q1: "a" }).questions.length, 2);
  });
  await test("Branch-selected outcome is determined on server", () => {
    const f = form([choice("q1")], {
      outcomeTiers: [
        {
          id: "custom",
          title: "Custom",
          minScorePercent: 0,
          maxScorePercent: 0,
        },
      ],
      logicRules: [
        {
          id: "r",
          sourceQuestionId: "q1",
          operator: "equals",
          value: "a",
          action: "jump_to_ending",
          targetOutcomeTierId: "custom",
        },
      ],
    });
    assert.equal(grade(f, { q1: "a" }).matchedTier.id, "custom");
  });
  await test("Public player data excludes answer keys and explanations", () => {
    const f = publicForm(
      form([
        {
          ...choice("q"),
          correctAnswerText: "SECRET",
          explanation: "PRIVATE",
          matrixAnswerKey: { A: "B" },
        },
      ]),
    );
    assert.equal(f.questions[0].correctAnswerText, undefined);
    assert.equal(f.questions[0].options[0].isCorrect, undefined);
    assert.equal(f.questions[0].matrixAnswerKey, undefined);
  });
  await test("Invalid emails and incomplete structured answers are rejected", () => {
    assert.ok(
      validationError(
        { id: "e", type: "email", title: "Email", required: true },
        "not-an-email",
      ),
    );
    assert.ok(
      validationError(
        { id: "n", type: "full_name", title: "Name", required: true },
        { firstName: "A" },
      ),
    );
    assert.ok(
      validationError(
        { id: "t", type: "terms", title: "Terms", required: true },
        false,
      ),
    );
  });
  await test("Logic cycles are rejected", () => {
    assert.throws(() =>
      validateFormReferences(
        form([choice("q")], {
          logicRules: [
            {
              id: "r",
              sourceQuestionId: "q",
              operator: "equals",
              value: "a",
              action: "jump_to_question",
              targetQuestionId: "q",
            },
          ],
        }),
      ),
    );
  });
  await test("Calculation supports arithmetic, never executable input", () => {
    assert.equal(calculate("{{q1}} * 2 + (3 / 2)", { q1: 5 }), 11.5);
    assert.equal(calculate("process.exit()", {}), null);
    assert.equal(calculate("1/0", {}), null);
  });
  await test("Atomic persistence rejects stale revisions and preserves corrupt data", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heyquiz-tests-"));
    process.env.HEYQUIZ_DATA_DIR = dir;
    const { writeRecord, readRecord } = require("../lib/records.ts");
    try {
      await writeRecord("forms", "a", "owner", { value: 1 }, 0);
      await assert.rejects(() =>
        writeRecord("forms", "a", "owner", { value: 2 }, 0),
      );
      assert.equal((await readRecord("forms", "a")).payload.value, 1);
      fs.writeFileSync(path.join(dir, "forms/a.json"), "{corrupt");
      await assert.rejects(() =>
        writeRecord("forms", "a", "owner", { value: 3 }),
      );
      assert.equal(
        fs.readFileSync(path.join(dir, "forms/a.json"), "utf8"),
        "{corrupt",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  const {
    evaluateMarketing,
    validateMarketing,
  } = require("../lib/marketing.ts");
  const { marketingTemplate } = require("../lib/marketing-templates.ts");
  const { FormSchema } = require("../lib/schema.ts");
  await test("All three marketing templates pass schema and publish validation", () => {
    for (const kind of ["product_finder", "segmentation", "scorecard"]) {
      const f = FormSchema.parse(marketingTemplate(kind, "marketing-fixture"));
      validateFormReferences(f);
      validateMarketing(f, true);
    }
  });
  await test("Product matching explains only selected benefits", () => {
    const f = marketingTemplate("product_finder", "f");
    const r = evaluateMarketing(f, { use: "a0", priority: "a0", fit: "a1" });
    assert.equal(r.outcomeId, "light");
    assert.equal(r.reasons.length, 2);
    assert.ok(r.reasons.every((x) => !x.includes("laptop")));
  });
  await test("Hard product exclusions override high match scores", () => {
    const r = evaluateMarketing(marketingTemplate("product_finder", "f"), {
      use: "a0",
      priority: "a0",
      fit: "a0",
    });
    assert.equal(r.status, "no_match");
    assert.equal(r.ctaUrl, undefined);
  });
  await test("Unknown product answers produce useful fallback", () =>
    assert.equal(
      evaluateMarketing(marketingTemplate("product_finder", "f"), {
        use: "a3",
        priority: "a3",
        fit: "a2",
      }).status,
      "no_match",
    ));
  await test("Buyer preference routes to the requested help without a test grade", () => {
    const f = marketingTemplate("segmentation", "f");
    const a = { experience: "a1", benefit: "a2", help: "a2" };
    assert.equal(evaluateMarketing(f, a).outcomeId, "routine");
    assert.equal(grade(f, a).totalPointsPossible, 0);
  });
  await test("Declining help does not force a sales recommendation", () =>
    assert.equal(
      evaluateMarketing(marketingTemplate("segmentation", "f"), {
        experience: "a0",
        benefit: "a0",
        help: "a3",
      }).status,
      "no_match",
    ));
  await test("Scorecards distinguish zero, unknown and incomplete coverage", () => {
    const f = marketingTemplate("scorecard", "f");
    const zero = evaluateMarketing(f, {
      capture: "a2",
      followup: "a2",
      measure: "a2",
    });
    assert.deepEqual(
      zero.categories.map((c) => c.score),
      [0, 0],
    );
    const unknown = evaluateMarketing(f, {
      capture: "a0",
      followup: "a3",
      measure: "a3",
    });
    assert.deepEqual(
      unknown.categories.map((c) => c.score),
      [null, null],
    );
    assert.deepEqual(
      evaluateMarketing(f, {
        capture: "a0",
        followup: "a1",
        measure: "a0",
      }).categories.map((c) => c.score),
      [75, 100],
    );
  });
  await test("Hidden answers cannot influence marketing results", () => {
    const f = marketingTemplate("product_finder", "f");
    f.logicRules = [
      {
        id: "hide",
        sourceQuestionId: "use",
        operator: "equals",
        value: "a3",
        action: "hide_question",
        targetQuestionId: "priority",
      },
    ];
    assert.equal(
      evaluateMarketing(f, { use: "a3", priority: "a0", fit: "a1" }).status,
      "no_match",
    );
  });
  await test("Duplicate selections contribute only once to recommendation", () => {
    const f = marketingTemplate("product_finder", "f");
    f.questions[0].type = "multiselect";
    assert.deepEqual(
      evaluateMarketing(f, { use: ["a0", "a0"], priority: "a1", fit: "a1" }),
      evaluateMarketing(f, { use: ["a0"], priority: "a1", fit: "a1" }),
    );
  });
  await test("Equal marketing scores use declared result order", () => {
    const f = marketingTemplate("product_finder", "f");
    f.marketing.rules.find((r) => r.id === "priority-1").points = 3;
    assert.equal(
      evaluateMarketing(f, { use: "a0", priority: "a1", fit: "a1" }).outcomeId,
      "light",
    );
  });
  await test("Broken and duplicate marketing rules are rejected", () => {
    const f = marketingTemplate("product_finder", "f");
    f.marketing.rules.push({ ...f.marketing.rules[0], id: "duplicate" });
    assert.throws(() => validateMarketing(f, true), /duplicated/);
    f.marketing.rules.pop();
    f.marketing.rules[0].answerId = "missing";
    assert.throws(() => validateMarketing(f, true), /missing/);
  });
  await test("Public marketing payload omits the decision rules and catalog", () => {
    const f = publicForm(marketingTemplate("product_finder", "f"));
    assert.equal(f.marketing.rules.length, 0);
    assert.equal(f.marketing.outcomes.length, 0);
  });
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => !r.passed)) process.exitCode = 1;
})();
