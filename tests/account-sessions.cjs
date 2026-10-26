// Real encrypted session records, mocked provider, and a temporary filesystem only.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), Module = require('node:module'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, file);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pippi-account-sessions-')), jar = new Map();
const load = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'next/headers') return {cookies: async () => ({get:name=>jar.get(name),set:(name,value,options)=>jar.set(name,{value,options}),delete:name=>jar.delete(name)})};
  if (name === 'next/navigation') return {redirect:()=>{throw Error('Synthetic redirect');}};
  return load.call(this, name.startsWith('@/') ? path.resolve(__dirname,'..',name.slice(2)) : name,parent,main);
};
for (const name of ['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY','HEYQUIZ_LOCAL_MODE','VERCEL','VERCEL_ENV']) delete process.env[name];
process.env.HEYQUIZ_DATA_DIR = root;
process.env.SESSION_SECRET = 'isolated-session-signing-secret-for-synthetic-tests';
process.env.SUPABASE_URL = 'https://synthetic-auth.example.test';
process.env.SUPABASE_ANON_KEY = 'synthetic-public-key';
const originalNow = Date.now, originalFetch = global.fetch;
let now = originalNow(), sequence = 0, refreshCalls = 0, providerFailure = '', refreshGate, refreshStarted;
Date.now = () => now;
const accesses = new Map(), refreshes = new Map();
function tokenPair(owner='owner-a', lifetime=3600) {
  const n=++sequence, pair={access_token:`synthetic-access-${n}`,refresh_token:`synthetic-refresh-${n}`,expires_in:lifetime,user:{id:owner}};
  accesses.set(pair.access_token,{owner,expiresAt:now+lifetime*1000});refreshes.set(pair.refresh_token,{owner,pair:null});return pair;
}
global.fetch = async (url,init={}) => {
  assert.ok(String(url).startsWith(process.env.SUPABASE_URL+'/auth/v1/'),'No real provider or database requests allowed');
  const endpoint=String(url).split('/auth/v1/')[1];
  if(endpoint==='user') {
    if(providerFailure==='user')return Response.json({code:'unexpected_failure'},{status:503});
    const auth=init.headers?.Authorization?.slice(7), access=accesses.get(auth);
    return access&&access.expiresAt>now ? Response.json({id:access.owner}) : Response.json({code:'bad_jwt'},{status:401});
  }
  if(endpoint==='token?grant_type=refresh_token') {
    refreshCalls++;if(refreshStarted)refreshStarted();if(refreshGate)await refreshGate;
    if(providerFailure==='refresh')return Response.json({code:'unexpected_failure'},{status:503});
    if(providerFailure==='unknown-4xx')return Response.json({code:'unexpected_configuration'},{status:400});
    const token=JSON.parse(init.body).refresh_token, previous=refreshes.get(token);
    if(!previous)return Response.json({code:'refresh_token_not_found'},{status:400});
    const pair=previous.pair||tokenPair(previous.owner);previous.pair=pair;
    if(providerFailure==='lost-refresh'){providerFailure='';throw Error('Synthetic response lost after rotation');}
    return Response.json(pair);
  }
  if(endpoint==='logout?scope=local')return new Response(null,{status:204});
  throw Error('Unmocked provider request');
};
const session=require('../lib/account-session.ts'), {readRecord,writeRecord}=require('../lib/records.ts'), {ServiceUnavailableError}=require('../lib/errors.ts');
const cookie=()=>jar.get(session.ACCOUNT_SESSION_COOKIE), id=()=>crypto.createHash('sha256').update(cookie().value).digest('hex');
const record=()=>readRecord('account_sessions',id());
let groups=0;
const check=async(name,fn)=>{await fn();groups++;console.log('PASS',name);};
async function fresh(owner='owner-a',lifetime=3600){jar.clear();providerFailure='';refreshGate=undefined;refreshStarted=undefined;const pair=tokenPair(owner,lifetime);await session.createAccountSession(pair);return pair;}
(async()=>{
  await check('opaque secure cookie and owner-bound encrypted durable record',async()=>{
    const pair=await fresh();assert.match(cookie().value,/^[A-Za-z0-9_-]{43}$/);assert.equal(cookie().options.httpOnly,true);assert.equal(cookie().options.secure,true);assert.equal(cookie().options.sameSite,'lax');assert.equal(cookie().options.domain,undefined);assert.equal(cookie().options.maxAge,30*86400);
    const row=await record(), bytes=JSON.stringify(row);assert.equal(row.owner_id,'owner-a');assert.ok(!bytes.includes(pair.access_token)&&!bytes.includes(pair.refresh_token)&&!bytes.includes(cookie().value));
    const user=await session.resolveAccountSession();assert.equal(user.id,'owner-a');assert.equal(user.accountKey,session.accountKeyForUser('owner-a'));assert.ok(!JSON.stringify(user).includes(pair.access_token));
  });
  await check('new login requires renewable provider credentials and validates identity',async()=>{
    const pair=tokenPair();await assert.rejects(()=>session.createAccountSession({...pair,refresh_token:undefined}),e=>e.status===502);
    await assert.rejects(()=>session.createAccountSession({...pair,user:{id:'other-owner'}}),e=>e.status===502);
  });
  await check('idle beyond access expiry renews without changing cookie or touching 30-day activity',async()=>{
    await fresh();const handle=cookie().value,old=await record(),before=refreshCalls;now+=3600001;
    assert.equal((await session.resolveAccountSession()).id,'owner-a');assert.equal(refreshCalls,before+1);assert.equal(cookie().value,handle);assert.equal((await record()).payload.expiresAt,old.payload.expiresAt);
  });
  await check('foreground activity rolls 30 days no more than every five minutes',async()=>{
    await fresh();const old=await record();now+=299999;await session.resolveAccountSession({touch:true});assert.equal((await record()).payload.expiresAt,old.payload.expiresAt);
    now+=2;await session.resolveAccountSession({touch:true});assert.equal((await record()).payload.expiresAt,now+session.ACCOUNT_SESSION_LIFETIME);
    now+=1000;await session.resolveAccountSession();assert.equal((await record()).payload.lastActivityAt,now-1000);
  });
  await check('thirty-day inactive sessions require reauthentication without provider refresh',async()=>{
    await fresh();const before=refreshCalls;now+=session.ACCOUNT_SESSION_LIFETIME+1;assert.equal(await session.resolveAccountSession({touch:true}),null);assert.equal(refreshCalls,before);
  });
  await check('parallel refresh claims perform one provider rotation',async()=>{
    await fresh();now+=3600001;const before=refreshCalls;const values=await Promise.all(Array.from({length:8},()=>session.resolveAccountSession()));assert.ok(values.every(v=>v?.id==='owner-a'));assert.equal(refreshCalls,before+1);assert.equal((await record()).payload.lease,undefined);
  });
  await check('transient refresh and unknown 4xx preserve credentials and can recover',async()=>{
    await fresh();now+=3600001;const previous=(await record()).payload.credentialBox;
    for(const failure of ['refresh','unknown-4xx']){providerFailure=failure;await assert.rejects(()=>session.resolveAccountSession(),e=>e instanceof ServiceUnavailableError);const row=await record();assert.equal(row.payload.revokedAt,undefined);assert.equal(row.payload.credentialBox,previous);}
    providerFailure='';assert.equal((await session.resolveAccountSession()).id,'owner-a');
  });
  await check('authentication-provider outage does not report sign-out',async()=>{
    await fresh();providerFailure='user';await assert.rejects(()=>session.resolveAccountSession(),e=>e.status===503);assert.equal((await record()).payload.revokedAt,undefined);providerFailure='';assert.ok(await session.resolveAccountSession());
  });
  await check('lost refresh response recovers using provider parent-token receipt',async()=>{
    await fresh();now+=3600001;providerFailure='lost-refresh';await assert.rejects(()=>session.resolveAccountSession(),e=>e.status===503);assert.equal((await session.resolveAccountSession()).id,'owner-a');
  });
  await check('rotation persistence outage retains old credentials and ambiguous commit is reconciled',async()=>{
    const records=require('../lib/records.ts'),originalWrite=records.writeRecord;
    for(const committed of [false,true]){
      await fresh();now+=3600001;let fail=true;
      records.writeRecord=async(...args)=>{
        if(fail&&args[0]==='account_sessions'&&args[3].credentialBox&&!args[3].lease){fail=false;if(committed)await originalWrite(...args);throw new ServiceUnavailableError('Synthetic persistence unavailable');}
        return originalWrite(...args);
      };
      try {
        if(committed)assert.equal((await session.resolveAccountSession()).id,'owner-a');
        else {await assert.rejects(()=>session.resolveAccountSession(),e=>e.status===503);assert.equal((await session.resolveAccountSession()).id,'owner-a');}
        assert.equal((await record()).payload.revokedAt,undefined);
      }finally{records.writeRecord=originalWrite;}
    }
  });
  await check('provider user identity cannot change a stored session owner',async()=>{
    const pair=await fresh();accesses.get(pair.access_token).owner='owner-b';assert.equal(await session.resolveAccountSession(),null);assert.ok((await record()).payload.revokedAt);
  });
  await check('revoked provider refresh token creates authoritative tombstone',async()=>{
    const pair=await fresh();refreshes.delete(pair.refresh_token);now+=3600001;assert.equal(await session.resolveAccountSession(),null);assert.ok((await record()).payload.revokedAt);assert.equal((await record()).payload.credentialBox,undefined);
  });
  await check('logout during refresh cannot resurrect a session',async()=>{
    await fresh();now+=3600001;let release,announce;refreshGate=new Promise(r=>release=r);const started=new Promise(r=>announce=r);refreshStarted=announce;const recordKey=id(),pending=session.resolveAccountSession();await started;await session.revokeAccountSession();release();assert.equal(await pending,null);assert.ok((await readRecord('account_sessions',recordKey)).payload.revokedAt);assert.equal(cookie(),undefined);refreshGate=undefined;refreshStarted=undefined;
  });
  await check('expired worker lease is reclaimable and credentials remain encrypted',async()=>{
    await fresh();now+=3600001;const row=await record();await writeRecord('account_sessions',row.id,row.owner_id,{...row.payload,lease:{claim:'abandoned',until:now-1}},row.version);assert.ok(await session.resolveAccountSession());assert.equal((await record()).payload.lease,undefined);
  });
  await check('credential corruption is a server fault and never treated as unauthenticated',async()=>{
    await fresh();const row=await record();await writeRecord('account_sessions',row.id,row.owner_id,{...row.payload,credentialBox:'invalid'},row.version);await assert.rejects(()=>session.resolveAccountSession(),/could not be opened/);assert.equal((await record()).payload.revokedAt,undefined);await session.revokeAccountSession();assert.equal(cookie(),undefined);
  });
  await check('held refresh lease returns retryable 503 within two-second contention window',async()=>{
    await fresh();now+=3600001;const row=await record();await writeRecord('account_sessions',row.id,row.owner_id,{...row.payload,lease:{claim:'other-worker',until:now+60000}},row.version);
    const starting=originalNow(),time=now;Date.now=()=>time+(originalNow()-starting);
    await assert.rejects(()=>session.resolveAccountSession(),e=>e.status===503&&e.retryAfterSeconds===2);assert.ok(originalNow()-starting<3000);Date.now=()=>now;
  });
  await check('session endpoint returns metadata only and distinguishes outages from invalid sessions',async()=>{
    const {POST}=require('../app/api/auth/session/route.ts');const req=origin=>new Request('https://quiz.example.test/api/auth/session',{method:'POST',headers:{origin:origin||'https://quiz.example.test','x-forwarded-for':'192.0.2.80'}});
    await fresh();let response=await POST(req());let body=await response.json();assert.equal(response.status,200);assert.equal(body.state,'authenticated');assert.equal(body.accountKey,session.accountKeyForUser('owner-a'));assert.deepEqual(Object.keys(body).sort(),['accountKey','expiresAt','state']);assert.equal(response.headers.get('cache-control'),'private, no-store');
    providerFailure='user';response=await POST(req());body=await response.json();assert.equal(response.status,503);assert.equal(body.state,'unavailable');assert.equal(response.headers.get('retry-after'),'2');providerFailure='';
    response=await POST(req('https://untrusted.example'));assert.equal(response.status,403);
    await session.revokeAccountSession();response=await POST(req());assert.equal(response.status,401);assert.equal((await response.json()).state,'reauth_required');
  });
  console.log(`${groups} account-session groups passed; isolated records, mocked provider, no external requests.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Date.now=originalNow;global.fetch=originalFetch;fs.rmSync(root,{recursive:true,force:true});});
