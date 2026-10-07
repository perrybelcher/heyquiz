const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "heyquiz-integrations-"));
process.env.HEYQUIZ_DATA_DIR = temp;
process.env.SESSION_SECRET = "test-only-integration-secret-32-characters";
delete process.env.SUPABASE_URL;
delete process.env.VERCEL;
const { writeRecord, readRecord, listRecords } = require("../lib/records.ts");
const { seal, unseal } = require("../lib/integrations/secrets.ts");
const { webhookUrl, publicAddress } = require("../lib/integrations/http.ts");
const s = require("../lib/integrations/service.ts");
const { IntegrationInput } = require("../lib/integrations/schema.ts");
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
let webhook, ghl;
const owner = "test-owner",
  formId = "test-quiz";
const defaults = {
  name: "QA webhook",
  provider: "webhook",
  enabled: true,
  consentOnly: true,
  url: "https://hooks.example.com/secret-path",
  signingSecret: "test-webhook-signing-secret",
  mappings: [
    { source: "result.title", target: "segment" },
    { source: "answers.campaign", target: "campaign" },
  ],
};
function result(id, consent = true) {
  return {
    id,
    formId,
    submittedAt: new Date().toISOString(),
    percentageScore: 80,
    answers: { campaign: "summer" },
    contact: {
      email: "qa@example.com",
      name: "QA Example",
      marketingConsent: consent,
      recordedAt: new Date(Date.now() + 100).toISOString(),
      consentText: "Optional marketing",
    },
    marketing: {
      kind: "segmentation",
      status: "matched",
      title: "Beginner",
      outcomeId: "beginner",
      categories: [],
    },
  };
}
async function jobs() {
  return listRecords("deliveries", owner);
}
async function job(responseId, connectionId = webhook.id) {
  return (await jobs()).find(
    (r) =>
      r.payload.event.responseId === responseId &&
      r.payload.connectionId === connectionId,
  );
}
async function due(r) {
  return writeRecord(
    "deliveries",
    r.id,
    owner,
    { ...r.payload, nextAttemptAt: 0 },
    r.version,
  );
}
(async () => {
  try {
    await writeRecord("forms", formId, owner, { id: formId, questions: [] });
    await check(
      "Credential encryption is authenticated and owner-bound",
      () => {
        const value = seal({ token: "private" }, "owner:a");
        assert.equal(unseal(value, "owner:a").token, "private");
        assert.ok(!value.includes("private"));
        assert.throws(() => unseal(value, "owner:b"));
        assert.throws(() => unseal(value.slice(0, -3) + "abc", "owner:a"));
      },
    );
    await check(
      "Webhook validation rejects private networks, credentials and unsafe URLs",
      () => {
        for (const u of [
          "http://example.com",
          "https://user:pass@example.com",
          "https://127.0.0.1",
          "https://169.254.169.254",
          "https://10.0.0.1",
          "https://[::1]",
          "https://example.com:444",
          "https://example.com/#secret",
        ])
          assert.throws(() => webhookUrl(u), u);
        for (const ip of [
          "127.0.0.1",
          "10.0.0.1",
          "100.64.0.1",
          "172.16.1.1",
          "192.168.1.1",
          "169.254.169.254",
          "::1",
          "::ffff:127.0.0.1",
          "fc00::1",
          "2001:db8::1",
          "2002:7f00::1",
        ])
          assert.equal(publicAddress(ip), false, ip);
        assert.equal(publicAddress("8.8.8.8"), true);
        assert.equal(publicAddress("2606:4700:4700::1111"), true);
      },
    );
    await check(
      "Mapping validation rejects duplicate and prototype targets",
      () => {
        assert.equal(
          IntegrationInput.safeParse({
            ...defaults,
            mappings: [{ source: "score", target: "__proto__" }],
          }).success,
          false,
        );
        assert.equal(
          IntegrationInput.safeParse({
            ...defaults,
            mappings: [
              { source: "score", target: "same" },
              { source: "formId", target: "same" },
            ],
          }).success,
          false,
        );
      },
    );
    await check(
      "Saved connection hides credentials and checks ownership",
      async () => {
        webhook = await s.saveConnection(formId, owner, defaults);
        assert.equal(webhook.credentialsSaved, true);
        assert.ok(!JSON.stringify(webhook).includes("secret-path"));
        assert.ok(
          !JSON.stringify(webhook).includes("test-webhook-signing-secret"),
        );
        await assert.rejects(s.saveConnection(formId, "intruder", defaults));
        await assert.rejects(s.ownedConnection(webhook.id, formId, "intruder"));
        await assert.rejects(
          s.saveConnection(formId, owner, {
            ...defaults,
            id: webhook.id,
            revision: 0,
          }),
        );
      },
    );
    await check(
      "Concurrent enqueue creates one durable job per response/destination",
      async () => {
        await Promise.all([
          s.enqueueSubmission(owner, result("one")),
          s.enqueueSubmission(owner, result("one")),
        ]);
        assert.equal(
          (await jobs()).filter((r) => r.payload.event.responseId === "one")
            .length,
          1,
        );
      },
    );
    await check(
      "Signed webhook maps fields and concurrent workers send once",
      async () => {
        const j = await job("one");
        let sends = 0;
        const sender = async (url, body, headers) => {
          sends++;
          assert.equal(url, defaults.url);
          assert.equal(headers["Idempotency-Key"], j.id);
          assert.equal(JSON.parse(body).fields.segment, "Beginner");
          assert.equal(JSON.parse(body).fields.campaign, "summer");
          const expected = require("node:crypto")
            .createHmac("sha256", defaults.signingSecret)
            .update(headers["X-HeyQuiz-Timestamp"] + "." + body)
            .digest("hex");
          assert.equal(headers["X-HeyQuiz-Signature"], "sha256=" + expected);
          await new Promise((r) => setTimeout(r, 30));
          return { status: 202, body: "" };
        };
        await Promise.all([
          s.deliver(j.id, owner, sender),
          s.deliver(j.id, owner, sender),
        ]);
        await s.deliver(j.id, owner, sender);
        assert.equal(sends, 1);
        assert.equal(
          (await readRecord("deliveries", j.id)).payload.state,
          "delivered",
        );
      },
    );
    await check(
      "Declined consent records a skip without a network call",
      async () => {
        await s.enqueueSubmission(owner, result("declined", false));
        const j = await job("declined");
        assert.equal(j.payload.state, "skipped");
        await s.deliver(j.id, owner, async () => {
          throw Error("must never send");
        });
      },
    );
    await check(
      "Transient failure backs off and preserves the same delivery ID",
      async () => {
        await s.enqueueSubmission(owner, result("retry"));
        let j = await job("retry");
        await s.deliver(j.id, owner, async () => ({
          status: 429,
          body: "secret response must not be retained",
          retryAfter: "120",
        }));
        j = await readRecord("deliveries", j.id);
        assert.equal(j.payload.state, "pending");
        assert.ok(j.payload.nextAttemptAt >= Date.now() + 118000);
        assert.ok(!JSON.stringify(j).includes("secret response"));
        await due(j);
        await s.deliver(j.id, owner, async (_u, _b, h) => {
          assert.equal(h["Idempotency-Key"], j.id);
          return { status: 200, body: "" };
        });
        assert.equal(
          (await readRecord("deliveries", j.id)).payload.attempts,
          2,
        );
      },
    );
    await check(
      "Authentication errors and redirects do not retry automatically",
      async () => {
        for (const status of [401, 302]) {
          await s.enqueueSubmission(owner, result("status-" + status));
          const j = await job("status-" + status);
          await s.deliver(j.id, owner, async () => ({
            status,
            body: "sensitive",
          }));
          assert.equal(
            (await readRecord("deliveries", j.id)).payload.state,
            "failed",
          );
        }
      },
    );
    await check(
      "Repeated transport errors stop after six attempts",
      async () => {
        await s.enqueueSubmission(owner, result("timeout"));
        let j = await job("timeout");
        for (let n = 0; n < 6; n++) {
          await due(j);
          await s.deliver(j.id, owner, async () => {
            throw Error("private-url-token");
          });
          j = await readRecord("deliveries", j.id);
        }
        assert.equal(j.payload.state, "failed");
        assert.equal(j.payload.attempts, 6);
        assert.ok(!j.payload.lastMessage.includes("private-url-token"));
      },
    );
    await check(
      "HighLevel upsert preserves tags and unsubscribe settings",
      async () => {
        ghl = await s.saveConnection(formId, owner, {
          name: "HighLevel",
          provider: "gohighlevel",
          enabled: true,
          consentOnly: true,
          locationId: "location1",
          token: "test-private-token",
          tags: ["quiz-lead"],
          resultTag: true,
          mappings: [{ source: "result.title", target: "customfield1" }],
        });
        await s.enqueueSubmission(owner, result("ghl"));
        let j = await job("ghl", ghl.id);
        let calls = [];
        await s.deliver(j.id, owner, async (url, body, headers) => {
          calls.push(url);
          const b = JSON.parse(body);
          assert.equal(headers.Authorization, "Bearer test-private-token");
          if (url.endsWith("/upsert")) {
            assert.equal(b.createNewIfDuplicateAllowed, false);
            assert.equal(b.tags, undefined);
            assert.equal(b.dnd, undefined);
            assert.equal(b.customFields[0].fieldValue, "Beginner");
            return {
              status: 200,
              body: JSON.stringify({ contact: { id: "contact123" } }),
            };
          }
          assert.deepEqual(b.tags, ["quiz-lead", "heyquiz-beginner"]);
          return { status: 503, body: "" };
        });
        j = await readRecord("deliveries", j.id);
        assert.equal(j.payload.remoteContactId, "contact123");
        await due(j);
        await s.deliver(j.id, owner, async (url) => {
          assert.ok(url.endsWith("/contact123/tags"));
          return { status: 200, body: "" };
        });
        assert.equal(calls.filter((x) => x.endsWith("/upsert")).length, 1);
        assert.equal(
          (await readRecord("deliveries", j.id)).payload.state,
          "delivered",
        );
      },
    );
    await check(
      "HighLevel cannot be configured to send non-consenting leads",
      async () => {
        await assert.rejects(
          s.saveConnection(formId, owner, {
            name: "Bad",
            provider: "gohighlevel",
            locationId: "location1",
            token: "x",
            consentOnly: false,
          }),
        );
      },
    );
    await check("Synthetic HighLevel tests omit automation tags", async () => {
      const id = await s.createTest(formId, owner, ghl.id);
      let count = 0;
      await s.deliver(id, owner, async (url, body) => {
        count++;
        assert.ok(url.endsWith("/upsert"));
        assert.equal(JSON.parse(body).email, "heyquiz-test@example.com");
        return {
          status: 200,
          body: JSON.stringify({ contact: { id: "testcontact" } }),
        };
      });
      assert.equal(count, 1);
    });
    await check(
      "Connection edits stop old pending jobs until explicit retry",
      async () => {
        await s.enqueueSubmission(owner, result("changed"));
        const j = await job("changed");
        webhook = await s.saveConnection(formId, owner, {
          ...defaults,
          id: webhook.id,
          revision: webhook.revision,
          name: "Updated",
        });
        let sends = 0;
        await s.deliver(j.id, owner, async () => {
          sends++;
          return { status: 200, body: "" };
        });
        assert.equal(sends, 0);
        assert.equal(
          (await readRecord("deliveries", j.id)).payload.state,
          "failed",
        );
        await s.retryDelivery(formId, owner, j.id);
        await s.deliver(j.id, owner, async () => {
          sends++;
          return { status: 200, body: "" };
        });
        assert.equal(sends, 1);
      },
    );
    await check(
      "Disabling a connection prevents pending delivery",
      async () => {
        await s.enqueueSubmission(owner, result("pause"));
        const j = await job("pause");
        webhook = await s.saveConnection(formId, owner, {
          ...defaults,
          id: webhook.id,
          revision: webhook.revision,
          enabled: false,
        });
        await s.deliver(j.id, owner, async () => {
          throw Error("must not send");
        });
        assert.equal(
          (await readRecord("deliveries", j.id)).payload.state,
          "failed",
        );
        await assert.rejects(s.retryDelivery(formId, owner, j.id));
      },
    );
    await check(
      "Historical contacts are not backfilled on enabling",
      async () => {
        webhook = await s.saveConnection(formId, owner, {
          ...defaults,
          id: webhook.id,
          revision: webhook.revision,
        });
        const r = result("old");
        r.contact.recordedAt = "2020-01-01T00:00:00.000Z";
        await s.enqueueSubmission(owner, r);
        assert.equal(await job("old"), undefined);
      },
    );
    await check(
      "Reconciliation recovers after-results capture and is idempotent",
      async () => {
        const r = result("recover");
        await writeRecord("submissions", r.id, owner, {
          ...r,
          contact: undefined,
        });
        await s.dispatch(owner, formId, async () => ({
          status: 200,
          body: JSON.stringify({ contact: { id: "recovered" } }),
        }));
        assert.equal(await job("recover"), undefined);
        const old = await readRecord("submissions", r.id);
        await writeRecord("submissions", r.id, owner, r, old.version);
        await s.dispatch(owner, formId, async () => ({
          status: 200,
          body: JSON.stringify({ contact: { id: "recovered" } }),
        }));
        assert.equal((await job("recover")).payload.state, "delivered");
        await s.dispatch(owner, formId, async () => {
          throw Error("duplicate delivery");
        });
        assert.equal((await job("recover")).payload.attempts, 1);
      },
    );
    await check("Preview deployment never sends production data", async () => {
      process.env.VERCEL = "1";
      process.env.VERCEL_ENV = "preview";
      assert.deepEqual(
        await s.dispatch(owner, formId, async () => {
          throw Error("never send");
        }),
        { processed: 0, disabled: true },
      );
      delete process.env.VERCEL;
    });
    await check("History excludes lead payload and credentials", async () => {
      const h = await s.deliveryHistory(formId, owner);
      assert.ok(h.length);
      assert.ok(!JSON.stringify(h).includes("qa@example.com"));
      assert.ok(!JSON.stringify(h).includes("test-private-token"));
      assert.deepEqual(await s.deliveryHistory(formId, "other-owner"), []);
    });
    await check("Scheduler authentication supports Vault hash and rejects wrong credentials", async () => {
      const { authorizeScheduler, schedulerStatus } = require("../lib/integrations/scheduler.ts");
      const token = "synthetic-worker-token-with-at-least-32-characters";
      await writeRecord("meta", "integration-worker-auth", "system", { enabled: true, cadence: "minute", tokenHash: require("node:crypto").createHash("sha256").update(token).digest("hex") });
      assert.equal(await authorizeScheduler("Bearer " + token), true);
      assert.equal(await authorizeScheduler("Bearer " + "wrong".repeat(10)), false);
      assert.equal(await authorizeScheduler(null), false);
      assert.deepEqual(await schedulerStatus(), { configured: true, cadence: "minute" });
      const row = await readRecord("meta", "integration-worker-auth");
      await writeRecord("meta", row.id, "system", { ...row.payload, enabled: false }, row.version);
      assert.equal(await authorizeScheduler("Bearer " + token), false);
    });
    await check("HTTP sender rejects mixed private DNS and pins the approved address", async () => {
      const dns = require("node:dns/promises"), https = require("node:https"), { EventEmitter } = require("node:events");
      const lookup = dns.lookup, request = https.request;
      const { sendHttps } = require("../lib/integrations/http.ts");
      let called = false;
      try {
        dns.lookup = async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }];
        https.request = () => { called = true; throw Error("must not connect"); };
        await assert.rejects(sendHttps("https://example.com/hook", "{}", {}), /public IP/);
        assert.equal(called, false);
        dns.lookup = async () => [{ address: "8.8.8.8", family: 4 }];
        https.request = (url, options, response) => {
          assert.equal(url.hostname, "example.com"); assert.equal(options.family, 4);
          options.lookup(url.hostname, {}, (error, address, family) => { assert.equal(error, null); assert.equal(address, "8.8.8.8"); assert.equal(family, 4); });
          const req = new EventEmitter();
          req.destroy = error => { req.emit("error", error); req.emit("close"); };
          req.end = body => { assert.equal(body, "{}"); process.nextTick(() => {
            const res = new EventEmitter(); res.statusCode = 302; res.headers = { location: "http://127.0.0.1" }; response(res);
            res.emit("end"); req.emit("close");
          }); }; return req;
        };
        assert.equal((await sendHttps("https://example.com/hook", "{}", {})).status, 302);
      } finally { dns.lookup = lookup; https.request = request; }
    });
    console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
