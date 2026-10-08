const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
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
const jar = new Map(),
  calls = [];
let reply = { data: {}, status: 200 };
const originalLoad = Module._load;
Module._load = function (id, parent, main) {
  if (id === "next/headers")
    return {
      cookies: async () => ({
        get: (n) => jar.get(n),
        set: (n, value, options) => jar.set(n, { value, options }),
        delete: (n) => jar.delete(n),
      }),
    };
  if (id === "next/navigation")
    return {
      redirect: () => {
        throw new Error("redirect");
      },
    };
  if (id.startsWith("@/"))
    return originalLoad.call(
      this,
      path.resolve(__dirname, "..", id.slice(2)),
      parent,
      main,
    );
  return originalLoad.call(this, id, parent, main);
};
process.env.SESSION_SECRET = "synthetic-test-secret-32-characters-long";
process.env.SUPABASE_URL = "https://auth.example.test";
process.env.SUPABASE_ANON_KEY = "synthetic-public-key";
delete process.env.HEYQUIZ_LOCAL_MODE;
global.fetch = async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body || "{}") });
  return Response.json(reply.data, { status: reply.status });
};
const { POST } = require("../app/api/auth/account/route.ts");
const { verifyToken, signToken } = require("../lib/auth.ts");
let ip = 0,
  passed = 0;
async function request(body, origin = "https://quiz.example.test") {
  return POST(
    new Request("https://quiz.example.test/api/auth/account", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-forwarded-for": `192.0.2.${++ip}`,
      },
      body: JSON.stringify(body),
    }),
  );
}
function check(condition, message) {
  assert.ok(condition, message);
  passed++;
  console.log("PASS", message);
}
(async () => {
  let r = await request({
    action: "signup",
    email: "bad",
    password: "long-test-password",
  });
  check(
    r.status === 400 && calls.length === 0,
    "invalid email rejected before provider",
  );
  r = await request({
    action: "signup",
    email: "test@example.test",
    password: "short",
  });
  check(r.status === 400 && calls.length === 0, "short password rejected");
  r = await request({ action: "signup" }, "https://evil.test");
  check(
    r.status === 403 && calls.length === 0,
    "cross-origin account submission rejected",
  );
  r = await request({
    action: "signup",
    email: " Test@Example.test ",
    password: "long-test-password",
  });
  let data = await r.json();
  check(
    r.status === 200 && data.message && !data.next,
    "signup waits for verification",
  );
  check(
    calls.at(-1).body.email === "test@example.test" &&
      calls.at(-1).body.code_challenge_method === "s256",
    "normalized email and PKCE challenge",
  );
  let flow = verifyToken(jar.get("hq_email_flow").value);
  check(
    flow.kind === "signup" &&
      jar.get("hq_email_flow").options.httpOnly &&
      jar.get("hq_email_flow").options.secure,
    "signed HttpOnly secure verifier",
  );
  check(
    calls
      .at(-1)
      .url.includes(
        encodeURIComponent("https://heyquiz-fawn.vercel.app/auth/callback"),
      ),
    "email redirect fixed to app, never supplied host",
  );
  reply = {
    data: { access_token: "synthetic-access", expires_in: 3600 },
    status: 200,
  };
  r = await request({ action: "exchange", code: "synthetic-code" });
  data = await r.json();
  check(
    data.next === "/" &&
      jar.get("hq_access").value === "synthetic-access" &&
      !jar.has("hq_email_flow"),
    "confirmed signup establishes session and consumes verifier",
  );
  check(
    calls.at(-1).body.code_verifier === flow.verifier &&
      !JSON.stringify(data).includes("synthetic-access"),
    "verifier exchanged server-side, tokens never returned",
  );
  r = await request({ action: "exchange", code: "synthetic-code" });
  check(r.status === 400, "replayed callback rejected");
  jar.clear();
  reply = { data: {}, status: 200 };
  r = await request({ action: "recover", email: "test@example.test" });
  check(
    r.status === 200 &&
      verifyToken(jar.get("hq_email_flow").value).kind === "recovery",
    "recovery request has distinct bound flow",
  );
  reply = {
    data: { access_token: "synthetic-recovery", expires_in: 3600 },
    status: 200,
  };
  r = await request({ action: "exchange", code: "recovery-code" });
  data = await r.json();
  check(
    data.next === "/reset-password" &&
      jar.has("hq_recovery") &&
      !jar.has("hq_access"),
    "recovery does not authenticate workspace",
  );
  reply = { data: { id: "test-user" }, status: 200 };
  r = await request({ action: "reset", password: "new-long-password" });
  data = await r.json();
  check(
    data.next === "/login?reset=success" &&
      !jar.has("hq_recovery") &&
      calls.at(-1).init.method === "PUT",
    "reset updates password and clears recovery grant",
  );
  r = await request({ action: "reset", password: "new-long-password" });
  check(r.status === 401, "reset without recovery cookie rejected");
  jar.set("hq_email_flow", {
    value: signToken({
      role: "email-flow",
      kind: "signup",
      verifier: "test",
      exp: Date.now() - 1,
    }),
  });
  r = await request({ action: "exchange", code: "some-code" });
  check(r.status === 400, "expired verifier rejected");
  reply = { data: { code: "email_address_not_authorized" }, status: 400 };
  r = await request({
    action: "signup",
    email: "test@example.test",
    password: "long-test-password",
  });
  data = await r.json();
  check(
    r.status === 503 && !data.message,
    "SMTP rejection is an error, never false email success",
  );
  reply = { data: { code: "over_email_send_rate_limit" }, status: 429 };
  r = await request({ action: "recover", email: "test@example.test" });
  check(r.status === 429, "provider rate limit preserved");
  console.log(
    `${passed} account checks passed (mock provider; no email sent).`,
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
