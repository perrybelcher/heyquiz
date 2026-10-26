const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, file);
const {editorSection} = require('../lib/editor-navigation.ts');
const source = ts.createSourceFile('EditorStudio.tsx', fs.readFileSync(require.resolve('../components/EditorStudio.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).startsWith('() => registerWorkspaceNavigationGuard(')) callback = node.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(callback, 'Test the actual registered editor departure callback');
const compiled = ts.transpileModule(`const effect = ${callback}; return effect;`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
function fixture(initial = {}, save = async () => true, confirm = () => true) {
  const state = {current: {guestDraft: false, backedUp: true, accountKey: 'synthetic-owner', ...initial}};
  let guard, error = '', prompts = 0, saves = 0;
  const effect = new Function('registerWorkspaceNavigationGuard', 'departureState', 'saveNow', 'setActionError', 'window', compiled)(
    callback => { guard = callback; return () => {}; }, state, async () => { saves++; return save(); }, value => { error = value; }, {confirm: text => { prompts++; return confirm(text); }},
  );
  effect(); return {state, run: () => guard(), get error() {return error;}, get prompts() {return prompts;}, get saves() {return saves;}};
}
(async () => {
  for (const section of ['edit', 'contacts', 'marketing', 'integrate', 'share', 'results']) assert.equal(editorSection(section), section);
  for (const invalid of [undefined, null, ['results'], 'results&other=1', '//example.test', 'unknown']) assert.equal(editorSection(invalid), 'edit');
  let app = fixture(); assert.equal(await app.run(), true); assert.equal(app.saves, 1);
  app = fixture({}, async () => false); assert.equal(await app.run(), false); assert.equal(app.prompts, 0);
  let finish;
  app = fixture({}, () => new Promise(resolve => {finish = resolve;}));
  const departing = app.run();
  app.state.current = {...app.state.current, emailCopyDraft: {subject: 'New edit during save'}, emailCopyStorageWarning: true};
  finish(true); assert.equal(await departing, false); assert.match(app.error, /recovery copy/); assert.equal(app.prompts, 0);
  app = fixture({reportDesignDraft: {layout: 'pending'}}, undefined, () => false); assert.equal(await app.run(), false); assert.equal(app.prompts, 1);
  app = fixture({reportDesignDraft: {layout: 'pending'}}); assert.equal(await app.run(), true); assert.equal(app.prompts, 1);
  app = fixture({guestDraft: true, backedUp: false}); assert.equal(await app.run(), false); assert.equal(app.saves, 0); assert.match(app.error, /persistent recovery/);
  app = fixture({guestDraft: true}); assert.equal(await app.run(), true); assert.equal(app.saves, 0); assert.equal(app.prompts, 1);
  console.log('PASS editor workspace navigation: safe section parsing, acknowledged save, failed save, edits arriving during save, unapplied panels, and persistent guest recovery.');
})().catch(error => {console.error(error); process.exitCode = 1;});
