// Run only against a compiled isolated loopback server, with credentials disabled.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),engines=require('playwright');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {authoredTemplates,authoredTemplate}=require('../lib/authored-templates.ts');
const fixtures=Object.assign({},...['a','b','c'].map(x=>require(`./fixtures/authored-templates-${x}.json`)));
const base=process.env.TEST_BASE_URL;assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);
const headers={Origin:base},artifacts=process.env.ARTIFACT_DIR||'/tmp/pippi-template-browser';fs.mkdirSync(artifacts,{recursive:true});
async function json(r,status=200){assert.equal(r.status(),status,await r.text());return r.json();}
async function stored(page){return page.evaluate(()=>{const id=localStorage.getItem('pippi-guest-draft');return JSON.parse(sessionStorage.getItem('heyquiz-draft:'+id)||localStorage.getItem('heyquiz-draft:'+id)||'null');});}
(async()=>{for(const name of (process.env.BROWSER_ENGINES||'chromium,firefox,webkit').split(',')){
 const browser=await engines[name].launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push({name:e.name,message:e.message,url:e.stack?.match(/https?:\/\/[^\s]+/)?.[0]}));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 try {
  const instanceIds=new Set();
  for(const t of authoredTemplates){
   await page.goto(base+'/templates?quizType='+t.quizType);
   assert.equal(await page.locator('[data-template-id]').count(),3);
   const card=page.locator(`[data-template-id="${t.id}"]`);await card.focus();await page.keyboard.press('Enter');
   const preview=page.getByRole('region',{name:'Template details'});await preview.getByRole('heading',{name:t.title,exact:true}).waitFor();
   assert.equal(await preview.locator('ol > li').count(),t.questionCount);
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Preview fits mobile');
   await preview.getByRole('button',{name:'Use this template',exact:true}).click();
   await page.waitForFunction(()=>Boolean(localStorage.getItem('pippi-guest-draft')));
   const f=await stored(page);assert.equal(f.quizType,t.quizType);assert.equal(f.title,t.title);assert.equal(f.questions.length,t.questionCount);assert.equal(f.publishedAt,undefined);assert.ok(!instanceIds.has(f.id));instanceIds.add(f.id);
   await page.reload();await page.getByRole('button',{name:'Design quiz',exact:true}).waitFor();assert.equal((await stored(page)).id,f.id);
   await page.setViewportSize({width:1440,height:1000});
  }
  console.log(`PASS ${name}: all18 previews, fresh drafts, mobile layout, keyboard selection and reload recovery`);
  // Authentication claims the actual template draft through the existing editor.
  const guest=await stored(page);await json(await context.request.post(base+'/api/auth',{headers,data:{local:true}}));
  await page.getByRole('button',{name:'Save my quiz',exact:true}).click();await page.waitForURL(base+'/editor/'+guest.id);
  assert.equal((await json(await context.request.get(base+'/api/forms/'+guest.id))).questions.length,guest.questions.length);
  for(const t of authoredTemplates){
   const fixture=fixtures[t.id];assert.ok(fixture,'Missing literal browser fixture '+t.id);
   const f=authoredTemplate(t.id,`qa-template-${name}-${t.id}-${Date.now()}`);
   for(const o of f.marketing?.outcomes??[])o.ctaUrl='https://example.test/next';
   assert.equal(Object.keys(fixture.answers).length,t.questionCount,'Fixture answers every substantive question');
   await json(await context.request.post(base+'/api/forms',{headers,data:f}),201);
   await json(await context.request.post(`${base}/api/forms/${f.id}/publish`,{headers}));
   await page.setViewportSize({width:t.length==='comprehensive'?390:1440,height:t.length==='comprehensive'?844:1000});
   await page.goto(base+'/play/'+f.id);
   const start=page.getByRole('button',{name:f.coverPage?.buttonText||'Let’s begin',exact:true});await start.click();
   const completed=page.waitForResponse(r=>r.url().endsWith(`/api/forms/${f.id}/submit`)&&r.request().method()==='POST',{timeout:120000});
   for(const [index,q] of f.questions.entries()){
    await page.getByRole('heading',{name:q.title,exact:true}).waitFor();
    const answer=fixture.answers[q.id];
    if(q.options?.length){const option=q.options.find(a=>a.id===answer);assert.ok(option,`${t.id}/${q.id} fixture choice exists`);await page.getByRole('radio',{name:option.label,exact:true}).check();
     if(f.settings.feedbackMode==='immediate'){await page.getByText(/^(Correct!|Not quite\.)$/).waitFor();await page.getByRole('button',{name:index===f.questions.length-1?(f.settings.showReviewBeforeSubmit?'Review answers':'Submit response'):'Next',exact:true}).click();}
    }else{await page.getByRole('spinbutton').fill(String(answer));await page.getByRole('button',{name:index===f.questions.length-1?(f.settings.showReviewBeforeSubmit?'Review answers':'Submit response'):'Next',exact:true}).click();}
   }
   if(f.settings.showReviewBeforeSubmit)await page.getByRole('button',{name:'Submit response',exact:true}).click();
   const result=await json(await completed);assert.equal(result.quizType,t.quizType);
   if(fixture.outcomeId!==undefined)assert.equal(result.marketing.outcomeId,fixture.outcomeId,t.id);
   if(fixture.overallScore!==undefined)assert.equal(result.marketing.overallScore,fixture.overallScore,t.id);
   if(fixture.percentageScore!==undefined)assert.equal(result.percentageScore,fixture.percentageScore,t.id);
   await page.getByRole('button',{name:'Create private result link',exact:true}).click();const link=page.getByRole('link',{name:'Open saved result'});await link.waitFor();const href=await link.getAttribute('href');
   await page.goto(base+href);await page.getByText(f.title,{exact:true}).first().waitFor();
   const pdf=await context.request.get(base+'/api'+href+'/pdf');assert.equal(pdf.status(),200,await pdf.text());assert.equal((await pdf.body()).subarray(0,4).toString(),'%PDF');
   await page.goto(base+'/reports/'+f.id);await page.getByRole('tab',{name:'Responses',exact:true}).click();await page.getByRole('heading',{name:'Responses',exact:true}).waitFor();
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const file=await (await download).path();const csv=fs.readFileSync(file,'utf8');assert.ok(csv.includes(t.quizType));if(fixture.outcomeId)assert.ok(csv.includes(fixture.outcomeId));
   console.log(`PASS ${name}: ${t.title} (${t.questionCount}) preview → draft/reload → publish → all questions → result/PDF/CSV`);
  }
  await page.goto(base+'/templates');await page.getByRole('button',{name:'Browse additional existing templates',exact:true}).click();await page.getByRole('combobox',{name:'Industry',exact:true}).waitFor();
  const navigationDiagnostic=e=>{if(name!=='webkit'||!e.name.startsWith('Fetch API cannot load')||!e.url)return false;const url=new URL(e.url);return url.origin===base&&url.searchParams.has('_rsc');};
  const unexpected=errors.filter(e=>!navigationDiagnostic(e));if(errors.length!==unexpected.length)console.log(`NOTE ${name}: ${errors.length-unexpected.length} background RSC prefetch diagnostics; all page readiness checks passed.`);assert.deepEqual(unexpected,[]);
 }catch(e){await page.screenshot({path:path.join(artifacts,name+'-failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
