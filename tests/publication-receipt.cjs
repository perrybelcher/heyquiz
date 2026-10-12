/* Actual source publish handler and route; in-memory records, controlled async boundaries. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), Module = require('node:module'), ts = require('typescript');
const app = path.resolve(__dirname, '..'), originalLoad = Module._load, originalFetch = global.fetch;
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
Module._load = function (request, parent, main) { return originalLoad.call(this, request.startsWith('@/') ? path.join(app, request.slice(2)) : request, parent, main); };
global.fetch = () => { throw Error('Publication receipt regression must not use network'); };
const { FormSchema } = require('../lib/schema.ts'), publication = require('../lib/publication.ts'), records = require('../lib/records.ts'), auth = require('../lib/auth.ts');
const memory = new Map(), clone = value => structuredClone(value), owner = 'synthetic-receipt-owner', id = 'synthetic-publication-receipt'; let actor = owner, publicationWriteHook = null, failPublication = false;
records.readRecord = async (kind, key) => clone(memory.get(kind + ':' + key) || null);
records.writeRecord = async (kind, key, who, payload, expected) => {
  const old = memory.get(kind + ':' + key); if (expected !== undefined && (old?.version || 0) !== expected) throw new records.ConflictError();
  if (kind === 'published') { if (failPublication) throw new Error('Synthetic publication write failed.'); if (publicationWriteHook) await publicationWriteHook(); }
  const row = { kind, id: key, owner_id: who, version: (old?.version || 0) + 1, payload: clone(payload) }; memory.set(kind + ':' + key, row); return clone(row);
};
auth.requireUser = async () => { if (!actor) throw new auth.HttpError(401, 'Sign in.'); return { id: actor }; };
const route = require('../app/api/forms/[id]/publish/route.ts');
const context = { params: Promise.resolve({ id }) }, request = () => new Request(`http://127.0.0.1:3164/api/forms/${id}/publish`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:3164' } });
const form = title => FormSchema.parse({ id, title, mode: 'form', questions: [{ id: 'q', type: 'multiple_choice', title: 'Synthetic question', options: [{ id: 'a', label: 'First' }] }] });
const a = form('Rendered draft A'), b = form('Newer saved draft B'), baseline = process.env.PUBLICATION_RECEIPT_BASELINE === '1';
const sourceText = fs.readFileSync(path.join(app, 'components/EditorStudio.tsx'), 'utf8'), ast = ts.createSourceFile('EditorStudio.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer; (function find(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handlePublish') initializer = node.initializer.getText(ast); ts.forEachChild(node, find); })(ast);
assert.ok(initializer, 'Read the actual editor publication handler');
const compiled = ts.transpileModule(`globalThis.extracted = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const observations = [];
async function exercise(name, latestAtSave, latestAtPublish, editAfterCommit, responsePatch) {
  memory.clear(); await records.writeRecord('forms', id, owner, a, 0);
  const state = { liveFingerprint: '', published: false, success: false, error: '', readiness: true, unverified: false, local: clone(a), response: null };
  const env = {
    ...publication, form: clone(a), publicationPending: { current: false }, publicationUncertain: false,
    setActionError: value => state.error = value, setPublishing: () => {}, setPublicationNotice: () => {}, setShowReadiness: value => state.readiness = value,
    setLiveFingerprint: value => state.liveFingerprint = value, setIsPublished: value => state.published = value, setShowPublishModal: value => state.success = value,
    closePublishReadiness: () => state.readiness = false,
    setPublicationUncertain: value => state.unverified = value,
    saveNow: async snapshot => {
      assert.equal(snapshot.title, a.title);
      // The existing autosave contract drains newer edits before resolving true.
      await Promise.resolve(); if (latestAtSave) { state.local = clone(latestAtSave); await records.writeRecord('forms', id, owner, latestAtSave); }
      return true;
    },
    fetch: async () => {
      // A different owner tab can save after this tab's save and before POST reads.
      if (latestAtPublish) await records.writeRecord('forms', id, owner, latestAtPublish);
      const response = await route.POST(request(), context); state.response = await response.clone().json();
      // Publication committed; later draft edits remain unpublished.
      if (editAfterCommit) { state.local = clone(editAfterCommit); await records.writeRecord('forms', id, owner, editAfterCommit); }
      await Promise.resolve(); return responsePatch ? responsePatch(response, state.response) : response;
    },
  };
  vm.createContext(env); vm.runInContext(compiled, env); await env.extracted(true);
  const actual = memory.get('published:' + id)?.payload;
  const observed = { name, localTitle: state.local.title, publishedTitle: actual?.title, receiptPresent: Boolean(state.response?.publication), successShown: state.success, error: state.error, claimedUpToDate: state.liveFingerprint === publication.publicationFingerprint(state.local), actuallyUpToDate: actual ? publication.publicationFingerprint(actual) === publication.publicationFingerprint(state.local) : false, receiptMatchesCommitted: actual ? state.liveFingerprint === publication.publicationFingerprint(actual) : false };
  observations.push(observed);
  if (!baseline && !responsePatch) { assert.equal(observed.successShown, true, observed.error); assert.equal(observed.receiptMatchesCommitted, true, name + ': live identity must come from the committed source'); assert.equal(observed.claimedUpToDate, observed.actuallyUpToDate, name + ': status must match retained publication'); }
  return state;
}
(async () => { try {
  await exercise('newer edit drained while save is pending', b, null, null);
  await exercise('other tab saves before publication reads', null, b, null);
  await exercise('newer draft edit after publication committed', null, null, b);
  if (baseline) {
    assert.equal(observations[0].claimedUpToDate, false); assert.equal(observations[0].actuallyUpToDate, true);
    assert.equal(observations[1].claimedUpToDate, true); assert.equal(observations[1].actuallyUpToDate, false);
    assert.equal(observations[2].claimedUpToDate, observations[2].actuallyUpToDate);
    console.log('REPRODUCED actual editor closure assigns stale identity despite server publication; this is baseline evidence, not an accepted regression pass.');
  }
  console.log(JSON.stringify(observations, null, 2));
  if (!baseline) {
    console.log('PASS actual handler/route receipt identity at three save/publication response boundaries');
    const receipt = { version: 1, formId: id, fingerprint: publication.publicationFingerprint(a) };
    assert.deepEqual(publication.parsePublicationReceipt(receipt, id), receipt);
    for (const value of [null, [], {}, { ...receipt, version: 2 }, { ...receipt, formId: 'other' }, { ...receipt, extra: true }, { ...receipt, fingerprint: '' }, { ...receipt, fingerprint: 'not json' }, { ...receipt, fingerprint: JSON.stringify({ id, title: 'Missing fields' }) }, { ...receipt, fingerprint: JSON.stringify(JSON.parse(receipt.fingerprint), null, 2) }, { ...receipt, fingerprint: publication.publicationFingerprint({ ...a, id: 'other' }) }]) assert.throws(() => publication.parsePublicationReceipt(value, id), error => error.message === publication.PUBLICATION_CONFIRMATION_ERROR);
    const legacy = { id, title: 'Legacy without parser defaults', mode: 'form', questions: [{ id: 'q', title: 'Choose', type: 'multiple_choice', options: [{ id: 'a', label: 'First' }] }] };
    const legacyReceipt = { version: 1, formId: id, fingerprint: publication.publicationFingerprint(legacy) };
    assert.deepEqual(publication.parsePublicationReceipt(legacyReceipt, id), legacyReceipt);
    const large = { ...a, title: 'x'.repeat(2 * 1024 * 1024 + 1) }, largeReceipt = { version: 1, formId: id, fingerprint: publication.publicationFingerprint(large) };
    assert.deepEqual(publication.parsePublicationReceipt(largeReceipt, id), largeReceipt);
    console.log('PASS receipt rejects malformed/foreign/noncanonical data without normalizing legacy content or imposing a new large-form limit');

    for (const patch of [(_res, body) => Response.json({ success: true, url: body.url }), (_res, body) => Response.json({ ...body, publication: { ...body.publication, formId: 'foreign' } }), () => new Response('unreadable', { status: 200 })]) {
      const result = await exercise('unverified successful publication response', null, null, null, patch);
      assert.equal(result.success, false); assert.equal(result.liveFingerprint, ''); assert.equal(result.readiness, false); assert.equal(result.error, publication.PUBLICATION_CONFIRMATION_ERROR); assert.equal(result.unverified, true);
    }
    console.log('PASS missing/malformed successful receipts preserve local draft and cannot show publication success or guessed live identity');

    memory.clear(); await records.writeRecord('forms', id, owner, a, 0);
    publicationWriteHook = async () => { await records.writeRecord('forms', id, owner, b); };
    const response = await route.POST(request(), context); publicationWriteHook = null;
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const received = await response.json(); assert.equal(received.success, true); assert.equal(received.url, `/play/${id}`);
    assert.equal(received.publication.fingerprint, publication.publicationFingerprint(a));
    assert.equal(memory.get('forms:' + id).payload.title, b.title); assert.equal(memory.get('published:' + id).payload.title, a.title);
    assert.deepEqual(Object.keys(received).sort(), ['publication', 'success', 'url']);
    console.log('PASS server receipt is derived from the source written by this request, not a newer draft reread');

    for (const who of [null, 'foreign-owner']) {
      actor = who; const rejected = await route.POST(request(), context); assert.equal(rejected.status, who === null ? 401 : 404); assert.equal(rejected.headers.get('cache-control'), 'private, no-store'); assert.equal('publication' in await rejected.json(), false);
    }
    actor = owner;
    const crossOrigin = await route.POST(new Request(`http://127.0.0.1:3164/api/forms/${id}/publish`, { method: 'POST', headers: { Origin: 'https://foreign.invalid' } }), context); assert.equal(crossOrigin.status, 403); assert.equal(crossOrigin.headers.get('cache-control'), 'private, no-store'); assert.equal('publication' in await crossOrigin.json(), false);
    failPublication = true; const failed = await route.POST(request(), context); failPublication = false;
    assert.ok(failed.status >= 400); assert.equal(failed.headers.get('cache-control'), 'private, no-store'); assert.equal('publication' in await failed.json(), false);
    console.log('PASS private owner-only receipts appear only after successful write; auth/origin/write errors retain no-store and omit content');
    console.log('5 publication receipt regression groups passed; actual source handler/route, in-memory data only.');
  }
} finally { Module._load = originalLoad; global.fetch = originalFetch; } })().catch(error => { console.error(error); process.exitCode = 1; });
