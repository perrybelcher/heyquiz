const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const page=await context.newPage();const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3130";try{
 await page.goto(base+'/create');await page.getByRole('button',{name:/^Test knowledge/}).click();await page.getByLabel('Scoring mode').selectOption('scorecard');
 await page.getByLabel('New category name').fill('Readiness');await page.getByRole('button',{name:'Add category',exact:true}).click();
 await page.getByLabel('First option: Readiness points').fill('0');await page.getByLabel('Second option: Readiness points').fill('10');
 await context.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}});
 await page.getByRole('button',{name:'Save my quiz',exact:true}).click();await page.waitForURL(/\/editor\//);const id=page.url().split('/').pop();
 let f=await(await context.request.get(base+'/api/forms/'+id)).json();assert.equal(f.marketing.kind,'scorecard');assert.deepEqual(f.marketing.rules.map(r=>r.points),[0,10]);assert.equal(f.mode,'survey');
 page.once('dialog',d=>d.dismiss());await page.getByLabel('Scoring mode').selectOption('product_finder');assert.equal(await page.getByLabel('Scoring mode').inputValue(),'scorecard');
 page.once('dialog',d=>d.accept());await page.getByLabel('Scoring mode').selectOption('product_finder');
 await page.getByLabel('New product name').fill('Starter');await page.getByRole('button',{name:'Add product',exact:true}).click();
 await page.getByLabel('First option: Starter points').fill('5');await page.getByRole('checkbox',{name:'Exclude',exact:true}).nth(1).check();
 await page.waitForTimeout(1200);f=await(await context.request.get(base+'/api/forms/'+id)).json();assert.equal(f.marketing.rules[0].points,5);assert.equal(f.marketing.rules[1].effect,'exclude');
 console.log('PASS answer-level points, zero scores, authenticated persistence, mode-change confirmation, exclusions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
