const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"), { compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true} }).outputText,f);
const { defaultCapture } = require("../lib/contacts.ts");
const { listRecords, removeRecord } = require("../lib/records.ts");
const assert = require("node:assert/strict");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3130",
  id = "qa-integrations-" + Date.now();
let cookie = "";
const checks = [];
async function request(path, method = "GET", body, auth = true, origin = base) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(auth ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
(async () => {
  try {
    const login = await fetch(base + "/api/auth", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ local: true }),
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (
        await request("/api/forms", "POST", {
          id,
          title: "QA Integrations",
          mode: "survey",
          questions: [
            { id: "q", type: "short_answer", title: "Answer", required: true },
          ],
        })
      ).status,
      201,
    );
    const endpoint = `/api/forms/${id}/integrations`;
    await check(
      "Anonymous callers cannot read or change integrations",
      async () => {
        for (const method of ["GET", "PUT", "POST"])
          assert.equal(
            (
              await request(
                endpoint,
                method,
                method === "GET" ? undefined : {},
                false,
              )
            ).status,
            401,
          );
      },
    );
    await check("Cross-origin connection mutation rejected", async () => {
      assert.equal(
        (await request(endpoint, "PUT", {}, true, "https://other.example"))
          .status,
        403,
      );
    });
    await check(
      "Non-owned or missing quiz does not reveal connections",
      async () => {
        assert.equal(
          (await request("/api/forms/absent-owner-quiz/integrations")).status,
          404,
        );
      },
    );
    let saved;
    await check("Save paused webhook without returning secrets", async () => {
      const r = await request(endpoint, "PUT", {
        name: "QA paused webhook",
        provider: "webhook",
        url: "https://hooks.example.com/private-fixture",
        signingSecret: "synthetic-signing-secret",
      });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      saved = r.data;
      assert.equal(saved.enabled, false);
      assert.equal(saved.credentialsSaved, true);
      assert.ok(!JSON.stringify(saved).includes("private-fixture"));
      assert.ok(!JSON.stringify(saved).includes("synthetic-signing-secret"));
    });
    await check(
      "Reload preserves configuration but never exposes credentials",
      async () => {
        const r = await request(endpoint);
        assert.equal(r.status, 200);
        assert.equal(r.data.connections[0].id, saved.id);
        assert.ok(!JSON.stringify(r.data).includes("private-fixture"));
      },
    );
    await check(
      "Blank credentials preserve saved destination on edit",
      async () => {
        const r = await request(endpoint, "PUT", {
          ...saved,
          name: "Renamed paused connection",
        });
        assert.equal(r.status, 200);
        saved = r.data;
        assert.equal(saved.destination, "hooks.example.com");
      },
    );
    await check("Stale edits cannot overwrite connection changes", async () => {
      assert.equal(
        (
          await request(endpoint, "PUT", {
            ...saved,
            revision: 1,
            name: "Stale",
          })
        ).status,
        409,
      );
    });
    await check(
      "Private URL, missing token and invalid mapping fail validation",
      async () => {
        for (const input of [
          {
            name: "Bad",
            provider: "webhook",
            url: "https://169.254.169.254/latest",
          },
          { name: "Bad", provider: "gohighlevel", locationId: "test" },
          {
            name: "Bad",
            provider: "webhook",
            url: "https://example.com",
            mappings: [{ source: "contact.email", target: "__proto__" }],
          },
        ])
          assert.ok((await request(endpoint, "PUT", input)).status >= 400);
      },
    );
    await check("Forged delivery and connection IDs rejected", async () => {
      assert.equal(
        (await request(endpoint, "POST", { action: "retry", id: "not-owned" }))
          .status,
        404,
      );
      assert.equal(
        (await request(endpoint, "POST", { action: "test", id: "not-owned" }))
          .status,
        404,
      );
    });
    await check(
      "Cron worker is inaccessible without its server credential",
      async () => {
        const r = await request(
          "/api/integrations/dispatch",
          "GET",
          undefined,
          false,
        );
        assert.ok([401, 503].includes(r.status));
      },
    );
    await check("Public submission queues a lead, duplicate submit does not duplicate it, preview never delivers", async () => {
      let form = (await request(`/api/forms/${id}`)).data;
      form.capture = { ...defaultCapture, enabled: true, required: true };
      assert.equal((await request(`/api/forms/${id}`, "PUT", form)).status, 200);
      assert.equal((await request(`/api/forms/${id}/publish`, "POST", {})).status, 200);
      // An unresolvable fixture host exercises transport failure without sending lead data to a third party.
      let config = await request(endpoint, "PUT", { ...saved, url: `https://${id}.example.com/hook`, enabled: true });
      assert.equal(config.status, 200); saved = config.data;
      const start = await request(`/api/forms/${id}/start`, "POST", {}, false);
      const body = { token: start.data.token, answers: {q:"QA answer"}, contact: { email:"qa-integration@example.com", marketingConsent:true } };
      assert.equal((await request(`/api/forms/${id}/submit`, "POST", body, false)).status, 200);
      assert.equal((await request(`/api/forms/${id}/submit`, "POST", body, false)).status, 200);
      let rows=[];
      for(let n=0;n<30;n++){rows=(await request(endpoint)).data.deliveries;if(rows.length===1&&rows[0].attempts>=1&&rows[0].state!=="sending")break;await new Promise(r=>setTimeout(r,200));}
      assert.equal(rows.length,1);assert.equal(rows[0].state,"pending");assert.equal(rows[0].attempts,1);
      const preview = await request(`/api/forms/${id}/start`, "POST", {preview:true});
      assert.equal((await request(`/api/forms/${id}/submit`, "POST", {...body,token:preview.data.token})).status,200);
      assert.equal((await request(endpoint)).data.deliveries.length,1);
    });
    await check("After-results capture queues only after contact is saved", async () => {
      const form=(await request(`/api/forms/${id}`)).data;
      form.capture={...defaultCapture,enabled:true,placement:"after_results",required:false};
      assert.equal((await request(`/api/forms/${id}`,"PUT",form)).status,200);
      assert.equal((await request(`/api/forms/${id}/publish`,"POST",{})).status,200);
      const start=await request(`/api/forms/${id}/start`,"POST",{},false);
      assert.equal((await request(`/api/forms/${id}/submit`,"POST",{token:start.data.token,answers:{q:"QA after capture"}},false)).status,200);
      assert.equal((await request(endpoint)).data.deliveries.length,1);
      const contact={token:start.data.token,contact:{email:"qa-after@example.com",marketingConsent:false}};
      assert.equal((await request(`/api/forms/${id}/contact`,"POST",contact,false)).status,200);
      assert.equal((await request(`/api/forms/${id}/contact`,"POST",contact,false)).status,200);
      let rows=[];for(let n=0;n<20;n++){rows=(await request(endpoint)).data.deliveries;if(rows.length===2)break;await new Promise(r=>setTimeout(r,200));}
      assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.state==="skipped").length,1);
    });
    console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally {
    if (cookie) await request("/api/forms/" + id, "DELETE");
    for(const kind of ["integrations","deliveries","submissions","attempts"])
      for(const r of await listRecords(kind,"local")) if(r.payload.formId===id||r.payload.form?.id===id) await removeRecord(kind,r.id,"local");
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
