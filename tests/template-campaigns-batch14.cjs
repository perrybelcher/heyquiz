// Literal campaign expectations; never calculate expected results with the engine.
const common=['campaign-reflection','campaign-result-faq'];
const match=(name,answers,resultId,titleIndex,extra=[])=>({name,answers,status:resultId?'matched':'no_match',resultId,score:null,titleIndex,categories:[],sections:[...extra,...(resultId?['campaign-'+resultId]:[]),...common]});
const cat=(id,score,answered=2)=>({id,score,answered,applicable:2,minAnswers:2});
const cats=(a,b,c,answered=[2,2,2])=>[cat('capture',a,answered[0]),cat('followup',b,answered[1]),cat('measurement',c,answered[2])];
const score=(name,options,status,resultId,value,titleIndex,categories)=>({name,options,status,resultId,score:value,titleIndex,categories,sections:[...(resultId?['campaign-'+resultId]:[]),...common]});
const fixture={
 ids:['candles','event-format','hotel','renovation','product_finder','scorecard','consultation'],
 titles:{
  candles:['Explore fresh fragrances','Explore soft fragrances','Explore warm fragrances','You can explore without choosing a scent today'],
  'event-format':['Plan a networking gathering','Plan a hands-on workshop','Plan a talk or panel','Clarify the purpose before filling the calendar'],
  hotel:['Explore a convenient city base','Explore a leisure-focused stay','Explore a work-friendly stay','Build a short stay checklist before deciding'],
  renovation:['Start with a cosmetic refresh','Explore a room renovation','Start with feasibility and design','Keep the project at the question stage for now'],
  product_finder:['The Everyday Sling','The Workday Pack','The Weekend Tote','Let’s check the fit first'],
  scorecard:['Start with one dependable habit','Turn good intentions into a repeatable process','Refine what is already working','Start by finding out what happens today'],
  consultation:['Start with a clarity exercise','Focus on one bottleneck','Explore a planning conversation','You can leave this here for now'],
 },
 matching:require('./template-campaigns-batch13.cjs').matching,
 product_finder:[
  match('Compact essentials',{use:'a0',priority:'a0',routine:'a0',space:'a0',fit:'a1'},'light',0,['check-fit']),
  match('Laptop workday',{use:'a1',priority:'a1',routine:'a1',space:'a1',fit:'a1'},'work',1,['check-fit']),
  match('Short trip',{use:'a2',priority:'a2',routine:'a2',space:'a2',fit:'a1'},'travel',2,['check-fit']),
  match('All preferences unknown',{use:'a3',priority:'a3',routine:'a3',space:'a3',fit:'a2'},null,3,['check-fit']),
  match('17-inch requirement overrides strong preference',{use:'a0',priority:'a0',routine:'a0',space:'a0',fit:'a0'},null,3,['check-fit']),
  match('Laptop protection excludes higher travel points',{use:'a1',priority:'a2',routine:'a2',space:'a2',fit:'a1'},'work',1,['check-fit']),
  match('Laptop requirement alone gives three points',{use:'a1',priority:'a3',routine:'a3',space:'a3',fit:'a1'},'work',1,['check-fit']),
  match('Original equal-points tie order',{use:'a3',priority:'a0',routine:'a1',space:'a1',fit:'a1'},'light',0,['check-fit']),
  match('One-point preference below original minimum',{use:'a3',priority:'a3',routine:'a1',space:'a3',fit:'a1'},null,3,['check-fit']),
  match('Uncertain laptop size still requires later verification',{use:'a0',priority:'a0',routine:'a0',space:'a0',fit:'a2'},'light',0,['check-fit']),
 ],
 scorecard:[
  score('All not yet',['a2','a2','a2','a2','a2','a2'],'scored','foundation',0,0,cats(0,0,0)),
  score('All sometimes',['a1','a1','a1','a1','a1','a1'],'scored','consistent',50,1,cats(50,50,50)),
  score('All consistent',['a0','a0','a0','a0','a0','a0'],'scored','refine',100,2,cats(100,100,100)),
  score('Mixed categories same overall midpoint',['a2','a2','a1','a1','a0','a0'],'scored','consistent',50,1,cats(0,50,100)),
  score('All unknown',['a3','a3','a3','a3','a3','a3'],'no_match',null,null,3,cats(null,null,null,[0,0,0])),
  score('Unknown whole capture area',['a3','a3','a0','a0','a0','a0'],'scored',null,null,null,cats(null,100,100,[0,2,2])),
  score('Single scored answer below category minimum',['a0','a3','a1','a1','a2','a2'],'scored',null,null,null,cats(null,50,0,[1,2,2])),
  score('Every area below two-answer minimum',['a0','a3','a1','a3','a2','a3'],'no_match',null,null,3,cats(null,null,null,[1,1,1])),
  score('Nearest attainable score below middle band',['a2','a1','a1','a1','a1','a1'],'scored','foundation',42,0,cats(25,50,50)),
  score('Nearest attainable score below upper band',['a0','a1','a0','a1','a0','a1'],'scored','consistent',75,1,cats(75,75,75)),
  score('Nearest attainable score in upper band',['a1','a1','a0','a0','a0','a0'],'scored','refine',83,2,cats(50,100,100)),
  score('Same midpoint different category distribution',['a0','a0','a2','a2','a1','a1'],'scored','consistent',50,1,cats(100,0,50)),
 ],
 consultation:[
  match('Self-guided preference',{priority:'a0',stage:'a0',support:'a0',timing:'a0',readiness:'a0'},'self',0),
  match('Focused review preference',{priority:'a1',stage:'a1',support:'a1',timing:'a1',readiness:'a1'},'review',1),
  match('Collaborative planning preference',{priority:'a2',stage:'a2',support:'a2',timing:'a2',readiness:'a2'},'plan',2),
  match('Self preference outweighs four planning hints',{priority:'a2',stage:'a2',support:'a0',timing:'a2',readiness:'a2'},'self',0),
  match('Review preference outweighs four self hints',{priority:'a0',stage:'a0',support:'a1',timing:'a0',readiness:'a0'},'review',1),
  match('Plan preference outweighs four self hints',{priority:'a0',stage:'a0',support:'a2',timing:'a0',readiness:'a0'},'plan',2),
  match('Explicit no support overrides all other answers',{priority:'a2',stage:'a2',support:'a3',timing:'a2',readiness:'a2'},null,3),
  match('No extra time excludes otherwise strong planning',{priority:'a2',stage:'a2',support:'a2',timing:'a2',readiness:'a3'},null,3),
  match('No extra time preserves eligible self-guided path',{priority:'a0',stage:'a0',support:'a1',timing:'a0',readiness:'a3'},'self',0),
  match('Entirely unsure or unwilling',{priority:'a3',stage:'a3',support:'a3',timing:'a3',readiness:'a3'},null,3),
 ],
 cases(id){return this[id]||this.matching;},
 answers(form,expected){return expected.answers||Object.fromEntries(form.questions.map((q,i)=>[q.id,q.id==='next'?expected.next:(expected.choices||expected.options)[i]]));},
 browserCase:{candles:0,'event-format':1,hotel:4,renovation:2,product_finder:5,scorecard:6,consultation:8},
};
module.exports=fixture;
if(require.main===module){
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{createHash}=require('node:crypto');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {launchTemplate,launchTemplates}=require('../lib/launch-templates.ts'),{catalogTemplate,catalogTemplates}=require('../lib/template-catalog.ts');
const {campaignTemplateIds,templateCampaignDetails,applyTemplateCampaign}=require('../lib/template-campaigns.ts'),{evaluateMarketing,validateMarketing}=require('../lib/marketing.ts'),{validateLanding}=require('../lib/landing.ts');
const {evaluateJourneyCase}=require('../lib/journey-testing.ts'),{gradeQuizSubmission}=require('../lib/scoring.ts'),{makeResultReport}=require('../lib/result-reports.ts'),{buildResultPdfModel}=require('../lib/result-pdf-model.ts');
let checked=0;
assert.equal(launchTemplates.length,43);assert.equal(campaignTemplateIds.length,43);assert.deepEqual(new Set(campaignTemplateIds),new Set(launchTemplates.map(t=>t.id)));assert.deepEqual(campaignTemplateIds.slice(36),fixture.ids);
for(const entry of catalogTemplates){const form=launchTemplate(entry.id,'unchanged-'+entry.id),original=catalogTemplate(entry.id,form.id);assert.deepEqual(form.questions,original.questions);assert.deepEqual(form.marketing.rules,original.marketing.rules);assert.deepEqual(form.marketing.outcomes,original.marketing.outcomes);assert.deepEqual(form.marketing.categories.map((category,i)=>({...category,description:original.marketing.categories[i].description})),original.marketing.categories);}
const legacyHashes={product_finder:'8e4956a712a4ec9e0f080c13c752fc9b224fc4287828082d102284d93ab8bb17',scorecard:'c8f467aa603c4e0581158a317c5376ebff43bda0d2d2a14fabc1690384ed76bf',consultation:'09bbf10d0f585c9082f865b361965c0b0fa1abcc96d6531ce0698f0bb74458d4'};
for(const [id,hash] of Object.entries(legacyHashes)){const f=launchTemplate(id,'baseline-'+id),semantic={questions:f.questions,outcomes:f.marketing.outcomes,rules:f.marketing.rules,categories:f.marketing.categories.map(category=>{const unchanged={...category};delete unchanged.description;return unchanged;}),scorecardBands:f.marketing.scorecard?.bands};assert.equal(createHash('sha256').update(JSON.stringify(semantic)).digest('hex'),hash,id+' original question/answer wording, weights, exclusions, outcome copy and score bands unchanged');}
const originalFit={id:'check-fit',type:'faq',title:'What should I check before choosing?',body:'Compare the actual dimensions, materials, and capacity with what you carry. This example matches preferences; it does not verify physical fit.',url:'',label:''};
for(const id of campaignTemplateIds){const form=launchTemplate(id,'twice-'+id);assert.deepEqual(applyTemplateCampaign(form,id),form,id+' repeated campaign application is idempotent and preserves section order');}
for(const id of fixture.ids){
 const form=launchTemplate(id,'batch14-'+id),details=templateCampaignDetails(id);validateLanding(form.coverPage,true);validateMarketing(form,true);
 assert.equal(form.questions.length,id==='scorecard'?6:5);assert.equal(form.coverPage.layout,'compact');assert.ok(!form.coverPage.imageUrl,'Final seven are intentionally art-free');assert.deepEqual(form.coverPage.sections.map(s=>s.type),['benefits','text','faq','faq','start']);assert.equal(form.marketing.resultSections.length,id==='product_finder'?6:5);assert.equal(form.marketing.presentation.layout,details.layout);
 if(id==='product_finder')assert.deepEqual(form.marketing.resultSections[0],originalFit,'Original fit FAQ remains first and byte-for-byte meaningful');
 if(id==='scorecard'){assert.deepEqual(form.marketing.categories.map(c=>c.description),details.categoryContext);assert.deepEqual(form.marketing.scorecard.bands.map(({id,min,max})=>({id,min,max})),[{id:'foundation',min:0,max:49},{id:'consistent',min:50,max:79},{id:'refine',min:80,max:100}]);}
 assert.equal(form.capture.required,false);assert.equal(form.capture.marketingEnabled,false);assert.equal(form.capture.privacyUrl,'');assert.ok(form.coverPage.sections.some(s=>s.body.includes('skip the optional contact')));
 for(const section of [...form.coverPage.sections,...form.marketing.resultSections]){assert.equal(section.url,'');assert.ok(!['testimonial','video','cta'].includes(section.type));}
 for(const outcome of form.marketing.outcomes)assert.equal(outcome.ctaUrl,'');for(const category of form.marketing.categories)for(const band of category.bands)assert.equal(band.ctaUrl,'');assert.equal(details.checklist.length,4);
 for(const expected of fixture.cases(id)){
  const answers=fixture.answers(form,expected),actual=evaluateJourneyCase(form,answers),marketing=evaluateMarketing(form,answers);
  assert.deepEqual({status:actual.status,resultId:actual.resultId??null,score:actual.score??null,categories:actual.categories,sections:actual.resultSectionIds},{status:expected.status,resultId:expected.resultId,score:expected.score,categories:expected.categories,sections:expected.sections},id+': '+expected.name);
  assert.equal(marketing.title,expected.titleIndex===null?form.marketing.scorecard.title:fixture.titles[id][expected.titleIndex]);
  const result={...gradeQuizSubmission(form,answers),marketing},inputResult=structuredClone(result),inputForm=structuredClone(form),report=makeResultReport(inputForm,inputResult,'private-fixture-'+checked),snapshot=structuredClone(report);
  const model=buildResultPdfModel(report),printed=model.blocks.map(block=>block.text??block.label??'').join('\n');assert.equal(model.layout,details.layout);
  for(const section of marketing.resultSections){assert.ok(printed.includes(section.title));assert.ok(printed.includes(section.body));}
  for(const section of form.marketing.resultSections.filter(section=>!expected.sections.includes(section.id)))assert.ok(!printed.includes(section.body),'Unmatched plan absent');
  for(const category of marketing.categories){assert.ok(printed.includes(category.title));assert.ok(printed.includes(category.description));}
  assert.deepEqual(model.blocks.filter(block=>block.kind==='score').map(block=>block.value),marketing.kind==='scorecard'?[marketing.overallScore??null,...expected.categories.map(c=>c.score),...expected.categories.map(c=>c.score)]:[],'Every numeric/null value and category coverage remains literal in the PDF model');assert.ok(!model.blocks.some(block=>block.kind==='link'));
  inputForm.coverPage.title='Later draft';inputForm.marketing.resultSections[0].body='Later guidance';inputResult.marketing.title='Changed source result';inputResult.marketing.resultSections[0].body='Changed source section';assert.deepEqual(report,snapshot);checked++;
 }
 const first=launchTemplate(id,'independent1'),second=launchTemplate(id,'independent2');second.coverPage.sections[0].items[0]='Changed';second.marketing.resultSections[0].body='Changed';assert.notEqual(first.coverPage.sections[0].items[0],'Changed');assert.notEqual(first.marketing.resultSections[0].body,'Changed');
 console.log('PASS '+id+': literal preferences/neutral/coverage/ordered sections, preserved scoring and immutable report/PDF model');
}
console.log(`PASS batch14:7 additional campaigns/43 total,${checked} literal journeys, all legacy semantic hashes and43 idempotence checks; no live destinations.`);
}
