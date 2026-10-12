const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {readRecord,writeRecord,removeRecord,cloudEnabled}=require('../lib/records.ts');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3163';
if(new URL(base).hostname!=='127.0.0.1'||!process.env.HEYQUIZ_DATA_DIR||cloudEnabled())throw Error('Isolated local server/data directory only.');
const artifacts=path.resolve(process.env.ARTIFACT_DIR||'../pippi-overnight-2026-10-12/analytics-cohorts');fs.mkdirSync(artifacts,{recursive:true});
const id='qa-analytics-cohorts-'+Date.now(),foreignId=id+'-foreign',headers={Origin:base},created=[];
const now=Date.now(),day=86400000,v1=new Date(now-20*day).toISOString(),v2=new Date(now-5*day).toISOString();
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),owner=await browser.newContext({viewport:{width:1440,height:1000}}),visitor=await browser.newContext(),page=await owner.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));let release;
try{
 assert.equal((await owner.request.post(base+'/api/auth',{data:{local:true},headers})).status(),200);
 const input={id,title:'Source and campaign cohort QA',mode:'survey',questions:[{id:'choice',type:'multiple_choice',title:'Renamed question',options:[{id:'a',label:'ImplementationReadinessRecommendations'},{id:'b',label:'Clarity'}]}]};
 assert.equal((await owner.request.post(base+'/api/forms',{data:input,headers})).status(),201);assert.equal((await owner.request.post(base+`/api/forms/${id}/publish`,{data:{},headers})).status(),200);
 const current={...(await readRecord('forms',id)).payload,publishedAt:v2},old={...current,publishedAt:v1,questions:[{...current.questions[0],title:'Original question'}]},legacy={...old,publishedAt:undefined};
 async function fixture(suffix,snapshot,attribution,completed,extra={},who='local'){
  const responseId=id+'-'+suffix,startedAt=extra.startedAt??now-2*day;
  const attempt={form:snapshot,startedAt,expiresAt:now+day,preview:false,reached:['choice'],analyticsVersion:1,lastSeenAt:now-day,lastQuestionId:'choice',attribution,completed,...(completed?{completedAt:startedAt+60000,resultViewedAt:now-day,offerClickedAt:now-day}:{}),...extra};
  await writeRecord('attempts',responseId,who,attempt,0);created.push({kind:'attempts',id:responseId,owner:who});
  if(completed){await writeRecord('submissions',responseId,who,{id:responseId,formId:snapshot.id,submittedAt:new Date(now-day).toISOString(),answers:{choice:snapshot.publishedAt===v1?'a':'b'},totalQuestions:1,totalPointsPossible:1,totalPointsEarned:1,percentageScore:100,grading:[],marketing:{title:snapshot.publishedAt===v1?'Original outcome':'Current outcome'},contact:{email:'PRIVATE-CONTACT@example.test',marketingConsent:true}},0);created.push({kind:'submissions',id:responseId,owner:who});}
 }
 await fixture('a',old,{version:1,source:'newsletter',campaign:'Autumn'},true);
 await fixture('b',old,{version:1,source:'newsletter',campaign:'Autumn'},false);
 await fixture('c',current,{version:1,source:'ads',campaign:'Autumn'},true);
 await fixture('d',current,{version:1,source:'ads',campaign:'Spring'},false,{lastSeenAt:now-100});
 await fixture('e',current,{version:1,source:'ads',campaign:'Spring'},false);
 await fixture('legacy',legacy,undefined,true,{analyticsVersion:undefined});
 await fixture('literal',current,{version:1,source:'all',campaign:'unknown'},false);
 await fixture('prior',old,{version:1,source:'newsletter',campaign:'Autumn'},false,{startedAt:now-9*day});
 await fixture('preview',current,{version:1,source:'PREVIEW-ONLY'},true,{preview:true});
 await writeRecord('submissions',id+'-unlinked','local',{id:id+'-unlinked',formId:id,submittedAt:new Date(now-day).toISOString(),answers:{choice:'PRIVATE-ANSWER'},grading:[]},0);created.push({kind:'submissions',id:id+'-unlinked',owner:'local'});
 await fixture('foreign-same-quiz',current,{version:1,source:'FOREIGN-OWNER'},true,{},'foreign-owner');
 await writeRecord('forms',foreignId,'foreign-owner',{...current,id:foreignId},0);created.push({kind:'forms',id:foreignId,owner:'foreign-owner'});
 await fixture('foreign-form',{...current,id:foreignId},{version:1,source:'FOREIGN-QUIZ'},false);
 const endpoint=base+`/api/forms/${id}/analytics`;
 assert.equal((await visitor.request.get(endpoint)).status(),401);assert.equal((await owner.request.get(base+`/api/forms/${foreignId}/analytics`)).status(),404);
 for(const invalid of ['range=7&range=30','source=unknown&source=','source=all','version=published:bad','campaign=value%3Aprivate%40example.test'])assert.equal((await owner.request.get(endpoint+'?'+invalid)).status(),400);
 const get=async(filters={})=>{const r=await owner.request.get(endpoint+'?'+new URLSearchParams({range:'7',...filters}));assert.equal(r.status(),200);assert.equal(r.headers()['cache-control'],'private, no-store');return r.json();};
 const all=await get();assert.equal(all.starts,7);assert.equal(all.completions,3);assert.equal(all.unlinkedSubmissions,1,'only a response without any retained attempt is unassignable; stored previews are excluded');
 const selected=await get({source:'utm:newsletter',campaign:'value:Autumn',version:'published:'+v1});assert.equal(selected.starts,2);assert.equal(selected.completions,1);assert.equal(selected.leads,1);assert.equal(selected.offerClicks,1);assert.equal(selected.previousStarts,1);assert.equal(selected.completionChange,50);assert.equal(selected.questions[0].title,'Original question (earlier wording)');assert.equal(selected.questions[0].reached,2);assert.equal(selected.answerDistributions.linkedCompletions,1);assert.equal(selected.days.reduce((n,d)=>n+d.starts,0),2);assert.equal(selected.attribution.sources.length,1);
 for(const forbidden of ['PRIVATE-CONTACT','FOREIGN-OWNER','FOREIGN-QUIZ','PREVIEW-ONLY'])assert.ok(!JSON.stringify(all).includes(forbidden),forbidden);
 assert.equal((await get({version:'unknown'})).starts,1);assert.equal((await get({source:'utm:all',campaign:'value:unknown'})).starts,1);assert.equal((await get({source:'utm:newsletter',version:'published:'+v2})).starts,0);
 await page.goto(base+'/editor/'+id);await page.getByRole('button',{name:'Results',exact:true}).click();const report=page.getByRole('region',{name:'Conversion analytics',exact:true});
 await report.getByRole('heading',{name:'Question performance',exact:true}).waitFor();
 const source=report.getByLabel('Filter by source',{exact:true}),campaign=report.getByLabel('Filter by campaign',{exact:true}),version=report.getByLabel('Filter by published version',{exact:true}),exportButton=report.getByRole('button',{name:'Export question performance',exact:true});
 await report.getByLabel('Analytics date range').selectOption('7');await report.getByRole('heading',{name:'Question performance',exact:true}).waitFor();
 await source.selectOption('utm:newsletter');await campaign.selectOption('value:Autumn');await version.selectOption('published:'+v1);
 await report.getByText('Original question (earlier wording)',{exact:true}).first().waitFor();assert.equal(await report.getByRole('region',{name:'Landing visit performance',exact:true}).count(),0);await report.getByText('Landing visits are hidden for this cohort.',{exact:true}).waitFor();
 const download=page.waitForEvent('download');await exportButton.click();const file=await download,csv=fs.readFileSync(await file.path(),'utf8');assert.ok(csv.includes('"Original question (earlier wording)","2","1"'));assert.ok(csv.includes('newsletter · UTM source'));assert.ok(csv.includes(v1));assert.ok(!csv.includes('Renamed question'));assert.ok(file.suggestedFilename().includes('filtered'));
 // An impossible combination stays selected, explicitly empty, and can be cleared with the keyboard.
 await version.selectOption('published:'+v2);await report.getByRole('heading',{name:'No sessions match this selection.',exact:true}).waitFor();
 await report.getByRole('button',{name:'Clear cohort filters',exact:true}).focus();await page.keyboard.press('Enter');await report.getByRole('region',{name:'Landing visit performance',exact:true}).waitFor();assert.equal(await source.inputValue(),'');assert.equal(await campaign.inputValue(),'');assert.equal(await version.inputValue(),'');
 // Hold a real newsletter response, select ads, then release the old result out of order.
 const entered=defer(),gate=defer(),released=defer();release=gate.resolve;
 await page.route('**/api/forms/'+id+'/analytics?*',async route=>{
  const url=new URL(route.request().url()),response=await route.fetch();
  if(url.searchParams.get('source')==='utm:newsletter'){entered.resolve();await gate.promise;try{await route.fulfill({response});}catch{/* The browser correctly aborted the superseded request. */}finally{released.resolve();}}else await route.fulfill({response});
 });
 await source.selectOption('utm:newsletter');await entered.promise;assert.equal(await exportButton.isDisabled(),true);assert.equal(await report.locator('.report-metric').count(),0,'old metric cards hidden immediately while new cohort loads');
 await source.selectOption('utm:ads');await report.getByRole('region',{name:'Session sources and campaigns',exact:true}).getByRole('rowheader',{name:/ads/}).waitFor();gate.resolve();await released.promise;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await source.inputValue(),'utm:ads');assert.equal(await report.getByText('Original question (earlier wording)',{exact:true}).count(),0);assert.equal(await exportButton.isEnabled(),true);
 const afterRace=page.waitForEvent('download');await exportButton.click();const raceCsv=fs.readFileSync(await(await afterRace).path(),'utf8');assert.ok(raceCsv.includes('"Renamed question","3","1"'));assert.ok(raceCsv.includes('ads · UTM source'));assert.ok(!raceCsv.includes('Original question'));
 await page.unroute('**/api/forms/'+id+'/analytics?*');
 await page.route('**/api/forms/'+id+'/analytics?*',route=>route.fulfill({status:503,json:{error:'Synthetic cohort read failure.'}}));await report.getByRole('button',{name:'Refresh analytics',exact:true}).click();await report.getByRole('alert').filter({hasText:'Synthetic cohort read failure.'}).waitFor();assert.equal(await exportButton.isDisabled(),true);assert.equal(await report.locator('.report-metric').count(),0);await page.unroute('**/api/forms/'+id+'/analytics?*');await report.getByRole('button',{name:'Try again',exact:true}).click();await report.getByRole('heading',{name:'Question performance',exact:true}).waitFor();assert.equal(await source.inputValue(),'utm:ads');
 await report.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,'analytics-cohorts-desktop.png')});await page.setViewportSize({width:390,height:844});await source.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no page-level horizontal overflow');await page.screenshot({path:path.join(artifacts,'analytics-cohorts-mobile.png')});
 await source.focus();await page.keyboard.press('Tab');assert.equal(await campaign.evaluate(element=>element===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await version.evaluate(element=>element===document.activeElement),true);
 await page.setViewportSize({width:320,height:900});
 for(const name of ['Question performance table','Answer distribution table']){
  const region=report.getByRole('region',{name,exact:true});await region.scrollIntoViewIfNeeded();await region.focus();
  assert.equal(await region.evaluate(element=>element===document.activeElement),true,name+' can receive keyboard focus');
  const extent=await region.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth}));
  assert.ok(extent.scrollWidth>extent.width,name+' fixture really overflows at 320px');
  await region.evaluate(element=>{element.scrollLeft=0;});await page.keyboard.press('ArrowRight');
  await page.waitForFunction(label=>{const element=[...document.querySelectorAll('[role="region"]')].find(node=>node.getAttribute('aria-label')===label);return element&&element.scrollLeft>0;},name);
  const focus=await region.evaluate(element=>({visible:element.matches(':focus-visible'),width:getComputedStyle(element).outlineWidth,style:getComputedStyle(element).outlineStyle}));assert.equal(focus.visible,true,name+' has visible keyboard focus');assert.ok(parseFloat(focus.width)>=2&&focus.style!=='none',name+' has a visible outline');
 }
 await page.screenshot({path:path.join(artifacts,'analytics-table-keyboard-320.png')});
 assert.deepEqual(errors,[]);console.log('PASS compiled cohort API/UI: exact reserved-label IDs, two publications/sources/campaigns and legacy, owner/privacy/preview exclusion, same-cohort metrics/comparison/CSV, historical wording, empty/reset/keyboard/mobile plus actual 320px arrow-key table scrolling and focus outlines, landing separation, delayed request abort and failed-refresh export protection.');
 console.log('Synthetic fixture '+id+(process.env.KEEP_ANALYTICS_FIXTURE==='1'?' retained for parent accessibility inspection.':' cleaned after test.'));
}finally{release?.();if(process.env.KEEP_ANALYTICS_FIXTURE!=='1'){await owner.request.delete(base+'/api/forms/'+id,{headers});for(const row of created)await removeRecord(row.kind,row.id,row.owner);await removeRecord('result_report_revocations',createHash('sha256').update(JSON.stringify(['local',id])).digest('hex'),'local');}await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
