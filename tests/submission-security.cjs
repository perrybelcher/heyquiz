require('./marketing-brief.cjs');
const assert=require('node:assert/strict');const {readRecord,writeRecord}=require('../lib/records.ts');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3161';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local synthetic tests only');
let cookie='';const id='qa-security-'+Date.now();
async function req(path,body,auth=false,method='POST'){const r=await fetch(base+path,{method,headers:{Origin:base,...(auth?{Cookie:cookie}:{}),...(!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
(async()=>{const login=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{"local":true}'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];let checks=0;
try{
 assert.equal((await req('/api/forms',{id,title:'Synthetic security test',mode:'quiz',questions:[{id:'q',type:'multiple_choice',title:'Choose',required:true,points:10,options:[{id:'a',label:'A',isCorrect:true},{id:'b',label:'B'}]},{id:'file',type:'file_upload',title:'Attachment'}]},true)).status,201);assert.equal((await req(`/api/forms/${id}/publish`,{},true)).status,200);
 const start=async()=>{const r=await req(`/api/forms/${id}/start`,{});assert.equal(r.status,200);return r.data;};const first=await start(),second=await start();
 for(const token of ['',first.token+'tampered','invalid']){assert.equal((await req(`/api/forms/${id}/submit`,{token,answers:{q:'a'}})).status,401);checks++;}
 assert.equal((await req('/api/forms/wrong-form/submit',{token:first.token,answers:{q:'a'}})).status,401);checks++;
 assert.equal((await req(`/api/forms/${id}/submit`,{token:first.token,answers:{q:'invented'}})).status,422);checks++;
 const upload=new FormData();upload.set('token',first.token);upload.set('file',new Blob(['Synthetic attachment'],{type:'text/plain'}),'qa.txt');const uploaded=await req('/api/media',upload);assert.equal(uploaded.status,200);
 assert.equal((await fetch(base+'/api/media/'+uploaded.data.id)).status,401);assert.equal((await fetch(base+uploaded.data.url)).status,200);checks++;
 assert.equal((await req(`/api/forms/${id}/submit`,{token:second.token,answers:{q:'a',file:uploaded.data}})).status,422);checks++;
 const blocked=new FormData();blocked.set('token',second.token);blocked.set('file',new Blob(['<script>test</script>'],{type:'text/html'}),'qa.html');assert.equal((await req('/api/media',blocked)).status,415);checks++;
 const concurrent=await Promise.all(Array.from({length:8},()=>req(`/api/forms/${id}/submit`,{token:first.token,answers:{q:'b',file:uploaded.data},totalPointsEarned:999,percentageScore:100})));
 concurrent.forEach(r=>{assert.equal(r.status,200);assert.equal(r.data.percentageScore,0);assert.equal(r.data.id,concurrent[0].data.id);});checks++;
 const rows=await req(`/api/forms/${id}/submissions`,undefined,true,'GET');assert.equal(rows.data.submissions.length,1);checks++;
 const attemptId=JSON.parse(Buffer.from(second.token.split('.')[0],'base64url').toString()).id;const record=await readRecord('attempts',attemptId);await writeRecord('attempts',attemptId,record.owner_id,{...record.payload,expiresAt:Date.now()-1},record.version);
 assert.equal((await req(`/api/forms/${id}/submit`,{token:second.token,answers:{q:'a'}})).status,401);checks++;
 // Exhaust each process-local backstop with invalid tokens, never real submissions.
 for(const [endpoint,max] of [['submit',60],['contact',30]]){let limited=false;for(let i=0;i<=max;i++){const r=await req(`/api/forms/${id}/${endpoint}`,{token:'invalid',answers:{}});if(r.status===429){limited=true;break;}assert.equal(r.status,401);}assert.ok(limited,endpoint+' must rate-limit');checks++;}
 console.log(`PASS ${checks} security groups: tampering, wrong form, invented answers, private uploads, cross-attempt attachment rejection, unsupported MIME, 8 concurrent duplicate requests, forged scores, expiry and both rate limits`);
}finally{await req('/api/forms/'+id,undefined,true,'DELETE');}})().catch(e=>{console.error(e.message);process.exitCode=1});
