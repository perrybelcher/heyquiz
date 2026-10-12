/* Literal report-design tests independent of renderer-generated expectations. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { FormSchema } = require('../lib/schema.ts');
const { ReportDesignSchema, safeReportUrl } = require('../lib/report-design.ts');
const { makeResultReport } = require('../lib/result-reports.ts');
const { publicForm } = require('../lib/engine.ts');
const { buildResultPdfModel: build } = require('../lib/result-pdf-model.ts');
let groups = 0;
const test = (name, run) => { run(); groups++; console.log('PASS ' + name); };
const choices = ['priorities','reasons','advice','details','action'];
function design(extra = {}) { return { version: 1, style: 'editorial', cover: false, title: 'Original report title', subtitle: 'A calm next step', introduction: 'Read this at your own pace.\nKeep what helps.', footer: 'Prepared for your own reflection.', sections: [...choices], ...extra }; }
function base() { return { submissionId: 'PRIVATE-response', formId: 'PRIVATE-form', createdAt: '2026-10-12T06:00:00.000Z', expiresAt: 1794463200000, quizTitle: 'Original quiz title', theme: { primaryColor: '#922c3b', brandName: 'Original Studio' }, heading: 'Saved result', message: 'Original result narrative.', cta: { label: 'Original next step', url: 'https://example.test/original' }, result: { totalPointsEarned: 6, totalPointsPossible: 8, percentageScore: 74.5 } }; }
function scorecard(extra = {}) {
 const report = base();
 report.result.marketing = { kind: 'scorecard', status: 'scored', presentation: { layout: 'action_plan' }, title: 'Your saved assessment', message: 'Your answers identify a useful starting point.', overallScore: null,
  reasons: ['REASON: protect one block of time.'], advice: 'ADVICE: choose one small habit.', priorities: [{ categoryId: 'PRIVATE-priority', title: 'Planning first', action: 'PRIORITY: schedule ten minutes.' }], ctaLabel: 'Original main action', ctaUrl: 'https://example.test/main',
  categories: [
   { id: 'PRIVATE-zero', title: 'Planning', description: 'CATEGORY: planning description.', score: 0, answered: 1, applicable: 2, minAnswers: 1, bandTitle: 'First step', advice: 'CATEGORY: planning guidance.' },
   { id: 'PRIVATE-full', title: 'Confidence', description: 'CATEGORY: confidence description.', score: 100, answered: 2, applicable: 2, minAnswers: 1, bandTitle: 'Keep it', advice: 'CATEGORY: confidence guidance.' },
   { id: 'PRIVATE-null', title: 'Support', description: 'CATEGORY: support description.', score: null, answered: 1, applicable: 3, minAnswers: 2, advice: 'CATEGORY: ask one more question.' },
  ], resultSections: [
   { id: 'PRIVATE-section-a', type: 'faq', title: 'DETAIL: Why start small?', body: 'DETAIL: One habit is easier to review.', label: '', url: '', condition: { type: 'always' } },
   { id: 'PRIVATE-section-b', type: 'cta', title: 'DETAIL: Separate resource', body: 'DETAIL: A resource description.', label: 'Secondary resource', url: 'https://example.test/secondary' },
  ], ...extra };
 return report;
}
const content = model => model.blocks.map(block => block.text ?? block.label ?? '');
function ordered(model, wanted) { const text = content(model); let previous = -1; for (const value of wanted) { const next = text.indexOf(value, previous + 1); assert.ok(next > previous, 'Literal block missing/out of order: ' + value); previous = next; } }
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('unconfigured legacy graded model remains the exact earlier shape and stored percentage', () => {
 assert.deepEqual(build(base()), { title: 'Original quiz title', brandName: 'Original Studio', hideBranding: false, createdAt: '2026-10-12T06:00:00.000Z', layout: 'stacked', accent: '#922c3b', blocks: [
  { kind: 'heading', text: 'Saved result', level: 1 }, { kind: 'paragraph', text: 'Original result narrative.' }, { kind: 'score', label: 'Score', value: 74.5 }, { kind: 'label', text: '6 of 8 points' }, { kind: 'link', label: 'Original next step', url: 'https://example.test/original' },
 ] });
});
test('strict versioned schema rejects unknown fields, duplicate groups, unsupported controls and limits', () => {
 assert.ok(ReportDesignSchema.safeParse(design()).success);
 for (const value of [design({version:2}),design({sections:['advice','advice']}),design({sections:['scores']}),design({hideScores:true}),design({title:'x'.repeat(141)}),design({subtitle:'x'.repeat(241)}),design({introduction:'x'.repeat(2001)}),design({footer:'x'.repeat(161)}),design({title:'x\nInjected'}),design({introduction:'x\u202eInjected'}),design({title:'bad\ud800'}),design({cta:{label:'Go',url:'https://example.test',tracking:true}})]) assert.equal(ReportDesignSchema.safeParse(value).success,false);
 assert.ok(ReportDesignSchema.safeParse(design({introduction:'First paragraph.\n\nSecond paragraph.'})).success);
});
test('custom CTA refuses capabilities, credentials and active/control/ambiguous URLs', () => {
 for(const url of ['javascript:alert(1)','data:text/html,unsafe','https://user:pass@example.test/go','https://example.test/a\\b','https://example.test/a%0ab','https://example.test/result/abc.signature','https://example.test/%72esult/abc.signature','https://example.test/go?next=/result/abc.signature','/relative']) {
  assert.equal(safeReportUrl(url),null); assert.equal(ReportDesignSchema.safeParse(design({cta:{label:'Go',url}})).success,false);
 }
 assert.equal(safeReportUrl('https://example.test/useful?q=one#two'),'https://example.test/useful?q=one#two');
});
test('every optional-group subset preserves literal mandatory facts and category guidance', () => {
 for(let mask=0;mask<32;mask++){
  const report=scorecard();report.reportDesign=design({sections:choices.filter((_,i)=>mask&(1<<i))});const model=build(freeze(report));
  assert.deepEqual(model.blocks.filter(b=>b.kind==='score').map(b=>b.value),[null,0,100,null]);
  ordered(model,['Your assessment','Your saved assessment','Your answers identify a useful starting point.','Overall score','Planning','CATEGORY: planning description.','First step','CATEGORY: planning guidance.','1 of 2 applicable questions scored','Confidence','CATEGORY: confidence description.','2 of 2 applicable questions scored','Support','CATEGORY: support description.','CATEGORY: ask one more question.','1 of 3 applicable questions scored · 2 needed']);
  const words=content(model).join('\n');for(const [key,marker]of [['priorities','PRIORITY:'],['reasons','REASON:'],['advice','ADVICE:'],['details','DETAIL:'],['action','Original main action']]) assert.equal(words.includes(marker),report.reportDesign.sections.includes(key),key);
 }
});
test('configured supporting order is literal and secondary section links remain independent', () => {
 const report=scorecard();report.reportDesign=design({sections:['action','details','reasons','advice','priorities'],cta:{label:'Custom main action',url:'https://example.test/custom'}});const before=JSON.stringify(report),model=build(report);
 ordered(model,['Support','Custom main action','DETAIL: Why start small?','DETAIL: One habit is easier to review.','DETAIL: Separate resource','Secondary resource','Why this fits','REASON: protect one block of time.','A useful first step','ADVICE: choose one small habit.','Your next priorities','PRIORITY: schedule ten minutes.']);
 assert.deepEqual(model.blocks.filter(b=>b.kind==='link').map(b=>[b.label,b.url]),[['Custom main action','https://example.test/custom'],['Secondary resource','https://example.test/secondary']]);
 assert.equal(JSON.stringify(report),before); assert.equal(report.result.marketing.ctaUrl,'https://example.test/main');
});
test('custom metadata is explicit; empty title uses the frozen quiz title and cannot change scoring',()=>{
 const report=base();report.reportDesign=design({style:'executive',cover:true,title:'   '});const model=build(report);
 assert.equal(model.title,'Original quiz title');assert.deepEqual(model.design,{style:'executive',cover:true,subtitle:'A calm next step',introduction:'Read this at your own pace.\nKeep what helps.',footer:'Prepared for your own reflection.',quizTitle:'Original quiz title'});
 assert.deepEqual(model.blocks.filter(b=>b.kind==='score').map(b=>b.value),[74.5]);assert.ok(content(model).includes('6 of 8 points'));
});
test('legacy marketing layouts retain earlier ordering when no design exists',()=>{
 const report=scorecard();const model=build(report);assert.equal(model.design,undefined);assert.equal(model.layout,'action_plan');
 ordered(model,['Your saved assessment','A useful first step','Your next priorities','Original main action','How your answers shaped this','Overall score','Why this fits','Planning','Confidence','Support','DETAIL: Why start small?']);
});
test('null, zero, no-match and unscored survey remain distinct under customization',()=>{
 for(const overall of [null,0,100]){const r=scorecard({overallScore:overall});r.reportDesign=design({sections:[]});assert.equal(build(r).blocks.find(b=>b.kind==='score').value,overall);}
 const survey=base();survey.result={totalPointsEarned:0,totalPointsPossible:0,percentageScore:100};survey.reportDesign=design({sections:[]});assert.equal(build(survey).blocks.some(b=>b.kind==='score'),false);
 const unmatched=scorecard({kind:'product_finder',status:'no_match',title:'No suitable match',message:'You can leave without choosing.',categories:[],overallScore:undefined,priorities:[],reasons:[]});unmatched.reportDesign=design({sections:[]});const m=build(unmatched);ordered(m,['Your recommendation','No suitable match','You can leave without choosing.']);assert.equal(m.blocks.some(b=>b.kind==='score'),false);
});
test('report snapshots clone design from the attempt form and exclude private data/public projection',()=>{
 const form=FormSchema.parse({id:'PRIVATE-form',title:'Original quiz title',mode:'quiz',theme:{brandName:'Original Studio'},questions:[],reportDesign:design(),endingPage:{title:'Saved result',message:'Original result narrative.'}});
 const submitted={id:'PRIVATE-response',formId:form.id,submittedAt:'2026-10-12T06:00:00.000Z',totalPointsEarned:6,totalPointsPossible:8,percentageScore:74.5,answers:{note:'PRIVATE-RAW-ANSWER'},contact:{email:'private@example.test'},grading:[{userAnswer:'PRIVATE-GRADING'}]};
 const report=makeResultReport(form,submitted,submitted.id);assert.deepEqual(report.reportDesign,design());
 form.reportDesign.title='Later draft';form.reportDesign.sections.reverse();form.theme.brandName='Later brand';form.title='Later quiz';
 assert.equal(report.reportDesign.title,'Original report title');assert.deepEqual(report.reportDesign.sections,choices);assert.equal(build(report).brandName,'Original Studio');assert.equal(build(report).title,'Original report title');
 for(const marker of ['private@example.test','PRIVATE-RAW-ANSWER','PRIVATE-GRADING'])assert.ok(!JSON.stringify(report).includes(marker));
 assert.equal(publicForm(form).reportDesign,undefined);
 const legacy=FormSchema.parse({id:'legacy',title:'Legacy',mode:'survey',questions:[]});assert.equal(makeResultReport(legacy,{...submitted,formId:'legacy'},submitted.id).reportDesign,undefined);
});
test('corrupt stored designs fail closed; internal IDs and private metadata never enter composed model',()=>{
 const report=scorecard();report.reportDesign=design({sections:['details']});report.contact={email:'PRIVATE-CONTACT'};report.answers={x:'PRIVATE-ANSWER'};report.result.grading='PRIVATE-GRADING';report.theme.logoUrl='http://169.254.169.254/private-image';
 const model=build(report);assert.ok(!JSON.stringify(model).includes('PRIVATE-'));assert.ok(!JSON.stringify(model).includes('169.254'));
 report.reportDesign=design({sections:['unknown']});assert.throws(()=>build(report),error=>error.code==='invalid_report'&&error.status===422);
});

async function rendering() {
 if(process.env.REPORT_CUSTOMIZATION_RENDER!=='1'){console.log('Native rendering not requested; model/snapshot assertions only.');return;}
 const {renderResultPdf}=require('../lib/result-pdf.ts');const dir=process.env.REPORT_CUSTOMIZATION_ARTIFACT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'pippi-report-independent-'));fs.mkdirSync(dir,{recursive:true});
 const originalFetch=global.fetch;global.fetch=()=>{throw new Error('Report renderer attempted network');};
 const transports=['node:http','node:https'].map(id=>{const t=require(id),old={get:t.get,request:t.request};t.get=t.request=()=>{throw new Error('Report renderer attempted network');};return[t,old];});
 const python=process.env.PDF_TEST_PYTHON||'/Users/perry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
 try{
  for(const [style,cover]of [['editorial',false],['editorial',true],['executive',false],['executive',true]]){
   const report=scorecard();report.reportDesign=design({style,cover,sections:['details','action'],cta:{label:'Custom main action',url:'https://example.test/custom'}});report.theme.logoUrl='http://169.254.169.254/must-not-fetch';report.theme.brandName='Original Studio';
   const before=JSON.stringify(report),bytes=await renderResultPdf(report);assert.equal(JSON.stringify(report),before);assert.ok(bytes.length<3*1024*1024);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
   const target=path.join(dir,`${style}-${cover?'cover':'inline'}.pdf`);fs.writeFileSync(target,bytes);
   const py="import json,sys\nfrom pypdf import PdfReader\nimport pdfplumber\nr=PdfReader(sys.argv[1]); pages=[p.extract_text() for p in r.pages];links=[];bad=[]\nfor p in r.pages:\n for a in p.get('/Annots',[]):\n  v=a.get_object().get('/A',{}).get('/URI');\n  if v: links.append(str(v))\nwith pdfplumber.open(sys.argv[1]) as d:\n for i,p in enumerate(d.pages):\n  for c in p.chars:\n   if c['text'].strip() and (c['x0']<35 or c['x1']>p.width-35 or c['top']<16 or c['bottom']>p.height-16): bad.append({'page':i+1,'x':c['x0'],'y':c['top']})\nprint(json.dumps({'pages':pages,'links':links,'bad':bad,'metadata':{str(k):str(v) for k,v in r.metadata.items()}}))";
   const run=spawnSync(python,['-c',py,target],{encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(run.status,0,'PDF inspection must run');const parsed=JSON.parse(run.stdout),text=parsed.pages.join('\n');
   for(const expected of ['Original report title','A calm next step','Read this at your own pace.','Your saved assessment','0%','100%','Not enough information','1 of 3 applicable questions scored','2 needed','CATEGORY: planning guidance.','DETAIL: One habit is easier to review.','Prepared for your own reflection.'])assert.ok(text.includes(expected),'Native PDF missing literal: '+expected);
   for(const excluded of ['PRIORITY:','REASON:','ADVICE:','PRIVATE-','169.254'])assert.ok(!JSON.stringify(parsed).includes(excluded),'Native PDF exposed excluded data');
   assert.equal(text.split('Prepared for your own reflection.').length-1,1);assert.deepEqual(parsed.links,['https://example.test/secondary','https://example.test/custom']);assert.deepEqual(parsed.bad,[],'Visible glyphs stay inside page bounds');if(cover)assert.ok(parsed.pages.length>=2,'Cover is separate');
   fs.writeFileSync(path.join(dir,`${style}-${cover?'cover':'inline'}.json`),JSON.stringify({pages:parsed.pages.length,bytes:bytes.length,links:parsed.links,layoutBounds:parsed.bad},null,2)+'\n');
   console.log(`PASS native ${style}/${cover?'cover':'inline'}: ${parsed.pages.length} pages, literal text/links/privacy/bounds`);groups++;
  }
 }finally{global.fetch=originalFetch;for(const[t,old]of transports)Object.assign(t,old);}
 console.log('PDF artifacts: '+dir+'; extraction/bounds are not visual inspection.');
}
rendering().then(()=>console.log(`${groups} independent report-customization groups passed.`)).catch(error=>{console.error(error?.name||'Error',error?.message||'Independent report customization failed');process.exitCode=1;});
