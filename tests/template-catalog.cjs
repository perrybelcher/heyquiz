const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {launchTemplate,launchTemplates}=require('../lib/launch-templates.ts');
const {catalogTemplates}=require('../lib/template-catalog.ts');
const {evaluateMarketing,validateMarketing}=require('../lib/marketing.ts');
assert.equal(launchTemplates.length,43);assert.equal(new Set(launchTemplates.map(t=>t.id)).size,43);
let paths=0;
for(const t of catalogTemplates){
 const f=launchTemplate(t.id,'test-'+t.id);validateMarketing(f,true);
 assert.equal(f.capture.required,false);assert.equal(f.capture.marketingEnabled,false);
 const clone=launchTemplate(t.id,'other');f.questions[0].title='changed';assert.notEqual(clone.questions[0].title,'changed');
 for(const o of f.marketing.outcomes)assert.equal(o.ctaUrl,'');
 if(t.kind==='scorecard'){
  for(let n=0;n<4096;n++){
   let v=n;const answers={},vals=[];
   for(const q of f.questions){const a=v%4;v=Math.floor(v/4);answers[q.id]='a'+a;vals.push(a===3?null:[100,50,0][a]);}
   const r=evaluateMarketing(f,answers);const expected=vals.includes(null)?null:Math.round(vals.reduce((a,b)=>a+b,0)/6);
   assert.equal(r.overallScore,expected,t.id+':'+n);paths++;
  }
 }else{
  for(let n=0;n<256;n++)for(let next=0;next<3;next++){
   let v=n;const answers={next:'a'+next},scores=[0,0,0];
   for(let q=0;q<4;q++){const a=v%4;v=Math.floor(v/4);answers['q'+q]='a'+a;if(a<3)scores[a]+=q===0?3:2;}
   const r=evaluateMarketing(f,answers);const best=Math.max(...scores);
   if(next===2||best===0)assert.equal(r.status,'no_match');else assert.equal(r.outcomeId,'path'+scores.indexOf(best));paths++;
  }
 }
}
console.log(`PASS ${launchTemplates.length} templates, independent drafts, optional capture, ${paths} scoring paths including ties, unknowns, and opt-outs`);
