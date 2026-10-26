// Real route -> validation/storage adapter -> shared HTTP error boundary.
// Supabase and authentication cookies are synthetic; no external network or data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
}).outputText, file);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...rest) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(process.cwd(), name.slice(2)) : name, ...rest);
};
const jar = new Map();
const originalLoad = Module._load;
Module._load = function(name, ...rest) {
  if (name === 'next/headers') return {cookies: async () => ({get: key => jar.get(key)})};
  if (name === 'next/navigation') return {redirect: () => {throw Error('Unexpected test redirect');}};
  return originalLoad.call(this, name, ...rest);
};
const envKeys = ['SESSION_SECRET', 'HEYQUIZ_LOCAL_MODE', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'VERCEL', 'VERCEL_ENV'];
const oldEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const oldFetch = global.fetch, oldError = console.error;
process.env.SESSION_SECRET = 'synthetic-save-error-signing-secret-long-enough';
process.env.HEYQUIZ_LOCAL_MODE = '1';
process.env.SUPABASE_URL = 'https://records.example.invalid';
process.env.SUPABASE_SECRET_KEY = 'synthetic-records-secret';
for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'VERCEL', 'VERCEL_ENV']) delete process.env[key];
const {apiError, signToken} = require('../lib/auth.ts');
const {HttpError, ValidationError, ConflictError, ServiceUnavailableError, readJsonRequest} = require('../lib/errors.ts');
const records = require('../lib/records.ts');
const {FormSchema} = require('../lib/schema.ts');
const {PUT} = require('../app/api/forms/[id]/route.ts');
const {publishForm} = require('../lib/storage.ts');
const {parseContact} = require('../lib/contacts.ts');
const {webhookUrl} = require('../lib/integrations/http.ts');
jar.set('hq_local', {value: signToken({role: 'local', exp: Date.now() + 60000})});
const id = 'save-errors-fixture';
const form = FormSchema.parse({id, title: 'Synthetic quiz', mode: 'survey', questions: [{id: 'q', type: 'short_answer', title: 'Question'}]});
const row = {kind: 'forms', id, owner_id: 'local', version: 1, payload: form};
let writeMode = 'success', readMode = 'success', writes = 0;
const logs = [];
console.error = value => logs.push(String(value));
global.fetch = async (url, init = {}) => {
  assert.ok(String(url).startsWith(process.env.SUPABASE_URL + '/rest/v1/'), 'Only mocked records service may be called');
  if (!init.method || init.method === 'GET') {
    if (readMode === 'network') throw new TypeError('synthetic private provider details');
    if (readMode === 'corrupt') return new Response('synthetic private invalid JSON');
    return Response.json([row]);
  }
  writes++;
  if (writeMode === 'network') throw new DOMException('synthetic private provider details', 'TimeoutError');
  if (writeMode === 'outage') return new Response('synthetic private provider body', {status: 503, headers: {'Retry-After': '3'}});
  if (writeMode === 'rate-limit') return new Response('synthetic private provider body', {status: 429, headers: {'Retry-After': '7'}});
  if (writeMode === 'conflict') return new Response('synthetic private provider body', {status: 409});
  if (writeMode === 'unexpected') return new Response('synthetic private provider body', {status: 418});
  const saved = {...JSON.parse(init.body), version: row.version + 1};
  return Response.json([saved]);
};
async function save(input = {...form, revision: 1}) {
  return PUT(new Request(`https://quiz.example.test/api/forms/${id}`, {
    method: 'PUT', headers: {origin: 'https://quiz.example.test', 'content-type': 'application/json'}, body: JSON.stringify(input),
  }), {params: Promise.resolve({id})});
}
async function expectFailure(mode, status, header) {
  writeMode = mode;
  const response = await save();
  assert.equal(response.status, status, mode);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes('synthetic private'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  if (status >= 500) {
    assert.match(body.reference, /^[a-f0-9-]{36}$/);
    assert.equal(response.headers.get('x-pippi-reference'), body.reference);
  }
  if (header) assert.equal(response.headers.get('retry-after'), header);
}
(async () => {
  let checks = 0;
  try {
    assert.equal(records.ConflictError, ConflictError); checks++;
    for (const [mode, status, retry] of [['outage', 503, '3'], ['network', 503], ['rate-limit', 503, '7'], ['conflict', 409], ['unexpected', 500]]) {
      await expectFailure(mode, status, retry); checks++;
    }
    readMode = 'network'; assert.equal((await save()).status, 503); checks++;
    readMode = 'corrupt';
    const corrupt = await save(); assert.equal(corrupt.status, 500);
    assert.ok(!(await corrupt.text()).includes('synthetic private')); checks++;
    readMode = 'success'; writeMode = 'success';
    const before = writes;
    assert.equal((await save({...form, revision: 1, questions: [form.questions[0], form.questions[0]]})).status, 400);
    assert.equal(writes, before, 'Invalid references never write records'); checks++;
    assert.equal((await save({...form, revision: 99})).status, 409); checks++;
    assert.equal((await save()).status, 200); checks++;
    await assert.rejects(() => records.writeRecord('forms', id, 'other-owner', form, 1), error => error instanceof HttpError && error.status === 404); checks++;
    await assert.rejects(() => records.readRecord('forms', '../private'), error => error instanceof ValidationError && error.status === 400); checks++;
    await assert.rejects(() => publishForm({...form, questions: []}, 'local'), error => error instanceof ValidationError && error.status === 400); checks++;
    assert.throws(() => parseContact({...require('../lib/contacts.ts').defaultCapture, enabled: true, required: true}, null), ValidationError); checks++;
    assert.throws(() => webhookUrl('http://localhost/private'), ValidationError); checks++;
    await assert.rejects(() => readJsonRequest(new Request('https://quiz.example.test', {method: 'POST', body: '{'})), ValidationError); checks++;
    for (const value of [null, [], 'text', 4, false]) {
      await assert.rejects(() => readJsonRequest(new Request('https://quiz.example.test', {method: 'POST', body: JSON.stringify(value)})), ValidationError); checks++;
    }
    for (const value of [null, [], 'text', 4, false]) assert.equal((await save(value)).status, 400); checks++;
    assert.equal(apiError(new SyntaxError('internal private JSON')).status, 500, 'Internal JSON faults are not client input errors'); checks++;
    const retry = apiError(new ServiceUnavailableError('Try later.', 2)); assert.equal(retry.headers.get('retry-after'), '2'); checks++;
    const validation = apiError(new ValidationError('Fix your answer.')); assert.equal(validation.status, 400); assert.equal((await validation.json()).error, 'Fix your answer.'); checks++;
    assert.ok(logs.length && logs.every(line => !line.includes('synthetic private') && !line.includes('internal private'))); checks++;
    console.log(`PASS save error classification: ${checks} checks; real routes and adapter, synthetic provider only.`);
  } finally {
    global.fetch = oldFetch; console.error = oldError;
    for (const key of envKeys) {if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];}
  }
})().catch(error => {oldError(error); process.exitCode = 1;});
