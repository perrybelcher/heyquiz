const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{createHash}=require('node:crypto');
require.extensions['.ts']=(loaded,file)=>loaded._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {cloudEnabled,readRecord,removeRecord}=require('../lib/records.ts');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3151';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)||!process.env.HEYQUIZ_DATA_DIR||cloudEnabled())throw Error('Explicit isolated local server/data directory with cloud disabled required.');
const artifacts=path.resolve(process.env.ARTIFACT_DIR||'../pippi-creation-review-2026-10-12/tests/launch-flow');fs.mkdirSync(artifacts,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const [label,kind] of [['Recommend a product','product_finder'],['Create a scorecard','scorecard'],['Understand your audience','segmentation'],['Test knowledge',null]]){
  const context=await browser.newContext(),page=await context.newPage(),errors=[],blocked=[];let cleanupId;page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base&&!['data:','about:','blob:'].includes(url.protocol)||/^\/api\/(agent|ai)(?:\/|$)/.test(url.pathname)){blocked.push(url.origin+url.pathname);return route.abort();}return route.continue();});
  try{
   await page.goto(base+'/create');await page.getByRole('group',{name:'Ways to create a quiz',exact:true}).getByRole('link',{name:/^Guided wizard(?:\s|$)/}).click();await page.waitForURL(base+'/create/guided');await page.getByLabel('Quiz name').fill('Launch flow test');await page.getByRole('button',{name:new RegExp('^'+label)}).click();await page.getByRole('button',{name:'Save my quiz',exact:true}).waitFor();
   const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('heyquiz-draft:'+localStorage.getItem('pippi-guest-draft'))));assert.equal(draft.marketing?.kind||null,kind);assert.equal(draft.title,'Launch flow test');cleanupId=draft.id;
   // The guided route owns goal selection; detailed scoring and Share remain in the full editor.
   await page.getByRole('button',{name:'Full editor & advanced tools',exact:true}).click();
   if(kind==='scorecard'){await page.getByLabel('Try an answer').first().selectOption('a0');await page.getByRole('status').filter({hasText:/%|Not enough answers/}).first().waitFor();}
   assert.equal((await context.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}})).status(),200);
   // Claim sets the canonical URL before its full navigation. URL alone can
   // resolve on the old guest editor; wait for the new document and its scripts.
   const claimedDocument=page.waitForEvent('domcontentloaded');claimedDocument.catch(()=>{});
   await page.getByRole('button',{name:'Save my quiz',exact:true}).click();await page.waitForURL(base+'/editor/'+cleanupId);await claimedDocument;await page.waitForLoadState('load');
   await page.getByRole('button',{name:'Share',exact:true}).click();await page.getByRole('button',{name:'Publish and enable sharing',exact:true}).click();await page.getByRole('dialog',{name:'Ready to publish?',exact:true}).getByRole('button',{name:'Publish now',exact:true}).click();
   const success=page.getByRole('dialog',{name:'Your Quiz is Published!',exact:true});await success.waitFor();await success.getByRole('button',{name:'Done',exact:true}).click();const live=page.getByText('Published · Up to date',{exact:true}).filter({visible:true});await live.first().waitFor();await page.reload();await live.first().waitFor();
   const savedEdit=page.waitForResponse(response=>response.url()===base+'/api/forms/'+cleanupId&&response.request().method()==='PUT'&&response.ok(),{timeout:15000});await page.getByRole('textbox',{name:'Quiz name',exact:true}).fill('Edited launch flow');await page.getByText('Published · Unpublished changes',{exact:true}).filter({visible:true}).first().waitFor();
   await savedEdit;await page.reload();await page.getByText('Published · Unpublished changes',{exact:true}).filter({visible:true}).first().waitFor();assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log('PASS guided '+label+', persistence, publication state and edit detection');
  }catch(error){await page.screenshot({path:path.join(artifacts,(kind||'knowledge')+'-failure.png'),fullPage:true}).catch(()=>{});const diagnostic=await page.evaluate(()=>({url:location.pathname,ready:document.readyState,width:innerWidth,body:document.body.innerText})).catch(()=>null);fs.writeFileSync(path.join(artifacts,(kind||'knowledge')+'-failure.json'),JSON.stringify(diagnostic,null,2));throw error;}finally{
   if(cleanupId){const removed=await context.request.delete(base+'/api/forms/'+cleanupId,{headers:{Origin:base}});assert.ok([200,404].includes(removed.status()));const retiredId=createHash('sha256').update(JSON.stringify(['local',cleanupId])).digest('hex'),row=await readRecord('result_report_revocations',retiredId);if(row){assert.equal(row.owner_id,'local');assert.deepEqual(Object.keys(row.payload),['retiredAt']);assert.equal(await readRecord('forms',cleanupId),null);assert.equal(await readRecord('published',cleanupId),null);await removeRecord('result_report_revocations',retiredId,'local');}}
   await context.close();
  }
 }
 const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();try{await page.goto(base+'/create');await page.getByRole('group',{name:'Ways to create a quiz',exact:true}).getByRole('link',{name:/^Guided wizard(?:\s|$)/}).click();await page.getByRole('heading',{name:'What should your quiz do?',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(artifacts,'guided-setup-mobile.png'),fullPage:true});console.log('PASS mobile guided goal setup width');}finally{await context.close();}
}finally{await browser.close();}})().catch(error=>{console.error(error?.name||'Error',error?.message||'Launch flow regression failed');process.exitCode=1;});
