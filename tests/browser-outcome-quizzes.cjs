// Compiled, loopback-only acceptance. Expected outcomes are literal fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const engines = require('playwright');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {FormSchema} = require('../lib/schema.ts');
const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/, 'Explicit isolated loopback server required');
const artifacts = process.env.ARTIFACT_DIR || '/tmp/pippi-outcome-browser'; fs.mkdirSync(artifacts,{recursive:true});
const kinds = {personality:'segmentation',product_finder:'product_finder',diagnostic:'segmentation',qualification:'qualification'};
const headings = {personality:'Your profile',product_finder:'Your best match',diagnostic:'Your biggest challenge',qualification:'Your recommended route'};
const headers = {Origin:base};
async function json(response,status=200) { assert.equal(response.status(),status,await response.text()); return response.json(); }
function fixture(type,id) {
  return FormSchema.parse({id,title:`Synthetic ${type}`,quizType:type,mode:'survey',settings:{showReviewBeforeSubmit:false},questions:[{id:'choice',title:'Which next step suits you?',type:'multiple_choice',required:true,options:[{id:'ready',label:'Ready for support'},{id:'later',label:'Explore independently'}]}],marketing:{kind:kinds[type],outcomes:[{id:'alpha',title:'Personal support',description:'A practical next step.',advice:'Choose one action for this week.',ctaLabel:'View next step',ctaUrl:'https://example.test/next'},{id:'beta',title:'Independent exploration',description:'Work at your pace.',advice:'Read the guide.',ctaLabel:'View guide',ctaUrl:'https://example.test/guide'}],rules:type==='qualification'?[]:[{id:'a',questionId:'choice',answerId:'ready',targetId:'alpha',points:2,reason:'You selected support.'},{id:'b',questionId:'choice',answerId:'later',targetId:'beta',points:2}],...(type==='qualification'?{qualificationRules:[{id:'a',outcomeId:'alpha',match:'all',conditions:[{questionId:'choice',operator:'equals',value:'ready'}]},{id:'b',outcomeId:'beta',match:'any',conditions:[{questionId:'choice',operator:'equals',value:'later'}]}]}:{})}});
}
(async()=>{
  for (const name of (process.env.BROWSER_ENGINES || 'chromium,firefox,webkit').split(',')) {
    const browser = await engines[name].launch({headless:true});
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage(), errors=[];
    context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(15000);
    await context.route('**/*',route=>new URL(route.request().url()).origin!==base?route.abort():route.continue());
    page.on('dialog',dialog=>dialog.accept());
    try {
      // Every direct path starts with type selection, including AI.
      for (const route of ['/create','/create/ai','/create/marketing']) {
        await page.goto(base+route); await page.getByRole('button',{name:/Discover your type/}).waitFor();
        assert.equal(await page.getByRole('region',{name:'Choose quiz outcome'}).getByRole('button').count(),6);
      }
      // Guest blank creation, reload, and authentication retain identity.
      await page.goto(base+'/create/blank?quizType=personality');
      await page.getByRole('heading',{name:'Possible profile results'}).waitFor();
      const guestId=await page.evaluate(()=>localStorage.getItem('pippi-guest-draft'));
      await page.reload(); await page.getByRole('heading',{name:'Possible profile results'}).waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('pippi-guest-draft')),guestId);
      await json(await context.request.post(base+'/api/auth',{headers,data:{local:true}}));
      const beforeClaim = await page.evaluate(()=>performance.timeOrigin);
      await page.getByRole('button',{name:'Save my quiz',exact:true}).click();
      await page.waitForURL(base+'/editor/'+guestId);
      await page.waitForFunction(before=>performance.timeOrigin!==before,beforeClaim);
      await page.getByRole('heading',{name:'Possible profile results'}).waitFor();
      assert.equal((await json(await context.request.get(base+'/api/forms/'+guestId))).quizType,'personality');
      for (const type of Object.keys(kinds)) {
        const form=fixture(type,`qa-outcome-${name}-${type}-${Date.now()}`);
        await json(await context.request.post(base+'/api/forms',{headers,data:form}),201);
        await page.goto(base+'/editor/'+form.id);
        await page.getByRole('region',{name:'Possible results'}).waitFor();
        await page.getByRole('button',{name:'Results reviewed — continue →',exact:true}).click();
        await page.getByRole('heading',{name:'Give your quiz a clear promise.',exact:true}).waitFor(); // one click advances
        await page.getByRole('button',{name:'3. Questions',exact:true}).click();
        await page.getByLabel('Question wording',{exact:true}).waitFor();
        await page.getByLabel('Question wording',{exact:true}).fill('Which next step suits you today?');
        await page.getByRole('button',{name:'Design quiz',exact:true}).click();
        await page.getByRole('dialog',{name:'Make it yours'}).getByRole('button',{name:'Ocean',exact:true}).click();
        await page.getByRole('button',{name:'Apply theme',exact:true}).click();
        await page.setViewportSize({width:390,height:844});
        assert.ok(await page.getByRole('button',{name:'Design quiz',exact:true}).isVisible());
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Editor fits narrow viewport');
        await page.setViewportSize({width:1440,height:1000});
        await page.getByRole('button',{name:'5. Publish',exact:true}).click();
        await page.getByRole('button',{name:'Review & publish',exact:true}).click();
        await page.getByRole('button',{name:'Publish now',exact:true}).click();
        await page.getByRole('heading',{name:'Your Quiz is Published!',exact:true}).waitFor();
        await page.getByRole('button',{name:'Done',exact:true}).click();
        const saved=await json(await context.request.get(base+'/api/forms/'+form.id));
        assert.equal(saved.quizType,type);assert.equal(saved.theme.primaryColor,'#2563eb');assert.equal(saved.questions[0].title,'Which next step suits you today?');
        const visitor=await context.newPage();await visitor.setViewportSize({width:390,height:844});
        await visitor.goto(base+'/play/'+form.id);
        await visitor.getByRole('button',{name:'Let’s begin',exact:true}).click();
        await visitor.getByRole('radio',{name:'Ready for support',exact:true}).check();
        const completed=visitor.waitForResponse(r=>r.url().endsWith(`/api/forms/${form.id}/submit`)&&r.request().method()==='POST');
        await visitor.getByRole('button',{name:'Submit response',exact:true}).click();
        const result=await json(await completed);assert.equal(result.quizType,type);assert.equal(result.marketing.outcomeId,'alpha');assert.equal(result.marketing.overallScore,undefined);
        const card=visitor.locator(`[data-quiz-type="${type}"]`);
        await card.getByText(headings[type],{exact:true}).waitFor();assert.equal(await card.getByRole('heading',{name:'Personal support',exact:true}).count(),1);
        assert.ok(!/%|Overall score|Grade/.test(await card.innerText()));
        assert.equal(await card.evaluate(el=>getComputedStyle(el).getPropertyValue('--hq-primary').trim()),'#2563eb');
        assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Result fits narrow viewport');
        await visitor.screenshot({path:path.join(artifacts,`${name}-${type}-mobile.png`),fullPage:true});
        await visitor.getByRole('button',{name:'Create private result link',exact:true}).click();
        const href=await visitor.getByRole('link',{name:'Open saved result'}).getAttribute('href');assert.match(href,/^\/result\//);
        await visitor.goto(base+href);await visitor.getByRole('heading',{name:'Personal support',exact:true}).waitFor();
        const pdf=await context.request.get(base+'/api'+href+'/pdf');assert.equal(pdf.status(),200);assert.equal((await pdf.body()).subarray(0,4).toString(),'%PDF');
        await visitor.close();
        await page.goto(base+'/reports/'+form.id);await page.getByText('Personal support',{exact:true}).first().waitFor();
        // Conversion keyboard access, impact preview and unpublished copy.
        if(type==='qualification') {
          await page.goto(base+'/editor/'+form.id);await page.getByRole('button',{name:'Change Type',exact:true}).click();
          const dialog=page.getByRole('dialog',{name:'Change quiz type'});await dialog.getByLabel('Desired outcome').selectOption('diagnostic');
          await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));
          await dialog.getByRole('button',{name:'Save and preview changes',exact:true}).click();
          await dialog.getByRole('region',{name:'Conversion impact'}).waitFor();
          await dialog.getByRole('button',{name:'Create converted copy',exact:true}).click();
          await page.waitForURL(url=>url.pathname.startsWith('/editor/')&&!url.pathname.endsWith(form.id));
          const copy=await json(await context.request.get(base+'/api/forms/'+page.url().split('/').pop()));
          assert.equal(copy.quizType,'diagnostic');assert.equal(copy.conversionReview.required,true);assert.equal(copy.publishedAt,undefined);
          assert.equal((await json(await context.request.get(base+'/api/forms/'+form.id))).quizType,'qualification');
        }
        console.log(`PASS ${name}: ${type} editor → publish → complete → saved report/PDF`);
      }
      assert.deepEqual(errors,[],'No uncaught browser errors');
    } catch(error) { await page.screenshot({path:path.join(artifacts,`${name}-failure.png`),fullPage:true}).catch(()=>{});throw error; }
    finally {await browser.close();}
  }
})().catch(error=>{console.error(error);process.exit(1);});
