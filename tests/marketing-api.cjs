const assert = require("node:assert/strict");
const fs = require("node:fs");
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
const { marketingTemplate } = require("../lib/marketing-templates.ts");
const base = process.env.TEST_URL || "http://127.0.0.1:3130";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Local test server only.");
let cookie = "";
const created = [];
const results = [];
async function request(path, method = "GET", body, auth = true) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
}
(async () => {
  try {
    const login = await fetch(base + "/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ local: true }),
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    for (const kind of ["product_finder", "segmentation", "scorecard"]) {
      const f = marketingTemplate(kind, `mvp-test-${kind}-${Date.now()}`);
      created.push(f.id);
      await check(
        `${kind}: create, persist and publish configuration`,
        async () => {
          let r = await request("/api/forms", "POST", f);
          assert.equal(r.status, 201, JSON.stringify(r));
          r = await request(`/api/forms/${f.id}`);
          assert.equal(r.data.marketing.rules.length, f.marketing.rules.length);
          assert.equal(
            (await request(`/api/forms/${f.id}/publish`, "POST", {})).status,
            200,
          );
        },
      );
      let attempt;
      await check(
        `${kind}: public start keeps decision rules on server`,
        async () => {
          const r = await request(
            `/api/forms/${f.id}/start`,
            "POST",
            {},
            false,
          );
          assert.equal(r.status, 200);
          attempt = r.data;
          assert.deepEqual(attempt.form.marketing.rules, []);
        },
      );
      const answers =
        kind === "product_finder"
          ? { use: "a0", priority: "a0", fit: "a1" }
          : kind === "segmentation"
            ? { experience: "a1", benefit: "a2", help: "a2" }
            : { capture: "a0", followup: "a1", measure: "a3" };
      await check(
        `${kind}: server computes and stores the correct result`,
        async () => {
          const r = await request(
            `/api/forms/${f.id}/submit`,
            "POST",
            {
              token: attempt.token,
              answers,
              marketing: { outcomeId: "attacker-choice" },
            },
            false,
          );
          assert.equal(r.status, 200, JSON.stringify(r));
          if (kind === "scorecard")
            assert.deepEqual(
              r.data.marketing.categories.map((c) => c.score),
              [75, null],
            );
          else
            assert.equal(
              r.data.marketing.outcomeId,
              kind === "product_finder" ? "light" : "routine",
            );
          const saved = await request(`/api/forms/${f.id}/submissions`);
          assert.deepEqual(
            saved.data.submissions[0].marketing,
            r.data.marketing,
          );
        },
      );
      await check(
        `${kind}: preview never creates a saved response`,
        async () => {
          const a = await request(`/api/forms/${f.id}/start`, "POST", {
            preview: true,
          });
          assert.equal(
            (
              await request(`/api/forms/${f.id}/submit`, "POST", {
                token: a.data.token,
                answers,
              })
            ).status,
            200,
          );
          assert.equal(
            (await request(`/api/forms/${f.id}/submissions`)).data.submissions
              .length,
            1,
          );
        },
      );
    }
    console.log(JSON.stringify(results, null, 2));
  } finally {
    for (const id of created) await request(`/api/forms/${id}`, "DELETE");
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
