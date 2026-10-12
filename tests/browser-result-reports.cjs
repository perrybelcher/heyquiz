const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {readRecord,writeRecord,removeRecord}=require('../lib/records.ts');
const {scorecardForm}=require('./fixtures/result-layouts.cjs');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3162';if(new URL(base).hostname!=='127.0.0.1')throw Error('Local synthetic test only');
async function checkPrint(page,label,expectedScores){
 const screenText=await page.locator('article').innerText();
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('.result-report-actions').evaluate(e=>getComputedStyle(e).display),'none');
 const colors=await page.locator('article').evaluate(article=>{
   const textElements=[article,...article.querySelectorAll('h1,h2,h3,p,span,li,summary,a,blockquote,figcaption')];
   const styles=textElements.map(e=>getComputedStyle(e));
   const surfaces=[article,...article.querySelectorAll('section,figure,details,[data-category-overview],.hq-primary')].map(e=>getComputedStyle(e));
   return {text:styles.map(s=>s.color),backgrounds:surfaces.map(s=>s.backgroundColor),shadow:styles.map(s=>s.textShadow),transitions:styles.map(s=>s.transitionProperty),animations:textElements.flatMap(e=>e.getAnimations()).length,failures:textElements.filter(e=>getComputedStyle(e).color!=='rgb(17, 17, 17)').map(e=>`${e.tagName}.${e.className}: ${e.textContent.slice(0,80)}`)};
 });
 // #111 on white has 18.88:1 contrast. Requiring ink on paper (not inverse
 // colors) also covers browsers that omit background paint in the PDF.
 assert.ok(colors.transitions.every(transition=>transition==='none'),label+': print palette applies immediately without a screen color transition');
 assert.equal(colors.animations,0,label+': print output cannot freeze a transitional color');
 assert.ok(colors.text.every(color=>color==='rgb(17, 17, 17)'),label+': all report typography uses dark ink; unexpected elements '+colors.failures.join('; '));
 assert.ok(colors.backgrounds.every(color=>color==='rgb(255, 255, 255)'),label+': dark/tinted cards become white paper');
 assert.ok(colors.shadow.every(shadow=>shadow==='none'),label+': no palette-dependent text shadows');
 assert.equal(await page.locator('article').innerText(),screenText,label+': printing retains every result and coverage label');
 const bars=await page.locator('[data-category-id]').evaluateAll(categories=>categories.map(category=>{
   const track=category.querySelector('[aria-hidden="true"]'),fill=track?.firstElementChild;
   if(!track||!fill)return null;
   const trackStyle=getComputedStyle(track),fillStyle=getComputedStyle(fill);
   return {text:category.innerText,width:fill.getBoundingClientRect().width,available:track.clientWidth,ink:fillStyle.borderTopColor,inkHeight:parseFloat(fillStyle.borderTopWidth),borderStyle:fillStyle.borderTopStyle,trackBorder:parseFloat(trackStyle.borderTopWidth)};
 }));
 assert.equal(bars.length,expectedScores.length);
 for(const [index,score] of expectedScores.entries()){
   const bar=bars[index];assert.ok(bar);assert.ok(bar.text.includes(score+'%'));
   assert.ok(Math.abs(bar.width/bar.available-score/100)<.01,label+': bar preserves the calculated proportion');
   assert.equal(bar.ink,'rgb(17, 17, 17)');assert.equal(bar.borderStyle,'solid');assert.ok(bar.inkHeight>=7);assert.ok(bar.trackBorder>=1);
   if(score===0)assert.equal(bar.width,0,'zero never acquires a filled bar');
 }
 for(const printBackground of [true,false]){
   const filename=`/tmp/pippi-private-result-${label}-backgrounds-${printBackground?'on':'off'}.pdf`;
   const pdf=await page.pdf({path:filename,format:'A4',printBackground});assert.ok(pdf.length>1000);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 }
 await page.screenshot({path:`/tmp/pippi-private-result-${label}-print.png`,fullPage:true});
 await page.emulateMedia({media:'screen'});
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1280,height:950}}),page=await ctx.newPage();page.setDefaultTimeout(15000);const headers={Origin:base},id='qa-report-'+Date.now(),reportIds=[],formIds=[id];
const post=(path,data)=>ctx.request.post(base+path,{data,headers});
try{
 assert.equal((await post('/api/auth',{local:true})).status(),200);
 assert.equal((await post('/api/forms',{id,title:'Original report quiz',mode:'quiz',theme:{brandName:'Test Studio',hidePippiBranding:true},questions:[{id:'q',title:'Choose a route',type:'multiple_choice',required:true,points:10,options:[{id:'a',label:'First path',isCorrect:true},{id:'b',label:'Second path'}]},{id:'note',title:'Private note',type:'short_answer',required:false}],settings:{showReviewBeforeSubmit:false},endingPage:{title:'Original result heading',message:'Original next step'}})).status(),201);
 assert.equal((await post(`/api/forms/${id}/publish`,{})).status(),200);
 const session=await(await post(`/api/forms/${id}/start`,{})).json();
 assert.equal((await post(`/api/forms/${id}/result-link`,{token:session.token})).status(),409);
 assert.equal((await post(`/api/forms/${id}/result-link`,{token:'invalid'})).status(),401);
 assert.equal((await post('/api/forms/another-quiz/result-link',{token:session.token})).status(),401);
 const submitted=await(await post(`/api/forms/${id}/submit`,{token:session.token,answers:{q:'a',note:'private-person@example.test'}})).json();assert.equal(submitted.percentageScore,100);
 const links=await Promise.all([post(`/api/forms/${id}/result-link`,{token:session.token}),post(`/api/forms/${id}/result-link`,{token:session.token})]);const link=await links[0].json(),second=await links[1].json();assert.equal(links[0].status(),200);assert.equal(link.path,second.path);
 const token=link.path.split('/').pop(),claims=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());reportIds.push(claims.id);
 assert.equal((await post(`/api/forms/${id}/progress`,{token,questionId:'q'})).status(),401);
 assert.equal((await post(`/api/forms/${id}/result-link`,{token})).status(),401);
 const anonymous=await browser.newContext();const response=await anonymous.request.get(base+link.path);assert.equal(response.status(),200);assert.ok(response.headers()['cache-control'].includes('no-store'));assert.ok(!(await response.text()).includes('private-person@example.test'));
 const reportPage=await anonymous.newPage();await reportPage.goto(base+link.path);await reportPage.getByRole('heading',{name:'Original result heading',exact:true}).waitFor();assert.equal(await reportPage.title(),'Your private quiz result');assert.equal(await reportPage.locator('meta[name=referrer]').getAttribute('content'),'no-referrer');assert.ok((await reportPage.locator('meta[name=robots]').getAttribute('content')).includes('noindex'));assert.equal(await reportPage.getByText('100%',{exact:true}).count(),1);
 const form=await(await ctx.request.get(base+'/api/forms/'+id)).json();assert.equal((await ctx.request.put(base+'/api/forms/'+id,{data:{...form,title:'Changed title',endingPage:{title:'Changed ending',message:'Changed advice'}},headers})).status(),200);await reportPage.reload();await reportPage.getByRole('heading',{name:'Original result heading',exact:true}).waitFor();assert.equal(await reportPage.getByText('Original report quiz',{exact:true}).count(),1);
 const attemptId=JSON.parse(Buffer.from(session.token.split('.')[0],'base64url').toString()).id,row=await readRecord('attempts',attemptId);await writeRecord('attempts',attemptId,row.owner_id,{...row.payload,expiresAt:Date.now()-1},row.version);assert.equal((await anonymous.request.get(base+link.path)).status(),200);
 await reportPage.setViewportSize({width:390,height:844});assert.ok(await reportPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await reportPage.screenshot({path:'/tmp/pippi-private-result-mobile.png',fullPage:false});await reportPage.emulateMedia({media:'print'});assert.equal(await reportPage.locator('.result-report-actions').evaluate(e=>getComputedStyle(e).display),'none');await reportPage.pdf({path:'/tmp/pippi-private-result.pdf',format:'A4',printBackground:true});assert.ok(fs.statSync('/tmp/pippi-private-result.pdf').size>1000);
 // Persist real scorecard reports in both palettes. White-on-black is an
 // intentional stress case: neither the title, score nor CTA may disappear.
 for(const dark of [false,true]){
   const printId=id+(dark?'-dark':'-light');formIds.push(printId);const printable=scorecardForm(printId,'score_overview');
   printable.theme={...printable.theme,brandName:'Print QA',hidePippiBranding:true,backgroundColor:dark?'#050505':'#f5f5f5',cardColor:dark?'#000000':'#ffffff',textColor:dark?'#ffffff':'#111111',primaryColor:dark?'#ffffff':'#a92335'};
   assert.equal((await post('/api/forms',printable)).status(),201);assert.equal((await post(`/api/forms/${printId}/publish`,{})).status(),200);
   const printSession=await(await post(`/api/forms/${printId}/start`,{})).json();
   const answers=Object.fromEntries(printable.questions.map((question,index)=>[question.id,index===2||dark&&index===0?'a0':'a2']));
   const printResult=await(await post(`/api/forms/${printId}/submit`,{token:printSession.token,answers})).json();assert.deepEqual(printResult.marketing.categories.map(category=>category.score),[dark?50:0,100]);
   const printLink=await(await post(`/api/forms/${printId}/result-link`,{token:printSession.token})).json();reportIds.push(JSON.parse(Buffer.from(printLink.path.split('/').pop().split('.')[0],'base64url').toString()).id);
   const printPage=await anonymous.newPage();await printPage.goto(base+printLink.path);await printPage.locator('[data-result-layout="score_overview"]').waitFor();
   assert.equal(await printPage.locator('article').evaluate(e=>getComputedStyle(e).backgroundColor),dark?'rgb(0, 0, 0)':'rgb(255, 255, 255)','screen palette is preserved');
   assert.equal(await printPage.locator('[data-result-block="primary-action"]').count(),1);
   await checkPrint(printPage,dark?'dark':'light',printResult.marketing.categories.map(category=>category.score));
   assert.equal(await printPage.locator('article').evaluate(e=>getComputedStyle(e).backgroundColor),dark?'rgb(0, 0, 0)':'rgb(255, 255, 255)','print styling does not alter the screen theme');await printPage.close();
 }
 const originalReport=await readRecord('result_reports',claims.id);await writeRecord('result_reports',claims.id,'local',{...originalReport.payload,expiresAt:Date.now()-1},originalReport.version);assert.equal((await anonymous.request.get(base+link.path)).status(),404);const expiredReport=await readRecord('result_reports',claims.id);await writeRecord('result_reports',claims.id,'local',originalReport.payload,expiredReport.version);
 const tampered=token.slice(0,-3)+'zzz';assert.equal((await anonymous.request.get(base+'/result/'+tampered)).status(),404);
 const preview=await(await post(`/api/forms/${id}/start`,{preview:true})).json();await post(`/api/forms/${id}/submit`,{token:preview.token,answers:{q:'a'}});assert.equal((await post(`/api/forms/${id}/result-link`,{token:preview.token})).status(),400);
 // The visible player offers link creation only after completing a live response.
 await page.goto(base+'/play/'+id);await page.getByRole('button',{name:'Let’s begin',exact:true}).click();await page.getByRole('radio',{name:'First path',exact:true}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Submit response',exact:true}).click();await page.getByRole('button',{name:'Create private result link',exact:true}).click();await page.getByRole('link',{name:/Open saved result/}).waitFor();const uiPath=await page.getByRole('link',{name:/Open saved result/}).getAttribute('href');reportIds.push(JSON.parse(Buffer.from(uiPath.split('/').pop().split('.')[0],'base64url').toString()).id);assert.equal((await anonymous.request.get(base+uiPath)).status(),200);
 assert.equal((await ctx.request.delete(base+`/api/forms/${id}/submissions?submissionId=${attemptId}`,{headers})).status(),200);assert.equal((await anonymous.request.get(base+link.path)).status(),404);
 console.log('PASS report link completion/auth/purpose/isolation, idempotence, no raw answers, expiry independent of attempt, frozen view, light/dark ink-and-paper PDF with backgrounds on/off, score/bar integrity, mobile, player action, tampering, preview exclusion and deletion revocation');
}finally{for(const formId of formIds)await ctx.request.delete(base+'/api/forms/'+formId,{headers});for(const reportId of reportIds)await removeRecord('result_reports',reportId,'local');await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
