const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {evaluateMarketing,MarketingSchema,validateMarketing}=require('../lib/marketing.ts');
const {FormSchema}=require('../lib/schema.ts');
const {marketingTemplate}=require('../lib/marketing-templates.ts');
const {scorecardForm}=require('./fixtures/result-layouts.cjs');
const layouts=['stacked','score_overview','action_plan'];
const withoutPresentation=result=>{const {presentation,...rest}=result;return rest;};
const scoredAnswers=[{capture:'a0',followup:'a0',measure:'a0'},{capture:'a2',followup:'a2',measure:'a2'},{capture:'a2',followup:'a2',measure:'a0'},{capture:'a3',followup:'a0',measure:'a0'},{}];
for(const answers of scoredAnswers){
  const baseline=evaluateMarketing(scorecardForm('layout-test'),answers);
  for(const layout of layouts){
    const form=scorecardForm('layout-test',layout),original=JSON.stringify(form);
    validateMarketing(form,true);const result=evaluateMarketing(FormSchema.parse(form),answers);
    assert.equal(result.presentation.layout,layout);
    assert.deepEqual(withoutPresentation(result),withoutPresentation(baseline),'layout cannot change scoring, coverage, priorities, outcome or filtered sections');
    assert.equal(JSON.stringify(form),original,'evaluation does not mutate the draft');
  }
}
const low=evaluateMarketing(scorecardForm('layout-low'),scoredAnswers[2]);
assert.equal(low.overallScore,50);assert.equal(low.categories[0].score,0);assert.equal(low.categories[1].score,100);
assert.deepEqual(low.categories.map(c=>[c.answered,c.applicable,c.minAnswers]),[[2,2,2],[1,1,1]]);
assert.deepEqual(low.resultSections.map(section=>section.id),['always','low','followup']);
const unknown=evaluateMarketing(scorecardForm('layout-unknown'),scoredAnswers[3]);
assert.equal(unknown.overallScore,null);assert.equal(unknown.categories[0].score,null);assert.equal(unknown.categories[0].answered,1);assert.equal(unknown.categories[1].score,100);
assert.equal(unknown.ctaUrl,undefined,'insufficient overall coverage never receives an overall-band CTA');
assert.deepEqual(unknown.resultSections.map(section=>section.id),['always','followup']);
const draft=scorecardForm('snapshot','score_overview');const saved=evaluateMarketing(draft,scoredAnswers[2]);const frozen=JSON.stringify(saved);
draft.marketing.presentation.layout='action_plan';draft.marketing.categories[0].title='Edited category';draft.marketing.categories[0].bands[0].advice='Edited advice';draft.marketing.resultSections[0].body='Edited content';draft.marketing.rules[0].points=99;
assert.equal(JSON.stringify(saved),frozen,'snapshot cannot change with later in-memory draft edits');
assert.equal(JSON.parse(frozen).presentation.layout,'score_overview','layout survives persistence serialization');
const legacy=scorecardForm('legacy');delete legacy.marketing.presentation;assert.equal(evaluateMarketing(legacy,scoredAnswers[0]).presentation.layout,'stacked');
assert.equal(MarketingSchema.safeParse({...legacy.marketing,presentation:{layout:'javascript:alert(1)'}}).success,false);
for(const kind of ['product_finder','segmentation'])for(const answers of [{}, {use:'a0',priority:'a0',fit:'a1'}, {goal:'a0',stage:'a0'}]){
  const form=marketingTemplate(kind,'matching-layout');const baseline=evaluateMarketing(form,answers);
  for(const layout of layouts){form.marketing.presentation={layout};const result=evaluateMarketing(form,answers);assert.deepEqual(withoutPresentation(result),withoutPresentation(baseline));assert.equal(result.categories.length,0,'a layout cannot invent categories for recommendations');}
}
console.log('PASS result layout numeric invariance across complete/zero/mixed/unknown answers, category coverage, conditional sections, snapshot isolation/persistence, legacy default and matching-quiz invariance');
