const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {launchTemplate,launchTemplates}=require('../lib/launch-templates.ts');
const {evaluateMarketing,validateMarketing}=require('../lib/marketing.ts');
for(const {id} of launchTemplates){const f=launchTemplate(id,'test');validateMarketing(f,true);assert.equal(f.capture.required,false);assert.equal(f.capture.marketingEnabled,false);assert.equal(f.coverPage.enabled,true);const copy=launchTemplate(id,'other');f.questions[0].title='changed';assert.notEqual(copy.questions[0].title,'changed');}
const product=launchTemplate('product_finder','product');
for(let i=0;i<3;i++){assert.equal(evaluateMarketing(product,{use:`a${i}`,priority:`a${i}`,routine:`a${i}`,space:`a${i}`,fit:'a1'}).outcomeId,['light','work','travel'][i]);}
let paths=0;for(let u=0;u<4;u++)for(let p=0;p<4;p++)for(let r=0;r<4;r++)for(let s=0;s<4;s++)for(let fit=0;fit<3;fit++) {const result=evaluateMarketing(product,{use:`a${u}`,priority:`a${p}`,routine:`a${r}`,space:`a${s}`,fit:`a${fit}`});if(fit===0)assert.equal(result.status,'no_match');if(u===1&&result.outcomeId)assert.equal(result.outcomeId,'work');paths++;}
const score=launchTemplate('scorecard','score');for(let i=0;i<4;i++){const answers=Object.fromEntries(score.questions.map(q=>[q.id,`a${i}`]));assert.equal(evaluateMarketing(score,answers).overallScore,[100,50,0,null][i]);}
const consult=launchTemplate('consultation','consult');for(let i=0;i<3;i++){const answers=Object.fromEntries(consult.questions.map(q=>[q.id,`a${i}`]));assert.equal(evaluateMarketing(consult,answers).outcomeId,['self','review','plan'][i]);answers.support='a3';assert.equal(evaluateMarketing(consult,answers).status,'no_match');}
console.log(`PASS three valid independent templates, capture defaults, score/unknown boundaries, consultation preferences, and ${paths} product paths`);
