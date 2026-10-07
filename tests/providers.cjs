const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'heyquiz-providers-'));
process.env.HEYQUIZ_DATA_DIR=temp; process.env.SESSION_SECRET='provider-test-only-session-secret-32-chars'; process.env.NANGO_SECRET_KEY='test-only'; delete process.env.SUPABASE_URL; delete process.env.VERCEL;
const {nangoProviders,providers}=require('../lib/integrations/providers.ts'), n=require('../lib/integrations/nango.ts'),{sendProvider}=require('../lib/integrations/adapters.ts'),{IntegrationInput}=require('../lib/integrations/schema.ts'),r=require('../lib/records.ts'),s=require('../lib/integrations/service.ts');
const response=(status,body={})=>({status,body:JSON.stringify(body)});
const event={schemaVersion:1,event:'lead.captured',eventId:'e',responseId:'r',formId:'q',submittedAt:new Date().toISOString(),score:75,contact:{email:'Test+quiz@Example.com',name:'Jane Doe',marketingConsent:true,recordedAt:new Date().toISOString(),consentText:'Yes'},result:{title:'Growth'},answers:{},fields:{}};
const secret={providerKey:'provider-key',connectionId:'connection'};
let passed=0;
async function test(name,fn){await fn(); console.log('PASS '+name);passed++;}
(async()=>{try{
  for(const provider of nangoProviders){
    process.env[n.integrationEnv(provider)]=provider+'-config';
    await test(provider+' authorization binds provider, owner, quiz and nonce',async()=>{
      const form='q-'+provider; await r.writeRecord('forms',form,'owner',{id:form},0);
      let tags;
      const start=await n.startProvider(provider,form,'owner',async(url,body)=>{
        const b=JSON.parse(body);tags=b.tags;assert.deepEqual(b.allowed_integrations,[provider+'-config']);
        return response(201,{data:{connect_link:'https://connect.nango.dev/?session_token=synthetic',expires_at:new Date(Date.now()+1800000).toISOString()}});
      });
      const remote={connection_id:'connection',provider:providers[provider].nangoProvider,provider_config_key:provider+'-config',tags};
      assert.equal(await n.finishProvider(provider,form,'owner',start.attemptId,async()=>response(200,{connections:[{...remote,provider:'wrong'}]})),null);
      await assert.rejects(n.finishProvider(provider,form,'foreign',start.attemptId),/not found/);
      const other=provider==='hubspot'?'twenty':'hubspot';
      await assert.rejects(n.finishProvider(other,form,'owner',start.attemptId),/not found/);
      const row=await n.finishProvider(provider,form,'owner',start.attemptId,async()=>response(200,{connections:[remote]}));
      assert.equal(row.payload.provider,provider);assert.equal(row.payload.enabled,false);assert.equal(row.payload.consentOnly,true);
      assert.ok(!row.payload.secretBox.includes('connection'));
      assert.equal((await n.finishProvider(provider,form,'owner',start.attemptId,async()=>{throw Error('should not call')})).id,row.id);
      await assert.rejects(s.saveConnection(form,'owner',{provider,name:'Forged',audienceId:'audience'}),/Authorize/);
      const saved=await s.saveConnection(form,'owner',{...row.payload,revision:row.version,audienceId:'audience',enabled:true});
      const submission={id:'response-'+provider,formId:form,submittedAt:new Date().toISOString(),percentageScore:75,answers:{},contact:{...event.contact,marketingConsent:false,recordedAt:new Date(Date.now()+100).toISOString()}};
      await s.enqueueSubmission('owner',submission);
      const jobs=await s.deliveryHistory(form,'owner');assert.equal(jobs[0].state,'skipped');
      assert.equal(saved.enabled,true);
    });
    await test(provider+' rejects mapping identity and unsubscribe fields',async()=>{
      for(const target of ['email','status','unsubscribed','__proto__']) assert.equal(IntegrationInput.safeParse({provider,name:'Test',audienceId:'audience',mappings:[{source:'score',target}]}).success,false);
    });
  }
  const cases=[
    ['activecampaign','/3/contact/sync','POST',{contact:{id:'123'}},b=>{assert.equal(b.contact.email,'test+quiz@example.com');assert.equal(b.contact.lastName,'Doe');assert.ok(!('status' in b.contact));}],
    ['klaviyo','/api/profile-import','POST',{data:{id:'PROFILE123'}},b=>{assert.equal(b.data.attributes.email,'test+quiz@example.com');assert.ok(!('subscriptions' in b.data.attributes));}],
    ['mailchimp','/3.0/lists/audience/members/','PUT',{id:'abc123'},b=>{assert.equal(b.status_if_new,'transactional');assert.ok(!('status' in b));}],
    ['keap','/crm/rest/v1/contacts','PUT',{id:123},b=>{assert.equal(b.duplicate_option,'Email');assert.ok(!('opt_in_reason' in b));}],
    ['brevo','/contacts','POST',{id:123},b=>{assert.equal(b.updateEnabled,true);assert.ok(!('emailBlacklisted' in b));assert.ok(!('forceMerge' in b));}],
    ['zoho','/crm/v8/Contacts/upsert','POST',{data:[{status:'success',code:'SUCCESS',details:{id:'123'}}]},b=>{assert.deepEqual(b.duplicate_check_fields,['Email']);assert.deepEqual(b.trigger,[]);}],
    ['freshsales','/api/contacts/upsert','POST',{contact:{id:123}},b=>assert.deepEqual(b.unique_identifier,{emails:'test+quiz@example.com'})],
    ['salesforce','/services/data/v61.0/sobjects/Contact/HeyQuiz_Email__c/','PATCH',{id:'003abcdefghijk1234'},b=>{assert.equal(b.LastName,'Doe');assert.ok(!('HasOptedOutOfEmail' in b));}],
  ];
  for(const [provider,url,method,answer,check] of cases){
    await test(provider+' sends documented upsert and confirms ID',async()=>{
      const out=await sendProvider(provider,event,secret,{audienceId:'audience'},async(u,b,h,m)=>{
        assert.ok(u.includes('/proxy'+url));assert.equal(m,method);assert.equal(h.Authorization,'Bearer test-only');assert.equal(h['Connection-Id'],'connection');check(JSON.parse(b));
        if(provider==='klaviyo')assert.equal(h['Nango-Proxy-revision'],'2026-07-15');
        return response(201,answer);
      });assert.ok(JSON.parse(out.body).id);
    });
    await test(provider+' preserves rate limits and rejects malformed success',async()=>{
      let calls=0;const out=await sendProvider(provider,event,secret,{audienceId:'audience'},async()=>{calls++;return {status:429,body:'{}',retryAfter:'60'}});
      assert.equal(calls,1);assert.equal(out.retryAfter,'60');assert.equal(out.status,429);
      await assert.rejects(sendProvider(provider,event,secret,{audienceId:'audience'},async()=>response(200,{})));
    });
  }
  await test('Zoho HTTP success with record failure is not delivered',async()=>{
    await assert.rejects(sendProvider('zoho',event,secret,{},async()=>response(200,{data:[{code:'INVALID_DATA',status:'error'}]})),/Zoho rejected/);
  });
  await test('Brevo and Salesforce empty success verified with readback',async()=>{
    for(const provider of ['brevo','salesforce']){let calls=0;
      const out=await sendProvider(provider,event,secret,{},async(u,b,h,m)=>{calls++;if(calls===1)return {status:204,body:''};assert.equal(m,'GET');return response(200,provider==='brevo'?{id:123}:{Id:'003abc'});});
      assert.equal(calls,2);assert.ok(JSON.parse(out.body).id);
    }
  });
  const uuid='12345678-1234-5123-a123-123456789012';
  await test('Twenty updates exactly matched person and preserves email collections',async()=>{
    let calls=0;const out=await sendProvider('twenty',event,secret,{},async(u,b,h,m)=>{
      calls++;if(calls===1){assert.equal(m,'GET');assert.equal(new URL(u).searchParams.get('filter'),'emails.primaryEmail[eq]:test+quiz@example.com');return response(200,{data:{people:[{id:uuid,emails:{primaryEmail:'test+quiz@example.com'}}]}});}
      assert.equal(m,'PATCH');assert.ok(u.endsWith(uuid));assert.ok(!('emails' in JSON.parse(b)));return response(200,{data:{updatePerson:{id:uuid}}});
    });assert.equal(JSON.parse(out.body).id,uuid);
  });
  await test('Twenty retries use stable creation ID',async()=>{
    const ids=[];for(let attempt=0;attempt<2;attempt++)await sendProvider('twenty',event,secret,{},async(u,b,h,m)=>{
      if(m==='GET')return response(200,{data:{people:[]}});ids.push(JSON.parse(b).id);return response(201,{data:{createPerson:{id:JSON.parse(b).id}}});
    });assert.equal(ids[0],ids[1]);
  });
  await test('Twenty fails closed on duplicates, wrong matches and filter injection',async()=>{
    for(const people of [[{id:uuid,emails:{primaryEmail:'wrong@example.com'}}],[{id:uuid,emails:{primaryEmail:event.contact.email.toLowerCase()}},{id:uuid,emails:{primaryEmail:event.contact.email.toLowerCase()}}]]){
      let calls=0;await assert.rejects(sendProvider('twenty',event,secret,{},async()=>{calls++;return response(200,{data:{people}})}));assert.equal(calls,1);
    }
    await assert.rejects(sendProvider('twenty',{...event,contact:{...event.contact,email:'x),or(id[neq]:0)@example.com'}},secret,{},async()=>{throw Error('must not send')}),/email format/);
  });
  await test('Provider-specific mappings preserve numeric scores and reject identity overrides',async()=>{
    let payload;await sendProvider('freshsales',{...event,fields:{cf_heyquiz_score:75}},secret,{},async(u,b)=>{payload=JSON.parse(b);return response(200,{contact:{id:1}})});assert.equal(payload.contact.custom_field.cf_heyquiz_score,75);
    await assert.rejects(sendProvider('salesforce',{...event,fields:{HeyQuiz_Email__c:'evil'}},secret,{},async()=>{throw Error('must not send')}));
  });
  await test('Mailchimp requires audience and oversized payload is rejected',async()=>{
    await assert.rejects(sendProvider('mailchimp',event,secret,{},async()=>{throw Error('must not send')}),/audience/);
    await assert.rejects(sendProvider('klaviyo',{...event,fields:{heyquiz_answer:'x'.repeat(110000)}},secret,{},async()=>{throw Error('must not send')}),/100 KB/);
  });
  console.log(`${passed} provider checks passed.`);
}finally{fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
