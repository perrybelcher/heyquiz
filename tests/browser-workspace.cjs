// Compiled loopback app + disposable synthetic records only. Email/password UI
// checks explicitly mock HTTP; they prove no real provider mutation or delivery.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE_URL,artifacts=process.env.ARTIFACT_DIR;
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/,'Explicit loopback TEST_BASE_URL required');
assert.ok(process.env.HEYQUIZ_DATA_DIR,'Explicit isolated HEYQUIZ_DATA_DIR required');assert.ok(artifacts,'Explicit ARTIFACT_DIR required');
fs.mkdirSync(artifacts,{recursive:true});const headers={Origin:base},created=[];let browser,context,page,originalProfile,checks=0;
let dialogPolicy='accept',dialogs=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const header=()=>page.locator('.workspace-header');
const nav=()=>page.getByRole('navigation',{name:'Workspace',exact:true});
const quizName=()=>page.getByRole('textbox',{name:'Quiz name',exact:true});
async function eventually(check,message){for(let n=0;n<100;n++){if(await check())return;await sleep(100)}assert.fail(message)}
async function read(id){const response=await context.request.get(`${base}/api/forms/${id}`);assert.equal(response.status(),200);return response.json()}
async function go(href){await page.goto(base+href);await header().waitFor();assert.equal(await header().count(),1,'One shared header only')}
async function check(name,run){try{await run();checks++;console.log('PASS '+name)}catch(error){await page?.screenshot({path:path.join(artifacts,'workspace-failure-'+(checks+1)+'.png'),fullPage:false}).catch(()=>{});console.error('FAILED '+name);throw error}}
async function create(label){const id='qa-workspace-'+label.replace(/[^a-zA-Z0-9_-]/g,'-')+'-'+Date.now(),title='QA Workspace '+label+' '+Date.now();const response=await context.request.post(base+'/api/forms',{headers,data:{id,title,mode:'survey',questions:[{id:'units',title:'Units',type:'number',required:true},{id:'estimate',title:'Total estimate',type:'calculation',calculationFormula:'{{units}} * 20'}]}});assert.equal(response.status(),201,await response.text());created.push(id);return {id,title,baseline:await response.json()}}
async function editor(id){await page.addInitScript(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),id);await go(`/editor/${id}`);await quizName().waitFor()}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
 const login=await context.request.post(base+'/api/auth',{headers,data:{local:true}});assert.equal(login.status(),200);
 const profileResponse=await context.request.get(base+'/api/profile');assert.equal(profileResponse.status(),200);originalProfile=await profileResponse.json();
 const first=await create('Report one'),second=await create('Report two');page=await context.newPage();page.on('dialog',async dialog=>{dialogs.push({type:dialog.type(),message:dialog.message()});if(dialogPolicy==='dismiss')await dialog.dismiss();else await dialog.accept()});
 await check('shared desktop header exposes overview, reports, templates, create and keyboard More navigation',async()=>{
  await go('/');assert.equal(await nav().getByRole('link',{name:'Overview',exact:true}).getAttribute('aria-current'),'page');
  for(const label of ['Overview','Reports','Templates'])await nav().getByRole('link',{name:label,exact:true}).waitFor();assert.equal(await header().getByRole('link',{name:'Create quiz',exact:true}).getAttribute('href'),'/create');
  const more=header().getByRole('button',{name:'More',exact:true});await more.click();await header().getByRole('link',{name:'Experiments',exact:true}).waitFor();await header().getByRole('link',{name:'Help',exact:true}).waitFor();await more.press('Escape');assert.equal(await more.getAttribute('aria-expanded'),'false');assert.equal(await more.evaluate(element=>element===document.activeElement),true);
  await page.screenshot({path:path.join(artifacts,'workspace-overview-desktop.png'),fullPage:false});
 });
 await check('Reports searches retained quiz definitions and opens refresh-stable Results deep link',async()=>{
  await nav().getByRole('link',{name:'Reports',exact:true}).click();await page.waitForURL(base+'/reports');await page.getByRole('heading',{name:'Reports',exact:true}).waitFor();
  await page.getByRole('searchbox',{name:'Search quiz reports'}).fill(first.title);await page.getByRole('heading',{name:first.title,exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:second.title,exact:true}).count(),0);
  const report=page.getByRole('link',{name:'View report',exact:true});assert.equal(await report.count(),1);assert.equal(await report.getAttribute('href'),`/editor/${first.id}?section=results`);
  await page.screenshot({path:path.join(artifacts,'workspace-reports-desktop.png'),fullPage:false});
  await report.click();await page.waitForURL(`${base}/editor/${first.id}?section=results`);await page.getByRole('heading',{name:'Submissions & Analytics',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Submissions & Analytics',exact:true}).waitFor();
  await nav().getByRole('link',{name:'Reports',exact:true}).click();await page.waitForURL(base+'/reports');assert.equal(await nav().getByRole('link',{name:'Reports',exact:true}).getAttribute('aria-current'),'page');
 });
 await check('Profile details save through actual local API, refresh the header and survive reload',async()=>{
  await header().getByRole('button',{name:'Profile',exact:true}).click();await header().getByRole('link',{name:'My profile',exact:true}).click();await page.waitForURL(base+'/profile');
  await page.getByRole('textbox',{name:'Name',exact:true}).fill('QA Workspace Reader');await page.getByRole('textbox',{name:'Company',exact:true}).fill('Synthetic workspace company');await page.getByRole('button',{name:'Save details',exact:true}).click();await page.getByText('Profile details saved.',{exact:true}).waitFor();
  await eventually(async()=>await page.locator('.workspace-header-profile-name').innerText()==='QA Workspace Reader','Header did not refresh saved profile name');
  await page.reload();await page.getByRole('textbox',{name:'Name',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Name',exact:true}).inputValue(),'QA Workspace Reader');assert.equal(await page.getByRole('textbox',{name:'Company',exact:true}).inputValue(),'Synthetic workspace company');
  const saved=await context.request.get(base+'/api/profile');assert.equal((await saved.json()).name,'QA Workspace Reader');
  await page.screenshot({path:path.join(artifacts,'workspace-profile-desktop.png'),fullPage:false});
 });
 await check('temporary profile-read failure keeps known identity and does not claim sign-out',async()=>{
  await page.route('**/api/profile',route=>route.request().method()==='GET'?route.fulfill({status:503,json:{error:'Synthetic profile outage'}}):route.continue());await page.evaluate(()=>window.dispatchEvent(new Event('pippi-profile-change')));
  await header().getByRole('button',{name:'Profile',exact:true}).click();await header().getByText('Profile details are temporarily unavailable.',{exact:true}).waitFor();assert.equal(await header().getByRole('link',{name:'Sign in',exact:true}).count(),0);assert.equal(await page.locator('.workspace-header-profile-name').innerText(),'QA Workspace Reader');
  await page.unroute('**/api/profile');await page.evaluate(()=>window.dispatchEvent(new Event('pippi-profile-change')));await header().getByRole('button',{name:'Profile',exact:true}).press('Escape');
 });
 await check('mobile menu retains destinations, Escape restores focus, and pages fit 375px',async()=>{
  await page.setViewportSize({width:375,height:812});const toggle=header().getByRole('button',{name:'Workspace menu',exact:true});await toggle.focus();await toggle.press('Enter');const menu=page.getByRole('navigation',{name:'Workspace menu',exact:true});await menu.waitFor();
  for(const label of ['Overview','Reports','Templates','Experiments','Help','My profile'])await menu.getByRole('link',{name:label,exact:true}).waitFor();await toggle.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(element=>element===document.activeElement),true);
  await toggle.click();await menu.getByRole('link',{name:'Reports',exact:true}).click();await page.waitForURL(base+'/reports');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await header().getByRole('button',{name:'Workspace menu',exact:true}).click();assert.equal(await page.getByRole('navigation',{name:'Workspace menu',exact:true}).getByRole('link',{name:'Reports',exact:true}).getAttribute('aria-current'),'page');await page.screenshot({path:path.join(artifacts,'workspace-mobile-menu.png'),fullPage:false});
  await page.getByRole('navigation',{name:'Workspace menu',exact:true}).getByRole('link',{name:'Templates',exact:true}).click();await page.waitForURL(base+'/templates');await page.getByRole('heading',{name:/A head start for/}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1440,height:1000});
 });
 await check('header departure saves latest editor changes before full navigation and preserves quiz logic',async()=>{
  await editor(first.id);await quizName().fill(first.title+' saved before leaving');await nav().getByRole('link',{name:'Reports',exact:true}).click();await page.waitForURL(base+'/reports');
  const saved=await read(first.id);assert.equal(saved.title,first.title+' saved before leaving');assert.deepEqual(saved.questions,first.baseline.questions);assert.equal(saved.mode,first.baseline.mode);assert.equal((await context.request.get(`${base}/play/${first.id}`)).status(),404,'Navigation must not publish');
 });
 await check('failed editor save blocks header departure and retains pending work until retry',async()=>{
  await editor(first.id);await page.route(`**/api/forms/${first.id}`,route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'Synthetic workspace save outage'}}):route.continue());
  await quizName().fill(first.title+' retained through failure');await page.getByText('Synthetic workspace save outage',{exact:false}).first().waitFor();await nav().getByRole('link',{name:'Reports',exact:true}).click();await page.locator('.workspace-header-error').waitFor();assert.equal(new URL(page.url()).pathname,`/editor/${first.id}`);assert.equal(await quizName().inputValue(),first.title+' retained through failure');assert.ok(await page.evaluate(id=>Object.keys(localStorage).some(key=>key.startsWith('pippi-draft:v2:')&&key.includes(id)),first.id));
  await page.unroute(`**/api/forms/${first.id}`);await nav().getByRole('link',{name:'Reports',exact:true}).click();await page.waitForURL(base+'/reports');assert.equal((await read(first.id)).title,first.title+' retained through failure');
 });
 await check('unapplied panel navigation offers one review, cancellation retains text, approved leave avoids duplicate native prompt',async()=>{
  await editor(first.id);await page.getByRole('button',{name:'Ending',exact:true}).filter({visible:true}).first().click();await page.getByText('Result email copy',{exact:false}).filter({visible:true}).first().click();await page.getByRole('textbox',{name:'Email subject',exact:true}).fill('Unapplied workspace copy');
  dialogs=[];dialogPolicy='dismiss';await nav().getByRole('link',{name:'Overview',exact:true}).click();await page.locator('.workspace-header-error').waitFor();assert.equal(new URL(page.url()).pathname,`/editor/${first.id}`);assert.equal(await page.getByRole('textbox',{name:'Email subject',exact:true}).inputValue(),'Unapplied workspace copy');assert.equal(dialogs.filter(dialog=>dialog.type==='confirm').length,1);
  dialogs=[];dialogPolicy='accept';await nav().getByRole('link',{name:'Overview',exact:true}).click();await page.waitForURL(base+'/');assert.equal(dialogs.filter(dialog=>dialog.type==='confirm').length,1);assert.equal(dialogs.filter(dialog=>dialog.type==='beforeunload').length,0);
 });
 await check('unapplied panel with unavailable storage cannot leave through header',async()=>{
  await editor(second.id);await page.getByRole('button',{name:'Ending',exact:true}).filter({visible:true}).first().click();await page.getByText('Result email copy',{exact:false}).filter({visible:true}).first().click();
  await page.evaluate(()=>{window.__workspaceSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('Synthetic blocked storage')}});await page.getByRole('textbox',{name:'Email subject',exact:true}).fill('Memory-only workspace panel');await page.getByText('Pending copy could not be backed up',{exact:false}).waitFor();
  await nav().getByRole('link',{name:'Reports',exact:true}).click();await page.locator('.workspace-header-error').waitFor();assert.equal(new URL(page.url()).pathname,`/editor/${second.id}`);assert.equal(await page.getByRole('textbox',{name:'Email subject',exact:true}).inputValue(),'Memory-only workspace panel');await page.screenshot({path:path.join(artifacts,'workspace-protected-panel.png'),fullPage:false});
  await page.evaluate(()=>{Storage.prototype.setItem=window.__workspaceSetItem});await page.getByRole('button',{name:'Discard unapplied changes',exact:true}).click();await nav().getByRole('link',{name:'Overview',exact:true}).click();await page.waitForURL(base+'/');
 });
 await check('profile security UI preserves rejected entries and reports pending email honestly (mocked HTTP only)',async()=>{
  let view={name:'Synthetic Hosted User',company:'Synthetic',email:'old@example.test',revision:1,local:false},emailCalls=0,passwordCalls=0;
  await page.route('**/api/profile',route=>route.request().method()==='GET'?route.fulfill({status:200,json:view}):route.continue());
  await page.route('**/api/profile/email',route=>{emailCalls++;if(emailCalls===1)return route.fulfill({status:401,json:{error:'Synthetic current password rejected'}});view={...view,pendingEmail:'new@example.test'};return route.fulfill({status:200,json:view})});
  await page.route('**/api/profile/password',route=>{passwordCalls++;return route.fulfill({status:200,json:{reauthRequired:false}})});
  await go('/profile');await page.getByRole('textbox',{name:'New email address',exact:true}).fill('new@example.test');await page.getByLabel('Current password to confirm email change',{exact:true}).fill('synthetic-current-password');await page.getByRole('button',{name:'Request email change',exact:true}).click();await page.getByText('Synthetic current password rejected',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'New email address',exact:true}).inputValue(),'new@example.test');
  await page.getByRole('button',{name:'Request email change',exact:true}).click();await page.getByText('Pending confirmation: new@example.test. This is not your confirmed sign-in email yet.',{exact:true}).waitFor();await page.getByText('Current sign-in email: old@example.test',{exact:true}).waitFor();
  await page.getByLabel('Current password',{exact:true}).fill('synthetic-current-password');await page.getByLabel('New password',{exact:true}).fill('synthetic-new-password');await page.getByLabel('Confirm new password',{exact:true}).fill('different-new-password');await page.getByRole('button',{name:'Update password',exact:true}).click();await page.getByText('The new passwords do not match.',{exact:true}).waitFor();assert.equal(passwordCalls,0);
  await page.getByLabel('Confirm new password',{exact:true}).fill('synthetic-new-password');await page.getByRole('button',{name:'Update password',exact:true}).click();await page.getByText('Password updated.',{exact:true}).waitFor();assert.equal(passwordCalls,1);assert.equal(await page.getByLabel('Current password',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('New password',{exact:true}).inputValue(),'');
  await page.unroute('**/api/profile');await page.unroute('**/api/profile/email');await page.unroute('**/api/profile/password');
 });
 await check('delayed sign-out pauses profile editing and a failed logout restores controls (mocked HTTP only)',async()=>{
  await page.evaluate(()=>localStorage.clear());await go('/profile');const name=page.getByRole('textbox',{name:'Name',exact:true});await name.waitFor();const before=await name.inputValue();let release;
  await page.route('**/api/auth',async route=>{if(route.request().method()!=='DELETE')return route.continue();await new Promise(resolve=>release=resolve);return route.fulfill({status:503,json:{error:'Synthetic delayed logout failure'}})});
  await header().getByRole('button',{name:'Profile',exact:true}).click();await header().getByRole('button',{name:'Sign out',exact:true}).click();await eventually(()=>!!release,'Logout request did not begin');
  assert.equal(await name.evaluate(element=>!!element.closest('[inert]')),true,'Profile must stay inert while logout is pending');await name.evaluate(element=>element.focus());assert.equal(await name.evaluate(element=>element===document.activeElement),false);await page.keyboard.type('Unexpected typing during logout');assert.equal(await name.inputValue(),before);
  release();await page.locator('.workspace-header-error').waitFor();assert.equal(await name.evaluate(element=>!!element.closest('[inert]')),false,'Failed logout must restore editing');assert.equal(new URL(page.url()).pathname,'/profile');await page.unroute('**/api/auth');
 });
 await check('anonymous creator header offers sign-in without exposing private profile details',async()=>{
  const anonymous=await browser.newContext({viewport:{width:1440,height:900}}),visitor=await anonymous.newPage();await visitor.goto(base+'/create');const visitorHeader=visitor.locator('.workspace-header');await visitorHeader.waitFor();await visitorHeader.getByRole('button',{name:'Profile',exact:true}).click();await visitorHeader.getByRole('link',{name:'Sign in',exact:true}).waitFor();await visitorHeader.getByRole('link',{name:'Create account',exact:true}).waitFor();assert.equal(await visitorHeader.getByText('QA Workspace Reader',{exact:true}).count(),0);await anonymous.close();
 });
 console.log(`PASS compiled workspace acceptance: ${checks} journeys. Synthetic local profile/quiz changes only; security forms mocked, no real provider mutation.`);
}finally{
 if(context){await context.request.post(base+'/api/auth',{headers,data:{local:true}}).catch(()=>{});if(originalProfile){const response=await context.request.get(base+'/api/profile').catch(()=>null);if(response?.status()===200){const current=await response.json();await context.request.patch(base+'/api/profile',{headers:{...headers,'X-Pippi-Account':(await (await context.request.post(base+'/api/auth/session',{headers})).json()).accountKey},data:{name:originalProfile.name,company:originalProfile.company,revision:current.revision}}).catch(()=>{})}}for(const id of created)await context.request.delete(`${base}/api/forms/${id}`,{headers}).catch(()=>{});}
 await browser?.close();
}})().catch(error=>{console.error(error);process.exitCode=1});
