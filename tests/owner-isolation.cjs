const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript");
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
const { writeRecord, removeRecord } = require("../lib/records.ts");
const { FormSchema } = require("../lib/schema.ts");
(async () => {
  const id = "qa-isolation-" + Date.now(),
    base = process.env.TEST_BASE_URL || "http://127.0.0.1:3130",
    other = "qa-other-owner";
  const f = FormSchema.parse({
    id,
    mode: "survey",
    title: "Other owner private fixture",
    questions: [{ id: "q", type: "short_answer", title: "Private question" }],
  });
  await writeRecord("forms", id, other, f);
  const login = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ local: true }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const checks = [];
  try {
    for (const [path, method] of [
      [`/api/forms/${id}`, "GET"],
      [`/api/forms/${id}`, "PUT"],
      [`/api/forms/${id}`, "DELETE"],
      [`/api/forms/${id}/publish`, "POST"],
      [`/api/forms/${id}/contacts`, "GET"],
      [`/api/forms/${id}/submissions`, "GET"],
      [`/api/forms/${id}/analytics`, "GET"],
    ]) {
      const r = await fetch(base + path, {
        method,
        headers: {
          Origin: base,
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        ...(["PUT", "POST"].includes(method)
          ? { body: JSON.stringify(f) }
          : {}),
      });
      assert.equal(r.status, 404, path + " " + method);
      checks.push(method + " " + path + " denies other owner");
    }
    const badOrigin = await fetch(base + "/api/forms", {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(f),
    });
    assert.equal(badOrigin.status, 403);
    checks.push("Cross-origin mutation rejected");
    console.log(JSON.stringify(checks, null, 2));
  } finally {
    await removeRecord("forms", id, other);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
