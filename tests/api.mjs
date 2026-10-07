import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://127.0.0.1:3130";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Run against a local test server.");
let cookie = "";
const results = [];
const id = `test-${Date.now()}`;
async function request(path, method = "GET", body, auth = true) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      Origin: base,
      ...(auth && cookie ? { Cookie: cookie } : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data, res };
}
async function test(name, fn) {
  await fn();
  results.push({ name, passed: true });
}
try {
  await test("Anonymous administration is denied", async () =>
    assert.equal(
      (await request("/api/forms", "GET", null, false)).status,
      401,
    ));
  const login = await request("/api/auth", "POST", { local: true });
  assert.equal(login.status, 200);
  cookie = login.res.headers.get("set-cookie").split(";")[0];
  const fixture = {
    id,
    title: "API regression fixture",
    mode: "quiz",
    settings: { showAnswerKeyOnFinish: false, showReviewBeforeSubmit: true },
    questions: [
      {
        id: "q",
        type: "multiselect",
        title: "Choose two",
        required: true,
        points: 10,
        options: [
          { id: "a", label: "Alpha", isCorrect: true },
          { id: "b", label: "Beta", isCorrect: true },
          { id: "c", label: "Gamma", isCorrect: false },
        ],
      },
    ],
  };
  let form;
  await test("Create and save revision", async () => {
    const r = await request("/api/forms", "POST", fixture);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    form = r.data;
    assert.equal(form.revision, 1);
  });
  await test("Draft is not publicly playable", async () =>
    assert.equal(
      (await request(`/api/forms/${id}/start`, "POST", {}, false)).status,
      404,
    ));
  await test("Stale save receives conflict", async () => {
    const good = await request(`/api/forms/${id}`, "PUT", {
      ...form,
      title: "Saved title",
    });
    assert.equal(good.status, 200);
    const stale = await request(`/api/forms/${id}`, "PUT", form);
    assert.equal(stale.status, 409);
    form = good.data;
  });
  await test("Publish succeeds", async () =>
    assert.equal(
      (await request(`/api/forms/${id}/publish`, "POST", {})).status,
      200,
    ));
  let attempt;
  await test("Public attempt contains no answer keys", async () => {
    const r = await request(`/api/forms/${id}/start`, "POST", {}, false);
    assert.equal(r.status, 200);
    attempt = r.data;
    assert.equal(attempt.form.questions[0].options[0].isCorrect, undefined);
  });
  await test("Unpublished edits do not change public snapshot", async () => {
    await request(`/api/forms/${id}`, "PUT", {
      ...form,
      title: "Unpublished title",
    });
    const r = await request(`/api/forms/${id}/start`, "POST", {}, false);
    assert.equal(r.data.form.title, "Saved title");
  });
  await test("Required answers are enforced on server", async () =>
    assert.equal(
      (
        await request(
          `/api/forms/${id}/submit`,
          "POST",
          { token: attempt.token, answers: {} },
          false,
        )
      ).status,
      422,
    ));
  await test("Uploads contain real bytes and require access", async () => {
    const data = new FormData();
    data.set("token", attempt.token);
    data.set(
      "file",
      new Blob(["heyquiz file verification"], { type: "text/plain" }),
      "test.txt",
    );
    const r = await request("/api/media", "POST", data, false);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal((await fetch(base + `/api/media/${r.data.id}`)).status, 401);
    assert.equal(
      await (await fetch(base + r.data.url)).text(),
      "heyquiz file verification",
    );
  });
  let result;
  await test("Duplicate selections cannot inflate score or leak keys", async () => {
    const r = await request(
      `/api/forms/${id}/submit`,
      "POST",
      { token: attempt.token, answers: { q: ["a", "a", "a"] } },
      false,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    result = r.data;
    assert.equal(result.percentageScore, 50);
    assert.ok(!result.grading.some((g) => g.correctAnswer));
  });
  await test("Submitting again returns same response", async () => {
    const r = await request(
      `/api/forms/${id}/submit`,
      "POST",
      { token: attempt.token, answers: { q: ["b"] } },
      false,
    );
    assert.equal(r.data.id, result.id);
    assert.equal(r.data.percentageScore, 50);
  });
  await test("Owner can retrieve results", async () => {
    const r = await request(`/api/forms/${id}/submissions`);
    assert.equal(r.status, 200);
    assert.equal(r.data.submissions.length, 1);
  });
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (cookie) await request(`/api/forms/${id}`, "DELETE");
}
