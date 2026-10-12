const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const helperPath = require.resolve('../lib/guest-draft.ts');
const { FormSchema } = require('../lib/schema.ts');
function fresh() { delete require.cache[helperPath]; return require(helperPath); }
const { readGuestDraft } = fresh();
const form = FormSchema.parse({ id: 'recovery-owned', title: 'Device draft', mode: 'quiz', questions: [] });
const sessionForm = { ...form, title: 'Current tab draft' };
const key = `heyquiz-draft:${form.id}`;
const localRows = new Map([['pippi-guest-draft', form.id], [key, JSON.stringify(form)]]);
const sessionRows = new Map([[key, JSON.stringify(sessionForm)]]);
const local = { getItem: id => localRows.get(id) ?? null };
const session = { getItem: id => sessionRows.get(id) ?? null };
const blocked = { getItem() { throw Error('Storage blocked'); } };
const before = JSON.stringify([...localRows]);
assert.equal(readGuestDraft(local, session).title, 'Current tab draft');
assert.equal(readGuestDraft(local, blocked).title, 'Device draft');
assert.equal(readGuestDraft(blocked, session, form.id).title, 'Current tab draft', 'explicit builder-tab ID allows valid session recovery when local reads throw');
assert.equal(readGuestDraft(blocked, session), null, 'without a readable pointer or explicit ID there is no safe draft to select');
sessionRows.set(key, '{broken');
assert.equal(readGuestDraft(local, session).title, 'Device draft');
sessionRows.set(key, JSON.stringify({ ...sessionForm, id: 'wrong-id' }));
assert.equal(readGuestDraft(local, session).title, 'Device draft');
assert.equal(readGuestDraft(local, session, 'missing-id'), null);
assert.equal(readGuestDraft({ getItem: () => '{broken' }, session, form.id), null);
assert.equal(JSON.stringify([...localRows]), before, 'read helper never mutates the device copy or pointer');

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
function performanceEntry(entry) {
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { getEntriesByType: kind => { assert.equal(kind, 'navigation'); return entry ? [entry] : []; } } });
}
try {
  for (const type of ['navigate', 'back_forward', 'prerender']) {
    performanceEntry({ type, name: 'http://127.0.0.1:3170/create/blank' });
    assert.equal(fresh().recoverBuilderReload('/create/blank'), false);
  }
  performanceEntry(null);
  assert.equal(fresh().recoverBuilderReload('/create/blank'), false);
  performanceEntry({ type: 'reload', name: 'not a URL' });
  assert.equal(fresh().recoverBuilderReload('/create/blank'), false);
  performanceEntry({ type: 'reload', name: 'http://127.0.0.1:3170/create/blank?example=1#section' });
  let { recoverBuilderReload } = fresh();
  assert.equal(recoverBuilderReload('/create/guided'), false, 'reload on another path cannot restore a wizard during later client navigation');
  assert.equal(recoverBuilderReload('/create/blank'), true, 'the actual document reload is recoverable once');
  assert.equal(recoverBuilderReload('/create/blank'), false, 'StrictMode replay cannot recover again');
  assert.equal(recoverBuilderReload('/create/guided'), false, 'later client navigation cannot claim the original blank reload');
  assert.equal(recoverBuilderReload('/create/blank'), false, 'returning through the client router starts a fresh blank');
  performanceEntry({ type: 'reload', name: 'http://127.0.0.1:3170/create/guided' });
  ({ recoverBuilderReload } = fresh());
  assert.equal(recoverBuilderReload('/create/blank'), false);
  assert.equal(recoverBuilderReload('/create/guided'), true);
  assert.equal(recoverBuilderReload('/create/guided'), false);
  assert.equal(fresh().recoverBuilderReload('/create/guided'), true, 'a new document/module lifecycle permits the next real reload');
} finally {
  if (descriptor) Object.defineProperty(globalThis, 'performance', descriptor);
  else delete globalThis.performance;
}
console.log('PASS guest-draft recovery: session precedence, corrupt/wrong-ID fallback, independent storage failure, read-only pointers, exact reload pathname, once-only StrictMode replay and later client-navigation exclusion.');
