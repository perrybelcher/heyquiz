const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {evaluateMarketing,validateMarketing,MarketingSchema}=require('../lib/marketing.ts');
const {marketingTemplate}=require('../lib/marketing-templates.ts');
const {publicForm}=require('../lib/engine.ts');
const form=marketingTemplate('scorecard','bands-test');
const bands=[{id:'low',min:0,max:49,title:'Foundation',advice:'Build a routine',action:'Choose an owner',ctaLabel:'Get the guide',ctaUrl:'https://example.com/guide'},{id:'high',min:50,max:100,title:'Ready to grow',advice:'Review your results weekly',action:'Review results',ctaLabel:'Book a call',ctaUrl:'https://example.com/book'}];
form.marketing=MarketingSchema.parse({...form.marketing,scorecard:{bands},categories:form.marketing.categories.map(c=>({...c,bands}))});
validateMarketing(form,true);
let r=evaluateMarketing(form,{capture:'a2',followup:'a2',measure:'a2'});
assert.equal(r.overallScore,0);assert.equal(r.title,'Foundation');assert.equal(r.ctaUrl,'https://example.com/guide');assert.equal(r.categories[0].advice,'Build a routine');assert.equal(r.priorities.length,2);
r=evaluateMarketing(form,{capture:'a0',followup:'a1',measure:'a2'});
assert.equal(r.overallScore,38);assert.equal(r.priorities[0].categoryId,r.categories[1].id);
r=evaluateMarketing(form,{capture:'a1',followup:'a1',measure:'a1'});
assert.equal(r.overallScore,50);assert.equal(r.outcomeId,'high');assert.equal(r.ctaUrl,'https://example.com/book');
r=evaluateMarketing(form,{capture:'a0',followup:'a0',measure:'a3'});
assert.equal(r.overallScore,null);assert.equal(r.ctaUrl,undefined);assert.equal(r.categories[1].advice,undefined);
for(const [patch,pattern] of [[{min:49},/overlap/],[{min:51},/every percentage/],[{max:99},/end at 100/],[{min:100,max:50},/minimum/]]){
 const f=structuredClone(form);Object.assign(f.marketing.scorecard.bands[1],patch);assert.throws(()=>validateMarketing(f,true),pattern);
}
assert.equal(publicForm(form).marketing.scorecard,undefined);
const old=marketingTemplate('scorecard','legacy');assert.equal(evaluateMarketing(old,{capture:'a0',followup:'a0',measure:'a0'}).title,'Your scorecard');assert.equal(evaluateMarketing(old,{}).overallScore,undefined);
assert.equal(MarketingSchema.safeParse({...form.marketing,scorecard:{bands:[{...bands[0],ctaUrl:'javascript:alert(1)'}]}}).success,false);
console.log('PASS score bands, 0/50 boundaries, coverage gating, priority order, range validation, safe URLs, legacy compatibility and public data redaction');
