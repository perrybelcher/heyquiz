/* Synthetic-only offline recovery rehearsal, not a production backup utility.
 * No source/destination arguments are accepted; all raw records stay in one new
 * disposable directory. Real runtime data, env files and old backups are unread. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const Module = require('node:module'), ts = require('typescript'), {z} = require('zod');
for (const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','VERCEL','VERCEL_ENV']) delete process.env[name];
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(),'pippi-recovery-rehearsal-'));
const source = path.join(sandbox,'source');fs.mkdirSync(source,{mode:0o700});
const signingKey = crypto.randomBytes(32).toString('base64url');
process.env.HEYQUIZ_DATA_DIR=source;process.env.SESSION_SECRET=signingKey;
process.env.HEYQUIZ_LOCAL_MODE='1';process.env.HEYQUIZ_RESULT_EMAIL_MODE='synthetic';process.env.HEYQUIZ_RESULT_EMAIL_ORIGIN='http://127.0.0.1:3199';
let outbound=0;global.fetch=async()=>{outbound++;throw Error('Outbound calls forbidden in recovery rehearsal');};
for(const protocol of ['node:http','node:https']){const client=require(protocol);for(const method of ['request','get'])client[method]=()=>{outbound++;throw Error('Outbound calls forbidden in recovery rehearsal');};}
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const originalLoad=Module._load;Module._load=function(name,parent,main){if(name==='next/headers')return{cookies:async()=>({get:()=>undefined})};return originalLoad.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,parent,main);};
const records=require('../lib/records.ts'),storage=require('../lib/storage.ts'),reports=require('../lib/result-reports.ts'),management=require('../lib/report-management.ts');
const attempts=require('../lib/attempts.ts'),auth=require('../lib/auth.ts'),email=require('../lib/result-email.ts'),emailConfig=require('../lib/result-email-config.ts');
const {submissionDeleted}=require('../lib/submission-lifecycle.ts');
const contacts=require('../lib/contacts.ts'),{FormSchema,FormThemeSchema}=require('../lib/schema.ts'),media=require('../app/api/media/[id]/route.ts');
const owner='synthetic-owner', other='synthetic-other', checkNames=[];
const ID=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), timestamp=z.number().finite().positive();
const contactSchema=z.object({email:z.email(),name:z.string().optional(),phone:z.string().optional(),marketingConsent:z.boolean(),recordedAt:z.iso.datetime(),consentText:z.string(),placement:z.enum(['before_results','after_results']),privacyUrl:z.string(),formRevision:z.number().int().nonnegative(),purposeText:z.string()}).strict();
const submissionSchema=z.object({id:ID,formId:ID,totalQuestions:z.number().int().nonnegative(),totalPointsPossible:z.number().nonnegative(),totalPointsEarned:z.number().nonnegative(),percentageScore:z.number().min(0).max(100),passed:z.boolean(),grading:z.array(z.unknown()),answers:z.record(z.string(),z.unknown()).optional(),contact:contactSchema.optional(),submittedAt:z.iso.datetime()}).strict();
const reportSchema=z.object({submissionId:ID,formId:ID,createdAt:z.iso.datetime(),expiresAt:timestamp,quizTitle:z.string(),theme:FormThemeSchema,heading:z.string(),message:z.string(),cta:z.object({label:z.string(),url:z.url()}).optional(),result:z.object({totalPointsEarned:z.number(),totalPointsPossible:z.number(),percentageScore:z.number()}).strict()}).strict();
const schemas={
  forms:FormSchema,published:FormSchema,
  attempts:z.object({form:FormSchema,startedAt:timestamp,expiresAt:timestamp,preview:z.boolean(),reached:z.array(ID),analyticsVersion:z.literal(1),lastSeenAt:timestamp,completed:z.boolean().optional(),completedAt:timestamp.optional(),result:submissionSchema.optional()}).strict(),
  submissions:submissionSchema,result_reports:reportSchema,
  submission_deletions:z.object({formId:ID,submissionId:ID,deletedAt:timestamp}).strict(),
  result_report_revocations:z.object({retiredAt:timestamp}).strict(),
  result_report_link_revocations:z.object({formId:ID,submissionId:ID,revokedAt:timestamp}).strict(),
  result_report_expirations:z.object({formId:ID,submissionId:ID,expiresAt:timestamp}).strict(),
  result_email_jobs:z.object({version:z.literal(1),formId:ID,responseId:ID,requestedAt:timestamp,requestVersion:z.literal(1),recipientBox:z.string().regex(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),recipientDigest:z.string().regex(/^[a-f0-9]{64}$/),copyBox:z.string().regex(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).optional(),state:z.literal('queued'),attempts:z.literal(0),nextAttemptAt:timestamp}).strict(),
  uploads:z.object({owner:ID,attemptId:ID.optional(),name:z.string(),mime:z.string(),size:z.number().int().positive(),public:z.boolean(),storagePath:z.string()}).strict(),
  meta:z.object({done:z.literal(true)}).strict(),
};
const envelope=z.object({format:z.literal('pippi-synthetic-recovery'),version:z.literal(1),createdAt:z.iso.datetime(),files:z.array(z.object({path:z.string().max(400),size:z.number().int().nonnegative().max(1024*1024),sha256:z.string().regex(/^[a-f0-9]{64}$/),data:z.string().max(2*1024*1024)}).strict()).min(1).max(1000),inventoryHash:z.string().regex(/^[a-f0-9]{64}$/),keyProof:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inventory=files=>JSON.stringify(files.map(({path,size,sha256})=>({path,size,sha256})));
const proof=(key,digest)=>crypto.createHmac('sha256',key).update('pippi-synthetic-recovery-v1:'+digest).digest('hex');
const resign=pack=>{pack.inventoryHash=hash(inventory(pack.files));pack.keyProof=proof(signingKey,pack.inventoryHash);return pack;};
function scoped(target){const relative=path.relative(sandbox,target);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('outside-synthetic-sandbox');}
function safePath(file){
 if(typeof file!=='string'||/[\\\x00-\x1f\x7f]/.test(file)||file.startsWith('/'))throw Error('invalid-path');
 const parts=file.split('/');if(parts.some(p=>!p||p==='.'||p==='..'))throw Error('invalid-path');
 if(parts[0]==='files'){if(parts.length!==3||![owner,other].includes(parts[1])||!ID.safeParse(parts[2]).success)throw Error('invalid-path');return;}
 if(parts.length!==2||!Object.hasOwn(schemas,parts[0])||!/^([A-Za-z0-9_-]{1,128})\.json$/.test(parts[1]))throw Error('unexpected-path');
}
function inventorySource(dir){
 scoped(dir);const names=[];
 function walk(where,parts=[]){const stat=fs.lstatSync(where);if(stat.isSymbolicLink())throw Error('symlink-rejected');if(!stat.isDirectory())throw Error('invalid-directory');
 for(const name of fs.readdirSync(where).sort()){const child=path.join(where,name),relative=[...parts,name],entry=fs.lstatSync(child);if(entry.isSymbolicLink())throw Error('symlink-rejected');
 if(entry.isDirectory()){if(relative.length===1&&!Object.hasOwn(schemas,name)&&name!=='files'||relative.length===2&&(relative[0]!=='files'||![owner,other].includes(name))||relative.length>2)throw Error('unexpected-directory');walk(child,relative);}
 else if(entry.isFile()){const file=relative.join('/');safePath(file);if(entry.size>1024*1024)throw Error('oversized-file');names.push(file);}else throw Error('invalid-file');}}
 walk(dir);return names.sort();
}
function bytesAt(dir,file){let where=dir;for(const segment of file.split('/')){where=path.join(where,segment);if(fs.lstatSync(where).isSymbolicLink())throw Error('symlink-rejected');}const fd=fs.openSync(where,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{return fs.readFileSync(fd);}finally{fs.closeSync(fd);}}
function validate(pack,key){
 const value=envelope.parse(pack),rows=new Map(),seen=new Set();let total=0;
 for(const entry of value.files){safePath(entry.path);if(seen.has(entry.path))throw Error('duplicate-path');seen.add(entry.path);
 const bytes=Buffer.from(entry.data,'base64');if(bytes.toString('base64')!==entry.data||bytes.length!==entry.size||hash(bytes)!==entry.sha256)throw Error('content-integrity');total+=bytes.length;if(total>8*1024*1024)throw Error('snapshot-too-large');
 if(entry.path.startsWith('files/'))continue;
 const row=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 z.object({kind:z.enum(Object.keys(schemas)),id:ID,owner_id:z.enum([owner,other]),version:z.number().int().positive(),payload:z.unknown()}).strict().parse(row);
 if(entry.path!==`${row.kind}/${row.id}.json`)throw Error('record-path-mismatch');schemas[row.kind].parse(row.payload);
 if(['forms','published','submissions'].includes(row.kind)&&row.payload.id!==row.id)throw Error('record-id-mismatch');
 if(row.kind==='result_reports'&&(row.id!=='result-'+row.payload.submissionId||row.payload.expiresAt!==Date.parse(row.payload.createdAt)+reports.RESULT_REPORT_LIFETIME))throw Error('invalid-report-linkage');
 if(row.kind==='submission_deletions'&&row.id!==hash(JSON.stringify([row.owner_id,row.payload.formId,row.payload.submissionId])))throw Error('invalid-submission-deletion-linkage');
 if(row.kind==='uploads'&&(row.owner_id!==row.payload.owner||row.payload.storagePath!==`${row.owner_id}/${row.id}`))throw Error('invalid-media-linkage');
 rows.set(entry.path,row);
 }
 for(const row of rows.values()){if(row.kind!=='uploads')continue;const bytes=value.files.find(entry=>entry.path===`files/${row.owner_id}/${row.id}`);if(!bytes||bytes.size!==row.payload.size)throw Error('incomplete-media');}
 for(const entry of value.files){if(!entry.path.startsWith('files/'))continue;const[,who,id]=entry.path.split('/');if(rows.get(`uploads/${id}.json`)?.owner_id!==who)throw Error('orphan-media');}
 if(hash(inventory(value.files))!==value.inventoryHash)throw Error('inventory-integrity');
 const expected=Buffer.from(proof(key,value.inventoryHash),'hex'),actual=Buffer.from(value.keyProof,'hex');if(!crypto.timingSafeEqual(expected,actual))throw Error('signing-key-mismatch');
 return value;
}
function snapshot(dir){
 const names=inventorySource(dir),files=names.map(file=>{const bytes=bytesAt(dir,file);return{path:file,size:bytes.length,sha256:hash(bytes),data:bytes.toString('base64')};});
 // The app must be stopped. This extra consistency pass detects the tested
 // changed inventory/bytes cases; it is not an online transaction or lock.
 assert.deepEqual(inventorySource(dir),names);for(const entry of files)if(hash(bytesAt(dir,entry.path))!==entry.sha256)throw Error('source-changed');
 return validate(resign({format:'pippi-synthetic-recovery',version:1,createdAt:new Date().toISOString(),files}),signingKey);
}
function restore(pack,destination,key){
 const validated=validate(pack,key);scoped(destination);
 let ancestor=path.dirname(destination);while(ancestor!==sandbox){if(fs.lstatSync(ancestor).isSymbolicLink())throw Error('symlink-rejected');ancestor=path.dirname(ancestor);}
 if(fs.existsSync(destination)||fs.lstatSync(path.dirname(destination)).isSymbolicLink())throw Error('destination-exists');
 // Only new, test-owned destinations. Failure never deletes/replaces an existing
 // workspace. This harness is not an atomic production volume-swap facility.
 fs.mkdirSync(destination,{mode:0o700});
 try{for(const entry of validated.files){const filename=path.join(destination,entry.path);fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});fs.writeFileSync(filename,Buffer.from(entry.data,'base64'),{flag:'wx',mode:0o600});}
 assert.deepEqual(inventorySource(destination),validated.files.map(entry=>entry.path).sort());for(const entry of validated.files)assert.equal(hash(bytesAt(destination,entry.path)),entry.sha256);
 }catch(error){fs.rmSync(destination,{recursive:true,force:true});throw error;}
 return destination;
}
async function check(name,fn){await fn();checkNames.push(name);console.log('PASS '+name);}
function alterRecord(pack,kind,change){const copy=structuredClone(pack),entry=copy.files.find(x=>x.path.startsWith(kind+'/')),row=JSON.parse(Buffer.from(entry.data,'base64'));change(row);const bytes=Buffer.from(JSON.stringify(row));Object.assign(entry,{data:bytes.toString('base64'),size:bytes.length,sha256:hash(bytes)});return resign(copy);}
(async()=>{try{
 const base=FormSchema.parse({id:'synthetic-main',title:'Draft v1',mode:'quiz',resultEmailCopy:{version:1,subject:'Recovery for {quiz_title}',introduction:'Frozen recovery copy for {quiz_title}',signOff:'From {brand_name}'},questions:[{id:'q1',type:'multiple_choice',title:'Pick a starting point',points:10,options:[{id:'a',label:'A',isCorrect:true},{id:'b',label:'B'}]}],endingPage:{title:'Frozen result',message:'An original practical next step'},capture:{...contacts.defaultCapture,enabled:true,required:true}});
 let draft=await storage.saveForm(base,owner);await storage.publishForm({...draft,publishedAt:new Date(Date.now()-2000).toISOString()},owner);
 draft=await storage.saveForm({...draft,title:'Published v2'},owner);await storage.publishForm({...draft,publishedAt:new Date(Date.now()-1000).toISOString()},owner);
 const published=(await records.readRecord('published',base.id)).payload;draft=await storage.saveForm({...draft,title:'Private draft v3'},owner);
 await records.writeRecord('meta','seed',owner,{done:true},0);
 async function complete(form=published,who=owner,age=0){const opened=await attempts.createAttempt(form,who,false);const id=auth.verifyToken(opened.token).id;
 const contact=contacts.parseContact(form.capture,{email:'contact@example.test',name:'Synthetic participant',marketingConsent:false},form.revision);
 const result={id,formId:form.id,totalQuestions:1,totalPointsPossible:10,totalPointsEarned:5,percentageScore:50,passed:false,grading:[],answers:{q1:'b'},contact,submittedAt:new Date(Date.now()-age).toISOString()};
 await records.writeRecord('submissions',id,who,result,0);const row=await records.readRecord('attempts',id);await records.writeRecord('attempts',id,who,{...row.payload,completed:true,completedAt:Date.now(),result},row.version);return{token:opened.token,row:await records.readRecord('attempts',id)};}
 const active=await attempts.createAttempt(published,owner,false),activeId=auth.verifyToken(active.token).id;const activeRow=await records.readRecord('attempts',activeId);await records.writeRecord('attempts',activeId,owner,{...activeRow.payload,reached:['q1']},activeRow.version);
 const good=await complete(),individual=await complete(),deleted=await complete(),expired=await complete(published,owner,reports.RESULT_REPORT_LIFETIME+10000);
 const goodLink=await reports.issueResultReport(good.row),revokedLink=await reports.issueResultReport(individual.row),deletedLink=await reports.issueResultReport(deleted.row);
 await records.writeRecord('result_reports','result-'+expired.row.id,owner,reports.makeResultReport(published,expired.row.payload.result,expired.row.id),0);
 const oldForm=await storage.saveForm(FormSchema.parse({...base,id:'synthetic-retired',title:'Retired quiz'}),owner);await storage.publishForm({...oldForm,publishedAt:new Date(Date.now()-3000).toISOString()},owner);
 const retiring=await complete((await records.readRecord('published',oldForm.id)).payload),retiredLink=await reports.issueResultReport(retiring.row);
 const foreign=await storage.saveForm(FormSchema.parse({...base,id:'synthetic-foreign'}),other);await complete({...foreign,publishedAt:new Date().toISOString()},other);
 await email.requestResultEmail(good.row,'recipient@example.test',true);const jobId=email.resultEmailJobId(owner,base.id,good.row.id);
 const fileId=crypto.randomUUID(),fileBytes=Buffer.from('Synthetic attachment bytes\nOnly local recovery evidence.');
 fs.mkdirSync(path.join(source,'files',owner),{recursive:true,mode:0o700});fs.writeFileSync(path.join(source,'files',owner,fileId),fileBytes,{mode:0o600});
 await records.writeRecord('uploads',fileId,owner,{owner,attemptId:activeId,name:'synthetic.txt',mime:'text/plain',size:fileBytes.length,public:false,storagePath:`${owner}/${fileId}`},0);
 const mediaToken=auth.signToken({uploadId:fileId,exp:Date.now()+86400000});
 const stale=snapshot(source);
 await management.revokeResultLink(base.id,owner,individual.row.id);await storage.deleteSubmission(deleted.row.id,base.id,owner);await storage.deleteForm(oldForm.id,owner);assert.equal((await management.cleanExpiredResultCopies(base.id,owner)).removed,1);
 const pack=snapshot(source),target=path.join(sandbox,'restored'),serialized=JSON.stringify(pack);
 await check('snapshot excludes signing secret and plaintext queued recipient; pending copy stays encrypted',async()=>{assert.ok(!serialized.includes(signingKey));for(const entry of pack.files){const raw=Buffer.from(entry.data,'base64').toString('utf8');assert.ok(!raw.includes(signingKey));assert.ok(!raw.includes('recipient@example.test'));}assert.equal((await records.readRecord('result_email_jobs',jobId)).payload.state,'queued');assert.equal((await records.listRecords('result_email_tests')).length,0);});
 await check('new-directory restore preserves every raw record version, path, byte and media hash',async()=>{restore(JSON.parse(serialized),target,signingKey);assert.deepEqual(inventorySource(target),inventorySource(source));for(const file of inventorySource(source))assert.deepEqual(bytesAt(target,file),bytesAt(source,file));process.env.HEYQUIZ_DATA_DIR=target;});
 await check('actual draft and published readers retain separate revisions and titles',async()=>{assert.equal((await storage.getFormById(base.id)).title,'Private draft v3');assert.equal((await storage.getFormById(base.id)).revision,3);assert.equal((await records.readRecord('published',base.id)).version,2);assert.equal((await storage.getPublishedForm(base.id)).title,'Published v2');});
 await check('old active attempt capability resumes frozen form, reach, owner and original expiry',async()=>{const row=await attempts.getAttempt(active.token,base.id);assert.equal(row.id,activeId);assert.equal(row.owner_id,owner);assert.deepEqual(row.payload.reached,['q1']);assert.equal(row.payload.form.title,'Published v2');assert.equal(row.payload.expiresAt,active.attempt.expiresAt);await assert.rejects(attempts.getAttempt(active.token,'another-form'));});
 await check('actual contact exports preserve responses, consent and owner isolation',async()=>{const rows=await storage.getSubmissionsByFormId(base.id,owner);const exported=contacts.contactExportRows(rows);assert.ok(exported.some(row=>row.email==='contact@example.test'&&row.marketingConsent===false&&row.score===50));assert.ok(rows.every(row=>row.formId===base.id));assert.equal((await storage.getSubmissionsByFormId(base.id,other)).length,0);assert.ok(contacts.contactsCsv(exported).includes('consentText'));});
 await check('existing signed result stays frozen; revoked, deleted and retired links stay denied',async()=>{const report=await reports.readResultReport(goodLink.path.split('/').pop());assert.equal(report.quizTitle,'Published v2');assert.equal(report.result.percentageScore,50);assert.ok(!JSON.stringify(report).includes('contact@example.test'));for(const link of[revokedLink,deletedLink,retiredLink])assert.equal(await reports.readResultReport(link.path.split('/').pop()),null);await assert.rejects(reports.issueResultReport(individual.row),e=>e.status===410);await assert.rejects(reports.issueResultReport(deleted.row),e=>e.status===404);assert.equal(await submissionDeleted(base.id,owner,deleted.row.id),true);const deletionReceipts=await records.listRecords('submission_deletions',owner);assert.equal(deletionReceipts.length,1);assert.deepEqual(Object.keys(deletionReceipts[0].payload).sort(),['deletedAt','formId','submissionId']);assert.equal(deletionReceipts[0].payload.submissionId,deleted.row.id);});
 await check('durable retirement and expiry receipts survive same-ID recreation and expired replay',async()=>{await storage.saveForm({...oldForm,revision:0},owner);assert.equal(await reports.readResultReport(retiredLink.path.split('/').pop()),null);await assert.rejects(reports.issueResultReport(retiring.row),e=>e.status===410);await assert.rejects(reports.issueResultReport(expired.row),e=>e.status===410);assert.equal(await records.readRecord('result_reports','result-'+expired.row.id),null);assert.equal((await records.listRecords('result_report_expirations',owner)).length,1);assert.equal((await records.listRecords('result_report_link_revocations',owner)).length,1);assert.equal((await records.listRecords('result_report_revocations',owner)).length,1);});
 await check('private media consumer reads identical bytes and original private headers',async()=>{const response=await media.GET(new Request(`http://127.0.0.1/api/media/${fileId}?token=${mediaToken}`),{params:Promise.resolve({id:fileId})});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),fileBytes);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');});
 await check('encrypted pending job opens only with original key and has not delivered or prepared',async()=>{const row=await records.readRecord('result_email_jobs',jobId);assert.equal(row.payload.state,'queued');assert.equal(row.payload.attempts,0);assert.equal(emailConfig.openResultEmail(row.payload.recipientBox,`${owner}:${jobId}:recipient`).email,'recipient@example.test');assert.ok(row.payload.copyBox);const copy=emailConfig.openResultEmail(row.payload.copyBox,`${owner}:${jobId}:copy:v1`);assert.equal(copy.renderingVersion,'1');assert.equal(copy.subject,'Recovery for Published v2');assert.equal(copy.introduction,'Frozen recovery copy for Published v2');assert.ok(!JSON.stringify(row).includes(copy.introduction));assert.throws(()=>emailConfig.openResultEmail(row.payload.copyBox,`${owner}:${jobId}:recipient`));assert.equal((await email.resultEmailStatus(good.row)).state,'queued');assert.equal((await records.listRecords('result_email_tests')).length,0);process.env.SESSION_SECRET=crypto.randomBytes(32).toString('base64url');assert.throws(()=>emailConfig.openResultEmail(row.payload.recipientBox,`${owner}:${jobId}:recipient`));assert.throws(()=>emailConfig.openResultEmail(row.payload.copyBox,`${owner}:${jobId}:copy:v1`));assert.equal(await reports.readResultReport(goodLink.path.split('/').pop()),null);await assert.rejects(attempts.getAttempt(active.token,base.id));process.env.SESSION_SECRET=signingKey;});
 const sentinel=path.join(sandbox,'existing');fs.mkdirSync(sentinel);fs.writeFileSync(path.join(sentinel,'sentinel.txt'),'Existing destination must remain untouched');
 const preserved=()=>assert.equal(fs.readFileSync(path.join(sentinel,'sentinel.txt'),'utf8'),'Existing destination must remain untouched');
 await check('valid snapshot never overwrites an existing destination',async()=>{assert.throws(()=>restore(pack,sentinel,signingKey),/destination-exists/);preserved();});
 const attacks=[
 ['modified-bytes',()=>{const p=structuredClone(pack);p.files[0].data=Buffer.from('corrupt').toString('base64');return p;}],
 ['missing-file',()=>{const p=structuredClone(pack);p.files.pop();return p;}],
 ['duplicate-file',()=>{const p=structuredClone(pack);p.files.push(p.files[0]);return resign(p);}],
 ['path-traversal',()=>{const p=structuredClone(pack);p.files[0].path='../escape.json';return resign(p);}],
 ['unexpected-env-path',()=>{const p=structuredClone(pack);p.files[0].path='.env.local';return resign(p);}],
 ['invalid-format-version',()=>({...structuredClone(pack),version:2})],
 ['unknown-envelope-field',()=>({...structuredClone(pack),extra:'unexpected'})],
 ['invalid-record-version',()=>alterRecord(pack,'forms',row=>row.version=-1)],
 ['record-owner-mismatch',()=>alterRecord(pack,'uploads',row=>row.owner_id=other)],
 ['submission-deletion-linkage',()=>alterRecord(pack,'submission_deletions',row=>row.payload.submissionId='different-response')],
 ['submission-deletion-unexpected-data',()=>alterRecord(pack,'submission_deletions',row=>row.payload.email='private@example.test')],
 ['malformed-form-schema',()=>alterRecord(pack,'forms',row=>row.payload.questions[0].type='not-a-question-type')],
 ['incomplete-media',()=>{const p=structuredClone(pack);p.files=p.files.filter(x=>!x.path.startsWith('files/'));return resign(p);}],
 ];
 for(const[name,mutate]of attacks)await check('reject '+name+' before destination mutation',async()=>{const invalid=mutate(),fresh=path.join(sandbox,'rejected-'+name);assert.throws(()=>restore(invalid,fresh,signingKey));assert.ok(!fs.existsSync(fresh));assert.throws(()=>restore(invalid,sentinel,signingKey));preserved();assert.deepEqual(fs.readdirSync(sentinel),['sentinel.txt']);});
 await check('wrong signing configuration rejected before a restore directory exists',async()=>{const target=path.join(sandbox,'wrong-key');assert.throws(()=>restore(pack,target,'different-synthetic-signing-key-32-characters'),/signing-key-mismatch/);assert.ok(!fs.existsSync(target));preserved();});
 await check('unexpected source files and unfinished writer locks are refused without reading them',async()=>{const extra=path.join(source,'forms','unexpected.tmp');fs.writeFileSync(extra,'synthetic unfinished write');assert.throws(()=>snapshot(source),/unexpected-path/);fs.unlinkSync(extra);const lock=path.join(source,'forms','synthetic-main.lock');fs.mkdirSync(lock);assert.throws(()=>snapshot(source),/unexpected-directory/);fs.rmdirSync(lock);});
 await check('source and destination symlinks are rejected with original targets unchanged',async()=>{const link=path.join(source,'forms','linked.json');fs.symlinkSync(path.join(sentinel,'sentinel.txt'),link);assert.throws(()=>snapshot(source),/symlink-rejected/);fs.unlinkSync(link);const destination=path.join(sandbox,'symlink-target');fs.symlinkSync(sentinel,destination);assert.throws(()=>restore(pack,destination,signingKey),/destination-exists/);preserved();assert.ok(fs.lstatSync(destination).isSymbolicLink());});
 await check('stale backup cannot know later revocation: explicit demonstrated rollback limitation',async()=>{const old=path.join(sandbox,'stale-restore');restore(stale,old,signingKey);process.env.HEYQUIZ_DATA_DIR=old;assert.ok(await reports.readResultReport(revokedLink.path.split('/').pop()),'An older snapshot lacks the later receipt; do not deploy it as revocation-safe');process.env.HEYQUIZ_DATA_DIR=target;assert.equal(await reports.readResultReport(revokedLink.path.split('/').pop()),null);});
 assert.equal(outbound,0);
 const evidence=path.resolve(process.env.ARTIFACT_DIR||'../pippi-overnight-2026-10-12/compiled-verification-batch-11/recovery');fs.mkdirSync(evidence,{recursive:true});
 fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify({passed:true,checks:checkNames,files:pack.files.length,recordFiles:pack.files.filter(f=>!f.path.startsWith('files/')).length,mediaFiles:pack.files.filter(f=>f.path.startsWith('files/')).length,bytes:pack.files.reduce((n,f)=>n+f.size,0),outboundCalls:outbound,rawSnapshotsRetained:false,productionToolAdded:false},null,2));
 console.log(`PASS local recovery rehearsal: ${checkNames.length} groups, ${pack.files.length} files; synthetic data removed, zero outbound calls.`);
 }finally{Module._load=originalLoad;fs.rmSync(sandbox,{recursive:true,force:true});}})().catch(()=>{console.error('FAIL local recovery rehearsal; no record or token contents logged.');process.exitCode=1;});
