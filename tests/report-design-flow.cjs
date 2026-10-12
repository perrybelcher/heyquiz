const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{spawnSync}=require('node:child_process');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {renderResultPdf}=require('../lib/result-pdf.ts'),{ReportDesignSchema}=require('../lib/report-design.ts');
const artifacts=path.resolve(process.env.ARTIFACT_DIR||'../pippi-delivery-2026-10-12/report-flow');fs.mkdirSync(artifacts,{recursive:true});
const python=process.env.PDF_TEST_PYTHON||'/Users/perry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
(async()=>{
 for(const style of ['editorial','executive']){
  const design=ReportDesignSchema.parse({version:1,style,cover:true,title:'W'.repeat(140),subtitle:'A thoughtful report. '.repeat(12).slice(0,240),introduction:'Every useful next step deserves space.\n'.repeat(48)+'FINAL INTRODUCTION',footer:'CLOSING '+ 'W'.repeat(152),sections:['details','action']});
  const report={quizTitle:'Boundary report',createdAt:'2026-10-12T12:00:00.000Z',theme:{brandName:'A study in clear advice',primaryColor:'#ffffff',hidePippiBranding:true},reportDesign:design,result:{marketing:{kind:'scorecard',title:'Your result stays intact',message:'This is a synthetic pagination exercise.',overallScore:null,reasons:[],categories:Array.from({length:8},(_,i)=>({title:'Area '+(i+1),description:'Useful context '.repeat(38),score:i===7?null:i%2===0?0:100,answered:i===7?0:1,applicable:1,minAnswers:1,bandTitle:'A practical next step',advice:'CATEGORY '+(i+1)+' FINAL GUIDANCE'})),resultSections:[{type:'faq',title:'A complete answer',body:'Detailed answer '.repeat(180)+'FINAL FAQ',label:'',url:''}],ctaLabel:'A safe next step',ctaUrl:'https://example.test/next'}}};
  const bytes=await renderResultPdf(report),file=path.join(artifacts,style+'-long.pdf');fs.writeFileSync(file,bytes);
  const script="import sys,json,pdfplumber\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1]);bad=[]\nwith pdfplumber.open(sys.argv[1]) as d:\n for i,p in enumerate(d.pages):\n  for c in p.chars:\n   if c['text'].strip() and (c['x0']<47 or c['x1']>p.width-47 or c['top']<20 or c['bottom']>p.height-20): bad.append([i+1,c['x0'],c['top']])\nprint(json.dumps({'pages':[p.extract_text() for p in r.pages],'bad':bad}))";
  const read=spawnSync(python,['-c',script,file],{encoding:'utf8',maxBuffer:6*1024*1024});assert.equal(read.status,0,read.stderr);const parsed=JSON.parse(read.stdout),text=parsed.pages.join('\n'),tight=text.replace(/\s/g,'');
  assert.deepEqual(parsed.bad,[]);assert.ok(parsed.pages.length>=5&&parsed.pages.length<=50);assert.ok(tight.includes('W'.repeat(140)));assert.ok(tight.includes('CLOSING'+'W'.repeat(152)));assert.equal(text.split('CLOSING').length-1,1);
  for(const marker of ['FINAL INTRODUCTION','Your result stays intact','Not enough information','0%','100%','0 of 1 applicable questions scored','1 needed','FINAL FAQ','CATEGORY 8 FINAL GUIDANCE'])assert.ok(text.includes(marker),marker);
  parsed.pages.forEach((page,index)=>assert.ok(page.includes('Page '+(index+1)+' of '+parsed.pages.length)));assert.ok(!text.includes('Made with Pippi'));
  console.log('PASS '+style+' maximum title/subtitle/footer, long introduction/category/FAQ pagination: '+parsed.pages.length+' pages; full text and glyph bounds retained');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
