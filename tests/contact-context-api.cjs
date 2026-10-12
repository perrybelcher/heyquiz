const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const originalLoad = Module._load, root = path.resolve(__dirname, '..'), memory = new Map(); let owner = 'local', failRead = false, failList = false, active = 0, maxActive = 0, network = 0;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const auth = { HttpError, requireUser: async () => { if (!owner) throw new HttpError(401, 'Sign in'); return { id: owner }; }, apiError: error => Response.json({ error: error.message }, { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } }) };
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/auth') return auth;
  if (request === '@/lib/storage') return { ownedForm: async (id, who) => memory.get('forms:' + id)?.owner_id === who ? memory.get('forms:' + id).payload : null };
  return originalLoad.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, isMain);
};
const records = require('../lib/records.ts');
records.listRecords = async (kind, who) => { if (failList) throw Error('PRIVATE STORAGE FAILURE'); return structuredClone([...memory.values()].filter(row => row.kind === kind && row.owner_id === who)); };
records.readRecord = async (kind, id) => { active++; maxActive = Math.max(active, maxActive); try { await new Promise(resolve => setTimeout(resolve, 1)); if (failRead) throw Error('PRIVATE HISTORY FAILURE'); return structuredClone(memory.get(kind + ':' + id) || null); } finally { active--; } };
const { loadContactDirectory } = require('../lib/contact-context-store.ts'), route = require('../app/api/forms/[id]/contacts/route.ts');
const originalFetch = global.fetch; global.fetch = async () => { network++; throw Error('No network permitted'); };
const t = Date.now() - 10000, save = (kind, id, who, payload) => memory.set(kind + ':' + id, { kind, id, owner_id: who, payload, version: 1 });
const request = id => route.GET(new Request('http://127.0.0.1/api/forms/' + id + '/contacts'), { params: Promise.resolve({ id }) });
const submission = (id, formId = 'quiz') => ({ id, formId, submittedAt: new Date(t).toISOString(), contact: { email: 'repeat@example.test', recordedAt: new Date(t - 10).toISOString(), placement: 'before_results' }, answers: { q: 'PRIVATE RETAINED ANSWER' }, grading: [] });
const attempt = (formId = 'quiz', patch = {}) => ({ form: { id: formId, secret: 'PRIVATE FORM' }, preview: false, startedAt: t - 100, result: { contact: { email: 'PRIVATE CACHE' } }, attribution: { version: 1, source: 'Newsletter' }, ...patch });
let count = 0; const pass = name => { count++; console.log('PASS ' + name); };
(async () => { try {
  save('forms', 'quiz', 'local', { id: 'quiz' }); save('forms', 'other', 'other', { id: 'other' });
  for (let n = 0; n < 34; n++) { save('submissions', 'r' + n, 'local', submission('r' + n)); save('attempts', 'r' + n, 'local', attempt()); }
  save('submissions', 'no-attempt', 'local', submission('no-attempt'));
  save('submissions', 'foreign-attempt', 'local', submission('foreign-attempt')); save('attempts', 'foreign-attempt', 'other', attempt());
  save('submissions', 'wrong-form', 'local', submission('wrong-form')); save('attempts', 'wrong-form', 'local', attempt('other'));
  save('submissions', 'preview', 'local', submission('preview')); save('attempts', 'preview', 'local', attempt('quiz', { preview: true }));
  save('submissions', 'canonical', 'local', submission('r1')); save('attempts', 'canonical', 'local', attempt('quiz', { attribution: { version: 1, source: 'Canonical' } }));
  save('submissions', 'other-quiz', 'local', submission('other-quiz', 'other')); save('submissions', 'foreign', 'other', submission('foreign'));
  save('attempts', 'orphan', 'local', attempt());
  let response = await request('quiz'); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json(); assert.equal(body.contacts.length, 39); assert.equal(body.contextByResponse.canonical.source, 'utm:Canonical'); assert.equal(body.contacts.find(row => row.id === 'canonical').id, 'canonical');
  assert.ok(!body.contacts.some(row => ['orphan', 'foreign', 'other-quiz'].includes(row.id)));
  for (const id of ['no-attempt', 'foreign-attempt', 'wrong-form', 'preview']) assert.equal(body.contextByResponse[id].history, 'unavailable');
  assert.ok(maxActive <= 8 && maxActive > 1); assert.equal(active, 0);
  for (const forbidden of ['PRIVATE FORM', 'PRIVATE CACHE', 'PRIVATE RETAINED ANSWER', 'repeat@example.test', 'token']) assert.ok(!JSON.stringify(body.contextByResponse).includes(forbidden));
  pass('Owner/form/non-preview join, canonical response IDs, no orphan restoration, bounded8 reads and allowlisted sidecar');
  owner = ''; assert.equal((await request('quiz')).status, 401); owner = 'other'; assert.equal((await request('quiz')).status, 404); owner = 'local'; assert.equal((await request('other')).status, 404); pass('Route auth and foreign-quiz access remain rejected');
  memory.delete('submissions:r1'); response = await request('quiz'); assert.equal((await response.json()).contextByResponse.r1, undefined); pass('Deleted retained response never returns via cached attempt result');
  failRead = true; response = await request('quiz'); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE')); assert.equal(active, 0); failRead = false;
  failList = true; response = await request('quiz'); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE')); failList = false;
  assert.equal((await request('quiz')).status, 200); pass('List/history failures yield safe503, drain workers and recover without successful partial cohorts');
  assert.equal((await loadContactDirectory('empty', 'local')).contacts.length, 0); assert.equal(network, 0); pass('Empty directory is successful and all checks use in-memory records without network');
  console.log(`${count} contact context API checks passed.`);
} finally { Module._load = originalLoad; global.fetch = originalFetch; } })().catch(error => { console.error(error); process.exitCode = 1; });
