const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript'), {createHash}=require('node:crypto');
require.extensions['.ts']=(loaded,file)=>loaded._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {cloudEnabled,readRecord,removeRecord}=require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3142';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR || cloudEnabled()) throw Error('Explicit isolated local server and data directory required.');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const context = await browser.newContext();
 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 let cleanupId;
 try {
  await page.goto(base+'/welcome');
  await page.getByRole('link',{name:'Create your first quiz'}).first().click();
  await page.waitForURL(base+'/create');await page.getByRole('group',{name:'Ways to create a quiz',exact:true}).getByRole('link',{name:/^Guided wizard(?:\s|$)/}).click();await page.waitForURL(base+'/create/guided');await page.getByRole('button',{name:/^Test knowledge/}).click();
  // Guest drafts open guided; the claimed editor may restore its full-editor mode.
  const title=page.getByRole('textbox',{name:/^Quiz (title|name)$/});
  await title.fill('My guest quiz');
  await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('heyquiz-draft:') && localStorage.getItem(k).includes('My guest quiz')));
  const draftId = await page.evaluate(()=>localStorage.getItem('pippi-guest-draft'));
  assert.ok(draftId);
  page.on('dialog', d=>d.accept());
  await page.reload();
  await title.waitFor();
  assert.equal(await title.inputValue(),'My guest quiz');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pippi-guest-draft')),draftId);
  await page.goto(base+'/create');await page.getByRole('heading',{name:'How would you like to start?',exact:true}).waitFor();await page.getByRole('region',{name:'Continue your draft',exact:true}).getByRole('link',{name:'Continue editing',exact:true}).click();await page.waitForURL(base+'/create/draft');await title.waitFor();assert.equal(await title.inputValue(),'My guest quiz');
  const failed=page.waitForResponse(r=>r.url()===base+'/api/forms'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save my quiz',exact:true}).click();
  assert.equal((await failed).status(),401);
  const prompt=page.getByRole('dialog',{name:'Keep your quiz moving.',exact:true});
  await prompt.getByRole('link',{name:/^Create free account/}).waitFor();
  assert.equal(await prompt.getByRole('link',{name:/^Create free account/}).getAttribute('target'),'_blank');
  assert.equal(await page.locator('.hq-error').count(),0,'Expected authentication uses the account prompt, not an error toast');
  const login=await context.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}});
  assert.equal(login.status(),200);
  // Establish that this unique browser draft does not replace an existing quiz.
  assert.equal((await context.request.get(base+'/api/forms/'+draftId)).status(),404);
  cleanupId=draftId;
  const claimDocument=await page.evaluate(()=>performance.timeOrigin);
  await prompt.getByRole('button',{name:'Save to my account',exact:true}).click();
  await page.waitForURL(/\/editor\//);
  await page.waitForFunction(before=>performance.timeOrigin!==before,claimDocument);
  await title.waitFor();
  assert.equal(await title.inputValue(),'My guest quiz');
  const id=page.url().split('/').pop();
  assert.equal(id,draftId);
  const saved=await context.request.get(base+'/api/forms/'+id);
  assert.equal((await saved.json()).title,'My guest quiz');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pippi-guest-draft')),null);
  assert.equal(await page.getByText('Unsaved edits from your previous session are available.',{exact:false}).count(),0,'A confirmed unchanged guest claim must not offer false recovery');
  assert.deepEqual(errors,[],'No hydration or application errors');
  if(process.env.ARTIFACT_DIR){fs.mkdirSync(process.env.ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ARTIFACT_DIR,'guest-claimed.png')});}
  console.log('PASS guest entry, editing, reload recovery, unauthorized save, free signup link, authenticated claim and persisted draft');
 } finally {
  try {
   if(cleanupId){const removed=await context.request.delete(base+'/api/forms/'+cleanupId,{headers:{Origin:base}});assert.ok([200,404].includes(removed.status()),'Only this test draft is deleted');const receiptId=createHash('sha256').update(JSON.stringify(['local',cleanupId])).digest('hex'),receipt=await readRecord('result_report_revocations',receiptId);if(receipt){assert.equal(receipt.owner_id,'local');assert.deepEqual(Object.keys(receipt.payload),['retiredAt']);assert.equal(await readRecord('forms',cleanupId),null);await removeRecord('result_report_revocations',receiptId,'local');}}
  } finally {await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
