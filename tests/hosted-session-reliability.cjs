// Compiled hosted-mode acceptance against a loopback-only fake Supabase service.
// No Supabase credentials, account emails, or records from an existing environment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');

const workspace = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync('/private/tmp/pippi-hosted-sessions-');
const artifacts = path.resolve(process.env.ARTIFACT_DIR || temporary);
assert.ok(artifacts.startsWith('/private/tmp/') || artifacts.startsWith('/tmp/'), 'Artifacts must remain in an explicit temporary directory');
fs.mkdirSync(artifacts, {recursive:true});
const store = new Map(), access = new Map(), refresh = new Map(), unexpected = [], external = [];
const publicKey = 'synthetic-publishable-key', serviceKey = 'sb_secret_SYNTHETIC_SERVER_ONLY';
let counter = 0, refreshCalls = 0, refreshDelay = 0, authUnavailable = false, storageUnavailable = false, app, browser, serverLog = '';
const children = [];
const key = row => `${row.kind}:${row.id}`;
const clone = value => JSON.parse(JSON.stringify(value));
const providerUser = owner => ({id: owner, email: owner === 'owner-b' ? 'other@example.test' : 'qa@example.test', email_confirmed_at: '2026-10-26T00:00:00.000Z'});
function pair(owner) {
  const n=++counter, value={access_token:`synthetic-access-${n}`,refresh_token:`synthetic-refresh-${n}`,expires_in:3600,user:providerUser(owner)};
  access.set(value.access_token,{owner,valid:true});refresh.set(value.refresh_token,{owner,pair:null});return value;
}
function json(response,status,value) {response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));}
async function body(request) {
  let text='';for await(const chunk of request){text+=chunk;if(text.length>2*1024*1024)throw Error('Synthetic request too large');}
  return text?JSON.parse(text):{};
}
function matches(row,search) {
  for(const [name,filter] of search) {
    if(['select','limit','order'].includes(name))continue;
    const dot=filter.indexOf('.'),op=filter.slice(0,dot),value=filter.slice(dot+1),actual=String(row[name]);
    if(op==='eq'&&actual!==value)return false;
    if(op==='gt'&&actual<=value)return false;
    if(!['eq','gt'].includes(op))throw Error('Unsupported synthetic filter');
  }
  return true;
}
const fake = http.createServer((request,response)=>void (async()=>{
  const url=new URL(request.url,'http://127.0.0.1'),apiKey=request.headers.apikey;
  if(url.pathname.startsWith('/auth/v1/')){
    assert.equal(apiKey,publicKey,'Auth calls must use only synthetic public key');
    if(authUnavailable){json(response,503,{code:'unexpected_failure'});return;}
    if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='password'&&request.method==='POST'){
      const input=await body(request);assert.equal(input.password,'synthetic-password-2026');
      const owner=input.email==='other@example.test'?'owner-b':'owner-a';json(response,200,pair(owner));return;
    }
    if(url.pathname==='/auth/v1/user'&&request.method==='GET'){
      const user=access.get(String(request.headers.authorization||'').replace(/^Bearer /,''));
      json(response,user?.valid?200:401,user?.valid?providerUser(user.owner):{code:'bad_jwt'});return;
    }
    if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token'&&request.method==='POST'){
      refreshCalls++;const input=await body(request),previous=refresh.get(input.refresh_token);
      if(refreshDelay)await delay(refreshDelay);
      if(!previous){json(response,400,{code:'refresh_token_not_found'});return;}
      previous.pair ||= pair(previous.owner);json(response,200,previous.pair);return;
    }
    if(url.pathname==='/auth/v1/logout'&&request.method==='POST'){response.writeHead(204);response.end();return;}
  }
  if(url.pathname==='/rest/v1/hq_records'){
    assert.equal(apiKey,serviceKey,'Records must use only synthetic service key');
    if(storageUnavailable&&request.method==='PATCH'&&url.searchParams.get('kind')==='eq.forms'){json(response,503,{code:'synthetic_storage_unavailable'});return;}
    const rows=[...store.values()].filter(row=>matches(row,url.searchParams)).sort((a,b)=>a.id.localeCompare(b.id));
    if(request.method==='GET'){json(response,200,rows.slice(0,Number(url.searchParams.get('limit')||1000)).map(clone));return;}
    if(request.method==='POST'){
      const row=await body(request);if(store.has(key(row))){json(response,409,{code:'23505'});return;}
      store.set(key(row),clone(row));json(response,201,[row]);return;
    }
    if(request.method==='PATCH'){
      const update=await body(request),results=[];
      // Filtering and mutation are synchronous: this is the provider's CAS boundary.
      for(const row of [...store.values()].filter(row=>matches(row,url.searchParams))){const next={...row,...update};store.set(key(next),clone(next));results.push(next);}
      json(response,200,results);return;
    }
    if(request.method==='DELETE'){for(const row of rows)store.delete(key(row));json(response,200,[]);return;}
  }
  unexpected.push(`${request.method} ${url.pathname}`);json(response,500,{error:'Unmocked synthetic endpoint'});
})().catch(()=>{unexpected.push('Synthetic provider handler failure');if(!response.headersSent)json(response,500,{error:'Synthetic provider failure'});else response.end();}));
const listen = server => new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const delay = milliseconds => new Promise(resolve=>setTimeout(resolve,milliseconds));
async function freePort(){const server=http.createServer();const port=await listen(server);await new Promise(resolve=>server.close(resolve));return port;}
async function poll(description,predicate,timeout=15000){const until=Date.now()+timeout;while(Date.now()<until){if(await predicate())return;await delay(100);}throw Error(`Timed out: ${description}`);}
const fixture = id => ({id,title:'Hosted session fixture',mode:'survey',questions:[{id:'q',type:'short_answer',title:'Synthetic question'}]});
const titleInStore = id => store.get(`forms:${id}`)?.payload.title;
const expireAccess = () => {for(const value of access.values())value.valid=false;};
const pendingStored = async (page,title) => page.evaluate(title=>Object.keys(localStorage).filter(key=>key.startsWith('pippi-recovery:')||key.startsWith('pippi-draft:')||key.includes('recovery')).some(key=>(localStorage.getItem(key)||'').includes(title)),title);
const escapedLog = () => serverLog.replace(/synthetic-(?:access|refresh)-\d+/g,'[synthetic token]');

