const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {productFinderTemplates}=require('../lib/authored-templates/product-finder.ts');
const {qualificationTemplates}=require('../lib/authored-templates/qualification.ts');
const {evaluateMarketing,validateMarketing}=require('../lib/marketing.ts');
const {resolvePath}=require('../lib/engine.ts');
const fixtures=require('./fixtures/authored-templates-b.json');
const all=[...productFinderTemplates,...qualificationTemplates];
const form=id=>all.find(t=>t.id===id).build('test-'+id);
const result=(id,answers)=>evaluateMarketing(form(id),answers);
function expect(id,answers,outcomeId){assert.equal(result(id,answers).outcomeId,outcomeId,`${id} ${JSON.stringify(answers)}`);}
assert.equal(all.length,6);assert.equal(all.reduce((n,t)=>n+t.build('count').questions.length,0),92);
for(const t of all){
 const f=t.build('first'),other=t.build('second'),fx=fixtures[t.id];
 assert.equal(f.questions.length,t.featured?30:8);assert.equal(f.quizType,t.quizType);assert.equal(f.title,t.title);
 assert.equal(new Set(f.questions.map(q=>q.id)).size,f.questions.length);
 assert.equal(f.marketing.outcomes.length,3);assert.ok(f.description.length>100);
 for(const q of f.questions){assert.ok(q.title.length>15);assert.ok(q.description);for(const o of q.options||[])assert.ok(o.label.trim());assert.ok(Object.hasOwn(fx.answers,q.id));}
 assert.equal(resolvePath(f,fx.answers).questions.length,f.questions.length);expect(t.id,fx.answers,fx.outcomeId);
 const original=other.questions[0].title;f.questions[0].title='changed';assert.equal(other.questions[0].title,original);assert.equal(t.build('third').questions[0].title,original);
 validateMarketing(other,false);if(t.quizType==='qualification')assert.throws(()=>validateMarketing(other,true),/URL/);
 other.marketing.outcomes.forEach(o=>o.ctaUrl='https://example.test/next');validateMarketing(other,true);
 assert.equal(result(t.id,{}).status,'no_match');
 const neutral=Object.fromEntries(other.questions.filter(q=>q.options).map(q=>[q.id,`${q.id}-unknown`]));assert.equal(result(t.id,neutral).status,'no_match');
}
// Literal evidence paths for every recommendation, plus tie order and hard requirements.
for(const [id,a,b,c,prefix] of [['website-package-30','presence','services','shop','w'],['ideal-coffee-8','bright','balanced','decaf','c'],['best-workspace-8','day-pass','dedicated-desk','private-office','s']]){
 expect(id,{[`${prefix}01`]:`${prefix}01-a`},a);expect(id,{[`${prefix}01`]:`${prefix}01-b`},b);expect(id,{[`${prefix}01`]:`${prefix}01-c`},c);
 expect(id,{[`${prefix}01`]:`${prefix}01-a`,[`${prefix}${prefix==='c'?'04':'02'}`]:`${prefix}${prefix==='c'?'04':'02'}-b`},a);
}
expect('website-package-30',{w01:'w01-a',w02:'w02-a',w03:'w03-b',w16:'w16-c'},'shop');
expect('ideal-coffee-8',{c01:'c01-a',c02:'c02-a',c04:'c04-b',c03:'c03-c'},'decaf');
expect('best-workspace-8',{s01:'s01-a',s03:'s03-a',s04:'s04-b',s02:'s02-c'},'private-office');
const ready={i01:'i01-a',i06:'i06-a',i11:'i11-a',i16:'i16-a',i21:4,i26:6};
expect('implementation-fit-30',ready,'pilot');expect('implementation-fit-30',{i01:'i01-b'},'scoping');expect('implementation-fit-30',{i01:'i01-c'},'preparation');
for(const [key,value] of [['i21',3.9999999],['i26',5.9999999],['i21',0]])expect('implementation-fit-30',{...ready,[key]:value},'preparation');
expect('implementation-fit-30',{...ready,i21:4.01,i26:6.01},'pilot');
expect('implementation-fit-30',{...ready,i01:'i01-b',i21:2},'preparation');
for(const value of [undefined,'',null,'not known',-1,81])expect('implementation-fit-30',{...ready,i21:value},undefined);
for(const key of ['i01','i06','i11','i16'])expect('implementation-fit-30',{...ready,[key]:`${key}-unknown`},undefined);
expect('renovation-next-step-8',{r01:'r01-b',r02:'r02-a',r03:1},'assessment'); // overlaps preparation; assessment first
expect('renovation-next-step-8',{r01:'r01-a',r02:'r02-a',r03:4},'brief');
expect('renovation-next-step-8',{r01:'r01-a',r02:'r02-a',r03:3.9999999},'research');
expect('renovation-next-step-8',{r02:'r02-b'},'research');expect('renovation-next-step-8',{r01:'r01-b',r02:'r02-unknown'},undefined);
expect('training-route-8',{t01:'t01-a',t02:2,t03:'t03-a'},'applied');
expect('training-route-8',{t01:'t01-b',t02:1,t03:'t03-a'},'foundations');expect('training-route-8',{t01:'t01-c',t02:1,t03:'t03-a'},'foundations');
expect('training-route-8',{t01:'t01-a',t02:1.9999999,t03:'t03-a'},'orientation');expect('training-route-8',{t01:'t01-b',t02:0.9999999,t03:'t03-a'},'orientation');
expect('training-route-8',{t03:'t03-b'},'orientation');expect('training-route-8',{t01:'t01-a',t02:2,t03:'t03-unknown'},undefined);
// Context never changes an eligible route; styling does not affect results.
const context=form('implementation-fit-30');const answers={...ready,i02:'i02-c',i30:'i30-unknown'};
assert.equal(evaluateMarketing(context,answers).outcomeId,'pilot');context.theme.primaryColor='#111111';assert.equal(evaluateMarketing(context,answers).outcomeId,'pilot');
console.log('PASS stream B: six templates /92 questions, full-path literal fixtures, all 18 outcomes, independent drafts, neutral/tie/exclusion/priority/exact numeric boundary/unknown cases and publication requirements');

expect('ideal-coffee-8',{c03:'c03-a'},undefined);expect('ideal-coffee-8',{c03:'c03-b'},undefined);expect('ideal-coffee-8',{c02:'c02-a',c05:'c05-c',c07:'c07-a',c08:'c08-b'},undefined);
