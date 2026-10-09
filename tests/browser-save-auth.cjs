const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3141';
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(10000);
  const id = 'save-auth-' + Date.now();
  const login = () => context.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}});
  try {
    assert.equal((await login()).status(),200);
    const created = await context.request.post(base+'/api/forms',{data:{id,title:'Auth recovery test',mode:'survey',questions:[{id:'q',type:'short_answer',title:'Your answer'}]},headers:{Origin:base}});
    assert.equal(created.status(),201,await created.text());
    await page.goto(base+'/editor/'+id);
    await page.locator('input').first().waitFor();
    await context.clearCookies();
    await page.locator('input').filter({visible:true}).first().fill('Unsaved recovery test');
    const alert = page.locator('.hq-error[role=alert]');
    await alert.getByText('Sign in to save your quiz',{exact:true}).waitFor();
    for (const [name,path] of [['Sign in ↗','/login'],['Create account ↗','/signup']]) {
      const link=alert.getByRole('link',{name,exact:true});
      assert.equal(await link.getAttribute('href'),path);
      assert.equal(await link.getAttribute('target'),'_blank');
    }
    const popupPromise=context.waitForEvent('page');
    await alert.getByRole('link',{name:'Sign in ↗',exact:true}).click();
    const popup=await popupPromise;
    await popup.getByRole('button',{name:'Open local workspace'}).click();
    await popup.waitForURL(base+'/', {timeout:10000});
    assert.ok(page.url().endsWith('/editor/'+id));
    assert.equal(await page.locator('input').filter({visible:true}).first().inputValue(),'Unsaved recovery test');
    const savedResponse = page.waitForResponse(r => r.url() === base+'/api/forms/'+id && r.request().method() === 'PUT');
    await alert.getByRole('button',{name:'Retry save'}).click();
    assert.equal((await savedResponse).status(),200);
    await alert.waitFor({state:'hidden'});
    const saved=await context.request.get(base+'/api/forms/'+id);
    assert.equal((await saved.json()).title,'Unsaved recovery test');
    console.log('PASS expired session offers both account links; sign-in opens separately; edits retained; retry persists quiz');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
