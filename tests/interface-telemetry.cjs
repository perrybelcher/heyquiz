const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const client = {exports:{}};
let requests = [], unavailable = false;
vm.runInNewContext(compile('lib/interface-telemetry.ts'), {module:client,exports:client.exports,window:{},fetch:(url,options)=>{requests.push({url,options});if(unavailable)throw Error('offline');return Promise.reject(Error('offline'));}});
(async () => {
  assert.equal(client.exports.reportInterfaceEvent('save_failed','v2'),undefined);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1);
  assert.deepEqual(JSON.parse(requests[0].options.body),{event:'save_failed',version:'v2'});
  assert.equal(requests[0].options.credentials,'same-origin');
  assert.equal(requests[0].options.referrerPolicy,'no-referrer');
  client.exports.reportInterfaceEvent('private content','v2');client.exports.reportInterfaceEvent('save_failed','unknown');
  assert.equal(requests.length,1);
  unavailable=true;assert.doesNotThrow(()=>client.exports.reportInterfaceEvent('editor_opened','v1'));
  let authenticated=true, originAllowed=true, limited=false, logs=[];
  const route={exports:{}};
  vm.runInNewContext(compile('app/api/interface-events/route.ts'), {module:route,exports:route.exports,Response,Date,console:{info:line=>logs.push(JSON.parse(line))},require:id=>{
    if(id==='zod')return {z};
    if(id==='@/lib/interface-telemetry')return client.exports;
    if(id==='@/lib/errors')return {readJsonRequest:request=>request.json()};
    if(id==='@/lib/rate-limit')return {rateLimit:(request,scope,max)=>{assert.equal(scope,'interface-events');assert.equal(max,120);if(limited)throw {status:429};}};
    if(id==='@/lib/auth')return {checkOrigin:()=>{if(!originAllowed)throw {status:403};},requireUser:async()=>{if(!authenticated)throw {status:401};return {id:'must-never-be-logged'};},apiError:error=>Response.json({error:'rejected'},{status:error.status||400})};
    throw Error(id);
  }});
  const request=body=>new Request('https://pippi.example.test/api/interface-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  for(const event of client.exports.interfaceEvents){const response=await route.exports.POST(request({event,version:'v2'}));assert.equal(response.status,204);assert.equal(response.headers.get('Cache-Control'),'private, no-store');}
  assert.equal(logs.length,client.exports.interfaceEvents.length);
  for(const log of logs){assert.deepEqual(Object.keys(log).sort(),['count','event','name','timestamp','version']);assert.equal(log.count,1);assert.equal(log.event,'pippi.interface');assert.ok(!JSON.stringify(log).includes('must-never'));}
  for(const body of [{event:'unknown',version:'v2'},{event:'save_failed',version:'v3'},{event:'save_failed',version:'v2',email:'private@example.test'},{event:'publish_failed',version:'v2',error:'private error'}])assert.equal((await route.exports.POST(request(body))).status,400);
  authenticated=false;assert.equal((await route.exports.POST(request({event:'save_failed',version:'v2'}))).status,401);authenticated=true;
  originAllowed=false;assert.equal((await route.exports.POST(request({event:'save_failed',version:'v2'}))).status,403);originAllowed=true;
  limited=true;assert.equal((await route.exports.POST(request({event:'save_failed',version:'v2'}))).status,429);
  assert.equal(logs.length,client.exports.interfaceEvents.length,'invalid, private, unauthenticated, cross-origin and throttled events never log');
  console.log('PASS interface telemetry: nonblocking, same-origin, no referrer, strict event-only payload, auth/origin/rate checks and content-free operational logs.');
})().catch(error=>{console.error(error);process.exitCode=1;});
