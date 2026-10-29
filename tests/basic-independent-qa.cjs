// Independent cases derived from the approved field and compatibility contract.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name, ...args); };
const React = require('react');
const { FormSchema } = require('../lib/schema.ts');
const { evaluateMarketing, validateMarketing } = require('../lib/marketing.ts');
const { gradeQuizSubmission } = require('../lib/scoring.ts');
const { authoredTemplates, authoredTemplate } = require('../lib/authored-templates.ts');
const { orderedQuestions, validateFormReferences } = require('../lib/engine.ts');
const { moveGuidedQuestion, renameGuidedAnswer, removeGuidedQuestion } = require('../lib/guided-editing.ts');
const { setBasicAssociation } = require('../lib/basic-editing.ts');
const QuestionEditor = require('../components/basic/BasicQuestionEditor.tsx').default;
const ResultsEditor = require('../components/basic/BasicResultsEditor.tsx').default;
let groups=0; const test=(name,fn)=>{fn();groups++;console.log('PASS independent Basic: '+name);};
const base=(type='product_finder')=>FormSchema.parse({id:'qa-basic',title:'Synthetic QA',mode:'survey',quizType:type,questions:[{id:'q',type:'multiple_choice',title:'Choose a requirement',options:[{id:'a',label:'Requires checkout'},{id:'b',label:'Contact only'},{id:'neutral',label:'Unsure'}]}],marketing:{kind:type==='product_finder'?'product_finder':'segmentation',outcomes:[{id:'information',title:'Information site'},{id:'shop',title:'Shop'}],rules:[]}});
function nodes(tree,out=[]){if(Array.isArray(tree)){tree.forEach(x=>nodes(x,out));return out;}if(React.isValidElement(tree)){out.push(tree);nodes(tree.props.children,out);}return out;}
function labelText(node){const content=node.props.children;return (Array.isArray(content)?content:[content]).filter(x=>typeof x==='string').join('');}
function field(tree,label){const node=nodes(tree).find(n=>n.type==='label'&&labelText(n)===label);assert.ok(node,'Missing field '+label);const input=nodes(node).find(n=>['input','textarea','select'].includes(n.type));assert.ok(input,'Missing input '+label);return input;}
function questionTree(form,change){const original=React.useState;React.useState=v=>[v,()=>{}];try{return QuestionEditor({form,onChange:change,questionId:'q',onAdvanced(){},onRoutes(){}});}finally{React.useState=original;}}
test('literal multi-result evidence, authoritative exclusion and neutral clearing',()=>{
 let f=base();f=setBasicAssociation(f,'q','a','information','8');f=setBasicAssociation(f,'q','a','shop','5');
 assert.equal(evaluateMarketing(f,{q:'a'}).outcomeId,'information');
 f.marketing.rules.push({id:'exclude-information',questionId:'q',answerId:'a',targetId:'information',effect:'exclude',points:0,reason:'Checkout requirement'});validateMarketing(f,false);
 const additive=f.marketing.rules.find(r=>r.targetId==='information'&&r.effect==='add');
 f=setBasicAssociation(f,'q','a','information','10',additive.id);
 assert.equal(f.marketing.rules.find(r=>r.id==='exclude-information').effect,'exclude');
 assert.equal(evaluateMarketing(f,{q:'a'}).outcomeId,'shop');
 f=setBasicAssociation(f,'q','a','information','','exclude-information');
 assert.equal(evaluateMarketing(f,{q:'a'}).outcomeId,'information');
 f=setBasicAssociation(f,'q','a','information','',additive.id);
 assert.equal(evaluateMarketing(f,{q:'a'}).outcomeId,'shop');
 assert.equal(evaluateMarketing(f,{q:'neutral'}).status,'no_match');validateMarketing(f,false);
});
test('scored zero satisfies coverage while blank and missing answers do not',()=>{
 const f=FormSchema.parse({id:'qa-zero',title:'Readiness',mode:'survey',quizType:'scorecard',questions:[{id:'q',title:'Coverage',type:'multiple_choice',options:[{id:'none',label:'Not yet'},{id:'done',label:'Always'},{id:'unknown',label:'Unsure'}]}],marketing:{kind:'scorecard',categories:[{id:'followup',title:'Follow-up',minAnswers:1}],rules:[]}});
 let scored=setBasicAssociation(f,'q','done','followup','10');scored=setBasicAssociation(scored,'q','none','followup','0');
 assert.equal(evaluateMarketing(scored,{q:'none'}).categories[0].score,0);
 assert.equal(evaluateMarketing(scored,{q:'none'}).categories[0].answered,1);
 assert.equal(evaluateMarketing(scored,{q:'unknown'}).categories[0].score,null);
 const cleared=setBasicAssociation(scored,'q','none','followup','');
 assert.equal(evaluateMarketing(cleared,{q:'none'}).categories[0].answered,0);
 assert.equal(evaluateMarketing(cleared,{q:'none'}).categories[0].score,null);
 assert.equal(evaluateMarketing(scored,{q:'done'}).categories[0].score,100);
});
test('actual knowledge editor handlers preserve question points and answer key',()=>{
 let f=FormSchema.parse({id:'qa-knowledge',title:'Knowledge',mode:'quiz',quizType:'knowledge',questions:[{id:'q',type:'multiple_choice',title:'Which is correct?',points:3,explanation:'Check the sender separately',options:[{id:'yes',label:'Verify separately',isCorrect:true,explanation:'Use a known channel'},{id:'no',label:'Reply immediately'}]}]});
 const capture=v=>{f=v;};
 field(questionTree(f,capture),'Question points').props.onChange({target:{value:'7'}});
 assert.equal(gradeQuizSubmission(f,{q:'yes'}).totalPointsEarned,7);
 assert.equal(gradeQuizSubmission(f,{q:'no'}).totalPointsEarned,0);
 field(questionTree(f,capture),'Question points').props.onChange({target:{value:''}});
 assert.equal(f.questions[0].points,undefined);
 assert.equal(gradeQuizSubmission(f,{q:'yes'}).totalPointsPossible,0);
 assert.equal(f.questions[0].options[0].explanation,'Use a known channel');
 field(questionTree(f,capture),'Description / help text').props.onChange({target:{value:'A new hint'}});
 assert.equal(f.questions[0].description,'A new hint');assert.equal(f.questions[0].options[0].isCorrect,true);
});
test('knowledge feedback editor saves literal score ranges without zero coercion',()=>{
 let f=FormSchema.parse({id:'qa-feedback',title:'Knowledge',mode:'quiz',quizType:'knowledge',outcomeTiers:[{id:'tier',minScorePercent:20,maxScorePercent:80,title:'Keep practicing',message:'Check known channels',badge:'Practice'}]});
 const render=()=>ResultsEditor({form:f,onChange:value=>{f=value;},selectedResultId:'tier',onSelectResult(){},onAdvanced(){}});
 field(render(),'From score (%)').props.onChange({target:{value:''}});assert.equal(f.outcomeTiers[0].minScorePercent,20);
 field(render(),'From score (%)').props.onChange({target:{value:'30'}});assert.equal(f.outcomeTiers[0].minScorePercent,30);
 field(render(),'Result message').props.onChange({target:{value:'Use the official support channel'}});assert.equal(f.outcomeTiers[0].message,'Use the official support channel');
});
test('all six comprehensive templates retain question 30 identity through edits',()=>{
 const long=authoredTemplates.filter(t=>t.questionCount===30);assert.equal(long.length,6);
 for(const template of long){const f=authoredTemplate(template.id,'qa-'+template.id);const question=orderedQuestions(f)[29];assert.ok(question?.id);
 const edited={...f,questions:f.questions.map(q=>q.id===question.id?{...q,title:'QA edited final question'}:q)};
 const moved=moveGuidedQuestion(edited,question.id,-1);assert.equal(orderedQuestions(moved)[28].id,question.id);assert.equal(moved.questions.find(q=>q.id===question.id).title,'QA edited final question');
 const restored=FormSchema.parse(JSON.parse(JSON.stringify(moved)));assert.equal(restored.questions.length,30);assert.equal(restored.questions.find(q=>q.id===question.id).title,'QA edited final question');validateFormReferences(restored);
 const removed=removeGuidedQuestion(restored,question.id);assert.equal(removed.questions.length,29);validateFormReferences(removed);
 }
});
test('qualification reference edits retain choice IDs and numeric boundaries',()=>{
 let f=FormSchema.parse({id:'qa-routes',title:'Fit',quizType:'qualification',mode:'survey',questions:[{id:'q',title:'Owner ready?',type:'multiple_choice',options:[{id:'ready',label:'Ready'},{id:'later',label:'Later'},{id:'unknown',label:'Unknown'}]},{id:'budget',title:'Budget',type:'number',minVal:0,maxVal:100}],marketing:{kind:'qualification',outcomes:[{id:'ready',title:'Ready route'},{id:'prepare',title:'Prepare route'}],qualificationRules:[{id:'first',outcomeId:'ready',match:'all',conditions:[{questionId:'q',operator:'equals',value:'ready'},{questionId:'budget',operator:'greater_than',value:'50'}]},{id:'second',outcomeId:'prepare',match:'any',conditions:[{questionId:'q',operator:'equals',value:'later'},{questionId:'budget',operator:'less_than',value:'51'}]}]}});
 f=renameGuidedAnswer(f,'q','ready','Named owner has agreed');
 assert.equal(evaluateMarketing(f,{q:'ready',budget:51}).outcomeId,'ready');
 assert.equal(evaluateMarketing(f,{q:'ready',budget:50}).outcomeId,'prepare');
 assert.equal(evaluateMarketing(f,{q:'unknown',budget:''}).status,'no_match');
 assert.equal(evaluateMarketing(f,{q:'later',budget:90}).outcomeId,'prepare');
 const removed=removeGuidedQuestion(f,'budget');assert.equal(removed.marketing.qualificationRules.length,0);
});
console.log(groups+' independent Basic acceptance groups passed.');
