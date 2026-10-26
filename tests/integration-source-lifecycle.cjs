// Isolated delivery lifecycle checks. All destinations are injected mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'pippi-integration-source-'));
for(const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])process.env[name]='';
delete process.env.VERCEL;delete process.env.VERCEL_ENV;
process.env.HEYQUIZ_DATA_DIR=temporary;process.env.SESSION_SECRET='synthetic-source-lifecycle-secret-32-characters';process.env.NANGO_SECRET_KEY='synthetic-nango-key';
global.fetch=async()=>{throw Error('Unexpected external request in synthetic lifecycle test');};
const records=require('../lib/records.ts'),service=require('../lib/integrations/service.ts'),{seal}=require('../lib/integrations/secrets.ts'),{ServiceUnavailableError}=require('../lib/errors.ts');
const {deleteSubmission}=require('../lib/storage.ts');
const owner='synthetic-owner';let sequence=0,groups=0;
const accepted=(body={id:'remote-contact'})=>({status:200,body:JSON.stringify(body)});
async function fixture(provider='webhook',tags=[],options={}){
  const n=++sequence,formId=`lifecycle-form-${n}`,responseId=`lifecycle-response-${n}`,connectionId=`lifecycle-connection-${n}`,now=new Date().toISOString();
  await records.writeRecord('forms',formId,owner,{id:formId,questions:[]},0);
  const connection={id:connectionId,formId,name:'Synthetic destination',provider,enabled:true,consentOnly:options.consentOnly??true,tags,resultTag:false,mappings:[],locationId:'synthetic-location',destination:'synthetic',createdAt:now,updatedAt:now,activeFrom:now,
    secretBox:seal({url:'https://hooks.example.test/synthetic',token:'synthetic-private-token',connectionId:'synthetic-nango-connection',providerKey:'synthetic-provider'},`${owner}:${formId}:${connectionId}`)};
  await records.writeRecord('integrations',connectionId,owner,connection,0);
  const result={id:responseId,formId,submittedAt:now,percentageScore:75,answers:{q:'original answer'},contact:{email:'synthetic@example.test',name:'Synthetic Person',phone:'+12025550123',marketingConsent:options.marketingConsent??true,recordedAt:now,consentText:'Synthetic opt-in',privacyUrl:'https://example.test/privacy',purposeText:'Synthetic follow-up',formRevision:1,placement:'before_results'}};
  await records.writeRecord('submissions',responseId,owner,result,0);await service.enqueueSubmission(owner,result);
  const job=(await records.listRecords('deliveries',owner)).find(row=>row.payload.event.responseId===responseId);
  assert.ok(job);return{formId,responseId,connectionId,result,job};
}
const state=async f=>(await records.readRecord('deliveries',f.job.id)).payload;
async function mutateSource(f,update){const row=await records.readRecord('submissions',f.responseId);await records.writeRecord('submissions',row.id,row.owner_id,update(row.payload),row.version);}
async function stopped(name,mutate){
  const f=await fixture();await mutate(f);let calls=0;await service.deliver(f.job.id,owner,async()=>{calls++;return accepted();});assert.equal(calls,0);assert.equal((await state(f)).state,'skipped');assert.match((await state(f)).lastMessage,/stopp|source|response/i);console.log('PASS',name);groups++;
}
(async()=>{
  await stopped('deleted responses never send queued frozen contact or answers',f=>records.removeRecord('submissions',f.responseId,owner));
  await stopped('foreign-owner source rows do not authorize delivery',async f=>{await records.removeRecord('submissions',f.responseId,owner);await records.writeRecord('submissions',f.responseId,'other-owner',f.result,0);});
  await stopped('wrong-form source rows do not authorize delivery',f=>mutateSource(f,result=>({...result,formId:'other-form'})));
  await stopped('mismatched payload response identities do not authorize delivery',f=>mutateSource(f,result=>({...result,id:'other-response'})));
  await stopped('removed captured contacts stop delivery',f=>mutateSource(f,result=>({...result,contact:undefined})));
  await stopped('changed captured mailboxes stop stale-recipient delivery',f=>mutateSource(f,result=>({...result,contact:{...result.contact,email:'changed@example.test'}})));
  await stopped('revoked marketing consent cannot replay frozen opt-in',f=>mutateSource(f,result=>({...result,contact:{...result.contact,marketingConsent:false}})));
  await stopped('changed captured phone details cannot replay a frozen contact',f=>mutateSource(f,result=>({...result,contact:{...result.contact,phone:'+12025550999'}})));
  await stopped('successful deletion receipt prevents same-ID source resurrection',async f=>{
    assert.equal(await deleteSubmission(f.responseId,f.formId,owner),true);
    const receipts=await records.listRecords('submission_deletions',owner),receipt=receipts.find(row=>row.payload.submissionId===f.responseId);assert.ok(receipt);
    const text=JSON.stringify(receipt);assert.ok(!text.includes('synthetic@example.test')&&!text.includes('original answer')&&!text.includes('Synthetic Person'));
    await records.writeRecord('submissions',f.responseId,owner,f.result,0);
  });

  {
    const f=await fixture();let calls=0;await service.deliver(f.job.id,owner,async()=>{calls++;return{status:400,body:'synthetic permanent rejection'};});assert.equal((await state(f)).state,'failed');
    await records.removeRecord('submissions',f.responseId,owner);await assert.rejects(()=>service.retryDelivery(f.formId,owner,f.job.id),error=>[409,410].includes(error.status));
    assert.equal((await state(f)).state,'skipped');await service.deliver(f.job.id,owner,async()=>{calls++;return accepted();});assert.equal(calls,1);console.log('PASS manual retry cannot requeue a deleted source');groups++;
  }
  {
    const f=await fixture(),original=records.readRecord;let calls=0;
    records.readRecord=async(kind,id,...args)=>{if(kind==='submissions'&&id===f.responseId)throw new ServiceUnavailableError('Synthetic read outage');return original(kind,id,...args);};
    try{await service.deliver(f.job.id,owner,async()=>{calls++;return accepted();});}finally{records.readRecord=original;}
    const job=await state(f);assert.equal(calls,0);assert.equal(job.state,'pending');assert.match(job.lastMessage,/Retry scheduled/);assert.ok(job.nextAttemptAt>Date.now());
    const row=await records.readRecord('deliveries',f.job.id);await records.writeRecord('deliveries',row.id,owner,{...row.payload,nextAttemptAt:0},row.version);await service.deliver(f.job.id,owner,async()=>{calls++;return accepted();});assert.equal(calls,1);assert.equal((await state(f)).state,'delivered');console.log('PASS source storage outages remain retryable and recover');groups++;
  }
  {
    const f=await fixture(),original=records.readRecord;let calls=0;
    records.readRecord=async(kind,...args)=>{if(kind==='submission_deletions')throw new ServiceUnavailableError('Synthetic receipt read outage');return original(kind,...args);};
    try{await service.deliver(f.job.id,owner,async()=>{calls++;return accepted();});}finally{records.readRecord=original;}
    assert.equal(calls,0);assert.equal((await state(f)).state,'pending');assert.equal((await state(f)).lastStatus,503);console.log('PASS deletion-receipt read outages fail closed and remain retryable');groups++;
  }
  {
    const f=await fixture(),original=records.writeRecord;
    records.writeRecord=async(kind,...args)=>{if(kind==='submission_deletions')throw new ServiceUnavailableError('Synthetic receipt write outage');return original(kind,...args);};
    try{await assert.rejects(()=>deleteSubmission(f.responseId,f.formId,owner),error=>error.status===503);}finally{records.writeRecord=original;}
    assert.ok(await records.readRecord('submissions',f.responseId));assert.equal((await state(f)).state,'pending');console.log('PASS deletion-receipt write outage rejects deletion and retains the source');groups++;
  }
  {
    const f=await fixture(),receiptId=require('node:crypto').createHash('sha256').update(JSON.stringify([owner,f.formId,f.responseId])).digest('hex');
    await records.writeRecord('submission_deletions',receiptId,owner,{formId:f.formId,submissionId:f.responseId,deletedAt:'invalid'},0);let calls=0;
    await service.deliver(f.job.id,owner,async()=>{calls++;return accepted();});assert.equal(calls,0);assert.equal((await state(f)).state,'pending');assert.equal((await state(f)).lastStatus,503);console.log('PASS corrupt deletion receipts fail closed without claiming a definitive deletion');groups++;
  }
  {
    const f=await fixture();await service.deliver(f.job.id,owner,async()=>({status:400,body:'synthetic rejection'}));const original=records.readRecord;
    records.readRecord=async(kind,...args)=>{if(kind==='submission_deletions')throw new ServiceUnavailableError('Synthetic receipt read outage');return original(kind,...args);};
    try{await assert.rejects(()=>service.retryDelivery(f.formId,owner,f.job.id),error=>error.status===503);}finally{records.readRecord=original;}
    assert.equal((await state(f)).state,'failed');console.log('PASS manual retry does not requeue while deletion status is unavailable');groups++;
  }
  {
    const f=await fixture(),original=records.readRecord;let reads=0,calls=0;
    records.readRecord=async(kind,id,...args)=>{if(kind==='submissions'&&id===f.responseId&&++reads===2)await deleteSubmission(f.responseId,f.formId,owner);return original(kind,id,...args);};
    try{await service.deliver(f.job.id,owner,async()=>{calls++;return accepted();});}finally{records.readRecord=original;}
    assert.equal(calls,0);assert.equal((await state(f)).state,'skipped');console.log('PASS deletion after initial preflight is checked again at the transport boundary');groups++;
  }
  {
    const f=await fixture('gohighlevel',['synthetic-tag']),calls=[];
    await service.deliver(f.job.id,owner,async url=>{calls.push(url);await records.removeRecord('submissions',f.responseId,owner);return accepted({contact:{id:'remote-contact'}});});
    assert.equal(calls.length,1);assert.match(calls[0],/\/contacts\/upsert$/);assert.equal((await state(f)).state,'skipped');assert.equal((await state(f)).remoteContactId,'remote-contact');assert.match((await state(f)).lastMessage,/earlier|already|previous/i);console.log('PASS deletion after HighLevel upsert prevents subsequent tags without denying earlier acceptance');groups++;
  }
  for(const provider of ['twenty','brevo','hubspot','salesforce']){
    const f=await fixture(provider),calls=[];
    await service.deliver(f.job.id,owner,async(url,_body,_headers,method)=>{calls.push({url,method});await deleteSubmission(f.responseId,f.formId,owner);return provider==='twenty'?accepted({data:{people:[]}}):provider==='hubspot'?{status:404,body:'{}'}:{status:204,body:''};});
    assert.equal(calls.length,1);assert.equal((await state(f)).state,'skipped');console.log(`PASS ${provider} revalidates source before its second Nango operation`);groups++;
  }
  {
    const f=await fixture();await mutateSource(f,result=>({...result,answers:{q:'later answer'}}));let payload,headers;
    await service.deliver(f.job.id,owner,async(_url,body,sentHeaders)=>{payload=JSON.parse(body);headers=sentHeaders;return accepted();});
    assert.equal((await state(f)).state,'delivered');assert.equal(payload.answers.q,'original answer');assert.equal(headers['Idempotency-Key'],f.job.id);console.log('PASS retained source keeps the existing frozen event and idempotency contract');groups++;
  }
  {
    const f=await fixture('webhook',[],{consentOnly:false,marketingConsent:false});let calls=0;
    await service.deliver(f.job.id,owner,async(_url,body)=>{calls++;assert.equal(JSON.parse(body).contact.marketingConsent,false);return accepted();});
    assert.equal(calls,1);assert.equal((await state(f)).state,'delivered');console.log('PASS explicitly configured all-contact webhooks preserve declined-consent evidence');groups++;
  }
  {
    const f=await fixture();await records.removeRecord('submissions',f.responseId,owner);const id=await service.createTest(f.formId,owner,f.connectionId);let calls=0;await service.deliver(id,owner,async()=>{calls++;return accepted();});assert.equal(calls,1);assert.equal((await records.readRecord('deliveries',id)).payload.state,'delivered');console.log('PASS explicit synthetic connection tests need no respondent source');groups++;
  }
  console.log(`${groups} integration source lifecycle groups passed; temporary records and mocked destinations only.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(temporary,{recursive:true,force:true}));
