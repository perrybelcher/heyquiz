const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3156';
(async()=>{const browser=await chromium.launch({channel:'chrome'}),ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage();try{
 assert.equal((await ctx.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}})).status(),200);
 await p.goto(base+'/create/persuasive');
 for(let i=0;i<2;i++){const g=p.getByRole('group',{name:`Product or service ${i+1}`,exact:true});await g.getByLabel('Product or service name',{exact:true}).fill(`Offer ${i}`);await g.getByLabel('Who is this for?').fill(`People seeking option ${i}`);}
 await p.getByRole('button',{name:'Continue',exact:true}).click();
 await p.getByLabel('Who is this quiz for?').fill('Synthetic QA audience');await p.getByLabel('What do you offer?').fill('Synthetic services');await p.getByLabel('What should the right person do next?').fill('Explore');
 await p.getByRole('button',{name:'Continue',exact:true}).click();
 await p.getByLabel('Number of questions').selectOption('30');
 let status=502;await p.route('**/api/agent/marketing',route=>route.fulfill({status,contentType:'application/json',headers:status===502?{'X-Pippi-Reference':'test-reference'}:{},body:JSON.stringify({error:status===401?'Sign in to continue.':'The AI draft did not pass validation. Your brief is still here.'})}));
 await p.getByRole('button',{name:'Propose my questions',exact:true}).click();
 const failure = p.getByRole('alert').filter({hasText:'The AI draft did not pass validation'});
 await failure.waitFor();
 assert.equal(await p.getByRole('link',{name:'Sign in again',exact:true}).count(),0);
 assert.match(await failure.innerText(), /The AI draft did not pass validation.*Support reference test-reference/);
 await p.getByRole('button',{name:'Create starter from this brief',exact:true}).waitFor();
 await p.reload();await p.getByRole('button',{name:'2. Audience & goal'}).click();assert.equal(await p.getByLabel('Who is this quiz for?').inputValue(),'Synthetic QA audience');
 await p.getByRole('button',{name:'3. Generate questions'}).click();assert.equal(await p.getByLabel('Number of questions').inputValue(),'30');
 status=401;await p.getByRole('button',{name:'Propose my questions',exact:true}).click();await p.getByRole('link',{name:'Sign in again',exact:true}).waitFor();
 await p.getByRole('button',{name:'Create starter from this brief',exact:true}).click();await p.getByRole('heading',{name:'Review your recommendations'}).waitFor();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.reload();await p.getByText('Your unsaved draft was restored from this tab.',{exact:false}).waitFor();
 await p.screenshot({path:'/tmp/pippi-recovery-mobile.png',fullPage:true});
 console.log('PASS Playwright mobile: provider vs auth errors, brief survives reload, one-click starter, preview restoration');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
