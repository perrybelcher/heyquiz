const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3166';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local tests only');
(async()=>{const browser=await chromium.launch({channel:'chrome'}),owner=await browser.newContext(),anon=await browser.newContext(),page=await owner.newPage(),headers={Origin:base};
try{
 assert.equal((await anon.request.get(base+'/api/experiments')).status(),401);
 assert.equal((await owner.request.post(base+'/api/auth',{data:{local:true},headers})).status(),200);
 const ids=['exp-a-'+Date.now(),'exp-b-'+Date.now()];
 for(const [i,id] of ids.entries()){
  const r=await owner.request.post(base+'/api/forms',{headers,data:{id,title:'Experiment '+(i?'B':'A'),mode:'quiz',settings:{},questions:[{id:'q',title:'Choose one',type:'multiple_choice',options:[{id:'yes',label:'Yes'},{id:'no',label:'No'}],correctAnswer:'yes',points:1}]}});
  assert.equal(r.status(),201,await r.text());assert.equal((await owner.request.post(base+`/api/forms/${id}/publish`,{headers,data:{}})).status(),200);
 }
 await page.goto(base+'/experiments');await page.getByLabel('Test name').fill('QA headline test '+ids[0]);await page.getByLabel('Version A',{exact:true}).selectOption(ids[0]);await page.getByLabel('Version B',{exact:true}).selectOption(ids[1]);await page.getByRole('button',{name:'Launch test'}).click();await page.getByRole('heading',{name:'QA headline test '+ids[0]}).waitFor();
 const all=await(await owner.request.get(base+'/api/experiments')).json(),id=all.experiments[0].id;
 const assign=async()=>{const r=await anon.request.post(base+`/api/experiments/${id}/assign`,{headers});assert.equal(r.status(),200);return r.json();};
 const first=await assign(),again=await assign();assert.equal(first.token,again.token);assert.equal(first.form.id,again.form.id);
 assert.equal((await anon.request.patch(base+`/api/experiments/${id}`,{headers,data:{active:false}})).status(),401);
 const start=await anon.request.post(base+`/api/forms/${first.form.id}/start`,{headers,data:{experimentToken:first.token}});assert.equal(start.status(),200);const s=await start.json();
 assert.equal((await anon.request.post(base+`/api/forms/${first.form.id}/start`,{headers,data:{experimentToken:first.token+'bad'}})).status(),401);
 assert.equal((await anon.request.post(base+`/api/forms/${ids.find(x=>x!==first.form.id)}/start`,{headers,data:{experimentToken:first.token}})).status(),400);
 assert.equal((await anon.request.post(base+`/api/forms/${first.form.id}/submit`,{headers,data:{token:s.token,answers:{q:'yes'}}})).status(),200);
 await anon.request.post(base+`/api/forms/${first.form.id}/start`,{headers,data:{experimentToken:first.token}});
 await anon.request.post(base+`/api/forms/${first.form.id}/start`,{headers,data:{}});
 const results=await(await owner.request.get(base+'/api/experiments')).json(),stats=results.experiments.find(t=>t.id===id).stats;
 assert.equal(stats.reduce((n,s)=>n+s.visitors,0),1);assert.equal(stats.reduce((n,s)=>n+s.completions,0),1);
 await page.reload();const section=page.locator('section').filter({has:page.getByRole('heading',{name:'QA headline test '+ids[0],exact:true})});await section.getByRole('button',{name:'Pause',exact:true}).first().click();await section.getByRole('button',{name:'Resume',exact:true}).first().waitFor();
 assert.equal((await anon.request.post(base+`/api/experiments/${id}/assign`,{headers})).status(),410);
 assert.equal((await anon.request.post(base+`/api/forms/${first.form.id}/start`,{headers,data:{experimentToken:first.token}})).status(),410);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await section.getByRole('button',{name:'Resume',exact:true}).first().click();await section.getByRole('button',{name:'Pause',exact:true}).first().waitFor();
 const visitor=await anon.newPage();await visitor.goto(base+`/experiment/${id}`);await visitor.getByText(first.form.title,{exact:true}).first().waitFor();
 console.log('PASS experiment UI creation, sticky assignment, auth, token tampering, variant mismatch, real submission, repeat/direct-traffic isolation, pause/resume, mobile layout and public player');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
