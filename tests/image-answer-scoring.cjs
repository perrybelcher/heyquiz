const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, f);
const {FormSchema} = require('../lib/schema.ts');
const {gradeQuizSubmission} = require('../lib/scoring.ts');
const {evaluateMarketing, validateMarketing} = require('../lib/marketing.ts');
const {singleTypes, multiTypes} = require('../lib/engine.ts');
for (const type of [...singleTypes, ...multiTypes]) {
  const multiple = multiTypes.has(type);
  const form = FormSchema.parse({id:'image-parity',title:'Choice scoring',mode:'quiz',questions:[{id:'q',type,title:'Pick an answer',points:12,options:[{id:'a',label:'A',isCorrect:true,imageUrl:'/quiz-icon.svg'},{id:'b',label:'B',isCorrect:multiple,imageUrl:'/quiz-icon.svg'},{id:'c',label:'C',isCorrect:false,imageUrl:'/quiz-icon.svg'}]}]});
  const result = answers => gradeQuizSubmission(form,{q:answers});
  assert.equal(result(multiple?['a','b']:'a').totalPointsEarned,12,type);
  assert.equal(result(multiple?['c']:'c').totalPointsEarned,0,type);
  if (multiple) {
    assert.equal(result(['a']).totalPointsEarned,6,type);
    assert.equal(result(['a','c']).totalPointsEarned,0,type);
    assert.equal(result(['a','a','b']).totalPointsEarned,12,type);
  }
  form.mode='survey';
  form.marketing={kind:'scorecard',categories:[{id:'category',title:'Readiness',description:'',minAnswers:1}],outcomes:[],rules:[{id:'zero',questionId:'q',answerId:'a',targetId:'category',effect:'add',points:0,reason:''},{id:'high',questionId:'q',answerId:'b',targetId:'category',effect:'add',points:10,reason:''}],fallbackTitle:'Unknown',fallbackMessage:'Not enough information'};
  validateMarketing(form,true);
  assert.equal(evaluateMarketing(form,{q:multiple?['a']:'a'}).categories[0].score,0,type);
  assert.equal(evaluateMarketing(form,{q:multiple?['b']:'b'}).categories[0].score,100,type);
  assert.equal(evaluateMarketing(form,{q:multiple?['c']:'c'}).categories[0].score,null,type);
  if (multiple) assert.deepEqual(evaluateMarketing(form,{q:['a','b','b']}).categories,evaluateMarketing(form,{q:['a','b']}).categories,type);
}
console.log('PASS all 10 choice types: correct-answer scoring, image/text parity, partial credit, penalties, duplicate selections, zero and neutral scorecard answers');
