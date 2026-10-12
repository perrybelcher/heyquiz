const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { safeCreationReturn, creationReturnFromSearch, creationAuthHref, creationAuthDestination, rememberCreationReturn, CREATION_RETURN_KEY } = require('../lib/creation-auth-return.ts');
const now = 1_800_000_000_000;
function store() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; }
for (const path of ['/create/ai', '/create/marketing']) {
  assert.equal(safeCreationReturn(path), path);
  assert.equal(creationReturnFromSearch(`?next=${encodeURIComponent(path)}`), path);
  assert.equal(creationAuthHref('/login', path), `/login?next=${encodeURIComponent(path)}`);
  const tab = store(); rememberCreationReturn(path, tab, now);
  assert.equal(creationAuthDestination('/', '', tab, now + 1), path);
  assert.equal(tab.getItem(CREATION_RETURN_KEY), null);
  assert.equal(creationAuthDestination('/', '', tab, now + 2), '/');
}
for (const unsafe of ['//evil.test', '/\\evil.test', 'https://evil.test/create/ai', '/create/ai?x=1', '/create/ai#x', '/create/ai/', '/create/ai\n', '/editor/x', '%2Fcreate%2Fai', null, {}]) {
  assert.equal(safeCreationReturn(unsafe), null);
  assert.equal(creationAuthHref('/login', unsafe), '/login');
}
assert.equal(creationReturnFromSearch('?next=/create/ai&next=/create/marketing'), null);
const tab = store();
rememberCreationReturn('/create/marketing', tab, now);
assert.equal(creationAuthDestination('/', '?next=%2Fcreate%2Fai', tab, now + 1), '/create/ai');
assert.equal(tab.getItem(CREATION_RETURN_KEY), null);
rememberCreationReturn('/create/marketing', tab, now);
assert.equal(creationAuthDestination('/', '?next=//evil.test', tab, now + 1), '/');
rememberCreationReturn('/create/ai', tab, now);
assert.equal(creationAuthDestination('/reset-password', '?next=/create/marketing', tab, now + 1), '/reset-password');
assert.ok(tab.getItem(CREATION_RETURN_KEY), 'recovery must not consume a signup return');
assert.equal(creationAuthDestination('/', '?reset=success&next=/create/ai', tab, now + 1), '/');
assert.equal(tab.getItem(CREATION_RETURN_KEY), null);
rememberCreationReturn('/create/ai', tab, now);
assert.equal(creationAuthDestination('/', '', tab, now + 24 * 60 * 60 * 1000), '/');
for (const payload of ['{bad', '{}', JSON.stringify({ next: '//evil.test', expiresAt: now + 1 }), JSON.stringify({ next: '/create/ai', expiresAt: now + 99 * 24 * 60 * 60 * 1000 })]) {
  tab.setItem(CREATION_RETURN_KEY, payload);
  assert.equal(creationAuthDestination('/', '', tab, now), '/');
}
const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
assert.doesNotThrow(() => rememberCreationReturn('/create/ai', blocked, now));
assert.equal(creationAuthDestination('/', '?next=/create/ai', blocked, now), '/create/ai');
assert.equal(creationAuthDestination('/', '', blocked, now), '/');
rememberCreationReturn('/create/ai', tab, now);
assert.equal(creationAuthDestination('/', '', store(), now), '/', 'new tabs do not inherit tab-scoped signup state');
console.log('PASS creation auth return: two exact destinations; encoded/duplicate/foreign path rejection; explicit next/reset precedence; one-use same-tab signup return; recovery unchanged; expiry/corruption/blocked storage/new-tab fallback.');
