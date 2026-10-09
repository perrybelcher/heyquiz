const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const page=await context.newPage();const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3130";const id='share-'+Date.now();try{
 await context.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}});
 await context.request.post(base+'/api/forms',{data:{id,title:'Sharing test',mode:'survey',questions:[{id:'q',type:'short_answer',title:'Your name?'}]},headers:{Origin:base}});
 await page.goto(base+'/editor/'+id);await page.getByRole('button',{name:'Share',exact:true}).click();
 await page.getByRole('button',{name:'Publish and enable sharing'}).waitFor();assert.equal(await page.getByRole('button',{name:'Copy Link',exact:true}).count(),0);
 const outsider=await browser.newContext();const publicPage=await outsider.newPage();await publicPage.goto(base+'/play/'+id);await publicPage.getByRole('heading',{name:'This quiz isn’t available yet'}).waitFor();
 await page.getByRole('button',{name:'Publish and enable sharing'}).click();await page.getByText('Published · Your public link is ready.',{exact:false}).waitFor();
 await publicPage.reload();await publicPage.getByText('Sharing test',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Share',exact:true}).click();await page.getByRole('button',{name:'Copy Link',exact:true}).waitFor();assert.equal(await page.locator('a[title="Open in new tab"]').getAttribute('href'),'/play/'+id);
 console.log('PASS draft sharing gated, unavailable guidance, publishing enables anonymous access, published status survives reload, public open link');await outsider.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
