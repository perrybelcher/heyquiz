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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "heyquiz-nango-"));
process.env.HEYQUIZ_DATA_DIR = temp;
process.env.SESSION_SECRET = "nango-test-only-session-secret-32-chars";
process.env.NANGO_SECRET_KEY = "nango-test-only-key";
process.env.NANGO_HUBSPOT_INTEGRATION_ID = "hubspot";
delete process.env.SUPABASE_URL;
delete process.env.VERCEL;
const n = require("../lib/integrations/nango.ts"),
  s = require("../lib/integrations/service.ts"),
  r = require("../lib/records.ts"),
  { unseal } = require("../lib/integrations/secrets.ts"),
  { IntegrationInput } = require("../lib/integrations/schema.ts");
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log("PASS " + name);
}
const response = (status, body = {}) => ({
  status,
  body: JSON.stringify(body),
});
(async () => {
  try {
    await r.writeRecord("forms", "quiz", "owner", { id: "quiz" }, 0);
    let tags, attempt;
    await test("Session restricts provider, contact scopes and opaque owner tags", async () => {
      attempt = await n.startHubspot(
        "quiz",
        "owner",
        async (url, body, headers, method) => {
          assert.equal(url, "https://api.nango.dev/connect/sessions");
          assert.equal(method, "POST");
          assert.equal(headers.Authorization, "Bearer nango-test-only-key");
          const b = JSON.parse(body);
          tags = b.tags;
          assert.deepEqual(b.allowed_integrations, ["hubspot"]);
          assert.equal(
            b.integrations_config_defaults.hubspot.connection_config
              .oauth_scopes_override,
            "oauth crm.objects.contacts.read crm.objects.contacts.write",
          );
          assert.notEqual(tags.heyquiz_owner, "owner");
          return response(201, {
            data: {
              token: "do-not-return",
              connect_link: "https://connect.nango.dev/?session_token=test",
              expires_at: new Date(Date.now() + 1800000).toISOString(),
            },
          });
        },
      );
      assert.ok(!JSON.stringify(attempt).includes("do-not-return"));
    });
    await test("Unexpected auth link is rejected", async () => {
      await assert.rejects(
        n.startHubspot("quiz", "owner", async () =>
          response(201, {
            data: {
              connect_link: "https://evil.example",
              expires_at: new Date(Date.now() + 1800000).toISOString(),
            },
          }),
        ),
        /unexpected/,
      );
    });
    await test("Foreign owner and quiz cannot finish authorization", async () => {
      const noCall = async () => {
        throw Error("must not call Nango");
      };
      await assert.rejects(
        n.finishHubspot("quiz", "intruder", attempt.attemptId, noCall),
        /not found/,
      );
      await assert.rejects(
        n.finishHubspot("other", "owner", attempt.attemptId, noCall),
        /not found/,
      );
    });
    const remote = {
      connection_id: "nango-connection",
      provider_config_key: "hubspot",
      provider: "hubspot",
      tags,
      errors: [],
    };
    await test("Pending, spoofed tag and wrong provider do not connect", async () => {
      for (const c of [
        [],
        [{ ...remote, tags: { ...tags, heyquiz_owner: "intruder" } }],
        [{ ...remote, provider: "slack" }],
      ])
        assert.equal(
          await n.finishHubspot("quiz", "owner", attempt.attemptId, async () =>
            response(200, { connections: c }),
          ),
          null,
        );
    });
    await test("Invalid or errored authorization is rejected", async () => {
      await assert.rejects(
        n.finishHubspot("quiz", "owner", attempt.attemptId, async () =>
          response(200, {
            connections: [{ ...remote, errors: [{ type: "auth" }] }],
          }),
        ),
        /attention/,
      );
      await assert.rejects(
        n.finishHubspot("quiz", "owner", attempt.attemptId, async () =>
          response(200, { connections: [remote, remote] }),
        ),
        /Multiple/,
      );
    });
    let connected;
    await test("Verified connection encrypted and paused, duplicate finish is idempotent", async () => {
      connected = await n.finishHubspot(
        "quiz",
        "owner",
        attempt.attemptId,
        async (url) => {
          assert.equal(
            new URL(url).searchParams.get("tags[heyquiz_attempt]"),
            attempt.attemptId,
          );
          return response(200, { connections: [remote] });
        },
      );
      assert.equal(connected.payload.enabled, false);
      assert.equal(
        unseal(connected.payload.secretBox, `owner:quiz:${attempt.attemptId}`)
          .connectionId,
        remote.connection_id,
      );
      assert.ok(
        !JSON.stringify(s.integrationView(connected)).includes(
          remote.connection_id,
        ),
      );
      assert.equal(
        (
          await n.finishHubspot(
            "quiz",
            "owner",
            attempt.attemptId,
            async () => {
              throw Error("unnecessary network");
            },
          )
        ).id,
        connected.id,
      );
    });
    await test("Client cannot forge HubSpot credentials or subscription mapping", async () => {
      await assert.rejects(
        s.saveConnection("quiz", "owner", {
          name: "HubSpot",
          provider: "hubspot",
          token: "forged",
        }),
        /Authorize/,
      );
      assert.equal(
        IntegrationInput.safeParse({
          name: "x",
          provider: "hubspot",
          consentOnly: false,
        }).success,
        false,
      );
      assert.equal(
        IntegrationInput.safeParse({
          name: "x",
          provider: "hubspot",
          mappings: [{ source: "score", target: "hs_email_optout" }],
        }).success,
        false,
      );
    });
    await test("Owner can map score and consent on saved connection", async () => {
      const saved = await s.saveConnection("quiz", "owner", {
        ...s.integrationView(connected),
        mappings: [
          { source: "score", target: "heyquiz_score" },
          { source: "contact.marketingConsent", target: "heyquiz_consent" },
        ],
      });
      assert.equal(saved.mappings.length, 2);
      assert.equal(saved.credentialsSaved, true);
    });
    const event = {
      contact: {
        email: "Person@Example.com",
        name: "Jane Doe",
        marketingConsent: true,
      },
      fields: {
        heyquiz_score: 75,
        heyquiz_consent: true,
        heyquiz_categories: [{ score: 20 }],
      },
    };
    const secret = { connectionId: "nango-connection", providerKey: "hubspot" };
    await test("Partial updates preserve absent phone and unrelated properties", async () => {
      const props = n.hubspotProperties(event);
      assert.equal(props.email, "person@example.com");
      assert.equal(props.firstname, "Jane");
      assert.equal(props.lastname, "Doe");
      assert.equal(props.phone, undefined);
      assert.equal(props.heyquiz_consent, "true");
      let calls = 0;
      const result = await n.sendHubspot(
        event,
        secret,
        async (url, body, headers, method) => {
          calls++;
          assert.equal(method, "PATCH");
          assert.ok(url.endsWith("person%40example.com?idProperty=email"));
          assert.equal(headers["Connection-Id"], "nango-connection");
          assert.deepEqual(JSON.parse(body).properties, props);
          return response(200, { id: "123" });
        },
      );
      assert.equal(calls, 1);
      assert.equal(result.status, 200);
    });
    await test("New contact and concurrent create race resolve by email", async () => {
      let methods = [],
        statuses = [404, 409, 200];
      const result = await n.sendHubspot(
        event,
        secret,
        async (_url, _body, _headers, method) => {
          methods.push(method);
          return response(statuses.shift(), { id: "123" });
        },
      );
      assert.deepEqual(methods, ["PATCH", "POST", "PATCH"]);
      assert.equal(result.status, 200);
    });
    await test("Authentication/rate-limit errors never attempt create", async () => {
      for (const status of [401, 403, 429, 500]) {
        let calls = 0;
        assert.equal(
          (
            await n.sendHubspot(event, secret, async () => {
              calls++;
              return response(status);
            })
          ).status,
          status,
        );
        assert.equal(calls, 1);
      }
    });
    await test("Worker retries transient HubSpot errors and records success once", async () => {
      const id = await s.createTest("quiz", "owner", connected.id);
      await s.deliver(id, "owner", async () => ({
        ...response(429),
        retryAfter: "60",
      }));
      let job = await r.readRecord("deliveries", id);
      assert.equal(job.payload.state, "pending");
      assert.equal(job.payload.lastStatus, 429);
      await r.writeRecord(
        "deliveries",
        id,
        "owner",
        { ...job.payload, nextAttemptAt: 0 },
        job.version,
      );
      await s.deliver(id, "owner", async () => response(200, { id: "987" }));
      job = await r.readRecord("deliveries", id);
      assert.equal(job.payload.state, "delivered");
      assert.equal(job.payload.remoteContactId, "987");
      await s.deliver(id, "owner", async () => {
        throw Error("must not redeliver");
      });
    });
    await test("Worker treats missing scopes and malformed success as terminal", async () => {
      for (const result of [
        response(403),
        response(200, { unexpected: true }),
      ]) {
        const id = await s.createTest("quiz", "owner", connected.id);
        await s.deliver(id, "owner", async () => result);
        assert.equal(
          (await r.readRecord("deliveries", id)).payload.state,
          "failed",
        );
      }
    });
    await test("No opt-in produces a skipped HubSpot delivery", async () => {
      const row = await r.readRecord("integrations", connected.id);
      await r.writeRecord(
        "integrations",
        row.id,
        "owner",
        { ...row.payload, enabled: true, activeFrom: "2000-01-01" },
        row.version,
      );
      await s.enqueueSubmission("owner", {
        id: "no-consent",
        formId: "quiz",
        submittedAt: new Date().toISOString(),
        percentageScore: 50,
        answers: {},
        contact: {
          email: "test@example.com",
          marketingConsent: false,
          recordedAt: new Date().toISOString(),
          consentText: "test",
        },
      });
      const jobs = await r.listRecords("deliveries", "owner");
      assert.equal(
        jobs.find((j) => j.payload.event.responseId === "no-consent").payload
          .state,
        "skipped",
      );
    });
    await test("Expired authorization and missing configuration fail clearly", async () => {
      const a = await r.readRecord("meta", `nango-${attempt.attemptId}`);
      await r.writeRecord(
        "meta",
        "nango-expired",
        "owner",
        { ...a.payload, expiresAt: 0 },
        0,
      );
      await assert.rejects(
        n.finishHubspot("quiz", "owner", "expired"),
        /expired/,
      );
      delete process.env.NANGO_SECRET_KEY;
      assert.equal(n.nangoConfigured(), false);
      await assert.rejects(n.startHubspot("quiz", "owner"), /setup is pending/);
    });
    console.log(`${passed} Nango / HubSpot checks passed.`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
