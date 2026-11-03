// Isolated compiled-app acceptance. Never run this fixture suite against production.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE_URL,artifacts=process.env.ARTIFACT_DIR;
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.HEYQUIZ_DATA_DIR&&artifacts,'Explicit isolated records and artifacts required');
fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const page=await context.newPage(),headers={Origin:base},ids=[],errors=[],external=[];
 context.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base||['data:','blob:'].includes(url.protocol))return route.continue();external.push(url.origin);return route.abort();});
 const read=async id=>{const r=await context.request.get(base+'/api/forms/'+id);assert.equal(r.status(),200);return r.json();};
 async function stored(id,check){for(let n=0;n<80;n++){const f=await read(id);if(check(f))return f;await new Promise(r=>setTimeout(r,100));}throw Error('Expected scoring edits were not persisted');}
 async function mode(name){await page.getByRole('group',{name:'Editor mode',exact:true}).filter({visible:true}).first().getByRole('button',{name,exact:true}).click();}
 async function basic(){await mode('Basic');await page.getByRole('navigation',{name:'Quiz setup steps',exact:true}).getByRole('button',{name:'Questions',exact:true}).click();}
 async function fixture(type,marketing){
  const id='qa-image-scoring-'+Date.now()+'-'+ids.length;ids.push(id);
  const form={id,title:'Image scoring QA',mode:marketing?'survey':'quiz',questions:[{id:'q',type,title:'Choose your image',points:10,options:[{id:'a',label:'First image',imageUrl:'/quiz-icon.svg',isCorrect:true},{id:'b',label:'Second image',imageUrl:'/quiz-icon.svg',isCorrect:false}]}],...(marketing?{marketing}:{}),coverPage:{enabled:false,title:'QA',buttonText:'Start'}};
  const created=await context.request.post(base+'/api/forms',{data:form,headers});assert.equal(created.status(),201,await created.text());
  await page.evaluate(id=>localStorage.setItem('pippi-editor-mode:'+id,'advanced'),id);
  await page.goto(base+'/editor/'+id);await page.locator('[data-session-state=authenticated]').waitFor();return id;
 }
 async function preview(id,answers){const start=await context.request.post(base+'/api/forms/'+id+'/start',{headers,data:{preview:true}});assert.equal(start.status(),200,await start.text());const {token}=await start.json();const submit=await context.request.post(base+'/api/forms/'+id+'/submit',{headers,data:{token,answers:{q:answers}}});assert.equal(submit.status(),200,await submit.text());return submit.json();}
 try{
  const login=await context.request.post(base+'/api/auth',{data:{local:true},headers});assert.equal(login.status(),200);
  const session=await(await context.request.post(base+'/api/auth/session',{headers})).json();
  await page.goto(base+'/');
  for(const version of ['v1','v2']){
   const pref=await(await context.request.get(base+'/api/profile/interface')).json();
   const changed=await context.request.patch(base+'/api/profile/interface',{headers:{...headers,'X-Pippi-Account':session.accountKey},data:{preferredVersion:version,revision:pref.revision}});assert.equal(changed.status(),200,await changed.text());
   for(const type of ['picture_choice','image_multiselect']){
    const id=await fixture(type,{kind:'scorecard',categories:[{id:'readiness',title:'Readiness',description:'',minAnswers:1}],rules:[]});
    await page.getByRole('group',{name:'Scoring for First image',exact:true}).waitFor();
    await page.getByLabel('First image: Readiness points',{exact:true}).fill('0');await page.getByLabel('Second image: Readiness points',{exact:true}).fill('10');
    await stored(id,f=>f.marketing.rules.length===2&&f.marketing.rules.find(r=>r.answerId==='a')?.points===0&&f.marketing.rules.find(r=>r.answerId==='b')?.points===10);
    await page.reload();await page.locator('[data-session-state=authenticated]').waitFor();assert.equal(await page.getByLabel('First image: Readiness points',{exact:true}).inputValue(),'0');
    const answer=(id)=>type==='image_multiselect'?[id]:id;
    assert.equal((await preview(id,answer('a'))).marketing.categories[0].score,0);
    assert.equal((await preview(id,answer('b'))).marketing.categories[0].score,100);
    await basic();const second=page.getByRole('group',{name:'Answer 2',exact:true});await second.getByLabel('Points',{exact:true}).fill('7');
    await stored(id,f=>f.marketing.rules.find(r=>r.answerId==='b')?.points===7);await mode('Advanced');assert.equal(await page.getByLabel('Second image: Readiness points',{exact:true}).inputValue(),'7');
    await page.getByLabel('First image: Readiness points',{exact:true}).fill('');await stored(id,f=>f.marketing.rules.length===1&&f.marketing.rules[0].answerId==='b');
    assert.equal((await preview(id,answer('a'))).marketing.categories[0].score,null);
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.getByRole('group',{name:'Scoring for Second image',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,version+'-'+type+'-mobile.png')});await page.setViewportSize({width:1440,height:1100});
    console.log('PASS',version,type,'inline scoring, zero/blank, persistence, Basic round-trip, preview results and mobile');
   }
   const product=await fixture('picture_choice',{kind:'product_finder',outcomes:[{id:'starter',title:'Starter',description:'',minPoints:1}],rules:[]});
   const card=page.getByRole('group',{name:'Scoring for Second image',exact:true});await card.getByLabel('Second image: Starter points',{exact:true}).fill('5');await stored(product,f=>f.marketing.rules[0]?.points===5);
   assert.equal((await preview(product,'b')).marketing.outcomeId,'starter');await card.getByRole('checkbox',{name:'Exclude',exact:true}).check();const excluded=await stored(product,f=>f.marketing.rules.length===2&&f.marketing.rules.some(r=>r.effect==='exclude'));const pointsId=excluded.marketing.rules.find(r=>r.effect==='add').id;assert.equal(await card.getByLabel('Second image: Starter points',{exact:true}).isDisabled(),true);assert.equal((await preview(product,'b')).marketing.status,'no_match');
   await page.reload();await page.locator('[data-session-state=authenticated]').waitFor();assert.equal(await card.getByRole('checkbox',{name:'Exclude',exact:true}).isChecked(),true);assert.equal(await card.getByLabel('Second image: Starter points',{exact:true}).isDisabled(),true);await card.getByRole('checkbox',{name:'Exclude',exact:true}).uncheck();await stored(product,f=>f.marketing.rules.length===1&&f.marketing.rules[0].effect==='add'&&f.marketing.rules[0].points===5&&f.marketing.rules[0].id===pointsId);assert.equal(await card.getByLabel('Second image: Starter points',{exact:true}).inputValue(),'5');assert.equal((await preview(product,'b')).marketing.outcomeId,'starter');
   console.log('PASS',version,'product exclusions override points, survive reload and restore the original association when cleared');
   for(const type of ['picture_choice','image_multiselect','segmented','thumbs','like_dislike','switch']){
    const id=await fixture(type);
    if(type==='picture_choice'||type==='image_multiselect'){
     await page.getByRole('button',{name:'Click to set as correct answer',exact:true}).click();
    }else await page.getByLabel('Correct answer 2: Second image',{exact:true}).check();
    await stored(id,f=>f.questions[0].options[1].isCorrect&&(type==='image_multiselect'||!f.questions[0].options[0].isCorrect));
    await basic();await page.getByRole('group',{name:'Answer 1',exact:true}).getByLabel('Correct answer',{exact:true}).check();await page.getByLabel('Question points',{exact:true}).fill('15');
    await stored(id,f=>f.questions[0].points===15&&f.questions[0].options[0].isCorrect&&(type==='image_multiselect'||!f.questions[0].options[1].isCorrect));
    const result=await preview(id,type==='image_multiselect'?['a','b']:'a');assert.equal(result.totalPointsEarned,15);
    await page.reload();await page.locator('[data-session-state=authenticated]').waitFor();await page.getByRole('navigation',{name:'Quiz setup steps',exact:true}).getByRole('button',{name:'Questions',exact:true}).click();assert.equal(await page.getByLabel('Question points',{exact:true}).inputValue(),'15');
    console.log('PASS',version,type,'correct-answer controls, Basic parity, reload and actual preview grade');
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS image scoring: both interfaces, 18 synthetic quizzes, unchanged scoring APIs and no external requests');
 }catch(error){await page.screenshot({path:path.join(artifacts,'image-scoring-failure.png')}).catch(()=>{});throw error;}
 finally{for(const id of ids)await context.request.delete(base+'/api/forms/'+id,{headers});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
