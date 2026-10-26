// Isolated records only; no provider calls or production configuration.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const load = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'next/headers') return { cookies: async () => ({ get: () => undefined }) };
  if (name === 'next/navigation') return { redirect() { throw Error('Unexpected redirect'); } };
  return load.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, main);
};
for (const key of Object.keys(process.env)) if (key.startsWith('SUPABASE_')) delete process.env[key];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pippi-choice-publication-'));
process.env.HEYQUIZ_DATA_DIR = root;
const { FormSchema } = require('../lib/schema.ts');
const { singleTypes, multiTypes, choiceQuestionProblems } = require('../lib/engine.ts');
const { getPublishReadiness } = require('../lib/publish-readiness.ts');
const { saveForm, publishForm, getPublishedForm } = require('../lib/storage.ts');
const { reportActivity } = require('../lib/report-activity.ts');
(async () => {
  try {
    for (const type of [...singleTypes, ...multiTypes]) {
      const form = FormSchema.parse({ id: `audit-${type}`, title: 'Choice quiz', mode: 'survey', questions: [{ id: 'q', type, title: 'Choose one', required: true, options: [] }] });
      let saved = await saveForm(form, 'audit-owner');
      assert.equal(saved.revision, 1, 'Incomplete draft remains saveable');
      assert.equal(getPublishReadiness(saved).blockers.some(item => item.code === 'choice-answers'), true);
      await assert.rejects(() => publishForm(saved, 'audit-owner'), /at least two answers/);
      assert.equal(await getPublishedForm(saved.id), null);
      saved.questions[0].options = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
      saved = await saveForm(saved, 'audit-owner');
      await publishForm(saved, 'audit-owner');
      assert.equal((await getPublishedForm(saved.id)).questions[0].options.length, 2);
      saved.questions[0].options[0].label = '  ';
      assert.equal(choiceQuestionProblems(saved).length, 1);
      await assert.rejects(() => publishForm(saved, 'audit-owner'), /each with a label/);
      assert.equal((await getPublishedForm(saved.id)).questions[0].options[0].label, 'A', 'Rejected publication preserves the live snapshot');
    }
    const activity = reportActivity([{ formId:'one', submittedAt:'2026-01-01' }, { formId:'two', submittedAt:'2026-02-01' }, { formId:'one', submittedAt:'2026-03-01' }, { formId:'one', submittedAt:'invalid' }]);
    assert.deepEqual(activity.get('one'), { responseCount:3, latestResponseAt:'2026-03-01' });
    assert.equal(activity.get('two').responseCount,1);
    assert.equal(activity.has('missing'),false);
    console.log('Choice publication: all 10 choice types reject unusable questions, retain drafts and preserve published snapshots; report activity aggregation passed.');
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
})().catch(error => { console.error(error); process.exitCode=1; });
