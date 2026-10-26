// Local compiled app only. Synthetic quizzes, attempts and contact; no hosted providers.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE_URL,artifacts=process.env.ARTIFACT_DIR;
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(process.env.HEYQUIZ_DATA_DIR&&artifacts);
fs.mkdirSync(artifacts,{recursive:true});const headers={Origin:base},id='qa-basic-leads-'+Date.now();let browser,context,page;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function saved(test){for(let i=0;i<60;i++){const response=await context.request.get(`${base}/api/forms/${id}`);const body=await response.json();if(response.ok()&&test(body))return body;await wait(150)}throw Error('Expected draft was not acknowledged');}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
 assert.equal((await context.request.post(base+'/api/auth',{headers,data:{local:true}})).status(),200);
 const create=await context.request.post(base+'/api/forms',{headers,data:{id,title:'QA Branch and Leads',mode:'survey',questions:[{id:'q1',title:'Experience?',type:'multiple_choice',required:true,options:[{id:'a',label:'Beginner'},{id:'b',label:'Expert'}]},{id:'q2',title:'Extra question',type:'short_answer'},{id:'q3',title:'Next question',type:'short_answer'}],logicRules:[{id:'r1',sourceQuestionId:'q1',operator:'equals',value:'Beginner',action:'jump_to_question',targetQuestionId:'q3'}]}});assert.equal(create.status(),201);
 assert.equal((await context.request.post(`${base}/api/forms/${id}/publish`,{headers,data:{}})).status(),200);
 page=await context.newPage();await page.addInitScript(id=>{if(!localStorage.getItem('pippi-editor-mode:'+id))localStorage.setItem('pippi-editor-mode:'+id,'advanced')},id);await page.goto(`${base}/editor/${id}`);
 await page.getByRole('textbox',{name:'Question 1, answer 1',exact:true}).fill('Starting out');
 const renamed=await saved(form=>form.questions[0].options[0].label==='Starting out');assert.equal(renamed.logicRules[0].value,'a');assert.equal(renamed.questions[0].options[0].id,'a');
 await page.getByRole('button',{name:/^Logic/}).click();assert.equal(await page.getByRole('combobox',{name:'Rule 1 answer',exact:true}).inputValue(),'a');await page.getByRole('combobox',{name:'Rule 1 answer',exact:true}).selectOption('a');await page.getByRole('button',{name:'Close & Save',exact:true}).click();
 await page.getByRole('button',{name:'Basic mode',exact:true}).first().click();await page.getByRole('button',{name:'5. Publish',exact:true}).click();
 await page.getByRole('checkbox',{name:'Collect contact details',exact:true}).check();
 assert.equal(await page.getByRole('checkbox',{name:'Offer a separate, optional marketing opt-in',exact:true}).isChecked(),false);
 await page.getByRole('combobox',{name:'Name field',exact:true}).selectOption('required');await page.getByRole('combobox',{name:'Phone field',exact:true}).selectOption('optional');
 await page.getByRole('checkbox',{name:'Require contact details to see results',exact:true}).check();
 await page.getByRole('textbox',{name:'Contact button label',exact:true}).fill('Continue to my advice');
 await page.getByRole('combobox',{name:'When to ask',exact:true}).selectOption('after_results');
 assert.equal(await page.getByRole('checkbox',{name:'Require contact details to see results',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('checkbox',{name:'Require contact details to see results',exact:true}).isChecked(),false);
 assert.equal(await page.getByRole('textbox',{name:'Contact button label',exact:true}).inputValue(),'Continue to my advice');
 await page.getByRole('combobox',{name:'When to ask',exact:true}).selectOption('before_results');await page.getByRole('checkbox',{name:'Require contact details to see results',exact:true}).check();
 await page.getByRole('checkbox',{name:'Offer a separate, optional marketing opt-in',exact:true}).check();await page.getByRole('textbox',{name:'Marketing consent wording',exact:true}).fill('Send me occasional baking tips.');
 await page.getByRole('button',{name:'Review next item',exact:true}).click();for(let i=0;i<40;i++){if(await page.getByRole('textbox',{name:'Privacy-policy link',exact:true}).evaluate(element=>element===document.activeElement))break;await wait(75)}assert.equal(await page.getByRole('textbox',{name:'Privacy-policy link',exact:true}).evaluate(element=>element===document.activeElement),true);
 await page.getByRole('textbox',{name:'Privacy-policy link',exact:true}).fill('https://example.test/privacy');
 await page.getByText('Preview contact form',{exact:true}).click();
 const preview=page.getByRole('group',{name:'Contact form preview',exact:true});for(const field of await preview.locator('input,button').all())assert.equal(await field.isDisabled(),true);
 assert.equal(await preview.getByRole('checkbox').isChecked(),false);
 const config=await saved(form=>form.capture?.privacyUrl==='https://example.test/privacy'&&form.capture?.required&&form.capture?.name==='required');assert.equal(config.capture.phone,'optional');assert.equal(config.capture.buttonText,'Continue to my advice');
 await page.setViewportSize({width:375,height:812});await preview.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(artifacts,'basic-lead-capture-mobile.png'),fullPage:false});
 await page.reload();await page.getByRole('button',{name:'5. Publish',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'Name field',exact:true}).inputValue(),'required');
 // Explicit publication in the isolated fixture only. Test the real respondent APIs.
 assert.equal((await context.request.post(`${base}/api/forms/${id}/publish`,{headers,data:{}})).status(),200);
 const start=await context.request.post(`${base}/api/forms/${id}/start`,{headers,data:{}}),attempt=await start.json();assert.equal(start.status(),200);
 const submit=await context.request.post(`${base}/api/forms/${id}/submit`,{headers,data:{token:attempt.token,answers:{q1:'a'},contact:{email:'synthetic@example.test',name:'Synthetic QA',marketingConsent:false}}});assert.equal(submit.status(),200,await submit.text());
 const records=await (await context.request.get(`${base}/api/forms/${id}/submissions`)).json();const response=records.submissions[0];assert.equal(response.contact.marketingConsent,false);assert.equal(response.grading.some(answer=>answer.questionId==='q2'),false);assert.equal(response.contact.name,'Synthetic QA');
 const unsafeDraft=await (await context.request.get(`${base}/api/forms/${id}`)).json();unsafeDraft.logicRules[0]={...unsafeDraft.logicRules[0],operator:'contains',value:'Starting'};
 assert.equal((await context.request.put(`${base}/api/forms/${id}`,{headers,data:unsafeDraft})).status(),200);
 await page.reload();await page.getByRole('button',{name:'2. Questions',exact:true}).click();await page.getByRole('textbox',{name:'Answer wording',exact:true}).first().fill('Different wording');
 await page.getByRole('alert').filter({hasText:'would alter a branching rule'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Answer wording',exact:true}).first().inputValue(),'Starting out');
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Advanced mode',exact:true}).first().click();await page.getByRole('textbox',{name:'Question 1, answer 1',exact:true}).fill('Different wording');await page.getByRole('alert').filter({hasText:'would alter a branching rule'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Question 1, answer 1',exact:true}).inputValue(),'Starting out');
 console.log('PASS compiled Basic lead collection: Advanced rename preserves live routing after explicit publish; Basic fields/timing/consent save and reload; custom copy stays intact, after-results capture is optional, disabled preview fits mobile, respondent decline of marketing still completes.');
}finally{if(context)await context.request.delete(`${base}/api/forms/${id}`,{headers});await browser?.close()}})().catch(error=>{console.error(error);process.exitCode=1});
