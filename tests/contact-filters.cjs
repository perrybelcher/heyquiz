const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
process.env.TZ='Europe/London';
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {contactScore,contactResultKey,contactResultOptions,emptyContactFilters,filterContacts,contactFilterError,contactPage}=require('../lib/contact-filters.ts');
const {contactExportRows,contactsCsv}=require('../lib/contacts.ts');
const fixture=(id,patch={})=>({id,formId:'qa-contacts',submittedAt:'2026-10-01T10:00:00Z',totalPointsPossible:10,totalPointsEarned:5,percentageScore:50,passed:false,totalQuestions:1,grading:[],answers:{q:'a'},contact:{email:'same@example.com',name:id,phone:'0123456789',marketingConsent:true,recordedAt:'2026-10-01T10:00:00Z',consentText:'Optional updates',placement:'before_results',privacyUrl:'https://example.com/privacy',formRevision:2,purposeText:'Send your results'},...patch});
const marketing=(kind,patch={})=>({kind,status:kind==='scorecard'?'scored':'matched',title:'Saved result',message:'Useful result',outcomeId:'outcome',reasons:[],categories:[],...patch});
const filters=patch=>({...emptyContactFilters,...patch});
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name);};
test('Scores reflect the frozen mode, never legacy marketing 100',()=>{
 assert.equal(contactScore(fixture('zero',{percentageScore:0})).value,0);
 for(const kind of ['product_finder','segmentation'])assert.deepEqual(contactScore(fixture(kind,{percentageScore:100,marketing:marketing(kind)})),{kind:'none',value:null,label:'No percentage score'});
 assert.equal(contactScore(fixture('overall',{marketing:marketing('scorecard',{overallScore:0})})).value,0);
 assert.equal(contactScore(fixture('hundred',{marketing:marketing('scorecard',{overallScore:100})})).value,100);
 for(const overallScore of [null,undefined,NaN,Infinity,-1,101])assert.equal(contactScore(fixture('unscored',{marketing:marketing('scorecard',{overallScore,categories:[{id:'a',title:'A',score:70}]})})).value,null);
 assert.equal(contactScore(fixture('survey',{totalPointsPossible:0,percentageScore:100})).value,null);
 assert.equal(contactScore(fixture('broken',{percentageScore:NaN})).value,null);
});
test('Search is trimmed/case-insensitive and includes saved knowledge tiers',()=>{
 const rows=[fixture('one',{matchedTier:{id:'tier',title:'Earlier confidence'}}),fixture('two',{marketing:marketing('segmentation',{title:'New direction'})})];
 assert.deepEqual(filterContacts(rows,filters({query:' EARLIER CONFIDENCE '})).map(r=>r.id),['one']);
 for(const query of ['SAME@example.com','012345','new direction'])assert.ok(filterContacts(rows,filters({query})).length);
 assert.equal(filterContacts(rows,filters({query:'undefined'})).length,0);
});
test('Saved result identities retain renamed, removed, duplicate-title and repeated attempts',()=>{
 const rows=[fixture('old',{marketing:marketing('product_finder',{title:'Original name'})}),fixture('new',{marketing:marketing('product_finder',{title:'Renamed result'})}),fixture('retake',{marketing:marketing('product_finder',{title:'Original name'})}),fixture('other',{marketing:marketing('product_finder',{title:'Original name',outcomeId:'another'})})];
 const options=contactResultOptions(rows);assert.equal(options.length,3);assert.equal(options.find(o=>o.value===contactResultKey(rows[0])).count,2);assert.equal(new Set(options.map(o=>o.label)).size,3);
 assert.deepEqual(filterContacts(rows,filters({result:contactResultKey(rows[0])})).map(r=>r.id),['old','retake']);
});
test('Missing legacy consent is not affirmative marketing permission',()=>{
 const yes=fixture('yes'),no=fixture('no'),legacy=fixture('legacy');no.contact.marketingConsent=false;delete legacy.contact.marketingConsent;
 assert.deepEqual(filterContacts([yes,no,legacy],filters({consent:'yes'})).map(r=>r.id),['yes']);
 assert.deepEqual(filterContacts([yes,no,legacy],filters({consent:'no'})).map(r=>r.id),['no','legacy']);
});
test('Date ranges use inclusive local days and survive daylight-saving transitions',()=>{
 const rows=[fixture('before',{submittedAt:'2026-03-28T23:59:59.999Z'}),fixture('first',{submittedAt:'2026-03-29T00:00:00.000Z'}),fixture('last',{submittedAt:'2026-03-29T22:59:59.999Z'}),fixture('after',{submittedAt:'2026-03-29T23:00:00.000Z'}),fixture('bad',{submittedAt:'missing'})];
 assert.deepEqual(filterContacts(rows,filters({from:'2026-03-29',to:'2026-03-29'})).map(r=>r.id),['first','last']);
 assert.equal(filterContacts(rows,filters()).length,5,'unknown dates stay accessible without date filtering');
});
test('Date, consent, result, search and inclusive score bounds combine',()=>{
 const common={marketing:marketing('scorecard',{overallScore:50})};
 const chosen=fixture('chosen',common), declined=fixture('declined',{...common,contact:{...chosen.contact,marketingConsent:false}}), old=fixture('old',{...common,submittedAt:'2026-09-01T10:00:00Z'}), low=fixture('low',{marketing:marketing('scorecard',{overallScore:49})});
 const result=filterContacts([chosen,declined,old,low],filters({query:'example.com',from:'2026-10-01',to:'2026-10-01',consent:'yes',result:contactResultKey(chosen),minScore:'50',maxScore:'50'}));assert.deepEqual(result.map(r=>r.id),['chosen']);
});
test('Unavailable scores never become zero or qualify for numeric ranges',()=>{
 const rows=[fixture('zero',{percentageScore:0}),fixture('product',{marketing:marketing('product_finder')}),fixture('category',{marketing:marketing('scorecard',{categories:[{id:'a',title:'A',score:60}]})}),fixture('survey',{totalPointsPossible:0})];
 assert.deepEqual(filterContacts(rows,filters({minScore:'0',maxScore:'0'})).map(r=>r.id),['zero']);
 assert.equal(filterContacts(rows,filters({score:'unscored'})).length,3);assert.equal(filterContacts(rows,filters({score:'scored'})).length,1);
});
test('Invalid ranges surface an error and cannot silently broaden results',()=>{
 for(const patch of [{from:'2026-02-30'},{from:'2026-10-02',to:'2026-10-01'},{minScore:'80',maxScore:'20'},{minScore:'-1'},{maxScore:'101'},{maxScore:'NaN'}]){assert.ok(contactFilterError(filters(patch)));assert.deepEqual(filterContacts([fixture('a')],filters(patch)),[]);}
 assert.equal(contactFilterError(filters({minScore:'0',maxScore:'100'})),'');
});
test('Pagination keeps 25 rows, clamps stale pages and does not deduplicate emails',()=>{
 const rows=Array.from({length:62},(_,i)=>fixture(String(i)));assert.equal(contactPage(rows,1).rows.length,25);assert.equal(contactPage(rows,3).rows.length,12);assert.equal(contactPage(rows,99).page,3);assert.equal(contactPage(rows,-1).page,1);assert.equal(contactPage([],1).start,0);assert.equal(contactPage([],1).end,0);assert.equal(filterContacts(rows,filters()).length,62);
});
test('CSV preserves existing columns/consent, with corrected primary score and explicit legacy grading',()=>{
 const rows=[fixture('knowledge'),fixture('product',{percentageScore:100,marketing:marketing('product_finder')}),fixture('scorecard',{percentageScore:100,marketing:marketing('scorecard',{overallScore:32,categories:[{id:'a',title:'A',score:null}]})})];
 const exported=contactExportRows(rows);assert.equal(exported[0].score,50);assert.equal(exported[1].score,'');assert.equal(exported[1].legacyKnowledgeScorePercent,100);assert.equal(exported[2].score,32);assert.equal(exported[2].scoreType,'scorecard');assert.equal(exported[2].scorecardCategoryScores[0].score,null);
 const originalColumns=['responseId','submittedAt','email','name','phone','marketingConsent','consentText','recordedAt','privacyUrl','formRevision','purposeText','placement','result','score','answers'];
 assert.deepEqual(Object.keys(exported[0]).slice(0,originalColumns.length),originalColumns,'original CSV columns keep their order');
 assert.equal(exported[0].purposeText,'Send your results');assert.equal(exported[0].formRevision,2);
});
test('CSV neutralizes formulas and preserves quotes/newlines across the full filtered set',()=>{
 const rows=Array.from({length:62},(_,i)=>fixture(String(i)));rows[0].contact={...rows[0].contact,name:'=HYPERLINK("test")',phone:' +123',consentText:'First line\nSecond line'};
 const csv=contactsCsv(contactExportRows(rows));assert.ok(csv.includes(`"'=HYPERLINK(""test"")"`));assert.ok(csv.includes(`"' +123"`));assert.ok(csv.includes('"First line\nSecond line"'));assert.ok(csv.includes('"61"'));
});
console.log(`${count} contact-filter scenarios passed.`);
