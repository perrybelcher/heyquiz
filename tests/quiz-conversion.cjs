const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {FormSchema}=require('../lib/schema.ts');
const {previewQuizConversion}=require('../lib/quiz-conversion.ts');
const {convertOwnedQuiz}=require('../lib/quiz-conversion-service.ts');
const {saveForm,ownedForm}=require('../lib/storage.ts');
const {validateMarketing}=require('../lib/marketing.ts');
const env=['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','HEYQUIZ_DATA_DIR'];const before=Object.fromEntries(env.map(k=>[k,process.env[k]]));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pippi-conversion-'));
for(const k of env)delete process.env[k];process.env.HEYQUIZ_DATA_DIR=dir;
(async()=>{
 try{
  const source=FormSchema.parse({id:'original',title:'Product',quizType:'product_finder',mode:'survey',questions:[{id:'q',type:'multiple_choice',title:'Choose',options:[{id:'a',label:'A'},{id:'b',label:'B'}]}],marketing:{kind:'product_finder',outcomes:[{id:'one',title:'One'}],rules:[{id:'r',questionId:'q',answerId:'a',targetId:'one',points:1},{id:'x',questionId:'q',answerId:'b',targetId:'one',effect:'exclude'}]},publishedAt:'past'});
  const snapshot=JSON.stringify(source);const preview=previewQuizConversion(source,'diagnostic');assert.equal(JSON.stringify(source),snapshot);assert.notEqual(preview.form.id,source.id);assert.equal(preview.form.publishedAt,undefined);assert.equal(preview.form.marketing.rules.length,1);assert.equal(preview.form.questions[0].options[0].id,'a');assert.equal(preview.form.conversionReview.required,true);assert.throws(()=>validateMarketing(preview.form,true));assert.ok(preview.changes.some(s=>s.includes('exclusion')));
  const qualification=previewQuizConversion(source,'qualification').form;assert.equal(qualification.marketing.rules.length,0);assert.equal(qualification.marketing.qualificationRules,undefined);assert.equal(qualification.meta,undefined);assert.equal(qualification.tracking,undefined);
  let saved=await saveForm(source,'owner');
  const request={action:'create',targetType:'diagnostic',sourceRevision:saved.revision,idempotencyKey:'request-one'};
  await assert.rejects(()=>convertOwnedQuiz('stranger',source.id,request),e=>e.status===404);
  await assert.rejects(()=>convertOwnedQuiz('owner',source.id,{...request,sourceRevision:99}),e=>e.status===409);
  const [a,b]=await Promise.all([convertOwnedQuiz('owner',source.id,request),convertOwnedQuiz('owner',source.id,request)]);assert.equal(a.form.id,b.form.id);assert.equal(a.form.revision,1);
  saved=await saveForm({...saved,title:'Changed after conversion'},'owner');
  assert.equal((await convertOwnedQuiz('owner',source.id,request)).form.id,a.form.id);
  await assert.rejects(()=>convertOwnedQuiz('owner',source.id,{...request,targetType:'personality'}),e=>e.status===409);
  await assert.rejects(()=>convertOwnedQuiz('owner',source.id,{...request,idempotencyKey:'new-request'}),e=>e.status===409);
  await assert.rejects(()=>saveForm({...saved,quizType:'personality',marketing:{...saved.marketing,kind:'segmentation',rules:[]}},'owner'));
  const legacy=await saveForm(FormSchema.parse({id:'legacy',title:'Legacy',mode:'quiz'}),'owner');await assert.rejects(()=>saveForm({...legacy,quizType:'knowledge'},'owner'));
  assert.equal((await ownedForm(source.id,'owner')).title,'Changed after conversion');
  console.log('PASS copy conversion, source preservation, exclusions, review gate, stale revisions, concurrent idempotency retries and owner/identity protection');
 }finally{for(const k of env)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
