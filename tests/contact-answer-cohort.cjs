const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), { createHash } = require('node:crypto');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { questionSignature, historicalSelection } = require('../lib/answer-history.ts');
const { createContactAnswerCollector, historicalAnswerVersionId: versionId } = require('../lib/contact-answer-cohort-server.ts');
const { parseContactAnswerQuery, parseContactAnswerCohort, contactAnswerTypes, contactAnswerQuery, contactAnswerOptionLabel } = require('../lib/contact-answer-cohort.ts');
const { filterContacts, emptyContactFilters } = require('../lib/contact-filters.ts');
const { contactExportRows, contactsCsv } = require('../lib/contacts.ts');
let checks = 0; const test = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
const q = (patch = {}) => ({ id: 'choice', type: 'multiple_choice', title: 'Which direction fits?', options: [{ id: 'b', label: 'Build' }, { id: 'a', label: 'Explore' }], ...patch });
const form = (questions = [q()], extra = {}) => ({ id: 'quiz', questions, ...extra });
const row = (id, answers = { choice: 'a' }, extra = {}) => ({ id, formId: 'quiz', submittedAt: '2026-10-01T00:00:00.000Z', contact: { email: 'repeat@example.test', marketingConsent: true }, grading: [], answers, ...extra });
const entry = (id, answers, snapshot = form(), extra = {}) => [row(id, answers, extra), { form: snapshot, preview: false }];
const collect = (entries, selection = null) => { const c = createContactAnswerCollector(selection); entries.forEach(([r,a]) => c.add(r,a)); return c.finish(); };
const pair = { version: versionId(q()), option: 'a' };
test('Exact old analytics version signature and hash survive extraction and shuffling', () => {
  const signature = '["choice","multiple_choice","Which direction fits?",[{"id":"a","label":"Explore"},{"id":"b","label":"Build"}]]';
  assert.equal(questionSignature(q()), signature); assert.equal(pair.version, 'answer-version-' + createHash('sha256').update(signature).digest('hex').slice(0,20));
  assert.equal(versionId(q({ options: [...q().options].reverse() })), pair.version);
  for (const changed of [q({ title: 'New title' }), q({ options: [{ id: 'a', label: 'Different meaning' }] }), q({ id: 'new' }), q({ type: 'dropdown' })]) assert.notEqual(versionId(changed), pair.version);
});
test('All ten supported discrete types use ID membership; multi is contains, with valid numeric legacy singles', () => {
  for (const type of contactAnswerTypes) {
    const multi = ['multiselect', 'checkboxes', 'image_multiselect'].includes(type), question = q({ type });
    const data = collect([entry('yes', { choice: multi ? ['b','a','a'] : 'a' }, form([question])), entry('no', { choice: multi ? ['b'] : 'b' }, form([question]))], { version: versionId(question), option: 'a' });
    assert.deepEqual(data.matchingIds, ['yes']); assert.equal(data.counts.answered, 2);
  }
  assert.deepEqual(historicalSelection(q({ options: [{ id: '0', label: 'Zero' }] }), 0), { status: 'answered', selected: ['0'] });
  assert.deepEqual(historicalSelection(q({ type:'checkbox' }), false), { status: 'answered', selected:['false'] });
});
test('Unanswered, invalid and partly invalid multi values never become option matches', () => {
  const values = [undefined, null, '', [], false, {}, ['a'], 'unknown', Infinity];
  const data = collect(values.map((v,i) => entry('r'+i, { choice:v })), pair);
  assert.deepEqual(data.counts, { answered:0, unanswered:4, skipped:0, otherVersion:0, unavailable:0, invalid:5 }); assert.deepEqual(data.matchingIds, []);
  const multi = q({ type:'multiselect' });
  for (const bad of [['a','unknown'], ['a',1], 'a', { selected:'a' }]) assert.equal(historicalSelection(multi,bad).status,'invalid');
});
test('Frozen show/hide and jump routing exclude stray skipped values and retain page order', () => {
  const route = q({ id:'route', title:'Route', options:[{id:'short',label:'Short'},{id:'long',label:'Long'}] });
  const branching = form([route,q()], { logicRules:[{id:'show',sourceQuestionId:'route',operator:'equals',value:'long',action:'show_question',targetQuestionId:'choice'}] });
  const hide = form([route,q()], { logicRules:[{id:'hide',sourceQuestionId:'route',operator:'equals',value:'short',action:'hide_question',targetQuestionId:'choice'}] });
  const ending = form([route,q()], { logicRules:[{id:'end',sourceQuestionId:'route',operator:'equals',value:'short',action:'jump_to_ending',targetOutcomeTierId:'done'}] });
  const jump = form([route,q(),q({id:'last'})], { logicRules:[{id:'jump',sourceQuestionId:'route',operator:'equals',value:'short',action:'jump_to_question',targetQuestionId:'last'}] });
  const paged = form([q({pageId:'second'}), {...route,pageId:'first'}], { pages:[{id:'first'},{id:'second'}], logicRules:branching.logicRules });
  const data = collect([entry('show-skip',{route:'short',choice:'a'},branching),entry('hide-skip',{route:'short',choice:'a'},hide),entry('end-skip',{route:'short',choice:'a'},ending),entry('jump-skip',{route:'short',choice:'a'},jump),entry('yes',{route:'long',choice:'a'},paged)], pair);
  assert.equal(data.counts.skipped,4); assert.deepEqual(data.matchingIds,['yes']);
});
test('Historical page fallback and optional ending targets intentionally match existing engine paths', () => {
  const fallback=form([q({pageId:'unknown-page'})],{pages:[{id:'first'}]});
  const route=q({id:'route',options:[{id:'stop',label:'Stop'}]});
  const ending=target=>form([route,q()],{logicRules:[{id:'end',sourceQuestionId:'route',operator:'equals',value:'stop',action:'jump_to_ending',...(target?{targetOutcomeTierId:target}:{})}]});
  const data=collect([entry('fallback',{choice:'a'},fallback),entry('default-end',{route:'stop',choice:'a'},ending()),entry('old-tier',{route:'stop',choice:'a'},ending('removed-tier'))],pair);
  assert.deepEqual(data.matchingIds,['fallback']);assert.equal(data.counts.skipped,2);assert.equal(data.counts.unavailable,0);
});
test('Missing raw answers/snapshots and broken routing are unavailable; other versions remain distinct', () => {
  const loop = form([q()], { logicRules:[{id:'loop',sourceQuestionId:'choice',operator:'equals',value:'a',action:'jump_to_question',targetQuestionId:'choice'}] });
  const unknown = form([q()], { logicRules:[{id:'bad',sourceQuestionId:'choice',operator:'equals',value:'a',action:'jump_to_question',targetQuestionId:'absent'}] });
  const entries = [[row('missing'),undefined], entry('raw',undefined), entry('loop',{choice:'a'},loop), entry('broken',{choice:'a'},unknown), entry('older',{choice:'a'},form([q({title:'Earlier'})])), entry('absent',{},form([]))];
  delete entries[1][0].answers;
  const data=collect(entries,pair); assert.deepEqual(data.counts,{answered:0,unanswered:0,skipped:0,otherVersion:2,unavailable:4,invalid:0}); assert.deepEqual(data.matchingIds,[]);
});
test('Snapshot shape/size and duplicate IDs fail closed; unsupported or private data never projected', () => {
  const cases=[form([q(),q()]),form([q({options:[{id:'a',label:'One'},{id:'a',label:'Two'}]})]),form([q({title:'x'.repeat(2001)})]),form([q({options:[]})])];
  for (const bad of cases) assert.equal(collect([entry('bad',{choice:'a'},bad)]).unavailableSnapshots,1);
  const privateForm=form([q({description:'PRIVATE DESCRIPTION',options:[{id:'a',label:'Explore',explanation:'PRIVATE KEY',imageUrl:'PRIVATE IMAGE'}]}),{id:'secret',type:'email',title:'PRIVATE FIELD'}, {id:'terms',type:'terms',title:'PRIVATE TERMS'}]);
  const data=collect([entry('response',{choice:'a',secret:'PRIVATE PERSON'},privateForm)]); assert.equal(data.versions.length,1); assert.ok(!JSON.stringify(data).includes('PRIVATE')); assert.ok(!JSON.stringify(data).includes('repeat@example'));
});
test('Same-label options remain separate and equal option IDs across versions never merge', () => {
  const same=q({options:[{id:'a',label:'Same'},{id:'b',label:'Same'}]}), data=collect([entry('a',{choice:'a'},form([same])),entry('b',{choice:'b'},form([same]))],{version:versionId(same),option:'a'});
  assert.deepEqual(data.matchingIds,['a']); assert.equal(contactAnswerOptionLabel(data.versions[0],data.versions[0].options[0]),'Same · Option a');
});
test('Catalog bounds disclose omissions and pin selected versions and options across refresh', () => {
  const entries=Array.from({length:65},(_,i)=>entry('r'+i,{choice:'a'},form([q({title:'Version '+i})])));
  const first=collect(entries); assert.equal(first.versions.length,60); assert.equal(first.omittedVersions,5);
  const omitted=entries.find(([,a])=>!first.versions.some(v=>v.id===versionId(a.form.questions[0]))), id=versionId(omitted[1].form.questions[0]);
  assert.ok(collect(entries,{version:id,option:'a'}).versions.some(v=>v.id===id));
  const many=q({options:Array.from({length:105},(_,i)=>({id:'o'+String(i).padStart(3,'0'),label:'Answer '+i}))});
  const pinned=collect([entry('r',{choice:'o104'},form([many]))],{version:versionId(many),option:'o104'}); assert.equal(pinned.versions[0].options.length,100); assert.equal(pinned.versions[0].omittedOptions,5); assert.ok(pinned.versions[0].options.some(o=>o.id==='o104'));
});
test('Invalid/duplicate/partial/stale queries fail without silently clearing answer condition', () => {
  assert.equal(parseContactAnswerQuery(new URLSearchParams()),null); assert.deepEqual(parseContactAnswerQuery(new URLSearchParams(contactAnswerQuery(pair).slice(1))),pair);
  for (const query of ['answerVersion='+pair.version,'answerOption=a','answerVersion=bad&answerOption=a','answerVersion='+pair.version+'&answerOption=a&answerOption=b','unexpected=yes']) assert.throws(()=>parseContactAnswerQuery(new URLSearchParams(query)));
  assert.throws(()=>collect([entry('r')],{version:pair.version,option:'removed'})); assert.throws(()=>collect([] ,pair));
});
test('Client rejects stale/incomplete sidecars, mismatched IDs and counts; strips extra payload keys', () => {
  const data=collect([entry('r')],pair); assert.deepEqual(parseContactAnswerCohort({...data,token:'PRIVATE'},['r'],pair),data);
  for (const bad of [undefined,{...data,matchingIds:['foreign']},{...data,matchingIds:['r','r']},{...data,counts:{...data.counts,answered:2}},{...data,selection:{...pair,option:'b'}},{...data,versions:[]}]) assert.throws(()=>parseContactAnswerCohort(bad,['r'],pair));
  assert.equal(parseContactAnswerCohort(undefined,[],null).versions.length,0);
});
test('Answer membership is ANDed with prior filters and exact all-page CSV never trusts stale pairs', () => {
  const entries=Array.from({length:60},(_,i)=>entry('r'+i,{choice:i<40?'a':'b'},form(),{contact:{email:'same@example.test',name:i===0?'=FORMULA()':'Example',marketingConsent:i<30}}));
  const data=collect(entries,pair), rows=entries.map(([r])=>r), filters={...emptyContactFilters,answerVersion:pair.version,answerOption:'a',consent:'yes'};
  const matching=filterContacts(rows,filters,{},data); assert.equal(matching.length,30); assert.equal(filterContacts(rows,filters,{},null).length,0); assert.equal(filterContacts(rows,{...filters,answerOption:'b'},{},data).length,0);
  const csv=contactsCsv(contactExportRows(matching)); assert.ok(csv.includes("'=FORMULA()")); assert.equal(contactExportRows(matching).length,30); assert.equal(filterContacts(rows,{...emptyContactFilters,answerVersion:pair.version},{},data).length,60);
});
console.log(`${checks} historical answer cohort scenarios passed.`);
