// Exercises explicit Flow routes and the optional contact step through the real player.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText, filename);
const { blankQuiz } = require('../lib/blank-quiz.ts');

const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.HEYQUIZ_DATA_DIR?.startsWith('/tmp/'), 'Use an isolated local test server.');
const headers = { Origin: base };
const prefix = 'capture-browser-' + randomUUID();
const finishLabel = 'Continue to contact details';
const skipLabel = 'Skip and see my results';
const tier = (id, title) => ({ id, title, badge: 'Result', message: title, minScorePercent: 0, maxScorePercent: 100 });
const shortEnd = {kind:'tier',id:'short-end'};
const longEnd = {kind:'tier',id:'long-end'};
const form = {
  mode: 'survey',
  title: 'Synthetic business quiz',
  questions: [
    { id:'route', type:'multiple_choice', title:'Choose your path', required:true, options:[{id:'short',label:'Short path'},{id:'long',label:'Long path'}] },
    { id:'detail', type:'short_answer', title:'One more detail', required:true }
  ],
  outcomeTiers: [tier('short-end','Short ending'), tier('long-end','Long ending')],
  routing: {version:1,entry:{kind:'question',id:'route'},routes:{
    route:{rules:[{id:'long',match:'all',conditions:[{questionId:'route',operator:'equals',value:'long'}],destination:{kind:'question',id:'detail'}}],default:shortEnd},
    detail:{rules:[],default:longEnd}
  }},
};

(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const owner = await browser.newContext();
  const ids = [];
  async function create(review) {
    const id = prefix + (review ? '-review' : '-direct');
    const response = await owner.request.post(base + '/api/forms', {headers, data:{...blankQuiz(id),...form,settings:{showReviewBeforeSubmit:review}}});
    assert.equal(response.status(),201,await response.text());
    ids.push(id);
    const draft = await response.json();
    assert.equal(draft.capture?.enabled,true);
    assert.equal(draft.capture.required,false);
    assert.equal(draft.capture.placement,'before_results');
    const publish = await owner.request.post(base+'/api/forms/'+id+'/publish',{headers,data:{}});
    assert.equal(publish.status(),200,await publish.text());
  }
  async function journey(id, {long,review,share}) {
    const visitor = await browser.newContext();
    try {
      const page = await visitor.newPage();
      await page.goto(base+'/play/'+id);
      await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
      await page.getByRole('radio',{name:long?'Long path':'Short path',exact:true}).check();
      if (long) {
        await page.getByRole('heading',{name:'One more detail',exact:true}).waitFor();
        assert.equal(await page.getByRole('textbox',{name:'Email',exact:true}).count(),0);
        await page.getByRole('textbox').fill('Ready');
        await page.getByRole('button',{name:review?'Review answers':finishLabel,exact:true}).click();
      }
      if (review) {
        await page.getByRole('heading',{name:'Review your answers',exact:true}).waitFor();
        await page.getByRole('button',{name:finishLabel,exact:true}).click();
      }
      await page.getByRole('textbox',{name:'Email',exact:true}).waitFor();
      assert.equal(await page.getByRole('checkbox').count(),0,'Fresh defaults do not solicit marketing consent');
      if (share) {
        await page.getByRole('textbox',{name:'Email',exact:true}).fill('synthetic@example.test');
        await page.getByRole('button',{name:'See my results',exact:true}).click();
      } else {
        await page.getByRole('button',{name:skipLabel,exact:true}).click();
      }
      await page.getByRole('heading',{name:long?'Long ending':'Short ending',exact:true}).waitFor();
      const contacts = await owner.request.get(base+'/api/forms/'+id+'/contacts');
      assert.equal(contacts.status(),200);
      const rows = (await contacts.json()).contacts;
      assert.equal(rows.length,share?1:0);
      if (share) assert.equal(rows[0].contact.marketingConsent,false);
    } finally { await visitor.close(); }
  }
  try {
    const login = await owner.request.post(base+'/api/auth',{headers,data:{local:true}});
    assert.equal(login.status(),200);
    await create(false); await create(true);
    await journey(ids[0], {long:false,review:false,share:false});
    await journey(ids[0], {long:true,review:false,share:true});
    await journey(ids[1], {long:false,review:true,share:false});
    await journey(ids[1], {long:true,review:true,share:true});
    console.log('PASS default capture: short/long Flow endings, manual final CTA, review, optional skip, valid contact submission, no automatic consent.');
  } finally {
    for (const id of ids) await owner.request.delete(base+'/api/forms/'+id,{headers});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