(async()=>{
  assert.ok(fs.existsSync(path.join(workspace,'.next','BUILD_ID')),'Build the current application before running this compiled acceptance suite');
  const providerPort=await listen(fake),appPort=await freePort(),secondPort=await freePort(),providerBase=`http://127.0.0.1:${providerPort}`,base=`http://127.0.0.1:${appPort}`,secondBase=`http://127.0.0.1:${secondPort}`;
  assert.notEqual(appPort,secondPort,'Separate compiled instances require distinct loopback ports');
  const blockedFile=path.join(temporary,'blocked-network.txt'),guard=path.join(temporary,'network-guard.cjs');
  fs.writeFileSync(guard,`const fs=require('node:fs');const original=global.fetch;const allowed=new Set(${JSON.stringify([base,secondBase,providerBase])});global.fetch=(input,init)=>{const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);if(!allowed.has(u.origin)){fs.appendFileSync(${JSON.stringify(blockedFile)},'blocked\\n');throw Error('Non-local outbound fetch rejected by isolated acceptance harness');}return original(input,init);};`);
  const environment={...process.env};
  for(const name of Object.keys(environment))if(/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|VERCEL|GEMINI_|NANGO_|RESEND_|TURNSTILE_|RESULT_EMAIL_|HEYQUIZ_RESULT_EMAIL_|CRON_SECRET$|INTEGRATION_SECRET$|NODE_OPTIONS$)/.test(name))delete environment[name];
  // Empty aliases override any local env file rather than falling through to it.
  for(const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','NANGO_SECRET_KEY','RESEND_API_KEY','RESEND_WEBHOOK_SECRET','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY','RESULT_EMAIL_FROM','RESULT_EMAIL_WORKER_SECRET','HEYQUIZ_RESULT_EMAIL_MODE','HEYQUIZ_RESULT_EMAIL_ORIGIN','CRON_SECRET','INTEGRATION_SECRET'])environment[name]='';
  Object.assign(environment,{NODE_ENV:'production',HEYQUIZ_LOCAL_MODE:'0',HEYQUIZ_DATA_DIR:path.join(temporary,'unused-local-records'),SUPABASE_URL:providerBase,SUPABASE_PUBLISHABLE_KEY:publicKey,SUPABASE_SECRET_KEY:serviceKey,SESSION_SECRET:crypto.randomBytes(32).toString('hex'),APP_URL:base,NEXT_PUBLIC_CLARITY_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'});
  function start(port,origin){
    const child=spawn(process.execPath,['--require',guard,path.join(workspace,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:workspace,env:{...environment,APP_URL:origin},stdio:['ignore','pipe','pipe']});
    children.push(child);for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-30000);});
    child.on('error',error=>{serverLog+=`\n${error.message}`;});return child;
  }
  app=start(appPort,base);const second=start(secondPort,secondBase);
  await Promise.all([[app,base],[second,secondBase]].map(([child,origin])=>poll('compiled app startup',async()=>{if(child.exitCode!==null)throw Error('Compiled app stopped before startup');try{return(await fetch(origin+'/login')).ok;}catch{return false;}},30000)));
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext(),page=await context.newPage();
  page.setDefaultTimeout(15000);
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());if([base,providerBase].includes(url.origin)||['data:','blob:'].includes(url.protocol))return route.continue();external.push(url.origin);return route.abort();
  });
  const forbidden=[];
  page.on('request',request=>{if(request.method()!=='GET'&&/\/(?:publish|result-email|integrations|submit)(?:\/|$)/.test(new URL(request.url()).pathname))forbidden.push(new URL(request.url()).pathname);});
  const clientErrors=[];page.on('pageerror',error=>clientErrors.push(error.message));
  await page.goto(base+'/login');await page.getByLabel('Email',{exact:true}).fill('owner@example.test');await page.getByLabel('Password',{exact:true}).fill('synthetic-password-2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(base+'/');
  const cookies=await context.cookies();const sessionCookie=cookies.find(cookie=>cookie.name==='hq_session');assert.ok(sessionCookie?.httpOnly);assert.ok(!cookies.some(cookie=>cookie.name==='hq_access'));
  const id=`hosted-session-${Date.now()}`;
  // Chrome accepts secure localhost cookies; APIRequestContext deliberately does
  // not send Secure cookies over HTTP. Exercise the browser's actual fetch path.
  const created=await page.evaluate(async form=>{const response=await fetch('/api/forms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});return response.status;},fixture(id));assert.equal(created,201);
  await page.goto(`${base}/editor/${id}`);
  const field=page.getByLabel('Quiz title',{exact:true});await field.waitFor();
  await poll('initial foreground session check',async()=>!(await page.getByRole('heading',{name:'Sign in to continue editing',exact:true}).isVisible()));
  const beforeRefresh=refreshCalls;expireAccess();await field.fill('Saved after idle access expiry');
  await poll('idle-expiry save reaches cloud adapter',()=>titleInStore(id)==='Saved after idle access expiry');
  await page.getByText(/^Saved to your account(?: ·|$)/).filter({visible:true}).first().waitFor();
  assert.equal(refreshCalls,beforeRefresh+1);assert.equal(await page.getByRole('heading',{name:'Sign in to continue editing',exact:true}).isVisible(),false);assert.equal(page.url(),`${base}/editor/${id}`);
  await page.screenshot({path:path.join(artifacts,'hosted-idle-renewal.png'),fullPage:false});
  console.log('PASS compiled hosted flow: idle access expiry renews once and saves without sign-in interruption');

  // The same handle is deliberately presented to independent Next processes.
  // Their only coordination mechanism is the shared records adapter's CAS lease.
  const sessionHandle=(await context.cookies()).find(cookie=>cookie.name==='hq_session').value;
  const sessionAt=async origin=>{const response=await fetch(origin+'/api/auth/session',{method:'POST',headers:{Origin:origin,Cookie:`hq_session=${sessionHandle}`}});assert.equal(response.status,200);return response.json();};
  const expectedSession=await sessionAt(base);expireAccess();const beforeCrossInstance=refreshCalls;refreshDelay=150;
  const [firstSession,secondSession]=await Promise.all([sessionAt(base),sessionAt(secondBase)]);refreshDelay=0;
  const crossInstanceRotations=refreshCalls-beforeCrossInstance;
  assert.equal(firstSession.state,'authenticated');assert.equal(secondSession.state,'authenticated');assert.equal(firstSession.accountKey,expectedSession.accountKey);assert.equal(secondSession.accountKey,expectedSession.accountKey);assert.equal(refreshCalls,beforeCrossInstance+1);
  const sessionRecord=store.get('account_sessions:'+crypto.createHash('sha256').update(sessionHandle).digest('hex'));
  assert.equal(sessionRecord.owner_id,'owner-a');assert.equal(sessionRecord.payload.lease,undefined);
  console.log('PASS compiled hosted flow: two independent Next instances renew the same handle with one provider rotation');

  authUnavailable=true;await field.fill('Pending during authentication outage');
  await page.getByText('Account service is temporarily unavailable.',{exact:false}).first().waitFor();
  assert.equal(await page.getByRole('heading',{name:'Sign in to continue editing',exact:true}).isVisible(),false);assert.equal(titleInStore(id),'Saved after idle access expiry');
  await poll('persistent outage recovery copy',()=>pendingStored(page,'Pending during authentication outage'));
  authUnavailable=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await poll('auth service recovery sync',()=>titleInStore(id)==='Pending during authentication outage');
  console.log('PASS compiled hosted flow: provider503 preserves draft, avoids false sign-out, and recovers');

  storageUnavailable=true;const failedWrite=page.waitForResponse(response=>response.url()===`${base}/api/forms/${id}`&&response.request().method()==='PUT'&&response.status()===503);
  await field.fill('Pending during storage outage');await failedWrite;assert.equal(titleInStore(id),'Pending during authentication outage');await poll('persistent storage-outage copy',()=>pendingStored(page,'Pending during storage outage'));
  storageUnavailable=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await poll('storage recovery sync',()=>titleInStore(id)==='Pending during storage outage');
  console.log('PASS compiled hosted flow: actual records adapter maps provider storage outage to503 and retries safely');

  expireAccess();refresh.clear();await field.fill('Pending across fresh sign-in');
  const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Sign in to continue editing',exact:true})});await dialog.waitFor();
  assert.notEqual(await page.locator('[aria-label="Quiz editor"]').getAttribute('inert'),null);assert.equal(titleInStore(id),'Pending during storage outage');await poll('persistent reauthentication copy',()=>pendingStored(page,'Pending across fresh sign-in'));
  await page.screenshot({path:path.join(artifacts,'hosted-inline-reauthentication.png'),fullPage:false});
  await dialog.getByLabel('Email',{exact:true}).fill('other@example.test');await dialog.getByLabel('Password',{exact:true}).fill('synthetic-password-2026');await dialog.getByRole('button',{name:'Sign in and resume saving',exact:true}).click();
  await dialog.getByText('A different account is signed in.',{exact:false}).waitFor();assert.equal(titleInStore(id),'Pending during storage outage');
  await dialog.getByLabel('Email',{exact:true}).fill('owner@example.test');await dialog.getByLabel('Password',{exact:true}).fill('synthetic-password-2026');await dialog.getByRole('button',{name:'Sign in and resume saving',exact:true}).click();
  await poll('original account pending draft sync',()=>titleInStore(id)==='Pending across fresh sign-in');await dialog.waitFor({state:'hidden'});assert.equal(page.url(),`${base}/editor/${id}`);
  await page.getByText(/^Saved to your account(?: ·|$)/).filter({visible:true}).first().waitFor();
  assert.equal(store.get(`forms:${id}`).owner_id,'owner-a');assert.equal(store.has(`published:${id}`),false);assert.equal(forbidden.length,0);assert.deepEqual(unexpected,[]);assert.deepEqual(external,[]);assert.deepEqual(clientErrors,[]);assert.equal(fs.existsSync(blockedFile),false);
  const sessions=[...store.values()].filter(row=>row.kind==='account_sessions');assert.ok(sessions.length>=3);assert.ok(sessions.every(row=>!JSON.stringify(row).includes('synthetic-access-')&&!JSON.stringify(row).includes('synthetic-refresh-')));
  await page.screenshot({path:path.join(artifacts,'hosted-reauthentication-saved.png'),fullPage:false});
  fs.writeFileSync(path.join(artifacts,'hosted-session-summary.json'),JSON.stringify({passed:true,groups:5,compiledInstances:2,crossInstanceRotations,refreshCalls,encryptedSessionRecords:sessions.length,formRevision:store.get(`forms:${id}`).version,unexpectedProviderRequests:unexpected.length,externalBrowserRequests:external.length,consequentialRequests:forbidden.length},null,2));
  console.log('PASS compiled hosted flow: inline reauthentication pauses editing, rejects wrong-account sync, resumes original draft, and never publishes');
  console.log(`PASS 5 hosted session reliability journeys; artifacts: ${artifacts}`);
})().catch(async error=>{
  console.error(error.message);fs.writeFileSync(path.join(artifacts,'server.log'),escapedLog());process.exitCode=1;
  if(browser)try{const pages=browser.contexts().flatMap(context=>context.pages());if(pages[0])await pages[0].screenshot({path:path.join(artifacts,'hosted-session-failure.png')});}catch{}
}).finally(async()=>{
  if(browser)await browser.close();
  await Promise.all(children.map(async child=>{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)]);if(child.exitCode===null)child.kill('SIGKILL');}}));
  if(fake.listening)await new Promise(resolve=>fake.close(resolve));
});
