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
const { defaultCapture, contactsCsv } = require("../lib/contacts.ts");
(async () => {
try {
 const login = await fetch(base + "/api/auth", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ local: true }) });
 cookie = login.headers.get("set-cookie").split(";")[0];
 for (const mode of ["required", "optional", "after"]) {
  const f = marketingTemplate("product_finder", `contacts-test-${mode}-${Date.now()}`); created.push(f.id);
  f.capture = { ...defaultCapture, enabled: true, required: mode === "required", placement: mode === "after" ? "after_results" : "before_results" };
  assert.equal((await request("/api/forms", "POST", f)).status, 201);
  assert.equal((await request(`/api/forms/${f.id}/publish`, "POST", {})).status, 200);
  const a = (await request(`/api/forms/${f.id}/start`, "POST", {}, false)).data;
  const payload = { token: a.token, answers: { use: "a0", priority: "a0", fit: "a1" } };
  const contact = { email: "Fictional@example.com", name: "Fictional Tester", marketingConsent: false };
  if (mode === "required") await check("Required capture cannot be bypassed", async () => { assert.notEqual((await request(`/api/forms/${f.id}/submit`, "POST", payload, false)).status, 200); });
  if (mode !== "after") await check(`${mode}: rejects invalid contact without recording a response`, async () => { assert.notEqual((await request(`/api/forms/${f.id}/submit`, "POST", { ...payload, contact: { ...contact, email: "bad" } }, false)).status, 200); assert.equal((await request(`/api/forms/${f.id}/contacts`)).data.contacts.length, 0); });
  if (mode === "after") await check("After-results capture cannot precede completion", async () => { assert.equal((await request(`/api/forms/${f.id}/contact`, "POST", { token: a.token, contact }, false)).status, 409); });
  if (mode === "required") await check("Temporary storage failure leaves answers available for a successful retry", async () => {
   const attemptId = JSON.parse(Buffer.from(a.token.split(".")[0], "base64url").toString()).id;
   assert.match(attemptId, /^[a-zA-Z0-9_-]+$/);
   const lock = `${process.env.HEYQUIZ_DATA_DIR || ".heyquiz-data"}/submissions/${attemptId}.lock`;
   fs.mkdirSync(lock);
   try { const failed = await request(`/api/forms/${f.id}/submit`, "POST", { ...payload, contact }, false); assert.notEqual(failed.status, 200); assert.match(failed.data.error, /busy/); assert.equal((await request(`/api/forms/${f.id}/contacts`)).data.contacts.length, 0); }
   finally { fs.rmdirSync(lock); }
  });
  const submitted = await request(`/api/forms/${f.id}/submit`, "POST", { ...payload, ...(mode !== "after" ? { contact } : {}) }, false);
  assert.equal(submitted.status, 200, JSON.stringify(submitted)); assert.equal(submitted.data.contact, undefined);
  const endpoint = mode === "after" ? "contact" : "submit";
  await check(`${mode}: concurrent retries keep one contact and accept declined marketing`, async () => {
   const replies = await Promise.all([1,2,3].map(() => request(`/api/forms/${f.id}/${endpoint}`, "POST", { ...payload, contact }, false)));
   replies.forEach(r => assert.equal(r.status, 200, JSON.stringify(r)));
   const rows = (await request(`/api/forms/${f.id}/contacts`)).data.contacts; assert.equal(rows.length, 1); assert.equal(rows[0].contact.email, "fictional@example.com"); assert.equal(rows[0].contact.marketingConsent, false); assert.equal(rows[0].answers.use, "a0"); assert.ok(rows[0].marketing.title); assert.equal(rows[0].contact.consentText, f.capture.marketingLabel);
  });
  await check(`${mode}: contact list is private`, async () => { assert.equal((await request(`/api/forms/${f.id}/contacts`, "GET", undefined, false)).status, 401); });
  if (mode === "optional") await check("Optional capture can be skipped", async () => { const b = (await request(`/api/forms/${f.id}/start`, "POST", {}, false)).data; assert.equal((await request(`/api/forms/${f.id}/submit`, "POST", { ...payload, token: b.token, contact: null }, false)).status, 200); assert.equal((await request(`/api/forms/${f.id}/contacts`)).data.contacts.length, 1); });
  await check(`${mode}: preview never creates a contact`, async () => { const b = (await request(`/api/forms/${f.id}/start`, "POST", { preview: true })).data; assert.equal((await request(`/api/forms/${f.id}/submit`, "POST", { ...payload, token: b.token, contact }, false)).status, 200); if (mode === "after") assert.equal((await request(`/api/forms/${f.id}/contact`, "POST", { token: b.token, contact }, false)).status, 200); assert.equal((await request(`/api/forms/${f.id}/contacts`)).data.contacts.length, 1); });
  await check(`${mode}: affirmative marketing consent is recorded independently`, async () => {
   const b = (await request(`/api/forms/${f.id}/start`, "POST", {}, false)).data;
   const optedIn = { ...contact, marketingConsent: true };
   assert.equal((await request(`/api/forms/${f.id}/submit`, "POST", { ...payload, token: b.token, ...(mode !== "after" ? { contact: optedIn } : {}) }, false)).status, 200);
   if (mode === "after") assert.equal((await request(`/api/forms/${f.id}/contact`, "POST", { token: b.token, contact: optedIn }, false)).status, 200);
   const rows = (await request(`/api/forms/${f.id}/contacts`)).data.contacts;
   assert.equal(rows.filter(r => r.contact.marketingConsent).length, 1);
  });
 }
 await check("CSV escapes spreadsheet formulas, quotes and line breaks", async () => { const csv = contactsCsv([{ name: '=HYPERLINK("x")', answer: "first\nsecond" }]); assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`)); assert.ok(csv.includes('"first\nsecond"')); });
 console.log(JSON.stringify(results, null, 2));
} finally { for (const id of created) await request(`/api/forms/${id}`, "DELETE");
 for (const kind of ["attempts", "submissions"]) for (const name of fs.readdirSync(`${process.env.HEYQUIZ_DATA_DIR || ".heyquiz-data"}/${kind}`)) {
  if (!name.endsWith(".json")) continue;
  const file = `${process.env.HEYQUIZ_DATA_DIR || ".heyquiz-data"}/${kind}/${name}`, row = JSON.parse(fs.readFileSync(file, "utf8"));
  if (created.includes(row.payload.formId || row.payload.form?.id)) fs.unlinkSync(file);
 } }
})().catch(e => { console.error(e); process.exitCode = 1; });
