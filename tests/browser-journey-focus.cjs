const playwright=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3163';if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local isolated browser only');
const engine=process.env.BROWSER||'chromium',artifacts=path.resolve(process.env.ARTIFACT_DIR||'../pippi-overnight-2026-10-12/journey-focus-browser');fs.mkdirSync(artifacts,{recursive:true});
(async()=>{const browser=await playwright[engine].launch(engine==='chromium'?{channel:'chrome'}:{}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],mutations=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin===base&&new URL(r.url()).pathname.startsWith('/api/')&&['POST','PUT','PATCH','DELETE'].includes(r.method()))mutations.push(r.method()+' '+new URL(r.url()).pathname);});
const name='See the conversation. Shape the next step.',map=page.getByRole('dialog',{name,exact:true});
const open=async()=>{if(page.viewportSize().width<1024){await page.getByRole('button',{name:'More',exact:true}).focus();await page.keyboard.press('Enter');}await page.getByRole('button',{name:'Conversation map',exact:true}).focus();await page.keyboard.press('Enter');await map.waitFor();};
const restored=async()=>{await map.waitFor({state:'detached'});const label=page.viewportSize().width<1024?'More':'Conversation map';await page.waitForFunction(label=>document.activeElement?.tagName==='BUTTON'&&document.activeElement.textContent.trim()===label,label);};
const twoFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
let checks=0;
try{
 await page.goto(base+'/create/blank');await page.getByRole('button',{name:'Guided setup',exact:true}).waitFor();
 for(const mode of ['advanced','guided']){
  if(mode==='guided'){await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Guided setup',exact:true}).click();await page.getByRole('heading',{name:'Give your quiz a clear promise.',exact:true}).waitFor();}
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   await open();await page.keyboard.press('Escape');await restored();checks++;
   await open();await map.getByRole('button',{name:'Close conversation map',exact:true}).click();await restored();checks++;
   await open();await page.setViewportSize({width:width===390?1440:390,height:width===390?1000:844});await twoFrames();await page.keyboard.press('Escape');await restored();checks++;
   await page.setViewportSize({width,height:width===390?844:1000});await open();await map.getByRole('button',{name:'Adjust the visual design',exact:true}).click();await map.waitFor({state:'detached'});const theme=page.getByRole('dialog',{name:'Make it yours',exact:true});await theme.waitFor();await twoFrames();assert.equal(await theme.evaluate(el=>el.contains(document.activeElement)),true,'Map dismissal must not steal focus from the requested theme editor');await theme.getByRole('button',{name:'Close theme editor',exact:true}).click();await theme.waitFor({state:'detached'});checks++;
  }
 }
 await page.screenshot({path:path.join(artifacts,'restored-mobile.png')});assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);console.log(`PASS ${engine}: ${checks} focus checks across guided/full editor, desktop/mobile Escape/close, responsive opener replacement, edit-to-theme without focus theft, no API writes or browser errors.`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
