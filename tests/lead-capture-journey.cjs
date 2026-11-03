// Real local API + server-rendered directory. No hosted data or external providers.
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.HEYQUIZ_DATA_DIR?.startsWith('/tmp/'), 'Use isolated disposable local records.');
let cookie = '';
const ids = [], suffix = Date.now();
async function request(path, method = 'GET', body, authenticated = true) {
  const response = await fetch(base + path, { method, headers: { Origin: base, 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  return { status: response.status, data };
}
async function ok(path, method, body, authenticated = true) {
  const result = await request(path, method, body, authenticated);
  assert.ok(result.status >= 200 && result.status < 300, `${method} ${path}: ${JSON.stringify(result)}`);
  return result.data;
}
const config = { enabled: true, placement: 'before_results', required: false, name: 'optional', phone: 'off', title: 'Your next step', description: 'Save your details', buttonText: 'Continue', marketingEnabled: true, marketingLabel: 'Optional marketing updates', privacyUrl: 'https://example.test/privacy' };
const question = { id: 'q', type: 'multiple_choice', title: 'Choose one', required: true, options: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }] };
async function create(label, capture, questions = [question]) {
  const id = `lead-journey-${label}-${suffix}`;
  ids.push(id);
  await ok('/api/forms', 'POST', { id, title: `Synthetic ${label}`, mode: 'survey', questions, ...(capture ? { capture } : {}) });
  await ok(`/api/forms/${id}/publish`, 'POST', {});
  return id;
}
async function submit(id, contact, { preview = false, after = false, answers = { q: 'a' } } = {}) {
  const attempt = await ok(`/api/forms/${id}/start`, 'POST', preview ? { preview: true } : {}, preview);
  await ok(`/api/forms/${id}/submit`, 'POST', { token: attempt.token, answers, ...(!after && contact ? { contact } : {}) }, false);
  if (after && contact) await ok(`/api/forms/${id}/contact`, 'POST', { token: attempt.token, contact }, false);
}
async function contacts(id) { return (await ok(`/api/forms/${id}/contacts`)).contacts; }
(async () => {
  try {
    const login = await fetch(base + '/api/auth', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ local: true }) });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    const before = await create('before', config), after = await create('after', { ...config, placement: 'after_results' });
    const alice = { name: `Before Visitor ${suffix}`, email: 'same-person@example.test', marketingConsent: false }, bob = { ...alice, name: `After Visitor ${suffix}` };
    await submit(before, alice); await submit(after, bob, { after: true });
    assert.equal((await contacts(before)).length, 1); assert.equal((await contacts(after)).length, 1);
    assert.equal((await contacts(before))[0].contact.marketingConsent, false);
    const overview = await fetch(base + '/contacts', { headers: { Cookie: cookie } });
    assert.equal(overview.status, 200);
    const html = await overview.text(), visible = html.split('</main>')[0];
    assert.ok(visible.includes(alice.name)); assert.ok(visible.includes(bob.name));
    assert.ok(visible.includes('Contacts collected through all your quizzes'));
    await submit(before, alice); assert.equal((await contacts(before)).length, 2, 'Repeat submissions remain separate');
    await submit(before, null); await submit(before, alice, { preview: true }); await submit(after, bob, { preview: true, after: true });
    assert.equal((await contacts(before)).length, 2); assert.equal((await contacts(after)).length, 1);
    const draft = await ok(`/api/forms/${before}`);
    await ok(`/api/forms/${before}`, 'PUT', { ...draft, capture: { ...draft.capture, enabled: false } });
    await submit(before, alice); assert.equal((await contacts(before)).length, 3, 'Unpublished capture edits do not change the live quiz');
    await ok(`/api/forms/${before}/publish`, 'POST', {});
    await submit(before, alice); assert.equal((await contacts(before)).length, 3, 'Publishing disabled capture stops new contact collection');
    const emailOnly = await create('email-question', undefined, [{ id: 'email', type: 'email', title: 'Email', required: true }]);
    await submit(emailOnly, null, { answers: { email: 'answer-only@example.test' } });
    assert.equal((await contacts(emailOnly)).length, 0, 'An email question alone is not dedicated capture');
    const savedSource = await ok(`/api/forms/${before}`);
    for (const [label, capture] of Object.entries({
      legacy: undefined, off: { ...config, enabled: false },
      required: { ...config, required: true }, after: { ...config, placement: 'after_results' }
    })) {
      const id = `lead-copy-${label}-${suffix}`;
      ids.push(id);
      const copy = { ...savedSource, id, revision: 0, capture };
      await ok('/api/forms', 'POST', copy);
      const reloaded = await ok(`/api/forms/${id}`);
      assert.deepEqual(reloaded.capture, capture, label + ' survives duplication');
      const imported = JSON.parse(JSON.stringify(copy));
      await ok(`/api/forms/${id}`, 'PUT', { ...imported, revision: reloaded.revision });
      assert.deepEqual((await ok(`/api/forms/${id}`)).capture, capture, label + ' survives JSON round trip');
    }
    const legacy = await fetch(`${base}/editor/${after}?section=contacts`, { headers: { Cookie: cookie } });
    assert.equal(legacy.status, 200); assert.ok((await legacy.text()).includes('Edit lead capture'));
    const settings = await fetch(`${base}/editor/${after}?section=capture`, { headers: { Cookie: cookie } });
    assert.equal(settings.status, 200);
    assert.match((await settings.text()), /Lead capture/);
    console.log('PASS two-quiz aggregation, separate attempts, declined consent, optional skip, both preview timings, draft/publication boundaries, email-question exclusion and directory/settings links.');
  } finally {
    for (const id of ids) await request(`/api/forms/${id}`, 'DELETE');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
