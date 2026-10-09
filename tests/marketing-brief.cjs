const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {MarketingBriefSchema,compileMarketingDraft,createMarketingStarter}=require('../lib/marketing-brief.ts');
const {evaluateMarketing}=require('../lib/marketing.ts');
const {publicForm}=require('../lib/engine.ts');
const brief={audience:'Small business owners',offer:'Practical follow-up coaching',goal:'Explore coaching',kind:'scorecard',numQuestions:3,ctaLabel:'Explore coaching',ctaUrl:'https://example.com/coaching',targets:[{title:'Operations',description:'How consistently inquiries are handled'},{title:'Measurement',description:'How consistently outcomes are reviewed'}]};
const band=(title)=>({title,advice:'Choose one useful improvement.',action:'Review the process with your team.'});
const fixture={title:'How ready is your follow-up?',description:'Find a useful next step.',fallbackTitle:'Explore at your own pace',fallbackMessage:'There is not enough information to recommend a specific option.',results:[0,1].map(()=>({advice:'Start with one small improvement.',bands:['Foundation','Developing','Established'].map(band)})),overallBands:['Foundation','Developing','Established'].map(band),questions:[0,1,0].map((target,i)=>({title:`How consistently do you complete step ${i+1}?`,purpose:'Understand the current routine.',options:[{label:'Consistently',weights:[{target,points:10}]},{label:'Not yet',weights:[{target,points:0}]},{label:'Not sure',weights:[]}]}))};
const {form,rationale}=compileMarketingDraft(brief,fixture);
assert.equal(form.mode,'survey');assert.equal(form.publishedAt,undefined);assert.equal(form.capture.marketingEnabled,false);assert.equal(form.capture.required,false);assert.equal(rationale.length,3);
let r=evaluateMarketing(form,Object.fromEntries(form.questions.map(q=>[q.id,'answer-0'])));assert.equal(r.overallScore,100);assert.equal(r.title,'Established');assert.equal(r.ctaUrl,brief.ctaUrl);
r=evaluateMarketing(form,{'question-0':'answer-1','question-1':'answer-2','question-2':'answer-1'});assert.equal(r.overallScore,null);assert.equal(r.ctaUrl,undefined);
assert.equal(JSON.stringify(publicForm(form)).includes('Understand the current routine.'),false);
for(const change of [d=>d.questions.pop(),d=>d.questions[0].options[0].weights[0].target=4,d=>d.questions[0].options[0].weights.push({target:0,points:1}),d=>d.questions[0].options[2].weights.push({target:0,points:1}),d=>d.questions[1].options.forEach(o=>o.weights.forEach(w=>w.target=0))]){const d=structuredClone(fixture);change(d);assert.throws(()=>compileMarketingDraft(brief,d));}
assert.equal(MarketingBriefSchema.safeParse({...brief,ctaUrl:'javascript:alert(1)'}).success,false);
assert.equal(MarketingBriefSchema.safeParse({...brief,targets:[brief.targets[0],brief.targets[0]]}).success,false);
for(const kind of ['segmentation','product_finder']){const f=compileMarketingDraft({...brief,kind,targets:brief.targets.map((t,i)=>({...t,ctaUrl:`https://example.com/result-${i}`}))},fixture).form;assert.equal(evaluateMarketing(f,{'question-0':'answer-0'}).ctaUrl,'https://example.com/result-0');assert.equal(evaluateMarketing(f,{'question-0':'answer-2','question-1':'answer-2','question-2':'answer-2'}).status,'no_match');}
console.log('PASS marketing brief compilation: all 3 modes, scoring, neutral answers, safe URLs, private rationale, consent defaults and invalid model output');
module.exports={brief,fixture};

for(const kind of ['scorecard','segmentation','product_finder'])for(const numQuestions of [3,6,12])assert.equal(createMarketingStarter({...brief,kind,numQuestions}).form.questions.length,numQuestions);
console.log('PASS no-AI starters for all modes and question-count limits');
