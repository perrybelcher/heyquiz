// Explicit opt-in and separate synthetic credentials prevent accidental customer testing.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'https://www.pippiapp.com';
if (!process.env.QA_ACCOUNTS_FILE) throw Error('Provide QA_ACCOUNTS_FILE containing two dedicated QA accounts.');
const accounts = JSON.parse(fs.readFileSync(process.env.QA_ACCOUNTS_FILE,'utf8'));
if(accounts.length!==2 || accounts.some(a=>!a.email.endsWith('@example.test'))) throw Error('Dedicated example.test accounts required');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 const contexts=await Promise.all(accounts.map(()=>browser.newContext()));
 const ids=accounts.map((_,i)=>'qa-live-isolation-'+Date.now()+'-'+i);
 const headers={Origin:base};let checks=0;
 try {
  for(let i=0;i<2;i++){
   const r=await contexts[i].request.post(base+'/api/auth',{headers,data:accounts[i]});assert.equal(r.status(),200,'QA login');
   const f={id:ids[i],title:'QA isolation fixture '+i,mode:'quiz',questions:[{id:'q',type:'multiple_choice',title:'Choose an answer',required:true,points:10,options:[{id:'a',label:'Correct',isCorrect:true},{id:'b',label:'Incorrect'}]}]};
   assert.equal((await contexts[i].request.post(base+'/api/forms',{headers,data:f})).status(),201);checks++;
  }
  for(let i=0;i<2;i++){
   const owner=contexts[i].request,other=contexts[1-i].request,id=ids[i];
   assert.equal((await owner.get(base+'/api/forms/'+id)).status(),200);
   for(const [method,suffix] of [['GET',''],['PUT',''],['DELETE',''],['POST','/publish'],['GET','/contacts'],['GET','/contacts?format=csv'],['GET','/submissions'],['GET','/submissions?format=csv'],['GET','/analytics']]){
    const r=await other.fetch(base+'/api/forms/'+id+suffix,{method,headers,...(['POST','PUT'].includes(method)?{data:{}}:{})});assert.equal(r.status(),404,method+suffix);checks++;
   }
   assert.equal((await other.post(base+'/api/forms/'+id+'/start',{headers,data:{preview:true}})).status(),404);checks++;
   const list=await(await other.get(base+'/api/forms')).json();assert.ok(!list.some(f=>f.id===id));checks++;
   assert.equal((await owner.post(base+'/api/forms/'+id+'/publish',{headers,data:{}})).status(),200);
   const start=await(await owner.post(base+'/api/forms/'+id+'/start',{headers,data:{}})).json();
   const upload=await owner.post(base+'/api/media',{headers,multipart:{token:start.token,file:{name:'qa.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic QA attachment')}}});assert.equal(upload.status(),200);const media=await upload.json();
   assert.equal((await owner.get(base+'/api/media/'+media.id)).status(),200);
   assert.equal((await other.get(base+'/api/media/'+media.id)).status(),401);checks++;
   assert.equal((await owner.post(base+'/api/forms/'+id+'/submit',{headers,data:{token:start.token,answers:{q:'a'}}})).status(),200);
   const rows=await(await owner.get(base+'/api/forms/'+id+'/submissions')).json();assert.equal(rows.submissions.length,1);assert.equal(rows.submissions[0].percentageScore,100);checks++;
  }
  console.log('PASS '+checks+' live checks using two independent Supabase accounts; both ownership directions, exports, preview, private uploads and real stored responses');
 } finally {
  for(let i=0;i<2;i++) {const r=await contexts[i].request.delete(base+'/api/forms/'+ids[i],{headers});console.log('Fixture cleanup',ids[i],r.status());await contexts[i].request.delete(base+'/api/auth',{headers});}
  await browser.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
