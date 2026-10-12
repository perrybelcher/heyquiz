// Local synthetic acceptance only. No provider, mail, customer or hosted calls.
const playwright = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { cloudEnabled, readRecord, removeRecord } = require('../lib/records.ts');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3164', engine = process.env.BROWSER || 'chromium';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/); assert.equal(cloudEnabled(), false); assert.ok(process.env.HEYQUIZ_DATA_DIR); assert.ok(['chromium','firefox','webkit'].includes(engine));
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-report-upgrade-2026-10-12/browser/' + engine); fs.mkdirSync(artifacts, { recursive: true });
const id = 'qa-report-design-' + require('node:crypto').randomUUID(), headers = { Origin: base }, errors = [], calls = [], blocked = [], ids = [];
async function until(check, message) { for (let n = 0; n < 120; n++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve,100)); } throw Error(message); }
(async () => {
 const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'chrome', headless: true } : { headless: true });
 const context = await browser.newContext({ viewport: { width:1440, height:1000 } }), page = await context.newPage();
 page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
 await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== base && !['data:','about:'].includes(url.protocol)) { blocked.push(url.origin); return route.abort(); } return route.continue(); });
 context.on('request', request => calls.push({ path:new URL(request.url()).pathname, method:request.method() }));
 let publicStarts=0;
 const post = async (url,data={}) => { const response=await context.request.post(base+url,{headers,data}); if(url.endsWith('/start')&&!data.preview&&response.ok()) publicStarts++; return response; };
 const draft = async () => { const r=await context.request.get(base+'/api/forms/'+id); assert.equal(r.status(),200); return r.json(); };
 const panel = page.getByRole('region',{name:'Report design settings',exact:true});
 const open = async () => { if (!await panel.isVisible()) await page.locator('summary').filter({hasText:'Report design'}).click(); await panel.waitFor(); };
 const input = name => panel.getByRole('textbox',{name,exact:true});
 const apply = () => panel.getByRole('button',{name:'Apply report design',exact:true}).click();
 try {
  assert.equal((await post('/api/auth',{local:true})).status(),200);
  assert.equal((await post('/api/forms',{id,title:'Frozen knowledge report',mode:'quiz',questions:[{id:'q',type:'multiple_choice',title:'Choose an answer',required:true,points:10,options:[{id:'a',label:'The correct answer',isCorrect:true},{id:'b',label:'Another answer'}]}],theme:{brandName:'Sample Studio',primaryColor:'#ffffff',backgroundColor:'#111111',cardColor:'#161616',textColor:'#ffffff'},settings:{showReviewBeforeSubmit:false}})).status(),201);
  await page.goto(base+'/editor/'+id); await page.getByRole('button',{name:'Ending',exact:true}).first().click(); await open(); const initial=await draft();
  const summary=page.locator('summary').filter({hasText:'Report design'}); await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await panel.isVisible(),false); await page.keyboard.press('Enter'); await panel.waitFor();
  await panel.getByRole('radio',{name:/Executive/}).check(); await panel.getByRole('checkbox',{name:'Add a separate cover page to the PDF'}).check();
  await input('Report title').fill('Your practical progress report'); await input('Report subtitle').fill('A useful starting point'); await input('Opening introduction').fill('Keep what works.\nTry one manageable next step.'); await input('Closing footer note').fill('A starting point for your own decisions.');
  await panel.getByRole('checkbox',{name:'Use a custom report button',exact:true}).check();
  await input('Report button text').fill('Read the guide'); await input('Report button link').fill('javascript:alert(1)');
  assert.equal(await panel.getByRole('button',{name:'Apply report design',exact:true}).isDisabled(),true); assert.equal((await draft()).revision,initial.revision,'Invalid pending design never autosaves');
  await input('Report button link').fill('https://example.test/guide');
  await panel.getByRole('checkbox',{name:'Next priorities',exact:true}).uncheck();
  await panel.getByRole('button',{name:'Move Additional result sections up',exact:true}).click();
  const preview=panel.getByRole('region',{name:'Report sample preview',exact:true}); assert.equal(await preview.locator('a,img').count(),0,'Fixed sample neither navigates nor fetches external art');
  const sampleText=await preview.innerText(); for (const word of ['75%','Not enough information','Sample content; not a participant result','Read the guide']) assert.ok(sampleText.includes(word));
  assert.ok(!sampleText.includes('Your next priorities'));
  await page.getByRole('button',{name:'Guided setup',exact:true}).click(); await page.getByRole('button',{name:'3. Results',exact:true}).click(); await open(); assert.equal(await input('Report title').inputValue(),'Your practical progress report');
  await page.reload(); await page.getByRole('button',{name:'3. Results',exact:true}).click(); await open(); await panel.getByText('Unapplied report settings were recovered',{exact:false}).waitFor();
  await apply(); await until(async()=> (await draft()).reportDesign?.title==='Your practical progress report','Design did not autosave'); const accepted=(await draft()).reportDesign;
  assert.deepEqual(accepted.sections,['reasons','details','advice','action']); assert.equal(accepted.style,'executive'); assert.equal(accepted.cover,true);
  assert.equal(await page.evaluate(id=>sessionStorage.getItem('pippi-report-design:'+id),id),null);
  await page.reload(); await page.getByRole('button',{name:'3. Results',exact:true}).click(); await open(); assert.equal(await input('Report title').inputValue(),accepted.title);
  const scans=[]; await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for (const width of [320,390,1440]) {
   await page.setViewportSize({width,height:1000}); await panel.getByRole('radio',{name:/Executive/}).scrollIntoViewIfNeeded();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow at '+width);
   const scan=await panel.evaluate(element=>window.axe.run(element,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})); scans.push({view:'editor',width,violations:scan.violations}); assert.deepEqual(scan.violations,[]);
   await page.screenshot({path:path.join(artifacts,'editor-'+width+'.png')}); await preview.scrollIntoViewIfNeeded(); await page.screenshot({path:path.join(artifacts,'preview-'+width+'.png')});
  }
  assert.equal((await post('/api/forms/'+id+'/publish')).status(),200);
  const start=await post('/api/forms/'+id+'/start'); assert.equal(start.status(),200); const session=await start.json(); assert.equal(session.form.reportDesign,undefined);
  const attemptId=JSON.parse(Buffer.from(session.token.split('.')[0],'base64url')).id; ids.push(['attempts',attemptId],['submissions',attemptId]);
  const submit=await post('/api/forms/'+id+'/submit',{token:session.token,answers:{q:'a'}}); assert.equal(submit.status(),200); assert.equal((await submit.json()).percentageScore,100);
  const linkResponse=await post('/api/forms/'+id+'/result-link',{token:session.token}); assert.equal(linkResponse.status(),200); const link=await linkResponse.json();
  const reportId=JSON.parse(Buffer.from(link.path.split('/').pop().split('.')[0],'base64url')).id; ids.push(['result_reports',reportId]);
  assert.deepEqual((await readRecord('result_reports',reportId)).payload.reportDesign,accepted);
  const reportPage=await context.newPage(); await reportPage.goto(base+link.path); const document=reportPage.getByRole('article',{name:'Saved report document',exact:true}); await document.waitFor();
  await document.getByRole('heading',{name:accepted.title,exact:true}).waitFor(); assert.ok((await document.innerText()).includes('100%')); assert.equal(await document.getByRole('link',{name:/Read the guide/}).getAttribute('href'),'https://example.test/guide');
  const download=reportPage.waitForEvent('download'); await reportPage.getByRole('button',{name:'Download PDF',exact:true}).click(); await (await download).saveAs(path.join(artifacts,'saved-report.pdf'));
  await reportPage.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for(const width of [320,390,1440]) { await reportPage.setViewportSize({width,height:1000}); assert.ok(await reportPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)); const scan=await document.evaluate(element=>window.axe.run(element,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})); scans.push({view:'saved',width,violations:scan.violations}); assert.deepEqual(scan.violations,[]); await reportPage.screenshot({path:path.join(artifacts,'saved-'+width+'.png')}); }
  // Save failure preserves applied changes for the ordinary retry; old report stays frozen.
  await page.route(base+'/api/forms/'+id,route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'Synthetic unavailable'}}):route.continue());
  await input('Report title').fill('Later draft report'); await apply(); await page.locator('.hq-error').waitFor(); assert.deepEqual((await draft()).reportDesign,accepted);
  await page.unroute(base+'/api/forms/'+id); await page.getByRole('button',{name:'Retry save',exact:true}).click(); await until(async()=> (await draft()).reportDesign?.title==='Later draft report','Retry did not save');
  await panel.getByRole('button',{name:'Use original report layout',exact:true}).click(); await until(async()=>!(await draft()).reportDesign,'Original reset did not save');
  assert.equal((await post('/api/forms/'+id+'/publish')).status(),200); await reportPage.reload(); await reportPage.getByRole('heading',{name:accepted.title,exact:true}).waitFor(); assert.deepEqual((await readRecord('result_reports',reportId)).payload.reportDesign,accepted);
  // External current-design changes never get silently overwritten by recovered local input.
  await input('Report title').fill('Pending report title'); const fresh=await draft(); assert.equal((await context.request.put(base+'/api/forms/'+id,{headers,data:{...fresh,reportDesign:accepted}})).status(),200);
  await page.reload(); await page.getByRole('button',{name:'3. Results',exact:true}).click(); await open(); await panel.getByText('The saved report design changed while you were editing.',{exact:false}).waitFor(); assert.equal(await panel.getByRole('button',{name:'Apply report design',exact:true}).isDisabled(),true); assert.equal(await input('Report title').inputValue(),'Pending report title');
  await panel.getByRole('button',{name:'Reload current design',exact:true}).click(); assert.equal(await input('Report title').inputValue(),accepted.title);
  assert.deepEqual(errors,[]); assert.deepEqual(blocked,[]); assert.equal(publicStarts,1); assert.ok(!calls.some(call=>call.method==='POST'&&/result-email/.test(call.path)));
  fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({engine,scans,publicStarts,completed:1,pdfDownloads:1,errors,blocked},null,2));
  console.log('PASS '+engine+' report design: guided/full, recovery, invalid isolation, save/retry/reset, frozen publication/report, real native download, custom CTA and six accessibility scans. One synthetic start; no email/providers.');
 } catch(error) { await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{}); throw error; }
 finally {
  await context.close();
  for(const [kind,key] of [...ids,['published',id],['forms',id]]) { const row=await readRecord(kind,key); if(row) { assert.equal(row.owner_id,'local'); if(kind==='attempts') assert.equal(row.payload.form.id,id); else if(!['forms','published'].includes(kind)) assert.equal(row.payload.formId,id); await removeRecord(kind,key,'local'); } }
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
