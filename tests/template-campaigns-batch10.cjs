// Literal expectations, authored from the preserved question/answer maps.
// Do not derive expected scores, coverage or conditional sections from the evaluator.
const common=['campaign-reflection','campaign-result-faq'];
const cat=(id,score,answered)=>({id,score,answered,applicable:2,minAnswers:2});
const fixture={
 ids:['garden','travel','cleaning','bookkeeping','volunteer-readiness','content-readiness'],
 titles:{
  garden:['Start with containers','Start a small kitchen garden','Plan a seasonal border','A little observation can come before the planting plan'],
  travel:['Explore a slower getaway','Explore a discovery trip','Explore an outdoor trip','You can find the pace before choosing the place'],
  cleaning:['Explore regular cleaning','Explore a deep clean','Explore move-related cleaning','A simple task list can come before choosing a service'],
  bookkeeping:['Discuss a records cleanup','Discuss recurring bookkeeping','Discuss a reporting review','You can organize the question before choosing support'],
  'volunteer-readiness':['Choose one foundation to strengthen','Make the useful habits repeatable','Review and refine','Confirm the welcome process before judging readiness'],
  'content-readiness':['Choose one foundation to strengthen','Make the useful habits repeatable','Review and refine','Gather a few real examples before scoring the routine'],
 },
 matching:[
  {name:'Every first preference',choices:['a0','a0','a0','a0'],next:'a0',status:'matched',resultId:'path0',score:null,titleIndex:0,categories:[],sections:['campaign-path0',...common]},
  {name:'Every second preference',choices:['a1','a1','a1','a1'],next:'a0',status:'matched',resultId:'path1',score:null,titleIndex:1,categories:[],sections:['campaign-path1',...common]},
  {name:'Every third preference',choices:['a2','a2','a2','a2'],next:'a0',status:'matched',resultId:'path2',score:null,titleIndex:2,categories:[],sections:['campaign-path2',...common]},
  {name:'Explore without a purchase or role commitment',choices:['a1','a1','a1','a1'],next:'a1',status:'matched',resultId:'path1',score:null,titleIndex:1,categories:[],sections:['campaign-path1',...common]},
  {name:'All preferences unsure',choices:['a3','a3','a3','a3'],next:'a0',status:'no_match',resultId:null,score:null,titleIndex:3,categories:[],sections:common},
  {name:'Explicit stop overrides otherwise strong third result',choices:['a2','a2','a2','a2'],next:'a2',status:'no_match',resultId:null,score:null,titleIndex:3,categories:[],sections:common},
  {name:'Equal two-point routes keep original tie order',choices:['a3','a0','a1','a3'],next:'a0',status:'matched',resultId:'path0',score:null,titleIndex:0,categories:[],sections:['campaign-path0',...common]},
 ],
 scorecards:[
  {name:'All not-yet',choices:['a2','a2','a2','a2','a2','a2'],status:'scored',resultId:'foundation',score:0,titleIndex:0,categories:[cat('area0',0,2),cat('area1',0,2),cat('area2',0,2)],sections:['campaign-foundation',...common]},
  {name:'All partly',choices:['a1','a1','a1','a1','a1','a1'],status:'scored',resultId:'consistent',score:50,titleIndex:1,categories:[cat('area0',50,2),cat('area1',50,2),cat('area2',50,2)],sections:['campaign-consistent',...common]},
  {name:'All consistent',choices:['a0','a0','a0','a0','a0','a0'],status:'scored',resultId:'refine',score:100,titleIndex:2,categories:[cat('area0',100,2),cat('area1',100,2),cat('area2',100,2)],sections:['campaign-refine',...common]},
  {name:'Low middle and high areas stay visible together',choices:['a2','a2','a1','a1','a0','a0'],status:'scored',resultId:'consistent',score:50,titleIndex:1,categories:[cat('area0',0,2),cat('area1',50,2),cat('area2',100,2)],sections:['campaign-consistent',...common]},
  {name:'All unknown',choices:['a3','a3','a3','a3','a3','a3'],status:'no_match',resultId:null,score:null,titleIndex:3,categories:[cat('area0',null,0),cat('area1',null,0),cat('area2',null,0)],sections:common},
  {name:'Unknown first area keeps overall incomplete',choices:['a3','a3','a0','a0','a0','a0'],status:'scored',resultId:null,score:null,titleIndex:null,categories:[cat('area0',null,0),cat('area1',100,2),cat('area2',100,2)],sections:common},
  {name:'One answered check is visible below the required coverage',choices:['a0','a3','a1','a1','a2','a2'],status:'scored',resultId:null,score:null,titleIndex:null,categories:[cat('area0',null,1),cat('area1',50,2),cat('area2',0,2)],sections:common},
  {name:'Different values within an area preserve the earned denominator',choices:['a0','a2','a1','a0','a2','a1'],status:'scored',resultId:'consistent',score:50,titleIndex:1,categories:[cat('area0',50,2),cat('area1',75,2),cat('area2',25,2)],sections:['campaign-consistent',...common]},
 ],
 answers(form,expected){return Object.fromEntries(form.questions.map((q,index)=>[q.id,q.id==='next'?expected.next:expected.choices[index]]));}
};

