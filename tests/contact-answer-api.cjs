const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const originalLoad=Module._load, root=path.resolve(__dirname,'..'), memory=new Map(); let owner='local', fail=false, reads=0, active=0, maximum=0;
class HttpError extends Error { constructor(status,message) {super(message);this.status=status;} }
Module._load=function(request,parent,isMain) {
 if(request==='@/lib/auth') return {HttpError,requireUser:async()=>{if(!owner)throw new HttpError(401,'Sign in');return{id:owner};},apiError:e=>Response.json({error:e.message},{status:e.status||400})};
 if(request==='@/lib/storage') return {ownedForm:async(id,who)=>memory.get('forms:'+id)?.owner_id===who?memory.get('forms:'+id).payload:null};
 return originalLoad.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,isMain);
};
const records=require('../lib/records.ts');
records.listRecords=async(kind,who)=>{reads++;return structuredClone([...memory.values()].filter(row=>row.kind===kind&&row.owner_id===who));};
records.readRecord=async(kind,id)=>{reads++;active++;maximum=Math.max(maximum,active);try{await new Promise(r=>setTimeout(r,1));if(fail)throw Error('PRIVATE ERROR');return structuredClone(memory.get(kind+':'+id)||null);}finally{active--;}};
const route=require('../app/api/forms/[id]/contacts/route.ts'), {historicalAnswerVersionId}=require('../lib/contact-answer-cohort-server.ts');
const {parseContactAnswerCohort}=require('../lib/contact-answer-cohort.ts');
const q={id:'q',type:'multiple_choice',title:'Choose a next step',options:[{id:'a',label:'Explore'},{id:'b',label:'Build'}]}, form={id:'quiz',questions:[q]}, pair={version:historicalAnswerVersionId(q),option:'a'};
const query='?'+new URLSearchParams({answerVersion:pair.version,answerOption:pair.option});
const put=(kind,id,who,payload)=>memory.set(kind+':'+id,{kind,id,owner_id:who,payload,version:1});
const request=(suffix='',id='quiz')=>route.GET(new Request('http://127.0.0.1/api/forms/'+id+'/contacts'+suffix),{params:Promise.resolve({id})});
const t=Date.now()-10000;
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const originalFetch=global.fetch;global.fetch=()=>{throw Error('Network forbidden');};
(async()=>{try{
 put('forms','quiz','local',form);
 for(let n=0;n<32;n++){const id='r'+n;put('submissions',id,'local',{id:n===0?'wrong-payload':id,formId:'quiz',submittedAt:new Date(t).toISOString(),contact:{email:'PRIVATE EMAIL'},answers:{q:n<29?'a':'b',free:'PRIVATE ANSWER'},grading:[]});put('attempts',id,'local',{form:{...form,private:'PRIVATE FORM'},preview:false,startedAt:t-100,result:{answers:{q:'PRIVATE CACHE'}}});}
 put('attempts','r29','other',{form,preview:false});put('attempts','r30','local',{form:{...form,id:'other-quiz'},preview:false});put('attempts','r31','local',{form,preview:true});
 let response=await request(query);assert.equal(response.status,200);let body=await response.json();
 assert.equal(body.contacts.length,32);assert.deepEqual(new Set(body.answerCohort.matchingIds),new Set(Array.from({length:29},(_,i)=>'r'+i)));assert.equal(body.answerCohort.counts.unavailable,3);assert.ok(body.answerCohort.matchingIds.includes('r0'));assert.ok(!body.answerCohort.matchingIds.includes('wrong-payload'));assert.ok(!JSON.stringify(body.answerCohort).includes('PRIVATE'));assert.equal(maximum,8);assert.equal(active,0);parseContactAnswerCohort(body.answerCohort,body.contacts.map(r=>r.id),pair);pass('Atomic owned contacts/context/catalog/membership with canonical IDs and eight-worker privacy-safe joins');
 const before=reads;for(const suffix of ['?answerVersion='+pair.version,'?answerOption=a',query+'&answerOption=b','?typo=yes'])assert.equal((await request(suffix)).status,400);assert.equal(reads,before);pass('Incomplete, duplicate and unknown query keys rejected before record scans');
 owner='';assert.equal((await request(query)).status,401);owner='foreign';assert.equal((await request(query)).status,404);owner='local';assert.equal(reads,before);pass('Auth and quiz ownership enforced before historic catalog access');
 fail=true;response=await request(query);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('PRIVATE'));assert.equal(active,0);fail=false;assert.equal((await request(query)).status,200);pass('Record failure cannot return a successful partial cohort and retry recovers');
 memory.delete('submissions:r0');response=await request(query);body=await response.json();assert.equal(body.answerCohort.matchingIds.length,28);assert.ok(!body.answerCohort.matchingIds.includes('r0'));assert.equal(body.contacts.length,31);pass('Deleted contact response never restored from retained attempt/cached answers');
 for(const [key,row] of memory)if(row.kind==='submissions')memory.delete(key);
 response=await request(query);assert.equal(response.status,400);assert.ok((await response.json()).error.includes('no longer available'));response=await request();body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.answerCohort.versions,[]);assert.equal(body.answerCohort.selection,null);pass('Stale selected version explicitly fails after deletion; cleared selection returns a genuinely empty directory');
 console.log(checks+' historical answer contact API scenarios passed.');
}finally{Module._load=originalLoad;global.fetch=originalFetch;}})().catch(e=>{console.error(e);process.exitCode=1;});
