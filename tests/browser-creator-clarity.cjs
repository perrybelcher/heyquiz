/* Synthetic local app only. Even the production-host consent rehearsal is proxied
 * to localhost; Microsoft's tag is replaced with a recording stub. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const base=process.env.TEST_BASE_URL,artifacts=process.env.ARTIFACT_DIR||'/private/tmp/pippi-clarity-qa/artifacts';
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);fs.mkdirSync(artifacts,{recursive:true});
const origin='https://www.pippiapp.com',key='pippi-behavior-consent-v1';
(async()=>{const browser=await chromium.launch({channel:'chrome'}),errors=[],ids=[];
const local=await browser.newContext({viewport:{width:1440,height:1000}});await local.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
const page=await local.newPage();page.on('pageerror',e=>errors.push(e.message));const headers={Origin:base};
try{
 assert.equal((await local.request.post(base+'/api/auth',{headers,data:{local:true}})).status(),200);
 for(const multiple of [false,true]){
  const id='clarity-qa-'+Date.now()+'-'+multiple;ids.push(id);
  const marketing=multiple?{kind:'scorecard',categories:[{id:'readiness',title:'Readiness'}],rules:[{id:'r1',questionId:'q',answerId:'a',targetId:'readiness',points:25},{id:'r2',questionId:'q',answerId:'b',targetId:'readiness',points:75}]}:{kind:'product_finder',outcomes:[{id:'one',title:'First product'},{id:'two',title:'Second product'}],rules:[{id:'r1',questionId:'q',answerId:'a',targetId:'one',points:25},{id:'r2',questionId:'q',answerId:'b',targetId:'one',effect:'exclude',points:0},{id:'r3',questionId:'q',answerId:'b',targetId:'two',points:75}]};
  const fixture={id,title:'',mode:'survey',questions:[{id:'q',title:'What fits you?',type:multiple?'multiselect':'multiple_choice',required:true,options:[{id:'a',label:'Option A'},{id:'b',label:'Option B'},{id:'z',label:'Not sure'}]}],marketing};
  assert.equal((await local.request.post(base+'/api/forms',{headers,data:fixture})).status(),201);
  await page.goto(base+'/editor/'+id);const next=page.getByRole('region',{name:'Your next step'});await next.getByRole('button',{name:'Review next item',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.closest('label')?.textContent?.startsWith('Quiz title'));await page.getByLabel('Quiz title',{exact:true}).fill('Synthetic scoring example');
  await page.getByRole('button',{name:'2. Questions',exact:true}).click();await page.getByText('How scoring works',{exact:true}).click();await page.getByText('Different points for each answer?',{exact:true}).waitFor();await page.getByText('How scoring works',{exact:true}).click();await page.getByText('Connect answers to results',{exact:true}).click();
  const scoring=page.getByRole('region',{name:'Answer scoring',exact:true});
  if(multiple){const sample=scoring.getByRole('group',{name:'Try a combination of answers'});await sample.getByLabel('Option A',{exact:true}).check();await sample.getByLabel('Option B',{exact:true}).check();await scoring.getByText('Readiness: +100 points',{exact:true}).waitFor();await sample.getByLabel('Option A',{exact:true}).uncheck();await sample.getByLabel('Option B',{exact:true}).uncheck();await sample.getByLabel('Not sure',{exact:true}).check();}
  else{await scoring.getByLabel('Try an answer',{exact:true}).selectOption('a');await scoring.getByText('First product: +25 points',{exact:true}).waitFor();await scoring.getByLabel('Try an answer',{exact:true}).selectOption('b');await scoring.getByText('First product: excluded, even if other answers add points',{exact:true}).waitFor();await scoring.getByText('Second product: +75 points',{exact:true}).waitFor();await scoring.getByLabel('Try an answer',{exact:true}).selectOption('z');}
  await scoring.getByText('No points assigned: this selection is neutral. It is not the same as a scored zero.',{exact:true}).waitFor();
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await scoring.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow '+width);await page.screenshot({path:path.join(artifacts,`scoring-${multiple}-${width}.png`)});}
  assert.equal(await page.locator('#pippi-clarity').count(),0,'Local development never loads Clarity');
 }
 console.log('PASS guided next action, mode help, individual points/exclusions/neutral answers and multi-answer combinations at 3 widths');
 // Proxy *all* allowed app requests locally. Never visit the real production app.
 async function consentContext({consent,gpc=false}={}){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});let tags=0;
  await ctx.routeWebSocket('**/*',ws=>ws.close());
  await ctx.route('**/*',async route=>{const url=new URL(route.request().url());
   if(url.hostname==='www.clarity.ms'){tags++;return route.fulfill({contentType:'application/javascript',body:'window.__clarityCalls=(window.clarity.q||[]).slice();window.clarity=function(){window.__clarityCalls.push(Array.from(arguments))};'});}
   if(url.origin===origin){const response=await route.fetch({url:base+url.pathname+url.search,headers:{...route.request().headers(),host:new URL(base).host}});return route.fulfill({response});}
   return route.abort();
  });
  await ctx.addInitScript(({key,consent,gpc})=>{if(consent)localStorage.setItem(key,JSON.stringify({value:consent,expires:Date.now()+100000}));if(gpc)Object.defineProperty(navigator,'globalPrivacyControl',{value:true});},{key,consent,gpc});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));return {ctx,p,tags:()=>tags};
 }
 let c=await consentContext();await c.p.goto(origin+'/create');await c.p.getByRole('button',{name:'No thanks',exact:true}).waitFor().catch(async error=>{console.error({url:c.p.url(),body:(await c.p.locator('body').innerText()).slice(0,1800),errors});throw error;});assert.equal(c.tags(),0);await c.p.getByRole('button',{name:'No thanks',exact:true}).click();assert.equal(c.tags(),0);await c.p.getByRole('button',{name:'Analytics preferences',exact:true}).click();await c.p.getByRole('button',{name:'Allow analytics',exact:true}).click();await c.p.waitForFunction(()=>window.__clarityCalls);assert.equal(c.tags(),1);assert.equal(await c.p.locator('html').getAttribute('data-clarity-mask'),'true');let calls=await c.p.evaluate(()=>window.__clarityCalls);assert.ok(calls.some(c=>c[0]==='consentv2'&&c[1].analytics_Storage==='granted'&&c[1].ad_Storage==='denied'));
 await c.p.getByRole('link',{name:/Start blank/}).click();await c.p.waitForURL(origin+'/create/blank');calls=await c.p.evaluate(()=>window.__clarityCalls);assert.ok(calls.some(c=>c[0]==='event'&&c[1]==='create_blank'));
 await c.p.getByRole('button',{name:'Analytics preferences',exact:true}).click();await c.p.getByRole('button',{name:'No thanks',exact:true}).click();calls=await c.p.evaluate(()=>window.__clarityCalls);assert.equal(calls.at(-1)[0],'stop');await c.ctx.close();
 for(const options of [{consent:'denied'},{consent:'granted',gpc:true}]){c=await consentContext(options);await c.p.goto(origin+'/create');await c.p.getByRole('heading',{name:'How would you like to start?'}).waitFor();assert.equal(c.tags(),0);await c.ctx.close();}
 for(const route of ['/login','/signup','/reset-password','/result/synthetic-private-token']){c=await consentContext({consent:'granted'});await c.p.goto(origin+route);assert.equal(c.tags(),0,route+' excluded');await c.ctx.close();}
 assert.deepEqual(errors,[]);console.log('PASS browser consent, withdrawal, GPC, no local/private-route tracking; vendor requests mocked');
 fs.writeFileSync(path.join(artifacts,'summary.json'),JSON.stringify({result:'passed',errors,externalProviderRequests:0,productionVerification:false},null,2));
}finally{for(const id of ids)await local.request.delete(base+'/api/forms/'+id,{headers});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
