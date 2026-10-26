// Pure synthetic forms and the actual Advanced update handler; no storage/network.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText, f);
const { FormSchema } = require('../lib/schema.ts');
const { resolvePath, evaluateCondition, singleTypes } = require('../lib/engine.ts');
const { renameGuidedAnswer } = require('../lib/guided-editing.ts');
const fixture = (operator='equals', value='Beginner', type='multiple_choice') => FormSchema.parse({ id:'branch-fixture', title:'Branch fixture', mode:'survey', questions:[{id:'q1',type,title:'Experience?',options:[{id:'a',label:'Beginner',isCorrect:true},{id:'b',label:'Expert'}]},{id:'q2',type:'short_answer',title:'Extra question'},{id:'q3',type:'short_answer',title:'Next question'}],logicRules:[{id:'r1',sourceQuestionId:'q1',operator,value,action:'jump_to_question',targetQuestionId:'q3'}] });
const source = fs.readFileSync('components/EditorStudio.tsx','utf8');
const handler = source.slice(source.indexOf('  const updateOption ='),source.indexOf('  const deleteOption ='));
function advanced(form, patch) { let result, error; vm.runInNewContext(ts.transpileModule(handler+'\nupdateOption("q1","a",patch);',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{Error,form,patch,renameGuidedAnswer,singleTypes,setForm:value=>result=value,setActionError:value=>error=value});return {result,error}; }
for(const operator of ['equals','not_equals']) for(const type of ['multiple_choice','multiselect']) {
  const form=fixture(operator,'Beginner',type),before=JSON.stringify(form);
  const basic=renameGuidedAnswer(form,'q1','a','Starting out');
  const {result,error}=advanced(form,{label:'Starting out',explanation:'Updated explanation'});
  assert.equal(error,'');assert.equal(result.logicRules[0].value,'a');assert.equal(result.questions[0].options[0].id,'a');assert.equal(result.questions[0].options[0].explanation,'Updated explanation');
  for(const answer of ['a','b', ['a'], ['b'], ['a','b']]) {
    const actual=type==='multiselect' ? (Array.isArray(answer)?answer:[answer]) : (Array.isArray(answer)?answer[0]:answer);
    assert.deepEqual(resolvePath(result,{q1:actual}).questions.map(q=>q.id),resolvePath(basic,{q1:actual}).questions.map(q=>q.id));
    assert.deepEqual(resolvePath(result,{q1:actual}).questions.map(q=>q.id),resolvePath(form,{q1:actual}).questions.map(q=>q.id));
  }
  assert.equal(JSON.stringify(form),before);
}
for(const form of [fixture('contains','Begin'), {...fixture(),questions:fixture().questions.map(q=>q.id==='q1'?{...q,options:[...q.options,{id:'c',label:'Beginner'}]}:q)}, fixture('equals','Starting out')]) {
  const before=JSON.stringify(form);
  assert.throws(()=>renameGuidedAnswer(form,'q1','a','Starting out'),/would alter a branching rule/);
  const {result,error}=advanced(form,{label:'Starting out'});assert.equal(result,undefined);assert.match(error,/Your answer has not changed/);assert.equal(JSON.stringify(form),before);
}
const stable=fixture('equals','a');assert.equal(advanced(stable,{label:'Starting out'}).result.logicRules[0].value,'a');
const unchanged=fixture('contains','gin');const safe=renameGuidedAnswer(unchanged,'q1','a','Beginner path');assert.equal(evaluateCondition('contains','a','gin',safe.questions[0]),true);
const corrected=advanced(fixture(),{isCorrect:false});assert.equal(corrected.result.questions[0].options[0].isCorrect,false);assert.equal(corrected.result.logicRules[0].value,'Beginner');
console.log('PASS answer branching: Basic/Advanced exact and negated rules, single/multiselect paths, stable IDs and metadata; ambiguous, substring and newly matching conditions cannot silently change routing.');
