// Compiled loopback app and explicitly isolated synthetic records only.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {writeRecord,removeRecord,cloudEnabled}=require('../lib/records.ts');
const base=process.env.TEST_BASE_URL,artifacts=process.env.ARTIFACT_DIR;
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(process.env.HEYQUIZ_DATA_DIR&&artifacts);assert.equal(cloudEnabled(),false);
fs.mkdirSync(artifacts,{recursive:true});const stamp=Date.now(),one=`qa-contact-one-${stamp}`,two=`qa-contact-two-${stamp}`,foreign=`qa-contact-foreign-${stamp}`,rows=[],headers={Origin:base};let browser,context,page;
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
 assert.equal((await context.request.get(base+'/contacts',{maxRedirects:0})).status(),307);
 assert.equal((await context.request.post(base+'/api/auth',{headers,data:{local:true}})).status(),200);
 for(const [id,title] of [[one,'QA Contact Quiz One'],[two,'QA Contact Quiz Two']])assert.equal((await context.request.post(base+'/api/forms',{headers,data:{id,title,mode:'survey',questions:[{id:'q',title:'Preference',type:'short_answer'}]}})).status(),201);
 for(let i=0;i<27;i++){
  const id=`qa-contact-response-${stamp}-${i}`,formId=i===26?two:one,date=`2026-10-26T12:00:${String(59-i).padStart(2,'0')}.000Z`;
  await writeRecord('submissions',id,'local',{id,formId,submittedAt:date,totalQuestions:1,totalPointsPossible:0,totalPointsEarned:0,percentageScore:0,passed:true,grading:[{questionId:'q',questionTitle:'Preference',userAnswer:'Bread'}],answers:{private:'Do not serialize raw answers into Contacts overview'},contact:{name:i===0?'Alex Example':`Reader ${String(i).padStart(2,'0')}`,email:i===0?'alex@example.test':`reader${i}@example.test`,phone:i===0?'123456789':'',marketingConsent:i%2===1,recordedAt:date,consentText:'Optional tips',privacyUrl:'https://example.test/privacy',formRevision:1,purposeText:'Synthetic verification',placement:'before_results'}},0);rows.push([id,'local']);
 }
 await writeRecord('forms',foreign,'foreign-owner',{id:foreign,title:'Private foreign quiz',mode:'survey',questions:[],theme:{},settings:{}},0);
 await writeRecord('submissions',foreign,'foreign-owner',{formId:foreign,submittedAt:'2026-10-26',contact:{name:'DO NOT SHOW FOREIGN CONTACT',email:'foreign@example.test'}},0);rows.push([foreign,'foreign-owner']);
 assert.equal((await context.request.get(`${base}/contacts?quiz=${foreign}`)).status(),404);
 page=await context.newPage();await page.goto(base+'/contacts');
 const nav=page.getByRole('navigation',{name:'Workspace',exact:true});assert.equal(await nav.getByRole('link',{name:'Contacts',exact:true}).getAttribute('aria-current'),'page');
 const directory=()=>page.getByRole('region',{name:'Contact directory',exact:true});
 await page.getByRole('heading',{name:'Alex Example',exact:true}).waitFor();assert.equal(await directory().getByRole('listitem').count(),25);assert.equal(await page.getByText('DO NOT SHOW FOREIGN CONTACT',{exact:true}).count(),0);
 assert.equal((await page.content()).includes('Do not serialize raw answers into Contacts overview'),false);
 await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Page 2 of 2 · 25 per page',{exact:true}).waitFor();assert.equal(await directory().getByRole('listitem').count(),2);
 const search=page.getByRole('searchbox',{name:'Search contacts',exact:true});await search.fill(' ALEX@EXAMPLE.TEST ');await page.getByRole('heading',{name:'Alex Example',exact:true}).waitFor();assert.equal(await directory().getByRole('listitem').count(),1);await page.getByText('Page 1 of 1 · 25 per page',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Marketing consent',exact:true}).selectOption('yes');await page.getByRole('heading',{name:'No contacts match these filters',exact:true}).waitFor();
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('combobox',{name:'Quiz',exact:true}).selectOption(two);await page.getByRole('heading',{name:'Reader 26',exact:true}).waitFor();assert.equal(await directory().getByRole('listitem').count(),1);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('button',{name:'Refresh contacts',exact:true}).click();await page.getByRole('heading',{name:'Alex Example',exact:true}).waitFor();await page.screenshot({path:path.join(artifacts,'contacts-overview-desktop.png'),fullPage:false});
 for(const width of [1024,375]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 const menu=page.getByRole('button',{name:'Workspace menu',exact:true});await menu.click();await page.getByRole('navigation',{name:'Workspace menu',exact:true}).getByRole('link',{name:'Contacts',exact:true}).waitFor();await menu.press('Escape');await page.screenshot({path:path.join(artifacts,'contacts-overview-mobile.png'),fullPage:false});
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}/reports/${one}`);
 await page.getByRole('tab',{name:'Responses',exact:true}).click();const responses=page.getByRole('region',{name:'Responses',exact:true});await responses.locator('summary').filter({hasText:'Alex Example'}).waitFor();await responses.getByText('alex@example.test',{exact:true}).waitFor();
 const reportSearch=responses.getByRole('searchbox',{name:'Search responses',exact:true});for(const query of [' Alex Example ','ALEX@EXAMPLE.TEST']){await reportSearch.fill(query);await responses.getByText('Showing 1–1 of 1 matching responses · 26 total',{exact:true}).waitFor();await responses.locator('summary').filter({hasText:'Alex Example'}).waitFor();}
 await reportSearch.fill('Bread');await responses.getByText('Showing 1–25 of 26 matching responses · 26 total',{exact:true}).waitFor();
 await page.getByRole('link',{name:'View contacts',exact:true}).click();await page.waitForURL(`${base}/contacts?quiz=${one}`);assert.equal(await page.getByRole('combobox',{name:'Quiz',exact:true}).inputValue(),one);
 // The header's existing dirty-editor guard must also cover its new destination.
 await page.addInitScript(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),one);await page.goto(`${base}/editor/${one}`);await page.getByRole('textbox',{name:'Quiz name',exact:true}).fill('QA Contact Quiz One updated');await nav.getByRole('link',{name:'Contacts',exact:true}).click();await page.waitForURL(base+'/contacts');assert.equal((await(await context.request.get(`${base}/api/forms/${one}`)).json()).title,'QA Contact Quiz One updated');
 console.log('PASS compiled Contacts navigation/report identity: captured-name/email and answer search, desktop/mobile active nav, quiz/consent filters, 25-row pagination/reset, refresh, report deep link, auth/owner isolation, omitted private answers and acknowledged dirty-editor departure.');
}finally{for(const [id,owner] of rows)await removeRecord('submissions',id,owner);await removeRecord('forms',foreign,'foreign-owner');if(context)for(const id of [one,two])await context.request.delete(`${base}/api/forms/${id}`,{headers});await browser?.close()}})().catch(error=>{console.error(error);process.exitCode=1});
