const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || path.resolve(__dirname, '../../pippi-overnight-2026-10-12/draft-safety'));
fs.mkdirSync(artifacts, { recursive: true });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3162';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/, 'Run only against the isolated local app');
const headers = { Origin: base };
const id = 'qa-draft-safety-' + Date.now();
const original = { id, title: 'Protected marketing campaign', mode: 'form', pages: [{ id: 'original-page', title: 'Original questions', questionIds: ['q'] }], questions: [{ id: 'q', pageId: 'original-page', title: 'Original question', type: 'multiple_choice', options: [{id:'yes', label:'Yes'}] }], marketing: { kind:'product_finder', outcomes:[{id:'product',title:'Original product',description:'Original result',minPoints:1}], rules:[{id:'r',questionId:'q',answerId:'yes',targetId:'product',effect:'add',points:1}] }, theme:{primaryColor:'#123456'}, capture:{enabled:true,placement:'before_results',required:false,name:'optional',phone:'off',title:'Your result',description:'Keep your result',buttonText:'Continue',marketingEnabled:true,marketingLabel:'Send me useful updates',privacyUrl:'https://example.com/privacy'}, coverPage:{enabled:true,title:'Original promise',buttonText:'Begin'}, endingPage:{enabled:true,title:'Original ending',message:'Original closing',buttonText:'Done'} };
const proposal = { id:'generated', title:'Unwanted generated title',mode:'quiz',questions:['q','generated-2','generated-3'].map((id,index)=>({id,title:`Suggested question ${index+1}`,type:'multiple_choice',options:[{id:'yes',label:'Proposed yes',isCorrect:true},{id:'no',label:'Proposed no'}],points:10})) };
(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  const read = async () => (await context.request.get(`${base}/api/forms/${id}`)).json();
  const waitQuestions = async count => { for(let i=0;i<100;i++){if((await read()).questions.length===count)return;await page.waitForTimeout(100);}assert.fail(`Expected ${count} saved questions`); };
  try {
    assert.equal((await context.request.post(base+'/api/auth',{data:{local:true},headers})).status(),200);
    assert.equal((await context.request.post(base+'/api/forms',{data:original,headers})).status(),201);
    const baseline = await read();
    await page.addInitScript(id => localStorage.setItem('pippi-editor-mode:'+id,'advanced'),id);
    await page.route('**/api/agent/generate',r=>r.fulfill({status:200,json:{form:proposal}}));
    await page.goto(`${base}/editor/${id}`);
    const generate = async () => { await page.getByRole('button',{name:'Agent',exact:true}).click();await page.getByLabel('What should the new questions cover?').fill('Synthetic question suggestions');await page.getByRole('button',{name:'Generate suggestions to review',exact:true}).click();await page.getByRole('heading',{name:'Review your question suggestions',exact:true}).waitFor(); };
    await generate();
    assert.equal((await read()).questions.length,1,'generation must not autosave a replacement');
    await page.getByRole('button',{name:'Discard suggestions',exact:true}).click();
    assert.equal((await read()).title,baseline.title,'discard leaves the original title');
    await generate();
    await page.screenshot({path:path.join(artifacts,'ai-question-review.png')});
    await page.getByRole('dialog').getByRole('checkbox').last().uncheck();
    await page.getByRole('button',{name:'Add 2 questions',exact:true}).click();
    await waitQuestions(3);
    const saved=await read();
    for(const key of ['title','mode','theme','settings','marketing','logicRules','capture','coverPage','endingPage','outcomeTiers'])assert.deepEqual(saved[key],baseline[key],`${key} survives AI additions`);
    assert.deepEqual(saved.questions[0],baseline.questions[0]);
    assert.equal(new Set(saved.questions.map(q=>q.id)).size,3,'AI IDs cannot collide');
    assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('pippi-draft-history:'+id)).length,id),1);
    await page.reload();
    await page.getByRole('button',{name:'Draft history',exact:true}).click();
    await page.screenshot({path:path.join(artifacts,'persistent-draft-history.png')});
    await page.getByRole('button',{name:'Review restore',exact:true}).click();
    await page.getByRole('button',{name:'Restore this draft',exact:true}).click();
    await waitQuestions(1);
    assert.ok((await read()).revision>saved.revision,'restoration uses current server revision');
    assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('pippi-draft-history:'+id)).length,id),2,'restore checkpoints the newer draft too');

    // Hold the first save while another edit arrives; preview must await both writes.
    let release; let announce; const firstWrite=new Promise(resolve=>announce=resolve);const held=new Promise(resolve=>release=resolve);let puts=0;
    await page.route(`**/api/forms/${id}`, async route=>{if(route.request().method()==='PUT'&&++puts===1){announce();await held;}await route.continue();});
    await page.locator('input').first().fill('Latest before preview');
    const popupPromise=page.waitForEvent('popup');
    await page.getByRole('button',{name:'Preview',exact:true}).click();
    const popup=await popupPromise;await firstWrite;
    assert.equal(popup.url(),'about:blank');
    await page.locator('input').first().fill('Newer edit during save');
    release();await popup.waitForURL(`**/play/${id}?preview=1`);
    assert.equal((await read()).title,'Newer edit during save');assert.ok(puts>=2,'preview drains edits arriving during save');
    await popup.close();await page.unroute(`**/api/forms/${id}`);

    // Every alternative preview route must also flush unsaved edits.
    for (const [tab, label] of [['Results','Test Quiz'],['Results','Try a private preview'],['Share','Preview privately']]) {
      await page.getByRole('button',{name:tab,exact:true}).click();
      await page.locator('input').first().fill('Current draft via '+label);
      const previewPromise=page.waitForEvent('popup');
      await page.getByRole('button',{name:label,exact:true}).click();
      const preview=await previewPromise;await preview.waitForURL(`**/play/${id}?preview=1`);
      assert.equal((await read()).title,'Current draft via '+label);await preview.close();
    }
    await page.getByRole('button',{name:'Guided setup',exact:true}).click();
    await page.getByRole('button',{name:/^1\. /}).click();
    await page.getByLabel('Quiz title',{exact:true}).fill('Current draft via guided preview');
    await page.getByRole('button',{name:/^5\. /}).click();
    const guidedPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Save & preview',exact:true}).click();
    const guidedPreview=await guidedPromise;await guidedPreview.waitForURL(`**/play/${id}?preview=1`);assert.equal((await read()).title,'Current draft via guided preview');await guidedPreview.close();
    await page.getByRole('button',{name:'Full editor & advanced tools',exact:true}).click();
    await page.getByRole('button',{name:'Edit',exact:true}).click();

    // Save failure closes the provisional popup and protects the browser backup.
    let failRelease, failAnnounce, failedWrites=0;
    const heldFailure=new Promise(resolve=>failRelease=resolve), failureStarted=new Promise(resolve=>failAnnounce=resolve);
    await page.route(`**/api/forms/${id}`,async route=>{
      if(route.request().method()!=='PUT'){await route.continue();return;}
      failedWrites++;if(failedWrites===1){failAnnounce();await heldFailure;}
      await route.fulfill({status:503,json:{error:'Synthetic save unavailable'}});
    });
    await page.locator('input').first().fill('Not yet saved');
    const failedPopupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Preview',exact:true}).click();const failedPopup=await failedPopupPromise;
    await failureStarted;
    // Both navigation handlers join the same in-flight preview save. A shared
    // failure must return false to all three actions without overlapping retries.
    await page.getByTitle('pippi - Back to Dashboard',{exact:true}).click();
    await page.getByTitle('pippi - Back to Dashboard',{exact:true}).click();
    failRelease();
    await page.getByText('Synthetic save unavailable',{exact:false}).waitFor();
    if(!failedPopup.isClosed())await failedPopup.waitForEvent('close');
    await page.waitForTimeout(150);
    assert.equal(failedWrites,1,'concurrent waiters share failure instead of retrying the same revision');
    assert.equal(page.url(),`${base}/editor/${id}`,'failed save prevents navigation too');
    assert.equal(await page.evaluate(id=>JSON.parse(sessionStorage.getItem('heyquiz-draft:'+id)).title,id),'Not yet saved');
    assert.equal((await read()).title,'Current draft via guided preview');
    await page.unroute(`**/api/forms/${id}`);await page.getByRole('button',{name:'Retry save',exact:true}).click();
    await page.getByText('Saved',{exact:true}).waitFor();

    // Storage failure blocks accepting an AI proposal instead of promising a nonexistent undo.
    await generate();
    await page.evaluate(()=>{const originalSet=Storage.prototype.setItem;window.__restoreStorage=()=>Storage.prototype.setItem=originalSet;Storage.prototype.setItem=function(key,value){if(key.startsWith('pippi-draft-history:'))throw Error('Synthetic storage quota');return originalSet.call(this,key,value);};});
    await page.getByRole('button',{name:'Add 3 questions',exact:true}).click();
    await page.getByText('Your draft was not changed because a safety checkpoint could not be saved.',{exact:false}).waitFor();
    assert.equal((await read()).questions.length,1);
    await page.evaluate(()=>window.__restoreStorage());await page.getByRole('button',{name:'Discard suggestions',exact:true}).click();
    // Guests receive sign-in/account links and keep their draft, never a broken preview tab.
    const guestContext=await browser.newContext();const guestPage=await guestContext.newPage();
    try {
      await guestPage.addInitScript(form=>{localStorage.setItem('pippi-guest-draft',form.id);localStorage.setItem('heyquiz-draft:'+form.id,JSON.stringify(form));localStorage.setItem('pippi-editor-mode:'+form.id,'advanced');},original);
      await guestPage.route('**/api/forms',r=>r.fulfill({status:401,json:{error:'Sign in to save your quiz'}}));
      await guestPage.goto(base+'/create');await guestPage.getByRole('button',{name:'Save to preview',exact:true}).click();
      await guestPage.getByRole('link',{name:'Sign in ↗',exact:true}).waitFor();await guestPage.getByRole('link',{name:'Create account ↗',exact:true}).waitFor();
      assert.equal(guestContext.pages().length,1);assert.ok(await guestPage.evaluate(id=>sessionStorage.getItem('heyquiz-draft:'+id),id));
    } finally { await guestContext.close(); }
    await page.getByRole('button',{name:'Draft history',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Draft history',exact:true}).evaluate(el=>el===document.activeElement),true);
    console.log('PASS Playwright: AI review/cancel/selection, all campaign settings preserved, collision safety, reload + reversible restore, all five preview routes save current edits, preview drains in-flight edits, concurrent actions share failed writes, failed-save popup closes with backup, quota failure blocks AI mutation, guest sign-in guidance and dialog Escape focus return. No real AI request, email or published changes.');
  } finally {
    await context.request.delete(`${base}/api/forms/${id}`,{headers});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
