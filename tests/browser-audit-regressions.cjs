const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:3180',headers={Origin:base};
(async()=>{const browser=await chromium.launch({channel:'chrome'}),ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();const ids=[],errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());try{
assert.equal((await ctx.request.post(base+'/api/auth',{headers,data:{local:true}})).status(),200);
assert.equal((await ctx.request.get(base+'/api/auth')).headers()['cache-control'],'private, no-store');
await page.goto(base+'/create/blank');await page.getByText('You’re signed in.',{exact:false}).waitFor();assert.equal(await page.getByText('Create a free account to save your quiz, share it and see the answers.',{exact:false}).count(),0);
const save=async extra=>{const id='qa-audit-'+Date.now()+'-'+ids.length;ids.push(id);const r=await ctx.request.post(base+'/api/forms',{headers,data:{id,title:'Audit fixture',mode:'survey',coverPage:{enabled:false,title:"Audit",buttonText:"Start"},...extra}});assert.equal(r.status(),201,await r.text());return await r.json();};
const security=await save({questions:[{id:'captcha',type:'captcha',title:'Verify'}]});
await page.addInitScript(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),security.id);await page.goto(base+'/editor/'+security.id);await page.getByRole('button',{name:'Publish',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'Ready to publish?'});await dialog.getByText('Publishing is blocked:',{exact:false}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Publish now'}).isDisabled(),true);
assert.equal((await ctx.request.post(base+'/api/forms/'+security.id+'/publish',{headers})).status(),422);
console.log('PASS signed-in draft copy and CAPTCHA UI/server publication blocker');
await dialog.getByRole('button',{name:'Back to editor'}).click();
await page.route('**/api/config',r=>r.fulfill({json:{turnstileConfigured:true}}));await page.getByRole('button',{name:'Publish',exact:true}).first().click();await dialog.getByText('Security verification is configured.',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Publish now'}).isDisabled(),false);await dialog.getByRole('button',{name:'Back to editor'}).click();await page.unroute('**/api/config');
const knowledge=await save({mode:'quiz',questions:[{id:'k',type:'multiple_choice',title:'Choose one',points:10,options:[{id:'yes',label:'Correct',isCorrect:true},{id:'no',label:'Incorrect',isCorrect:false}]}]});
await page.addInitScript(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),knowledge.id);await page.goto(base+'/editor/'+knowledge.id);await page.getByRole('button',{name:'Publish',exact:true}).first().click();assert.equal(await dialog.getByRole('button',{name:'Publish now'}).isDisabled(),true);await dialog.getByRole('checkbox').check();assert.equal(await dialog.getByRole('button',{name:'Publish now'}).isDisabled(),false);
console.log('PASS configured CAPTCHA readiness and explicit knowledge-answer review');
const fixture=await save({pages:[{id:'old',title:'Old page',questionIds:['p']}],questions:[{id:'p',pageId:'old',type:'phone',title:'Phone',required:true},{id:'n',type:'nps',title:'Recommend?',minRating:1,maxRating:10}]});
await page.addInitScript(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),fixture.id);await page.goto(base+'/editor/'+fixture.id);
// Use the visible JSON schema control and import a replacement page.
await page.getByTitle('Declarative Schema JSON').first().click();
const imported={...fixture,pages:[{id:'new',title:'Imported page',questionIds:['text']}],questions:[{id:'text',pageId:'new',type:'short_answer',title:'Imported question'}]};
await page.locator('textarea:visible').last().fill(JSON.stringify(imported));await page.getByRole('button',{name:'Apply Schema'}).click();await page.locator('textarea').filter({visible:true}).filter({hasText:'Imported question'}).first().waitFor();assert.equal(await page.getByText('A different draft saved on this device is available.',{exact:false}).count(),0);
console.log('PASS schema import selects imported page');
// A matching initial backup must not become a recovery candidate after a later save.
const recoveryFixture=await save({questions:[{id:'r',type:'short_answer',title:'Original wording'}]});
await page.addInitScript(f=>{localStorage.setItem('pippi-editor-mode:'+f.id,'advanced');sessionStorage.setItem('heyquiz-draft:'+f.id,JSON.stringify(f));},recoveryFixture);
await page.goto(base+'/editor/'+recoveryFixture.id);await page.locator('input').first().fill('Updated in this session');
await page.getByText('Saved',{exact:true}).first().waitFor();
for(let i=0;i<50;i++){const saved=await(await ctx.request.get(base+'/api/forms/'+recoveryFixture.id)).json();if(saved.title==='Updated in this session')break;await page.waitForTimeout(100);}
assert.equal((await(await ctx.request.get(base+'/api/forms/'+recoveryFixture.id)).json()).title,'Updated in this session');
assert.equal(await page.getByRole('button',{name:'Restore changes',exact:true}).count(),0);
console.log('PASS matching initial backup does not reappear after current-session save');
await page.getByRole('button',{name:'Conversation map',exact:true}).first().click();await page.getByText('Separate contact step is off',{exact:true}).waitFor();assert.equal(await page.getByText('No contact details requested',{exact:true}).count(),0);
console.log('PASS conversation map distinguishes separate capture from in-quiz questions');
const report=await save({questions:[{id:'c',type:'multiple_choice',title:'Choose',options:[{id:'a',label:'A'}]}],outcomeTiers:[{id:'tier',badge:'',title:'Unrelated tier',minScorePercent:0,maxScorePercent:100,message:'Other'}],marketing:{kind:'product_finder',outcomes:[{id:'product',title:'Baking Tools Upgrade',description:'Tools',minPoints:1}],rules:[{id:'rule',questionId:'c',answerId:'a',targetId:'product',effect:'add',points:1}]}});
await page.addInitScript(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),report.id);
await page.route('**/api/forms/'+report.id+'/submissions',r=>r.fulfill({json:{submissions:[{id:'synthetic',formId:report.id,submittedAt:new Date().toISOString(),percentageScore:100,totalPointsEarned:0,totalPointsPossible:0,passed:true,grading:[],matchedTier:report.outcomeTiers[0],marketing:{kind:'product_finder',status:'matched',outcomeId:'product',title:'Baking Tools Upgrade',message:'Tools',reasons:[],categories:[]}}],stats:{total:1,passedCount:1,failedCount:0,passRate:100,averageScore:100,tierDistribution:{'Baking Tools Upgrade':1},starts:1,completionRate:100,funnel:[]}}}));
await page.goto(base+'/editor/'+report.id);await page.getByRole('button',{name:'Results',exact:true}).click();await page.getByText('Baking Tools Upgrade',{exact:true}).first().waitFor();assert.equal(await page.getByText('Outcome Tier Distribution',{exact:true}).count(),0);
const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const download=await downloaded;const stream=await download.createReadStream();let csv='';for await(const part of stream)csv+=part.toString();assert.ok(csv.includes(',,,"Recorded","Baking Tools Upgrade"'));assert.ok(!csv.includes('Unrelated tier'));
console.log('PASS real CSV download leaves ungraded scores blank and uses saved recommendation; irrelevant tier chart hidden');

