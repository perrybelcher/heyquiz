const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3171';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local-only fault injection');
(async()=>{const b=await chromium.launch({channel:'chrome'}),ctx=await b.newContext(),p=await ctx.newPage();const id='qa-error-'+Date.now(),file=path.resolve('.heyquiz-data/forms',id+'.json'),headers={Origin:base};let saved;
try{
 assert.equal((await ctx.request.post(base+'/api/auth',{headers,data:{local:true}})).status(),200);
 assert.equal((await ctx.request.post(base+'/api/forms',{headers,data:{id,title:'Recovered QA quiz',mode:'survey',questions:[{id:'q',type:'short_answer',title:'Question'}]}})).status(),201);
 saved=await fs.readFile(file);await fs.writeFile(file,'{invalid synthetic data');
 const api=await ctx.request.get(base+'/api/forms/'+id);const body=await api.json();assert.match(body.reference,/^[a-f0-9-]{36}$/);assert.equal(api.headers()['x-pippi-reference'],body.reference);
 await p.goto(base+'/editor/'+id);await p.getByRole('heading',{name:'Something interrupted this page.'}).waitFor();await p.getByText('Support reference:',{exact:false}).waitFor();
 await p.screenshot({path:'/tmp/pippi-error-recovery.png',fullPage:true});
 await fs.writeFile(file,saved);await p.getByRole('button',{name:'Try again',exact:true}).click();await p.locator('input').first().waitFor();assert.equal(await p.locator('input').first().inputValue(),'Recovered QA quiz');
 assert.equal((await ctx.request.post(base+'/api/diagnostics',{headers:{Origin:'https://untrusted.example','Content-Type':'application/pippi-error'}})).status(),403);
 assert.equal((await ctx.request.post(base+'/api/diagnostics',{headers,data:{secret:'must not log'}})).status(),400);
 let limited=false;for(let i=0;i<12;i++){const r=await ctx.request.post(base+'/api/diagnostics',{headers:{...headers,'Content-Type':'application/pippi-error'}});if(r.status()===429){limited=true;break;}assert.equal(r.status(),200);}assert.ok(limited);
 console.log('PASS real render fault: support reference, server/API logging, successful retry, origin validation, payload rejection and report rate limit');
}finally{if(saved)await fs.writeFile(file,saved);await ctx.request.delete(base+'/api/forms/'+id,{headers});await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
