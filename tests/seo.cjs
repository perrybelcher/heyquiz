const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3162';
if(new URL(base).hostname!=='127.0.0.1')throw Error('Local only');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const routes=['/','/lead-generation-quiz-builder','/product-recommendation-quiz-builder','/scorecard-builder'];const titles=[];
 for(const route of routes){assert.equal((await page.goto(base+route)).status(),200);assert.equal(await page.locator('h1').count(),1);titles.push(await page.title());assert.equal(new URL(await page.locator('link[rel=canonical]').getAttribute('href')).href,'https://www.pippiapp.com'+route);assert.ok((await page.locator('meta[name=description]').getAttribute('content')).length>70);assert.equal(new URL(await page.locator('meta[property="og:url"]').getAttribute('content')).href,'https://www.pippiapp.com'+route);
 for(const width of [390,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+route+' '+width);}
 }
 assert.equal(new Set(titles).size,4);
 await page.goto(base+'/welcome');assert.equal(new URL(await page.locator('link[rel=canonical]').getAttribute('href')).href,'https://www.pippiapp.com/');assert.equal(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@type'],'WebSite');
 for(const route of ['/login','/signup','/forgot-password','/reset-password','/resend-confirmation','/create']){await page.goto(base+route);assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);}
 const sitemap=await(await page.request.get(base+'/sitemap.xml')).text();for(const route of routes)assert.ok(sitemap.includes('https://www.pippiapp.com'+route));assert.ok(!sitemap.includes('/welcome'));assert.ok(!sitemap.includes('/play/'));
 assert.match(await(await page.request.get(base+'/robots.txt')).text(),/Sitemap: https:\/\/www.pippiapp.com\/sitemap.xml/);
 assert.match((await page.request.get(base+'/api/config')).headers()['x-robots-tag'],/noindex/);
 assert.deepEqual(errors,[]);console.log('PASS metadata, canonical URLs, structured data, sitemap, noindex, API headers and responsive public pages');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
