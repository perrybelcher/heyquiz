// Profile APIs, renewable-session integration and provider changes use fixtures only.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pippi-profile-')),jar=new Map();
for(const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','HEYQUIZ_LOCAL_MODE','VERCEL','VERCEL_ENV'])delete process.env[name];
process.env.HEYQUIZ_DATA_DIR=directory;process.env.SESSION_SECRET='synthetic-profile-session-secret-32-characters';process.env.SUPABASE_URL='https://profile-provider.example.test';process.env.SUPABASE_ANON_KEY='synthetic-public-key';
const originalLoad=Module._load;
Module._load=function(name,parent,main){
  if(name==='next/headers')return{cookies:async()=>({get:name=>jar.get(name),set:(name,value,options)=>jar.set(name,{value,options}),delete:name=>jar.delete(name)})};
  if(name==='next/navigation')return{redirect:()=>{throw Error('Unexpected synthetic redirect');}};
  return originalLoad.call(this,name.startsWith('@/')?path.join(process.cwd(),name.slice(2)):name,parent,main);
};
const people=new Map([['owner-a',{id:'owner-a',email:'owner@example.test',password:'current-password-2026',email_confirmed_at:new Date().toISOString(),user_metadata:{name:'Ignored provider metadata',role:'admin'}}],['owner-b',{id:'owner-b',email:'other@example.test',password:'other-password-2026',email_confirmed_at:new Date().toISOString()}]]),tokens=new Map();
let serial=0,providerFailure='',grantCalls=0,updateCalls=0,lastUpdate,gateFresh=false,releaseGate,announceGate,exchangePair,expectedVerifier;
const publicUser=owner=>{const {password,...data}=people.get(owner);void password;return{...data};};
function pair(owner){const n=++serial,value={access_token:`synthetic-access-${n}`,refresh_token:`synthetic-refresh-${n}`,expires_in:3600,user:publicUser(owner)};tokens.set(value.access_token,{owner,valid:true});return value;}
global.fetch=async(url,init={})=>{
  assert.ok(String(url).startsWith(process.env.SUPABASE_URL+'/auth/v1/'),'Only synthetic provider requests are allowed');
  const target=new URL(url),endpoint=target.pathname.slice('/auth/v1/'.length),token=String(init.headers?.Authorization||'').replace(/^Bearer /,''),authenticated=tokens.get(token);
  if(providerFailure==='outage')return Response.json({code:'unexpected_failure'},{status:503});
  if(endpoint==='user'&&(init.method||'GET')==='GET'){
    if(!authenticated?.valid)return Response.json({code:'bad_jwt'},{status:401});
    if(gateFresh&&token===gateFresh){announceGate?.();await new Promise(resolve=>releaseGate=resolve);}
    return Response.json(publicUser(authenticated.owner));
  }
  if(endpoint==='token'&&target.searchParams.get('grant_type')==='password'){
    grantCalls++;const input=JSON.parse(init.body),person=[...people.values()].find(person=>person.email===input.email&&person.password===input.password);
    if(!person)return Response.json({code:'invalid_credentials'},{status:400});
    const result=pair(person.id);if(gateFresh===true)gateFresh=result.access_token;return Response.json(result);
  }
  if(endpoint==='token'&&target.searchParams.get('grant_type')==='pkce'){
    const input=JSON.parse(init.body);assert.equal(input.code_verifier,expectedVerifier);assert.ok(exchangePair);return Response.json(exchangePair);
  }
  if(endpoint==='user'&&init.method==='PUT'){
    updateCalls++;if(!authenticated?.valid)return Response.json({code:'bad_jwt'},{status:401});
    const input=JSON.parse(init.body),person=people.get(authenticated.owner);lastUpdate={...input,redirect:target.searchParams.get('redirect_to')};
    if(providerFailure==='smtp')return Response.json({code:'email_address_not_authorized'},{status:400});
    if(providerFailure==='weak')return Response.json({code:'weak_password'},{status:422});
    if(providerFailure==='rate')return Response.json({code:'over_request_rate_limit'},{status:429,headers:{'Retry-After':'30'}});
    if(input.password){if(input.current_password!==person.password)return Response.json({code:'invalid_credentials'},{status:400});person.password=input.password;for(const [other,state]of tokens)if(state.owner===person.id&&other!==token)state.valid=false;}
    if(input.email)person.new_email=input.email;
    return Response.json(publicUser(person.id));
  }
  if(endpoint==='logout'){return new Response(null,{status:204});}
  throw Error('Unmocked synthetic provider operation');
};
const records=require('../lib/records.ts'),session=require('../lib/account-session.ts'),auth=require('../lib/auth.ts'),profile=require('../lib/profile.ts'),accountAuth=require('../lib/account-auth.ts');
const routes={profile:require('../app/api/profile/route.ts'),email:require('../app/api/profile/email/route.ts'),password:require('../app/api/profile/password/route.ts')};
const accountRoutes=require('../app/api/auth/account/route.ts');
let groups=0,ip=0,requestOwner='owner-a';
async function login(owner='owner-a'){jar.clear();providerFailure='';gateFresh=false;requestOwner=owner;await session.createAccountSession(pair(owner));}
function request(which,body,origin='https://quiz.example.test',method='POST'){
  return new Request('https://quiz.example.test/api/profile'+(which==='profile'?'':'/'+which),{method,headers:{Origin:origin,'Content-Type':'application/json','x-pippi-account':session.accountKeyForUser(requestOwner),'x-forwarded-for':`192.0.2.${++ip}`},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function invoke(which,body,method='POST',origin){const response=await routes[which][method](request(which,body,origin,method));return{status:response.status,body:await response.json(),headers:response.headers};}
async function exchange(data){exchangePair=data;const flow=await accountAuth.emailFlow();expectedVerifier=flow.verifier;const response=await accountRoutes.POST(new Request('https://quiz.example.test/api/auth/account',{method:'POST',headers:{Origin:'https://quiz.example.test','Content-Type':'application/json','x-forwarded-for':`192.0.2.${++ip}`},body:JSON.stringify({action:'exchange',code:'synthetic-confirmation-code'})}));return{status:response.status,body:await response.json()};}
async function group(name,fn){await fn();groups++;console.log('PASS',name);}
const profileId=owner=>crypto.createHash('sha256').update(owner).digest('hex');
(async()=>{
  await group('authenticated profile DTO is minimal, authoritative and private',async()=>{
    await login();const response=await routes.profile.GET(),body=await response.json();assert.equal(response.status,200);assert.deepEqual(body,{name:'',company:'',email:'owner@example.test',revision:0});assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(!JSON.stringify(body).includes('synthetic-access')&&!Object.hasOwn(body,'id'));
  });
  await group('profile edits persist only name/company with revision checks',async()=>{
    let response=await invoke('profile',{name:'  Alice  ',company:'  Example Co  ',revision:0},'PATCH');assert.equal(response.status,200);assert.equal(response.body.name,'Alice');assert.equal(response.body.company,'Example Co');assert.equal(response.body.revision,1);
    response=await invoke('profile',{name:'Overwrite',company:'Wrong',revision:0},'PATCH');assert.equal(response.status,409);assert.equal((await profile.getProfile()).name,'Alice');
    const stored=await records.readRecord('account_profiles',profileId('owner-a'));assert.deepEqual(Object.keys(stored.payload).sort(),['company','name']);assert.equal(stored.owner_id,'owner-a');
  });
  await group('profile owner cannot be selected by input or another account',async()=>{
    const response=await invoke('profile',{name:'Wrong',company:'Wrong',revision:1,ownerId:'owner-b'},'PATCH');assert.equal(response.status,400);await login('owner-b');assert.equal((await profile.getProfile()).name,'');await profile.saveProfile({name:'Bob',company:'Other Co',revision:0},session.accountKeyForUser('owner-b'));await login();assert.equal((await profile.getProfile()).name,'Alice');
  });
  await group('stale-account and omitted account bindings cannot mutate the current account',async()=>{
    await login('owner-b');requestOwner='owner-a';let response=await invoke('profile',{name:'Alice leak',company:'Wrong account',revision:1},'PATCH');assert.equal(response.status,403);assert.equal((await profile.getProfile()).name,'Bob');
    const missing=request('profile',{name:'No binding',company:'Wrong',revision:1},undefined,'PATCH');missing.headers.delete('x-pippi-account');response=await routes.profile.PATCH(missing);assert.equal(response.status,403);assert.equal((await profile.getProfile()).name,'Bob');
    const before=grantCalls;response=await invoke('password',{currentPassword:'other-password-2026',password:'should-not-change-password'});assert.equal(response.status,403);assert.equal(grantCalls,before);await login();
  });
  await group('validation and origin rejection happen before mutations',async()=>{
    assert.equal((await invoke('profile',{name:'x'.repeat(161),company:'',revision:1},'PATCH')).status,400);
    assert.equal((await invoke('password',{currentPassword:'current-password-2026',password:'short'})).status,400);
    assert.equal((await invoke('email',{currentPassword:'current-password-2026',email:'invalid'})).status,400);
    assert.equal((await invoke('profile',{name:'Bad origin',company:'',revision:1},'PATCH','https://untrusted.example')).status,403);
  });
  await group('incorrect current password preserves the existing renewable session',async()=>{
    const handle=jar.get('hq_session').value,before=updateCalls;const response=await invoke('password',{currentPassword:'incorrect-password',password:'replacement-password-2026'});assert.equal(response.status,400);assert.equal(updateCalls,before);assert.equal(jar.get('hq_session').value,handle);assert.equal((await session.resolveAccountSession()).id,'owner-a');
  });
  await group('pending email remains distinct and has owner-bound PKCE confirmation',async()=>{
    const handle=jar.get('hq_session').value;const response=await invoke('email',{currentPassword:'current-password-2026',email:' NEW@example.test '});assert.equal(response.status,200);assert.equal(response.body.email,'owner@example.test');assert.equal(response.body.pendingEmail,'new@example.test');assert.equal(jar.get('hq_session').value,handle);
    assert.equal(lastUpdate.email,'new@example.test');assert.equal(lastUpdate.code_challenge_method,'s256');assert.equal(lastUpdate.redirect,'https://www.pippiapp.com/auth/callback');
    const flow=await accountAuth.emailFlow();assert.equal(flow.kind,'email_change');assert.equal(flow.ownerId,'owner-a');assert.equal(flow.requestedEmail,'new@example.test');assert.equal(crypto.createHash('sha256').update(flow.verifier).digest('base64url'),lastUpdate.code_challenge);assert.equal(jar.get('hq_email_flow').options.httpOnly,true);
    assert.ok(!JSON.stringify(response.body).includes('synthetic-access')&&!JSON.stringify(response.body).includes('current-password'));
  });
  await group('email callback requires provider-confirmed target and original account',async()=>{
    const flow=await accountAuth.emailFlow();await assert.rejects(()=>profile.verifyProfileEmailExchange(pair('owner-a'),flow),error=>error.status===409);
    await assert.rejects(()=>profile.verifyProfileEmailExchange(pair('owner-a'),{...flow,kind:'recovery'}),error=>error.status===400);
    const person=people.get('owner-a');person.email='new@example.test';delete person.new_email;person.email_confirmed_at=new Date().toISOString();await profile.verifyProfileEmailExchange(pair('owner-a'),flow);assert.equal((await profile.getProfile()).email,'new@example.test');assert.equal((await profile.getProfile()).pendingEmail,undefined);
    await login('owner-b');await assert.rejects(()=>profile.verifyProfileEmailExchange(pair('owner-a'),flow),error=>error.status===409);await login();
  });
  await group('actual email-change exchange rejects unconfirmed/mismatched owners without consuming the flow',async()=>{
    const person=people.get('owner-a'),flow=await accountAuth.beginEmailFlow('email_change',{ownerId:'owner-a',requestedEmail:'confirmed@example.test'});await flow.persist();person.new_email='confirmed@example.test';
    const cookie=jar.get('hq_email_flow').value,handle=jar.get('hq_session').value;
    let response=await exchange(pair('owner-a'));assert.equal(response.status,409);assert.equal(jar.get('hq_email_flow').value,cookie);assert.equal(jar.get('hq_session').value,handle);assert.equal(jar.has('hq_recovery'),false);
    response=await exchange(pair('owner-b'));assert.equal(response.status,403);assert.equal(jar.get('hq_email_flow').value,cookie);assert.equal(jar.get('hq_session').value,handle);assert.equal(jar.has('hq_recovery'),false);
    await session.createAccountSession(pair('owner-b'));const otherHandle=jar.get('hq_session').value;response=await exchange(pair('owner-a'));assert.equal(response.status,409);assert.equal(jar.get('hq_email_flow').value,cookie);assert.equal(jar.get('hq_session').value,otherHandle);await session.createAccountSession(pair('owner-a'));
  });
  await group('actual confirmed email exchange establishes a normal durable session and returns to profile',async()=>{
    const person=people.get('owner-a');person.email='confirmed@example.test';delete person.new_email;person.email_confirmed_at=new Date().toISOString();
    const before=jar.get('hq_session').value,keyBefore=(await session.resolveAccountSession()).accountKey,response=await exchange(pair('owner-a'));assert.equal(response.status,200);assert.deepEqual(response.body,{next:'/profile'});assert.notEqual(jar.get('hq_session').value,before);assert.equal(jar.has('hq_email_flow'),false);assert.equal(jar.has('hq_recovery'),false);assert.equal(jar.has('hq_access'),false);assert.equal((await session.resolveAccountSession()).accountKey,keyBefore);assert.equal((await profile.getProfile()).email,'confirmed@example.test');assert.equal((await profile.getProfile()).name,'Alice');
    const replay=await accountRoutes.POST(new Request('https://quiz.example.test/api/auth/account',{method:'POST',headers:{Origin:'https://quiz.example.test','Content-Type':'application/json','x-forwarded-for':`192.0.2.${++ip}`},body:JSON.stringify({action:'exchange',code:'synthetic-confirmation-code'})}));assert.equal(replay.status,400);
  });
  await group('password update retains stable handle, owner and profile data',async()=>{
    const handle=jar.get('hq_session').value;const response=await invoke('password',{currentPassword:'current-password-2026',password:'replacement-password-2026'});assert.equal(response.status,200);assert.deepEqual(response.body,{ok:true});assert.equal(jar.get('hq_session').value,handle);assert.equal((await session.resolveAccountSession()).id,'owner-a');assert.equal((await profile.getProfile()).name,'Alice');assert.equal(lastUpdate.current_password,'current-password-2026');
    const rows=await records.listRecords('account_profiles');assert.ok(rows.every(row=>!JSON.stringify(row).includes('password')));
  });
  await group('provider SMTP failure does not claim a pending or confirmed change',async()=>{
    providerFailure='smtp';const response=await invoke('email',{currentPassword:'replacement-password-2026',email:'never-confirmed@example.test'});assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');providerFailure='';assert.equal((await profile.getProfile()).email,'confirmed@example.test');assert.equal((await profile.getProfile()).pendingEmail,undefined);
  });
  await group('provider rate/strength policies remain explicit',async()=>{
    providerFailure='rate';let response=await invoke('password',{currentPassword:'replacement-password-2026',password:'another-password-2026'});assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'30');providerFailure='weak';response=await invoke('password',{currentPassword:'replacement-password-2026',password:'another-password-2026'});assert.equal(response.status,422);providerFailure='';
  });
  await group('provider outage preserves profile and does not turn into sign-out',async()=>{
    providerFailure='outage';const response=await routes.profile.GET();assert.equal(response.status,503);providerFailure='';assert.equal((await session.resolveAccountSession()).id,'owner-a');assert.equal((await profile.getProfile()).name,'Alice');
  });
  await group('logout during fresh authentication wins over pending profile mutation',async()=>{
    gateFresh=true;const started=new Promise(resolve=>announceGate=resolve),before=updateCalls,handle=jar.get('hq_session').value;
    const pending=profile.changeProfilePassword({currentPassword:'replacement-password-2026',password:'must-not-change-password'},session.accountKeyForUser('owner-a'));await started;await session.revokeAccountSession();releaseGate();await assert.rejects(()=>pending,error=>error.status===401);gateFresh=false;announceGate=undefined;assert.equal(updateCalls,before);assert.equal(jar.has('hq_session'),false);assert.equal(await session.resolveAccountSession(),null);const row=await records.readRecord('account_sessions',crypto.createHash('sha256').update(handle).digest('hex'));assert.ok(row.payload.revokedAt);
  });
  await group('legacy profile reads work but sensitive changes require fresh sign-in',async()=>{
    jar.clear();const token=pair('owner-a');jar.set('hq_access',{value:token.access_token});assert.equal((await profile.getProfile()).name,'Alice');const before=grantCalls;const response=await invoke('password',{currentPassword:'replacement-password-2026',password:'another-password-2026'});assert.equal(response.status,401);assert.equal(grantCalls,before);
  });
  await group('local profiles can edit metadata but cannot invoke provider account changes',async()=>{
    jar.clear();process.env.HEYQUIZ_LOCAL_MODE='1';requestOwner='local';jar.set('hq_local',{value:auth.signToken({role:'local',exp:Date.now()+3600000})});const before=grantCalls;
    assert.deepEqual(await profile.getProfile(),{name:'',company:'',email:'',revision:0,local:true});await profile.saveProfile({name:'Local Name',company:'Local Co',revision:0},session.accountKeyForUser('local'));assert.equal((await profile.getProfile()).name,'Local Name');assert.equal((await invoke('email',{email:'local-change@example.test',currentPassword:'anything'})).status,403);assert.equal((await invoke('password',{currentPassword:'anything',password:'replacement-password-2026'})).status,403);assert.equal(grantCalls,before);delete process.env.HEYQUIZ_LOCAL_MODE;
  });
  console.log(`${groups} profile API groups passed; synthetic provider and isolated records only.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(directory,{recursive:true,force:true}));
