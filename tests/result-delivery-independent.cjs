/* Independent literal acceptance for real result delivery. All records and HTTP are fake. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const { createHmac } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
Module._load = function (name, parent, main) { return originalLoad.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, main); };
Object.assign(process.env, {
  SESSION_SECRET: 'independent-result-delivery-test-secret-never-live-2026', HEYQUIZ_LOCAL_MODE: '0', HEYQUIZ_RESULT_EMAIL_MODE: 'resend',
  APP_URL: 'https://delivery.example.test', RESULT_EMAIL_FROM: 'Pippi QA <results@example.test>', RESEND_API_KEY: 're_TEST_ONLY_INDEPENDENT_NO_NETWORK',
  SUPABASE_URL: 'https://cloud.example.invalid', SUPABASE_PUBLISHABLE_KEY: 'TEST_ONLY_PUBLISHABLE', SUPABASE_ANON_KEY: '', SUPABASE_SECRET_KEY: 'TEST_ONLY_SECRET', SUPABASE_SERVICE_ROLE_KEY: '',
  VERCEL: '1', VERCEL_ENV: 'production', HEYQUIZ_RESULT_EMAIL_ORIGIN: '',
});
const records = require('../lib/records.ts'), memory = new Map();
let beforeWrite = async () => {};
records.readRecord = async (kind, id) => structuredClone(memory.get(`${kind}:${id}`) || null);
records.listRecords = async (kind, owner) => structuredClone([...memory.values()].filter(row => row.kind === kind && (!owner || row.owner_id === owner)));
records.writeRecord = async (kind, id, owner, payload, expected) => {
  await beforeWrite(kind, id, owner, payload, expected);
  const key = `${kind}:${id}`, old = memory.get(key);
  if (old && old.owner_id !== owner) throw new Error('Synthetic owner conflict');
  if (expected !== undefined && (old?.version || 0) !== expected) throw new records.ConflictError();
  const row = { kind, id, owner_id: owner, version: (old?.version || 0) + 1, payload: structuredClone(payload) };
  memory.set(key, row); return structuredClone(row);
};
records.removeRecord = async (kind, id, owner) => memory.get(`${kind}:${id}`)?.owner_id === owner && memory.delete(`${kind}:${id}`);
const originalFetch = global.fetch;
let providerHandler = async () => { throw new Error('Unexpected synthetic HTTP call'); };
let outboundCalls = 0;
global.fetch = async (url, options) => {
  outboundCalls++;
  assert.equal(new URL(String(url)).origin, 'https://api.resend.com', 'Only the fixed mocked provider origin is permitted');
  return providerHandler(String(url), options || {});
};
const { FormSchema } = require('../lib/schema.ts');
const { createAttempt } = require('../lib/attempts.ts');
const report = require('../lib/result-reports.ts');
const live = require('../lib/result-email-live.ts');
const service = require('../lib/result-email.ts');
const config = require('../lib/result-email-config.ts');
const transport = require('../lib/result-email-transport.ts');
const webhook = require('../lib/result-email-webhook.ts');
const owner = 'independent-delivery-owner';
let seq = 0, groups = 0;
const pass = label => { groups++; console.log('PASS ' + label); };
let providerSequence = 0;
const providerId = () => `11111111-2222-4333-8444-${String(++providerSequence).padStart(12,'0')}`;
async function fixture(extra = {}) {
  const id = `independent-delivery-${++seq}`;
  const form = FormSchema.parse({ id, title: 'Original <Quiz> & plan', mode: 'survey', publishedAt: new Date(Date.now() - 1000).toISOString(),
    theme: { brandName: 'Original Studio', primaryColor: '#922c3b' }, questions: [],
    resultEmailCopy: { version: 1, subject: '{brand_name}: requested result', introduction: 'You asked for {quiz_title}.\n\nYour next step is inside.', signOff: 'Regards,\n{brand_name}' }, ...extra.form });
  await records.writeRecord('forms', id, owner, form, 0);
  await records.writeRecord('published', id, owner, form, 0);
  const started = await createAttempt(form, owner, false);
  const responseId = JSON.parse(Buffer.from(started.token.split('.')[0], 'base64url')).id;
  const row = await records.readRecord('attempts', responseId);
  const result = { id: responseId, formId: id, submittedAt: new Date().toISOString(), totalPointsEarned: 0, totalPointsPossible: 0, percentageScore: 100,
    answers: { private: 'PRIVATE-RAW-ANSWER' }, contact: { email: 'separate-contact@example.test', marketingConsent: false }, grading: [] };
  await records.writeRecord('submissions', responseId, owner, result, 0);
  const attempt = await records.writeRecord('attempts', responseId, owner, { ...row.payload, completed: true, result, ...extra.attempt }, row.version);
  const f = { id, attempt, token: started.token, jobId: service.resultEmailJobId(owner, id, responseId) }; return f;
}
async function job(f) { return records.readRecord('result_email_jobs', f.jobId); }
async function queue(email = 'recipient@example.test') { const f = await fixture(); await live.requestLiveResultEmail(f.attempt, email, true); return f; }
const httpError = status => error => error?.status === status;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function privateFree(value) {
  const text = JSON.stringify(value);
  for (const fragment of ['recipient@example.test', 'separate-contact@example.test', 'PRIVATE-RAW-ANSWER', '/result/', 'recipientBox', 'payloadBox', 'copyBox', 're_TEST_ONLY']) assert.ok(!text.includes(fragment), 'Status must exclude private field: ' + fragment.replace(/@.*/, '@…'));
}
(async () => { try {
  const first = await fixture();
  await assert.rejects(() => live.requestLiveResultEmail(first.attempt, 'recipient@example.test', false), httpError(400));
  for (const email of ['one@example.test,two@example.test', 'one@example.test;two@example.test', 'one\r\nBcc:two@example.test', 'one\u0000@example.test', '"one,two"@example.test', '<one@example.test>', ['one@example.test','two@example.test']]) {
    await assert.rejects(() => live.requestLiveResultEmail(first.attempt, email, true), httpError(400));
  }
  assert.equal(await job(first), null); assert.equal(outboundCalls, 0);
  pass('explicit request and one unambiguous mailbox required before queue or provider');

  const preview = await fixture({ attempt: { preview: true } }), incomplete = await fixture({ attempt: { completed: false } });
  await assert.rejects(() => live.authorizeLiveResultEmail(preview.token, preview.id), httpError(409));
  await assert.rejects(() => live.authorizeLiveResultEmail(incomplete.token, incomplete.id), httpError(409));
  await assert.rejects(() => live.authorizeLiveResultEmail(first.token, 'different-quiz'), httpError(401));
  await assert.rejects(() => live.authorizeLiveResultEmail('invalid', first.id), httpError(401));
  pass('published completed-attempt authorization rejects preview/incomplete/wrong quiz/invalid token');

  await Promise.all([live.requestLiveResultEmail(first.attempt, 'Recipient@Example.Test ', true), live.requestLiveResultEmail(first.attempt, 'recipient@example.test', true)]);
  const frozenJob = await job(first);
  assert.equal(frozenJob.payload.version, 2); assert.equal(frozenJob.payload.mode, 'resend'); assert.equal(frozenJob.version, 1);
  await assert.rejects(() => live.requestLiveResultEmail(first.attempt, 'other@example.test', true), httpError(409));
  assert.equal((await records.readRecord('submissions', first.attempt.id)).payload.contact.marketingConsent, false);
  assert.equal((await records.readRecord('submissions', first.attempt.id)).payload.contact.email, 'separate-contact@example.test');
  for (const text of ['recipient@example.test','Original Studio','Original <Quiz>','PRIVATE-RAW-ANSWER','/result/']) assert.ok(!JSON.stringify(frozenJob).includes(text), 'Queued record must not expose private content');
  privateFree(await live.liveResultEmailStatus(first.attempt));
  pass('concurrent queue pins encrypted recipient/message without altering lead consent or exposing status');

  assert.equal(outboundCalls, 0, 'Pre-dispatch cases make no HTTP requests');
  const recorded = [];
  providerHandler = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    const headers = new Headers(options.headers); assert.equal(headers.get('idempotency-key'), `pippi-result-v2/${first.jobId}`);
    const payload = JSON.parse(options.body); recorded.push(payload); return Response.json({ id: providerId() });
  };
  const storedForm = await records.readRecord('forms', first.id);
  await records.writeRecord('forms', first.id, owner, { ...storedForm.payload, title: 'Edited current title', resultEmailCopy: { version:1,subject:'EDITED',introduction:'EDITED',signOff:'EDITED' }, theme:{...storedForm.payload.theme,brandName:'Edited studio'} }, storedForm.version);
  process.env.APP_URL = 'https://later.example.test'; process.env.RESULT_EMAIL_FROM = 'Later sender <later@example.test>';
  const countBefore = outboundCalls;
  await Promise.all([live.processLiveResultEmail(first.jobId, owner), live.processLiveResultEmail(first.jobId, owner)]);
  assert.equal(outboundCalls-countBefore,1); assert.equal((await job(first)).payload.state,'accepted');
  assert.equal(recorded.length,1); const message=recorded[0];
  assert.equal(message.from,'Pippi QA <results@example.test>'); assert.deepEqual(message.to,['recipient@example.test']);
  assert.equal(message.subject,'Original Studio: requested result');
  assert.ok(message.text.includes('You asked for Original <Quiz> & plan.'));
  assert.ok(message.text.includes('https://delivery.example.test/result/')); assert.ok(message.html.includes('Original &lt;Quiz&gt; &amp; plan'));
  assert.ok(message.text.includes('This request does not subscribe you to marketing emails.'));
  for(const excluded of ['LOCAL TEST','EDITED','Edited studio','later.example.test','PRIVATE-RAW-ANSWER','separate-contact@example.test']) assert.ok(!JSON.stringify(message).includes(excluded),'Frozen message must omit changed/private data');
  privateFree(await live.liveResultEmailStatus(first.attempt));
  await live.processLiveResultEmail(first.jobId,owner); assert.equal(outboundCalls-countBefore,1);
  await assert.rejects(()=>live.processLiveResultEmail(first.jobId,'other-owner'),httpError(404));
  process.env.APP_URL='https://delivery.example.test';process.env.RESULT_EMAIL_FROM='Pippi QA <results@example.test>';
  pass('concurrent claims send once using exact frozen recipient/copy/from/origin with truthful accepted status');

  const encrypted=(await job(first)).payload.payloadBox;
  assert.equal(config.openLiveResultEmail(encrypted,`${owner}:${first.jobId}:resend:v2`).subject,'Original Studio: requested result');
  for(const scope of [`other:${first.jobId}:resend:v2`,`${owner}:other:resend:v2`,`${owner}:${first.jobId}:resend:v1`,`${owner}:${first.jobId}:recipient`])assert.throws(()=>config.openLiveResultEmail(encrypted,scope));
  const changedKey=await queue();const credentialCalls=outboundCalls;process.env.RESEND_API_KEY='re_TEST_ONLY_REPLACEMENT_NO_NETWORK';
  const changedStatus=await live.processLiveResultEmail(changedKey.jobId,owner);assert.equal(changedStatus.state,'failed');assert.equal(changedStatus.canRetry,false);assert.equal(outboundCalls,credentialCalls);
  process.env.RESEND_API_KEY='re_TEST_ONLY_INDEPENDENT_NO_NETWORK';
  pass('encrypted payload is owner/job/purpose-bound and credential rotation cannot silently replay through another account');

  const retry=await queue(), requests=[]; let rejectOnce=true;
  providerHandler=async(url,options)=>{requests.push({key:new Headers(options.headers).get('idempotency-key'),body:options.body});return rejectOnce?Response.json({name:'rate_limit_exceeded'},{status:429,headers:{'retry-after':'4'}}):Response.json({id:providerId()});};
  assert.equal((await live.processLiveResultEmail(retry.jobId,owner)).state,'queued');const delayed=await job(retry);assert.ok(delayed.payload.nextAttemptAt>Date.now()+3000);
  const queuedCount=outboundCalls;await live.processLiveResultEmail(retry.jobId,owner);assert.equal(outboundCalls,queuedCount);
  await records.writeRecord('result_email_jobs',retry.jobId,owner,{...delayed.payload,nextAttemptAt:0},delayed.version);rejectOnce=false;
  assert.equal((await live.processLiveResultEmail(retry.jobId,owner)).state,'accepted');assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);
  pass('transient retry honors delay and repeats exactly the same idempotency key and provider payload');

  const crash=await queue(), receiptId=providerId();let dropAck=true;const crashBefore=outboundCalls;
  providerHandler=async()=>Response.json({id:receiptId});
  beforeWrite=async(kind,id,o,payload)=>{if(dropAck&&kind==='result_email_jobs'&&id===crash.jobId&&payload.state==='accepted'){dropAck=false;throw new Error('Synthetic acknowledgement failure');}};
  await live.processLiveResultEmail(crash.jobId,owner);beforeWrite=async()=>{};
  assert.equal((await records.readRecord('result_email_receipts',`receipt-${crash.jobId}`)).payload.providerId,receiptId);
  const crashed=await job(crash);await records.writeRecord('result_email_jobs',crash.jobId,owner,{...crashed.payload,state:'sending',leaseUntil:0,firstAttemptAt:Date.now()-24*3600000,attempts:3},crashed.version);
  assert.equal((await live.processLiveResultEmail(crash.jobId,owner)).state,'accepted');assert.equal(outboundCalls-crashBefore,1);
  pass('durable acceptance recovers acknowledgement failure even after final-attempt/window without another send');

  for(const response of [()=>Response.json({success:true}),()=>new Response('not json'),()=>new Response(JSON.stringify({id:providerId(),padding:'x'.repeat(66000)}))]){
    const unknown=await queue();providerHandler=async()=>response();const state=await live.processLiveResultEmail(unknown.jobId,owner);assert.equal(state.state,'queued');assert.equal((await job(unknown)).payload.uncertain,true);privateFree(state);
  }
  const permanent=await queue();providerHandler=async()=>Response.json({name:'validation_error',message:'PRIVATE PROVIDER MESSAGE'},{status:422});const rejected=await live.processLiveResultEmail(permanent.jobId,owner);assert.equal(rejected.state,'failed');assert.equal(rejected.canRetry,false);assert.ok(!JSON.stringify(rejected).includes('PRIVATE PROVIDER'));
  const mismatched=await queue();providerHandler=async()=>Response.json({name:'invalid_idempotent_request'},{status:409});assert.equal((await live.processLiveResultEmail(mismatched.jobId,owner)).state,'unknown');
  pass('malformed/oversized successes stay unconfirmed; permanent rejection and conflicting-key outcomes remain safe and private');

  const exhausted=await queue();providerHandler=async()=>Response.json({name:'server_error'},{status:503});
  for(let i=1;i<=3;i++){const row=await job(exhausted);await records.writeRecord('result_email_jobs',exhausted.jobId,owner,{...row.payload,nextAttemptAt:0},row.version);const state=await live.processLiveResultEmail(exhausted.jobId,owner);assert.equal(state.state,i<3?'queued':'unknown');}
  const exhaustedCount=outboundCalls;await live.processLiveResultEmail(exhausted.jobId,owner);assert.equal(outboundCalls,exhaustedCount);
  await assert.rejects(()=>live.retryLiveResultEmail(exhausted.attempt),httpError(409));
  const expired=await queue(),expiredRow=await job(expired);await records.writeRecord('result_email_jobs',expired.jobId,owner,{...expiredRow.payload,firstAttemptAt:Date.now()-23*3600000-1,attempts:1,uncertain:true},expiredRow.version);
  assert.equal((await live.processLiveResultEmail(expired.jobId,owner)).state,'unknown');assert.equal(outboundCalls,exhaustedCount);
  pass('three-attempt and23-hour limits end uncertain delivery without a fresh-key resend');

  const revoked=await queue();await records.writeRecord('result_report_link_revocations',report.resultLinkReceiptId(revoked.id,owner,revoked.attempt.id),owner,{formId:revoked.id,submissionId:revoked.attempt.id,revokedAt:Date.now()},0);
  const revocationCount=outboundCalls;assert.equal((await live.processLiveResultEmail(revoked.jobId,owner)).state,'cancelled');assert.equal(outboundCalls,revocationCount);
  const racing=await queue(),entered=deferred(),release=deferred();providerHandler=async()=>{entered.resolve();await release.promise;return Response.json({id:providerId()});};
  const sending=live.processLiveResultEmail(racing.jobId,owner);await entered.promise;
  await records.writeRecord('result_report_link_revocations',report.resultLinkReceiptId(racing.id,owner,racing.attempt.id),owner,{formId:racing.id,submissionId:racing.attempt.id,revokedAt:Date.now()},0);release.resolve();
  const acceptedAfterRevoke=await sending;assert.equal(acceptedAfterRevoke.state,'accepted');assert.ok(!acceptedAfterRevoke.message.includes('cancelled'));
  await assert.rejects(()=>report.issueResultReport(racing.attempt),httpError(410));
  pass('revocation before dispatch cancels; acceptance during later revocation stays truthful while link access is denied');

  const legacy=await fixture();await records.writeRecord('result_email_jobs',legacy.jobId,owner,{version:1,state:'prepared',formId:legacy.id,responseId:legacy.attempt.id},0);
  const legacyBefore=outboundCalls;await assert.rejects(()=>live.requestLiveResultEmail(legacy.attempt,'recipient@example.test',true),httpError(409));await assert.rejects(()=>live.processLiveResultEmail(legacy.jobId,owner),httpError(409));assert.equal(outboundCalls,legacyBefore);
  pass('old synthetic job cannot be converted to a real send by changing deployment mode');

  const confirmed=await queue(),confirmationId=providerId();providerHandler=async()=>Response.json({id:confirmationId});await live.processLiveResultEmail(confirmed.jobId,owner);
  const acceptedAt=Date.now();await live.recordLiveEmailReceipt(confirmed.jobId,owner,confirmationId,'delivered',acceptedAt);await live.recordLiveEmailReceipt(confirmed.jobId,owner,confirmationId,'sent',acceptedAt-1000);
  const delivered=await live.liveResultEmailStatus(confirmed.attempt);assert.equal(delivered.state,'delivered');assert.ok(delivered.message.includes('mail server'));assert.ok(delivered.message.includes('does not confirm that it was read'));privateFree(delivered);
  await assert.rejects(()=>live.recordLiveEmailReceipt(confirmed.jobId,'another-owner',confirmationId,'delivered'),httpError(404));await assert.rejects(()=>live.recordLiveEmailReceipt(confirmed.jobId,owner,providerId(),'delivered'),httpError(409));
  pass('confirmation state is monotone and exact owner/provider identity prevents relabeling another request');

  const poll = await queue(), pollId = providerId(); providerHandler = async () => Response.json({id:pollId});
  await live.processLiveResultEmail(poll.jobId,owner); const pollCalls = outboundCalls;
  providerHandler=async(url,options)=>{assert.equal(url,`https://api.resend.com/emails/${pollId}`);assert.equal(options.method,undefined);return Response.json({id:pollId,to:['wrong@example.test'],last_event:'delivered'});};
  const pollStates=await Promise.all([live.liveResultEmailStatus(poll.attempt,{refresh:true}),live.liveResultEmailStatus(poll.attempt,{refresh:true})]);
  assert.ok(pollStates.every(state=>state.state==='accepted'));assert.equal(outboundCalls-pollCalls,1);
  await live.liveResultEmailStatus(poll.attempt,{refresh:true});assert.equal(outboundCalls-pollCalls,1);
  const pollReceipt=await records.readRecord('result_email_receipts',`receipt-${poll.jobId}`);
  await records.writeRecord('result_email_receipts',pollReceipt.id,owner,{...pollReceipt.payload,lastCheckedAt:0},pollReceipt.version);
  providerHandler=async()=>Response.json({id:pollId,to:['recipient@example.test'],last_event:'delivered'});
  assert.equal((await live.liveResultEmailStatus(poll.attempt,{refresh:true})).state,'delivered');assert.equal(outboundCalls-pollCalls,2);
  await live.liveResultEmailStatus(poll.attempt,{refresh:true});assert.equal(outboundCalls-pollCalls,2);
  for(const invalid of [{id:providerId(),to:['recipient@example.test'],last_event:'delivered'},{id:pollId,to:['recipient@example.test','other@example.test'],last_event:'delivered'},{id:pollId,to:['recipient@example.test'],last_event:'opened'},null]){
    providerHandler=async()=>Response.json(invalid);assert.equal(await transport.retrieveResendResultEmail(pollId,'recipient@example.test'),null);
  }
  const noGet=outboundCalls;assert.equal(await transport.retrieveResendResultEmail('../emails','recipient@example.test'),null);assert.equal(outboundCalls,noGet);
  pass('status refresh makes one throttled GET, verifies exact message/recipient and cannot invent delivery from unknown events');

  const signatureKey=Buffer.from('independent-webhook-test-key-2026-only');process.env.RESEND_WEBHOOK_SECRET='whsec_'+signatureKey.toString('base64');
  const signedNow=Date.now(), signedTimestamp=String(Math.floor(signedNow/1000));
  const sign=(raw,id='evt_independent',timestamp=signedTimestamp,key=signatureKey)=>new Headers({'svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+createHmac('sha256',key).update(`${id}.${timestamp}.${raw}`).digest('base64')});
  const callback=await queue(), callbackId=providerId();providerHandler=async()=>Response.json({id:callbackId});await live.processLiveResultEmail(callback.jobId,owner);
  const event={type:'email.delivered',created_at:new Date(signedNow).toISOString(),data:{email_id:callbackId,to:['recipient@example.test'],tags:{pippi_job:callback.jobId},subject:'PRIVATE WEBHOOK COPY',text:'PRIVATE RAW CALLBACK'}};
  const raw=JSON.stringify(event), validHeaders=sign(raw);
  assert.deepEqual(webhook.verifyResultEmailWebhook(raw,validHeaders,signedNow),event);
  for(const [body,headers,now]of [[raw+' ',validHeaders,signedNow],[raw,sign(raw,'evt_other'),signedNow+300001],[raw,sign(raw,'evt_independent',signedTimestamp,Buffer.from('other-independent-secret-key-2026')),signedNow],[raw,new Headers({...Object.fromEntries(validHeaders),'svix-signature':'v2,invalid'}),signedNow]])assert.throws(()=>webhook.verifyResultEmailWebhook(body,headers,now),httpError(400));
  const multiSignature=sign(raw);multiSignature.set('svix-signature','v1,AAAA '+validHeaders.get('svix-signature'));assert.deepEqual(webhook.verifyResultEmailWebhook(raw,multiSignature,signedNow),event);
  assert.throws(()=>webhook.verifyResultEmailWebhook('{',sign('{'),signedNow),httpError(400));
  const savedWebhookSecret=process.env.RESEND_WEBHOOK_SECRET;delete process.env.RESEND_WEBHOOK_SECRET;assert.throws(()=>webhook.verifyResultEmailWebhook(raw,validHeaders,signedNow),httpError(503));process.env.RESEND_WEBHOOK_SECRET=savedWebhookSecret;
  const eventCalls=outboundCalls;assert.deepEqual(await live.applyLiveResultEmailEvent(webhook.verifyResultEmailWebhook(raw,validHeaders,signedNow)),{matched:true});
  const deliveredReceipt=await records.readRecord('result_email_receipts',`receipt-${callback.jobId}`);await live.applyLiveResultEmailEvent(event);
  assert.deepEqual(await records.readRecord('result_email_receipts',deliveredReceipt.id),deliveredReceipt,'Duplicate event must not rewrite receipt');
  await live.applyLiveResultEmailEvent({...event,type:'email.sent',created_at:new Date(signedNow-1000).toISOString()});
  assert.equal((await live.liveResultEmailStatus(callback.attempt)).state,'delivered');assert.equal(outboundCalls,eventCalls);
  const receiptText=JSON.stringify(await records.readRecord('result_email_receipts',deliveredReceipt.id));for(const privateText of ['recipient@example.test','PRIVATE WEBHOOK COPY','PRIVATE RAW CALLBACK','subject','tags'])assert.ok(!receiptText.includes(privateText));
  pass('raw-body HMAC, timestamp and signature version checks reject forgery; duplicate/stale signed callbacks retain minimal monotone receipts');

  for(const badData of [{...event.data,email_id:providerId()},{...event.data,to:['wrong@example.test']},{...event.data,to:['recipient@example.test','other@example.test']}])await assert.rejects(()=>live.applyLiveResultEmailEvent({...event,data:badData}),error=>[400,409].includes(error?.status));
  await assert.rejects(()=>live.applyLiveResultEmailEvent({...event,created_at:new Date(signedNow-600000).toISOString()}),httpError(400));
  await assert.rejects(()=>live.applyLiveResultEmailEvent({...event,created_at:new Date(Date.now()+600000).toISOString()}),httpError(400));
  await assert.rejects(()=>live.applyLiveResultEmailEvent({}),httpError(400));
  assert.deepEqual(await live.applyLiveResultEmailEvent({...event,type:'email.opened'}),{matched:false});
  assert.deepEqual(await live.applyLiveResultEmailEvent({...event,data:{...event.data,tags:{pippi_job:'mail-'+'f'.repeat(48)}}}),{matched:false});
  const notSent=await queue();assert.deepEqual(await live.applyLiveResultEmailEvent({...event,data:{...event.data,tags:{pippi_job:notSent.jobId}}}),{matched:false});
  await records.writeRecord('result_report_link_revocations',report.resultLinkReceiptId(callback.id,owner,callback.attempt.id),owner,{formId:callback.id,submissionId:callback.attempt.id,revokedAt:Date.now()},0);
  assert.deepEqual(await live.applyLiveResultEmailEvent({...event,type:'email.bounced'}),{matched:true});assert.equal((await live.liveResultEmailStatus(callback.attempt)).state,'bounced');await assert.rejects(()=>report.issueResultReport(callback.attempt),httpError(410));
  pass('callbacks bind exact job/provider/recipient and cannot resurrect revoked reports or unsent requests');

  function requestStream(chunks,headers={}){let cancelled=false,index=0;return{request:new Request('https://delivery.example.test/api/result-email/webhook',{method:'POST',headers,duplex:'half',body:new ReadableStream({pull(controller){if(index<chunks.length)controller.enqueue(chunks[index++]);else controller.close();},cancel(){cancelled=true;}})}),cancelled:()=>cancelled};}
  const encoder=new TextEncoder(), multibyte=encoder.encode('{"value":"雪"}');
  const split=requestStream([multibyte.subarray(0,11),multibyte.subarray(11,12),multibyte.subarray(12)]);assert.equal(await webhook.readResultEmailWebhook(split.request),'{"value":"雪"}');
  const oversize=requestStream([new Uint8Array(40000),new Uint8Array(30000),new Uint8Array(2)]);await assert.rejects(()=>webhook.readResultEmailWebhook(oversize.request),httpError(413));assert.equal(oversize.cancelled(),true);
  const badLength=requestStream([encoder.encode('{}')],{'content-length':'65537'});await assert.rejects(()=>webhook.readResultEmailWebhook(badLength.request),httpError(413));
  const invalidUtf8=requestStream([new Uint8Array([0xc3,0x28])]);await assert.rejects(()=>webhook.readResultEmailWebhook(invalidUtf8.request),httpError(400));
  const byteBound=requestStream([encoder.encode('雪'.repeat(21846))]);await assert.rejects(()=>webhook.readResultEmailWebhook(byteBound.request),httpError(413));
  pass('webhook raw-body reader counts bytes, preserves split UTF-8 and cancels over-limit streams before parsing');

  const noDispatch=outboundCalls;
  await assert.rejects(()=>transport.sendResendResultEmail({idempotencyKey:'synthetic-key',payload:message,validateAcceptance:async()=>{throw new Error('Synthetic acceptance denied');}}),/Synthetic acceptance denied/);assert.equal(outboundCalls,noDispatch);
  let cancelledResponse=false;providerHandler=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(66000));},cancel(){cancelledResponse=true;}}));
  await assert.rejects(()=>transport.sendResendResultEmail({idempotencyKey:'synthetic-key',payload:message,validateAcceptance:async()=>{}}),error=>error instanceof transport.ResendResultTransportError&&error.ambiguous&&error.status===502);assert.equal(cancelledResponse,true);
  providerHandler=async()=>{throw new Error('PRIVATE NETWORK CONTENT');};await assert.rejects(()=>transport.sendResendResultEmail({idempotencyKey:'synthetic-key',payload:message,validateAcceptance:async()=>{}}),error=>error instanceof transport.ResendResultTransportError&&error.status===408&&error.ambiguous&&!error.message.includes('PRIVATE'));
  pass('transport validates lifecycle before HTTP, cancels oversized responses and returns sanitized uncertain network errors');

  for(const [key,value]of [['HEYQUIZ_RESULT_EMAIL_MODE','synthetic'],['HEYQUIZ_LOCAL_MODE','1'],['SUPABASE_SECRET_KEY',''],['SESSION_SECRET','short'],['RESEND_API_KEY',''],['VERCEL_ENV','preview'],['APP_URL','http://delivery.example.test'],['APP_URL','https://delivery.example.test/private'],['APP_URL','https://delivery.example.test?token=secret'],['RESULT_EMAIL_FROM','Pippi <one@example.test>, <two@example.test>']]){
    const before=process.env[key];process.env[key]=value;assert.throws(()=>config.liveResultEmailSettings(),httpError(503));process.env[key]=before;
  }
  const finalPrivate=await live.listLiveResultEmails(owner,first.id);privateFree(finalPrivate);await assert.rejects(()=>live.listLiveResultEmails('other-owner',first.id),httpError(404));
  pass('configuration cannot enable live transport in preview/local/invalid-origin modes and owner history remains private');

  const receiptOutage=await queue(), durableProviderId=providerId(), recoveredRequests=[];
  providerHandler=async(url,options)=>{recoveredRequests.push({key:new Headers(options.headers).get('idempotency-key'),body:options.body});return Response.json({id:durableProviderId});};
  beforeWrite=async(kind,id)=>{if(kind==='result_email_receipts'&&id===`receipt-${receiptOutage.jobId}`)throw new Error('Synthetic receipt store unavailable');};
  await assert.rejects(()=>live.processLiveResultEmail(receiptOutage.jobId,owner),error=>error?.status===503&&!error.message.includes('Synthetic'));
  beforeWrite=async()=>{};const waiting=await job(receiptOutage);assert.equal(waiting.payload.state,'sending');assert.equal(waiting.payload.uncertain,true);assert.equal(await records.readRecord('result_email_receipts',`receipt-${receiptOutage.jobId}`),null);
  const waitingCalls=outboundCalls;await live.processLiveResultEmail(receiptOutage.jobId,owner);assert.equal(outboundCalls,waitingCalls);
  await records.writeRecord('result_email_jobs',receiptOutage.jobId,owner,{...waiting.payload,leaseUntil:0},waiting.version);
  const recovered=await live.processLiveResultEmail(receiptOutage.jobId,owner);assert.equal(recovered.state,'accepted');assert.equal(recoveredRequests.length,2);assert.deepEqual(recoveredRequests[0],recoveredRequests[1]);assert.equal((await records.readRecord('result_email_receipts',`receipt-${receiptOutage.jobId}`)).payload.providerId,durableProviderId);
  pass('provider acceptance during receipt-store outage retains lease and recovers through identical provider key/payload');

  console.log(`${groups} independent result-delivery groups passed; in-memory records and guarded fake HTTP only.`);
} finally { Module._load = originalLoad; global.fetch = originalFetch; beforeWrite = async () => {}; } })().catch(error => { console.error(error?.name || 'Error', error?.code || '', error?.status || '', error?.message || 'Independent result-delivery failure'); process.exitCode = 1; });
