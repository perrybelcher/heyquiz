const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:3157';
(async()=>{const browser=await chromium.launch({channel:'chrome'}),ctx=await browser.newContext();const id='qa-draft-'+Date.now(),headers={Origin:base};try{
 await ctx.request.post(base+'/api/auth',{data:{local:true},headers});
 assert.equal((await ctx.request.post(base+'/api/forms',{data:{id,title:'Original',mode:'survey',questions:[{id:'q',type:'short_answer',title:'Question'}]},headers})).status(),201);
 const a=await ctx.newPage(),b=await ctx.newPage();for(const p of [a,b]){p.on('dialog',d=>d.accept());await p.goto(base+'/editor/'+id);}
 await b.route('**/api/forms/'+id,r=>r.request().method()==='PUT'?r.fulfill({status:503,json:{error:'Synthetic offline save failure'}}):r.continue());
 await b.locator('input').first().fill('Tab B unsaved');await b.getByText('Synthetic offline save failure',{exact:false}).waitFor();
 await a.locator('input').first().fill('Tab A saved');await a.getByText('Saved',{exact:true}).waitFor();
 assert.equal(await b.evaluate(id=>JSON.parse(sessionStorage.getItem('heyquiz-draft:'+id)).title,id),'Tab B unsaved');
 await b.reload();await b.getByRole('button',{name:'Restore changes',exact:true}).waitFor();await b.getByRole('button',{name:'Restore changes',exact:true}).click();assert.equal(await b.locator('input').first().inputValue(),'Tab B unsaved');
 await b.unroute('**/api/forms/'+id);await b.getByText('Saved',{exact:true}).waitFor();
 assert.equal((await(await ctx.request.get(base+'/api/forms/'+id)).json()).title,'Tab B unsaved');
 // A is stale: the server must refuse silently overwriting B's newer revision.
 await a.locator('input').first().fill('Stale overwrite attempt');await a.locator('.hq-error').waitFor();assert.equal((await(await ctx.request.get(base+'/api/forms/'+id)).json()).title,'Tab B unsaved');
 const broken=await ctx.newPage();await broken.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});await broken.goto(base+'/editor/'+id);await broken.locator('input').first().fill('Storage unavailable');await broken.getByText('Browser backup is unavailable.',{exact:false}).waitFor();await broken.getByText('Saved',{exact:true}).waitFor();
 await a.screenshot({path:'/tmp/pippi-draft-conflict.png',fullPage:false});
 console.log('PASS two-tab isolation, failed-save reload recovery, successful restore, stale revision rejection, unavailable storage warning');
}finally{await ctx.request.delete(base+'/api/forms/'+id,{headers});await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
