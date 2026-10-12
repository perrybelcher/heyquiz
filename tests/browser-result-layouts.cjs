const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {scorecardForm}=require('./fixtures/result-layouts.cjs');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3162';assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/,'Local fixtures only');
const artifacts=path.resolve(__dirname,'../../pippi-overnight-2026-10-12/result-layouts');fs.mkdirSync(artifacts,{recursive:true});
const id='qa-result-layouts-'+Date.now(),headers={Origin:base};
(async()=>{
  const browser=await chromium.launch({channel:'chrome'}),owner=await browser.newContext({viewport:{width:1440,height:1000}}),visitor=await browser.newContext({viewport:{width:1100,height:1000}}),editor=await owner.newPage();
  const form=scorecardForm(id),read=async()=>(await owner.request.get(`${base}/api/forms/${id}`)).json();
  const pages=[];let firstResult;
  try{
    assert.equal((await owner.request.post(base+'/api/auth',{data:{local:true},headers})).status(),200);
    assert.equal((await owner.request.post(base+'/api/forms',{data:form,headers})).status(),201);
    await editor.addInitScript(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),id);
    await editor.goto(`${base}/editor/${id}`);await editor.getByRole('button',{name:'Marketing',exact:true}).click();
    for(const [layout,label] of [['stacked','Stacked'],['score_overview','Score overview'],['action_plan','Action plan']]){
      await editor.getByRole('radio',{name:new RegExp('^'+label)}).check();
      for(let attempt=0;attempt<80;attempt++){if((await read()).marketing.presentation.layout===layout)break;if(attempt===79)assert.fail('Layout did not autosave');await editor.waitForTimeout(100);}
      await editor.reload();await editor.getByRole('button',{name:'Marketing',exact:true}).click();
      assert.equal(await editor.getByRole('radio',{name:new RegExp('^'+label)}).isChecked(),true,'layout survives reload');
      for(const [index,question] of form.questions.entries())await editor.locator('aside').getByLabel(question.title,{exact:false}).selectOption(index===2?'a0':'a2');
      const simulated=editor.getByRole('region',{name:'Simulated result'});
      assert.equal(await simulated.locator('[data-result-layout]').getAttribute('data-result-layout'),layout);
      assert.equal(await simulated.locator('[data-category-id="operations"]').getByText('0%',{exact:true}).count(),1);
      assert.equal(await simulated.locator('[data-result-section="low"]').count(),1);assert.equal(await simulated.locator('[data-result-section="high"]').count(),0);
      // Simulating unknown coverage preserves a missing score, not a misleading zero.
      await editor.locator('aside').getByLabel(form.questions[0].title,{exact:false}).selectOption('a3');
      assert.equal(await simulated.locator('[data-category-id="operations"]').getByText('Not enough information',{exact:true}).count(),1);
      assert.equal(await simulated.locator('[data-result-block="overall"]').getByText('Not enough information',{exact:true}).count(),1);
      assert.equal(await simulated.locator('[data-result-block="primary-action"]').count(),0);
      assert.equal(await simulated.locator('[data-result-section="low"]').count(),0);
      await editor.locator('aside').getByLabel(form.questions[0].title,{exact:false}).selectOption('a2');
      assert.equal((await owner.request.post(`${base}/api/forms/${id}/publish`,{data:{},headers})).status(),200);
      const page=await visitor.newPage();pages.push(page);await page.goto(`${base}/play/${id}`);await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
      for(const [index,question] of form.questions.entries()){
        await page.getByRole('heading',{name:question.title,exact:true}).waitFor();await page.getByRole('radio',{name:question.options[index===2?0:2].label,exact:true}).check();
        await page.getByRole('button',{name:index===form.questions.length-1?'Review answers':'Continue',exact:true}).click();
      }
      const responsePromise=page.waitForResponse(r=>r.url()===`${base}/api/forms/${id}/submit`&&r.request().method()==='POST');
      await page.getByRole('button',{name:'Submit response',exact:true}).click();const result=await(await responsePromise).json();if(!firstResult)firstResult=result;
      assert.equal(result.marketing.presentation.layout,layout);assert.equal(result.marketing.overallScore,50);assert.deepEqual(result.marketing.categories.map(c=>c.score),[0,100]);
      const card=page.locator(`[data-result-layout="${layout}"]`);await card.waitFor();
      assert.equal(await card.locator('[data-category-id]').count(),2,'both favorable and unfavorable category details remain visible');
      await card.getByText('2 of 2 applicable questions scored',{exact:true}).first().waitFor();await card.getByText('1 of 1 applicable questions scored',{exact:true}).first().waitFor();
      assert.equal(await card.locator('[data-result-section="low"]').count(),1);assert.equal(await card.locator('[data-result-section="high"]').count(),0);
      const order=await card.locator(':scope > [data-result-block]').evaluateAll(elements=>elements.map(el=>el.getAttribute('data-result-block')));
      if(layout==='stacked')assert.ok(order.indexOf('overall')<order.indexOf('priorities'));
      if(layout==='score_overview'){assert.ok(order.indexOf('category-overview')<order.indexOf('priorities'));assert.equal(await card.locator('[data-category-overview]').count(),2);}
      if(layout==='action_plan'){assert.ok(order.indexOf('advice')<order.indexOf('evidence'));assert.ok(order.indexOf('primary-action')<order.indexOf('evidence'));}
      await page.screenshot({path:path.join(artifacts,`${layout}-desktop.png`),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'result fits a phone viewport');
      assert.equal(await page.locator('.hq-player > header').count(),1,'mobile document has one player header');
      await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(artifacts,`${layout}-mobile.png`)});
      await card.locator('[data-category-id="operations"]').scrollIntoViewIfNeeded();
      assert.equal(await card.locator('[data-category-id="operations"]').getByText('0%',{exact:true}).isVisible(),true);
      await page.screenshot({path:path.join(artifacts,`${layout}-mobile-evidence.png`)});
      // Keep navigation in this test page while still exercising the real React click callback.
      await card.locator('a').evaluateAll(anchors=>anchors.forEach(anchor=>anchor.addEventListener('click',event=>event.preventDefault())));
      for(const selector of ['[data-result-block="primary-action"]','[data-result-section="followup"] a']){
        const tracked=page.waitForResponse(r=>r.url()===`${base}/api/forms/${id}/progress`&&r.request().method()==='POST'&&r.request().postDataJSON().event==='offer_click');
        await card.locator(selector).click();assert.equal((await tracked).status(),200);
      }
      const analytics=await(await owner.request.get(`${base}/api/forms/${id}/analytics`)).json();assert.equal(analytics.offerClicks,pages.length,'CTA events retain existing per-attempt deduplication');
    }
    // Later edits/publications must not rewrite the already saved result layout or contents.
    const submissions=await(await owner.request.get(`${base}/api/forms/${id}/submissions`)).json();const earliest=submissions.submissions.find(sub=>sub.id===firstResult.id);
    assert.ok(earliest);assert.deepEqual(earliest.marketing,firstResult.marketing);
    const first=pages[0];await first.reload();await first.getByRole('button',{name:'View your results',exact:true}).click();await first.locator('[data-result-layout="stacked"]').waitFor();
    // Exercise a persisted legacy result that predates the layout field.
    await first.evaluate(id=>{const key=`heyquiz:${id}:live`,session=JSON.parse(sessionStorage.getItem(key));delete session.result.marketing.presentation;sessionStorage.setItem(key,JSON.stringify(session));},id);
    await first.reload();await first.getByRole('button',{name:'View your results',exact:true}).click();await first.locator('[data-result-layout="stacked"]').waitFor();
    console.log('PASS Playwright: all three layouts edit/autosave/reload, real calculated simulator, real player and saved result snapshot, low + insufficient category visibility, exact coverage, conditional sections, mobile overflow, both CTA callbacks/deduplication, historical result stability and legacy stacked fallback. Local synthetic data only.');
  }finally{await owner.request.delete(`${base}/api/forms/${id}`,{headers});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