const player=await save({questions:[{id:'p',type:'phone',title:'Phone',required:true},{id:'n',type:'nps',title:'Recommend?',minRating:1,maxRating:10},{id:'im',type:'image_upload',title:'Image',required:false}],theme:{layout:'step'},settings:{showReviewBeforeSubmit:false}});
await page.goto(base+'/play/'+player.id+'?preview=1');await page.getByRole('button',{name:'Let’s begin'}).click();
await page.getByLabel('Phone',{exact:true}).fill('abc');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Enter a phone number with 7–15 digits,',{exact:false}).waitFor();
await page.getByLabel('Phone',{exact:true}).fill('+1 (512) 555-0100');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'0 out of 10',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();
let uploadCalls=0;page.on('request',r=>{if(r.url().endsWith('/api/media')&&r.method()==='POST')uploadCalls++;});
await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic test')});await page.getByText('Choose a PNG, JPEG, WebP or GIF image.',{exact:false}).waitFor();assert.equal(uploadCalls,0);
await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzQAAAABJRU5ErkJggg==','base64')});await page.getByText('synthetic.png',{exact:true}).waitFor();
await page.getByRole('button',{name:'Submit response',exact:true}).click();await page.getByText('Your preview is complete. No response was recorded.',{exact:true}).waitFor();
assert.equal(await page.getByText('Your answers have been saved successfully.',{exact:true}).count(),0);
console.log('PASS phone validation, selectable NPS zero, image-only upload and honest preview completion');
await page.screenshot({path:'/tmp/pippi-audit-player.png'});
assert.deepEqual(errors,[]);
}finally{for(const id of ids)await ctx.request.delete(base+'/api/forms/'+id,{headers});await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
