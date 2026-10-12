// Bounded mixed local-read measurement. Baseline disables only the new budget
// in this child harness; it retains the existing per-listing32 workers.
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{performance}=require('node:perf_hooks'),{spawnSync}=require('node:child_process'),ts=require('typescript'),Module=require('node:module');
const size=Number(process.env.LOAD_SIZE||1000),rounds=Number(process.env.LOAD_ROUNDS||2);
if(!Number.isInteger(size)||size<100||size>3000||!Number.isInteger(rounds)||rounds<1||rounds>3)throw Error('Bounded local measurements only.');
if(!process.env.LOCAL_READ_LOAD_CHILD){
 const measurements=[];for(let round=0;round<rounds;round++)for(const mode of round%2?['shared32','per-list32']:['per-list32','shared32']){
  const child=spawnSync(process.execPath,['--expose-gc',__filename],{env:{...process.env,LOCAL_READ_LOAD_CHILD:mode,LOAD_SIZE:String(size)},encoding:'utf8',maxBuffer:4*1024*1024});if(child.status!==0)throw Error(child.stderr||child.stdout||'Measurement failed');const result=JSON.parse(child.stdout);result.round=round+1;measurements.push(result);console.log(JSON.stringify(result));
 }
 const first=measurements[0];for(const row of measurements){assert.deepEqual(row.result,first.result);assert.equal(row.readCalls,first.readCalls);if(row.mode==='shared32')assert.ok(row.peakConcurrentReads<=32);}
 const output={node:process.version,fixtureSessions:size,rounds,note:'Synthetic per-list baseline bypasses only the new helper in an isolated child; warm local measurements, not production guarantees.',measurements};
 if(process.env.LOAD_OUTPUT){const out=path.resolve(process.env.LOAD_OUTPUT);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');}
 console.log('PASS mixed contact/analytics/report/direct reads: exact counts/read totals preserved, shared local peak<=32.');
}else{
 for(const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])delete process.env[key];global.fetch=async()=>{throw Error('Network forbidden');};
 require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
 const originalLoad=Module._load;if(process.env.LOCAL_READ_LOAD_CHILD==='per-list32')Module._load=function(request,parent,isMain){if(request==='./local-record-reads'&&parent?.filename.endsWith('/lib/records.ts'))return{withLocalRecordRead:operation=>operation()};return originalLoad.call(this,request,parent,isMain);};
 const {listRecords,readRecord}=require('../lib/records.ts'),{loadContactDirectory}=require('../lib/contact-context-store.ts'),{summarizeAnalytics}=require('../lib/analytics.ts'),{listResultLinks}=require('../lib/report-management.ts'),{makeResultReport}=require('../lib/result-reports.ts'),{FormSchema}=require('../lib/schema.ts');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pippi-mixed-read-load-'));process.env.HEYQUIZ_DATA_DIR=directory;
 const now=Date.now(),owner='synthetic-owner',form=FormSchema.parse({id:'quiz',title:'Synthetic mixed-read quiz',mode:'survey',questions:[{id:'q',type:'multiple_choice',title:'What would help?',options:[{id:'a',label:'Explore'},{id:'b',label:'Build'}]}]}),ids=[];let bytes=0,fileCount=0;
 function write(kind,id,who,payload){fs.mkdirSync(path.join(directory,kind),{recursive:true});const text=JSON.stringify({kind,id,owner_id:who,version:1,payload});fs.writeFileSync(path.join(directory,kind,id+'.json'),text);bytes+=Buffer.byteLength(text);fileCount++;}
 write('forms','quiz',owner,form);let expected=0;
 for(let i=0;i<size;i++){
  const id='00000000-0000-4000-8000-'+String(i).padStart(12,'0'),who=i%4?'synthetic-owner':'foreign-owner',time=now-60000-i*10;ids.push(id);if(who===owner)expected++;
  const result={id,formId:'quiz',submittedAt:new Date(time).toISOString(),totalQuestions:1,totalPointsPossible:0,totalPointsEarned:0,percentageScore:100,passed:true,grading:[],answers:{q:i%2?'a':'b'},contact:{email:'synthetic@example.test',marketingConsent:true}};
  write('submissions',id,who,result);write('attempts',id,who,{form,startedAt:time-1000,expiresAt:time+86400000,reached:['q'],completed:true,completedAt:time,preview:false,analyticsVersion:1,attribution:{version:1,source:'synthetic',campaign:'load'}});write('landing_visits','visit-'+id,who,{version:1,formId:'quiz',firstViewedAt:time-1500,expiresAt:time+1000,channel:'direct'});write('result_reports','result-'+id,who,makeResultReport(form,result,id));
 }
 let active=0,peak=0,readCalls=0;const originalRead=fsp.readFile;fsp.readFile=async(...args)=>{active++;peak=Math.max(peak,active);readCalls++;try{return await originalRead(...args);}finally{active--;}};
 (async()=>{let timer;try{
  if(global.gc)global.gc();const initial=process.memoryUsage();let rss=initial.rss;timer=setInterval(()=>rss=Math.max(rss,process.memoryUsage().rss),5);const started=performance.now();
  const [contacts,analytics,links,direct]=await Promise.all([
   loadContactDirectory('quiz',owner),
   (async()=>{const [attempts,submissions,visits]=await Promise.all([listRecords('attempts',owner),listRecords('submissions',owner),listRecords('landing_visits',owner)]);return summarizeAnalytics(form,attempts,submissions.map(r=>({...r.payload,id:r.id})),'all',now,visits);})(),
   listResultLinks('quiz',owner),
   Promise.all(ids.slice(0,64).map(id=>readRecord('attempts',id)))
  ]);
  assert.equal(contacts.contacts.length,expected);assert.equal(analytics.starts,expected);assert.equal(analytics.completions,expected);assert.equal(links.total,expected);assert.equal(direct.length,64);assert.equal(active,0);if(process.env.LOCAL_READ_LOAD_CHILD==='shared32')assert.ok(peak<=32);
  const result={contacts:contacts.contacts.length,questionVersions:contacts.answerCohort.versions.length,starts:analytics.starts,completions:analytics.completions,retainedReportLinks:links.total,directReads:direct.length};
  console.log(JSON.stringify({mode:process.env.LOCAL_READ_LOAD_CHILD,sessions:size,files:fileCount,jsonBytes:bytes,ms:Math.round((performance.now()-started)*10)/10,readCalls,peakConcurrentReads:peak,rssDeltaMiB:Math.round((Math.max(rss,process.memoryUsage().rss)-initial.rss)/1048576*10)/10,heapDeltaMiB:Math.round((process.memoryUsage().heapUsed-initial.heapUsed)/1048576*10)/10,result}));
 }finally{clearInterval(timer);fsp.readFile=originalRead;Module._load=originalLoad;fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
}