// Browser acceptance imports only the independent literal fixture.
module.exports=fixture;
if(require.main===module){
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {launchTemplate,launchTemplates}=require('../lib/launch-templates.ts'),{catalogTemplate,catalogTemplates}=require('../lib/template-catalog.ts');
const {campaignTemplateIds,templateCampaignDetails}=require('../lib/template-campaigns.ts'),{evaluateMarketing,validateMarketing}=require('../lib/marketing.ts'),{validateLanding}=require('../lib/landing.ts');
const {evaluateJourneyCase}=require('../lib/journey-testing.ts'),{gradeQuizSubmission}=require('../lib/scoring.ts'),{makeResultReport}=require('../lib/result-reports.ts'),{buildResultPdfModel}=require('../lib/result-pdf-model.ts');
let checked=0;
assert.equal(launchTemplates.length,43);assert.equal(new Set(launchTemplates.map(t=>t.id)).size,43);
assert.deepEqual(campaignTemplateIds.slice(0,24),['coffee','home-style','web-design','course','client-onboarding','website-readiness','gifts','photography','wedding','saas','event-readiness','retail-readiness','tea','desk','language','nonprofit','course-readiness','workshop-readiness',...fixture.ids]);
for(const entry of catalogTemplates){const form=launchTemplate(entry.id,'unchanged-'+entry.id),original=catalogTemplate(entry.id,form.id);assert.deepEqual(form.questions,original.questions,entry.id+' question wording/IDs/options unchanged');assert.deepEqual(form.marketing.rules,original.marketing.rules,entry.id+' scoring and exclusions unchanged');assert.deepEqual(form.marketing.outcomes,original.marketing.outcomes,entry.id+' outcomes unchanged');assert.deepEqual(form.marketing.categories.map((category,i)=>({...category,description:original.marketing.categories[i].description})),original.marketing.categories,entry.id+' category bands/minimum/IDs unchanged');}
for(const id of fixture.ids){
 const form=launchTemplate(id,'batch10-'+id),details=templateCampaignDetails(id);validateLanding(form.coverPage,true);validateMarketing(form,true);
 assert.equal(form.questions.length,form.marketing.kind==='scorecard'?6:5);assert.deepEqual(form.coverPage.sections.map(s=>s.type),['benefits','text','faq','faq','start']);assert.equal(form.marketing.resultSections.length,5);assert.equal(form.marketing.presentation.layout,details.layout);
 assert.equal(form.capture.required,false);assert.equal(form.capture.marketingEnabled,false);assert.equal(form.capture.privacyUrl,'');assert.ok(form.coverPage.sections.some(s=>s.type==='faq'&&s.body.includes('skip the optional contact')));
 for(const section of [...form.coverPage.sections,...form.marketing.resultSections]){assert.equal(section.url,'');assert.ok(!['testimonial','video','cta'].includes(section.type));assert.ok(section.title.length>10);}
 for(const outcome of form.marketing.outcomes)assert.equal(outcome.ctaUrl,'');for(const category of form.marketing.categories)for(const band of category.bands)assert.equal(band.ctaUrl,'');
 if(form.coverPage.imageUrl){assert.ok(form.coverPage.imageUrl.startsWith('/template-images/'));assert.ok(fs.existsSync('public'+form.coverPage.imageUrl));}
 assert.deepEqual(details.checklist.length,4);assert.ok(!JSON.stringify(details).match(/\b(?:guaranteed|thousands of|trusted by|we will email|we'll email|send you your results)\b/i));
 for(const expected of form.marketing.kind==='scorecard'?fixture.scorecards:fixture.matching){
  const answers=fixture.answers(form,expected),actual=evaluateJourneyCase(form,answers),marketing=evaluateMarketing(form,answers);
  assert.deepEqual({status:actual.status,resultId:actual.resultId??null,score:actual.score??null,categories:actual.categories,sections:actual.resultSectionIds},{status:expected.status,resultId:expected.resultId,score:expected.score,categories:expected.categories,sections:expected.sections},id+': '+expected.name);
  if(expected.titleIndex!==null)assert.equal(marketing.title,fixture.titles[id][expected.titleIndex]);else assert.equal(marketing.title,form.marketing.scorecard.title,'Partial scorecard keeps the category-level result without inventing a band');
  const result={...gradeQuizSubmission(form,answers),marketing},inputResult=structuredClone(result),inputForm=structuredClone(form),report=makeResultReport(inputForm,inputResult,'private-fixture-'+checked),snapshot=structuredClone(report);
  const model=buildResultPdfModel(report),printed=model.blocks.map(block=>block.text??block.label??'').join('\n');assert.equal(model.layout,details.layout);
  for(const section of marketing.resultSections){assert.ok(printed.includes(section.title));assert.ok(printed.includes(section.body));}
  for(const section of form.marketing.resultSections.filter(section=>!expected.sections.includes(section.id)))assert.ok(!printed.includes(section.body),'Unmatched plan absent');
  for(const category of marketing.categories){assert.ok(printed.includes(category.title));assert.ok(printed.includes(category.description));}
  assert.deepEqual(model.blocks.filter(block=>block.kind==='score').map(block=>block.value),marketing.kind==='scorecard'?[marketing.overallScore??null,...(details.layout==='score_overview'?expected.categories.map(c=>c.score):[]),...expected.categories.map(c=>c.score)]:[],'Every saved numeric/null value stays unchanged in PDF');
  assert.ok(!model.blocks.some(block=>block.kind==='link'));
  inputForm.coverPage.title='Later draft';inputForm.marketing.fallbackTitle='Later fallback';inputForm.marketing.resultSections[0].body='Later guidance';inputResult.marketing.title='Changed source result';inputResult.marketing.resultSections[0].body='Changed source section';assert.deepEqual(report,snapshot,'Frozen report is independent of later mutations to both original inputs');
  checked++;
 }
 console.log('PASS '+id+': original campaign, complete literal outcomes/neutral/category coverage, ordered sections and report/PDF parity');
}
for(const id of ['client-onboarding','website-readiness','event-readiness','retail-readiness','course-readiness','workshop-readiness','volunteer-readiness','content-readiness']){
 const form=launchTemplate(id,'context-'+id),details=templateCampaignDetails(id);assert.deepEqual(form.marketing.categories.map(c=>c.description),details.categoryContext);assert.equal(new Set(details.categoryContext).size,3);
 for(const category of form.marketing.categories){assert.ok(category.description.length>70);for(const band of category.bands){assert.notEqual(category.description,band.advice);assert.notEqual(category.description,band.action);}}
}
const pristine=launchTemplate('garden','fresh-garden');const changed=launchTemplate('garden','changed-garden');changed.coverPage.sections[0].items[0]='Changed';changed.marketing.resultSections[0].body='Changed';assert.notEqual(pristine.coverPage.sections[0].items[0],'Changed');assert.notEqual(pristine.marketing.resultSections[0].body,'Changed');
console.log(`PASS batch10:6 preserved additions/first24 rich campaigns,43 IDs preserved,${checked} literal journeys,8 scorecards with distinct context, no live destinations or provider calls.`);

}
