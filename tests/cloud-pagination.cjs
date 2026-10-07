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
process.env.SUPABASE_URL = "https://pagination.invalid";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
const { listRecords } = require("../lib/records.ts");
const rows = Array.from({ length: 1205 }, (_, i) => ({
  kind: "submissions",
  id: String(i).padStart(5, "0"),
  owner_id: "owner",
  version: 1,
  payload: { index: i },
}));
let calls = 0;
global.fetch = async (url, init) => {
  calls++;
  const u = new URL(url);
  assert.equal(u.searchParams.get("owner_id"), "eq.owner");
  assert.equal(init.headers.apikey, "sb_secret_test");
  assert.equal(init.headers.Authorization, undefined);
  const after = u.searchParams.get("id")?.slice(3) || "";
  const offset = Number(u.searchParams.get("offset") || 0);
  return Response.json(
    rows
      .filter((r) => r.id > after)
      .slice(
        offset,
        offset + Math.min(Number(u.searchParams.get("limit") || 1000), 137),
      ),
  );
};
(async () => {
  const r = await listRecords("submissions", "owner");
  assert.equal(
    r.length,
    1205,
    "Every row must be returned even when server caps pages below requested size",
  );
  assert.equal(new Set(r.map((x) => x.id)).size, 1205);
  assert.ok(calls > 1);
  console.log(
    "Cloud pagination: 1205 records, reduced server cap, owner filter and secret-key headers passed",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
