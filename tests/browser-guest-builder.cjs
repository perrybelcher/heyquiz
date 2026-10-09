const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3142';
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const context = await browser.newContext();
 const page = await context.newPage();
 try {
  await page.goto(base+'/welcome');
  await page.getByRole('link',{name:'Create your first quiz'}).first().click();
  await page.waitForURL(base+'/create');
  const title=page.locator('input').filter({visible:true}).first();
  await title.fill('My guest quiz');
  await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('heyquiz-draft:') && localStorage.getItem(k).includes('My guest quiz')));
  page.on('dialog', d=>d.accept());
  await page.reload();
  await title.waitFor();
  assert.equal(await title.inputValue(),'My guest quiz');
  const failed=page.waitForResponse(r=>r.url()===base+'/api/forms'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save my quiz',exact:true}).click();
  assert.equal((await failed).status(),401);
  const alert=page.locator('.hq-error');
  await alert.getByRole('link',{name:'Create account ↗'}).waitFor();
  assert.equal(await alert.getByRole('link',{name:'Create account ↗'}).getAttribute('target'),'_blank');
  const login=await context.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}});
  assert.equal(login.status(),200);
  await alert.getByRole('button',{name:'Retry save'}).click();
  await page.waitForURL(/\/editor\//);
  assert.equal(await title.inputValue(),'My guest quiz');
  const id=page.url().split('/').pop();
  const saved=await context.request.get(base+'/api/forms/'+id);
  assert.equal((await saved.json()).title,'My guest quiz');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pippi-guest-draft')),null);
  console.log('PASS guest entry, editing, reload recovery, unauthorized save, free signup link, authenticated claim and persisted draft');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
