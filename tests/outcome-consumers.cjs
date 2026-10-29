const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name, ...args); };
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const Card = require('../components/MarketingResultCard.tsx').default;
const { buildResultPdfModel } = require('../lib/result-pdf-model.ts');
const { makeResultReport } = require('../lib/result-reports.ts');
const { makeEvent } = require('../lib/integrations/service.ts');
const { IntegrationInput } = require('../lib/integrations/schema.ts');
const { contactExportRows } = require('../lib/contacts.ts');
const { responsesCsv } = require('../lib/report-responses.ts');
const { qualify } = require('../lib/meta/qualification.ts');
const types = [
 ['personality', 'segmentation', 'Your profile', 'Your next step'],
 ['product_finder', 'product_finder', 'Your best match', 'Make the most of your match'],
 ['diagnostic', 'segmentation', 'Your biggest challenge', 'Your action plan'],
 ['qualification', 'qualification', 'Your recommended route', 'What happens next'],
];
for (const [quizType, kind, heading, adviceHeading] of types) for (const layout of ['stacked', 'score_overview', 'action_plan']) {
 const marketing = {quizType, kind, status:'matched', title:'Saved outcome', message:'Saved explanation', outcomeId:'selected', advice:'Take this step', reasons:['A literal reason'], categories:[], presentation:{layout}, ctaLabel:'Book a call', ctaUrl:'https://example.test/next'};
 const result = {id:'response',formId:'quiz',submittedAt:'2026-10-29T10:00:00.000Z',totalPointsEarned:2,totalPointsPossible:2,percentageScore:100,marketing,answers:{},grading:[],contact:{email:'synthetic@example.test',marketingConsent:true,recordedAt:'2026-10-29T10:00:00.000Z',consentText:'Consent'}};
 const form = {id:'quiz',title:'Original quiz',theme:{primaryColor:'#123456'},questions:[]};
 const report = makeResultReport(form,result,'response');
 const html = renderToStaticMarkup(React.createElement(Card,{result:report.result.marketing}));
 assert.ok(html.includes(heading)); assert.ok(html.includes(adviceHeading)); assert.ok(html.includes('Book a call'));
 assert.ok(!html.includes('100%')); assert.ok(!html.includes('Overall score'));
 assert.ok(html.includes('--hq-primary'));
 const pdf = buildResultPdfModel(report);
 assert.ok(pdf.blocks.some(b=>b.text===heading)); assert.ok(pdf.blocks.some(b=>b.text===adviceHeading));
 assert.ok(pdf.blocks.some(b=>b.kind==='link'&&b.url==='https://example.test/next'));
 assert.ok(!pdf.blocks.some(b=>b.kind==='score'));
 const config = {mappings:[{source:'quizType',target:'format'},{source:'applicableScore',target:'applicable'},{source:'score',target:'legacy'},{source:'result.outcomeId',target:'outcome'}]};
 const event = makeEvent(result,'event',config);
 assert.equal(event.score,100); assert.equal(event.applicableScore,null); assert.equal(event.quizType,quizType);
 assert.deepEqual(event.fields,{format:quizType,applicable:null,legacy:100,outcome:'selected'});
 assert.equal(contactExportRows([result])[0].quizType,quizType);assert.equal(contactExportRows([result])[0].score,'');
 const csv=responsesCsv([result]);assert.ok(csv.includes('"Quiz type","Outcome ID"'));assert.ok(csv.includes(`"${quizType}","selected"`));
 const meta=qualify({rules:[{kind:'score',min:0,max:100}],mappings:[]},result);assert.equal(meta.status,'unclassified','routing must not produce a Meta qualification score');
 marketing.title='Later edit';marketing.quizType='scorecard';assert.equal(report.result.marketing.title,'Saved outcome');assert.equal(report.result.marketing.quizType,quizType);
 const fallback={...report.result.marketing,status:'no_match'};
 assert.ok(renderToStaticMarkup(React.createElement(Card,{result:fallback})).includes('More information needed'));
 report.result.marketing=fallback;assert.ok(buildResultPdfModel(report).blocks.some(b=>b.text==='More information needed'));
}
assert.equal(IntegrationInput.safeParse({name:'Typed mapping',provider:'webhook',mappings:[{source:'quizType',target:'format'},{source:'applicableScore',target:'applicable'}]}).success,true);
const legacy={id:'old',formId:'quiz',submittedAt:'2026-10-29T10:00:00.000Z',totalPointsPossible:5,percentageScore:80,contact:{email:'synthetic@example.test'}};
const event=makeEvent(legacy,'event',{mappings:[]});assert.equal(event.score,80);assert.equal(event.applicableScore,80);assert.equal(Object.hasOwn(event,'quizType'),false);
const cardScore=makeEvent({...legacy,marketing:{kind:'scorecard',overallScore:42}},'event',{mappings:[]});assert.equal(cardScore.applicableScore,42);assert.equal(cardScore.score,80);
console.log('PASS four frozen outcome types in all layouts: web/PDF headings, CTA and theme; no grades; immutable saved results; CSV and mapped integration fields; legacy scores; no inferred Meta score');
