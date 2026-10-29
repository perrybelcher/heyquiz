const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {FormSchema}=require('../lib/schema.ts'),{validateFormReferences}=require('../lib/engine.ts');
const text=fs.readFileSync(require.resolve('../components/EditorStudio.tsx'),'utf8'),ast=ts.createSourceFile('EditorStudio.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let source;function find(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='applyJsonChanges')source=node.initializer.getText(ast);ts.forEachChild(node,find)}find(ast);assert.ok(source);
const code=ts.transpileModule(`return (${source});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function apply(form,input){let saved,error,checkpoints=0;const handler=new Function('jsonText','form','FormSchema','validateFormReferences','checkpoint','setForm','setActivePageId','setSelectedQuestionId','setCanvasView','setJsonError','setShowJsonModal',code)(JSON.stringify(input),form,FormSchema,validateFormReferences,()=>{checkpoints++;return true},value=>saved=value,()=>{},()=>{},()=>{},value=>error=value,()=>{});handler();return {saved,error,checkpoints}}
const form=FormSchema.parse({id:'original',title:'Profile',quizType:'personality',mode:'survey',marketing:{kind:'segmentation'},questions:[]});
for(const quizType of ['diagnostic',undefined]){const result=apply(form,{...form,quizType});assert.equal(result.saved,undefined);assert.equal(result.checkpoints,0);assert.match(result.error,/converted copy/)}
const legacy=FormSchema.parse({id:'original',title:'Legacy',mode:'survey',questions:[]});assert.equal(apply(legacy,form).saved,undefined);
const edit=apply(form,{...form,title:'Updated profile'});assert.equal(edit.saved.title,'Updated profile');assert.equal(edit.saved.quizType,'personality');assert.equal(edit.checkpoints,1);
assert.equal(apply(legacy,{...legacy,title:'Updated legacy'}).saved.quizType,undefined);
console.log('PASS actual JSON editor handler preserves type identity and requires converted copies, including guest drafts');
