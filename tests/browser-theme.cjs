const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext(); const page=await context.newPage(); const base='http://127.0.0.1:3143';
 try {
 await page.goto(base+'/create');
 await page.getByRole('button',{name:'Theme',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Midnight',exact:true}).click();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Theme',exact:true}).click();
 assert.equal(await dialog.getByLabel('Buttons & highlights',{exact:true}).inputValue(),'#c62121');
 await dialog.getByLabel('Buttons & highlights',{exact:true}).fill('bad');
 assert.equal(await dialog.getByRole('button',{name:'Apply theme'}).isDisabled(),true);
 await dialog.getByLabel('Buttons & highlights',{exact:true}).fill('#a5b4fc');
 await dialog.getByLabel('Page background',{exact:true}).fill('#111827');
 await dialog.getByLabel('Question cards',{exact:true}).fill('#1f2937');
 await dialog.getByLabel('Text',{exact:true}).fill('#f9fafb');
 await dialog.getByLabel('Font family').selectOption('serif');
 await dialog.getByLabel('Card corners').selectOption('none');
 await dialog.getByRole('button',{name:'Apply theme'}).click();
 await context.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}});
 await page.getByRole('button',{name:'Save my quiz',exact:true}).click();
 await page.waitForURL(/\/editor\//);
 const id=page.url().split('/').pop();
 const form=await (await context.request.get(base+'/api/forms/'+id)).json();
 assert.equal(form.theme.font,'serif'); assert.equal(form.theme.primaryColor,'#a5b4fc'); assert.equal(form.theme.borderRadius,'none');
 const publish=await context.request.post(base+'/api/forms/'+id+'/publish',{headers:{Origin:base}}); assert.equal(publish.ok(),true,await publish.text());
 await page.goto(base+'/play/'+id);
 const styles=await page.locator('.hq-player').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,font:getComputedStyle(e).fontFamily,radius:getComputedStyle(e).getPropertyValue('--hq-radius'),button:getComputedStyle(e).getPropertyValue('--hq-button-text')}));
 assert.equal(styles.bg,'rgb(17, 24, 39)'); assert.ok(styles.font.includes('Georgia')); assert.equal(styles.radius,'0px'); assert.equal(styles.button,'#111111');
 await page.setViewportSize({width:390,height:844}); await page.goto(base+'/create'); await page.getByRole('button',{name:'Theme',exact:true}).click();
 assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 console.log('PASS cancel, hex validation, custom colors, font, corners, save/publish rendering, mobile dialog width');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
