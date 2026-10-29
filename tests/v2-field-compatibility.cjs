// Execute the actual shared editor factory in Classic and V2; isolated storage only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const load=Module._load;
Module._load=function(name,parent,main){if(name==='next/headers')return{cookies:async()=>({get:()=>undefined})};if(name==='next/navigation')return{redirect(){throw Error('Unexpected redirect')}};return load.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,main)};
for(const key of Object.keys(process.env))if(key.startsWith('SUPABASE_'))delete process.env[key];
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pippi-v2-compat-'));process.env.HEYQUIZ_DATA_DIR=root;
const {FormSchema,QuestionTypeEnum}=require('../lib/schema.ts');
const {displayTypes}=require('../lib/engine.ts');
const {saveForm,getFormById}=require('../lib/storage.ts');
const source=fs.readFileSync('components/EditorStudio.tsx','utf8');
const ast=ts.createSourceFile('EditorStudio.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let add,defaults;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='addQuestion')add=node.initializer.getText(ast);if(ts.isFunctionDeclaration(node)&&node.name?.text==='getDefaultQuestionTitle')defaults=node.getText(ast);ts.forEachChild(node,visit)}visit(ast);assert.ok(add&&defaults,'actual editor factory found');
function insert(form,type,v2){let result,selected,seq=0;const context={form,type,v2,activePageId:'page-1',displayTypes,nanoid:()=>`id${++seq}`,setForm:value=>result=value,setSelectedQuestionId:value=>selected=value,setCanvasView(){},setMobilePanel(){},requestAnimationFrame:fn=>fn(),document:{querySelector:()=>null}};vm.runInNewContext(ts.transpileModule(`${defaults}\nconst addQuestion=${add};\naddQuestion(type,1);`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);assert.equal(result.questions[1].id,selected);return JSON.parse(JSON.stringify(result));}
(async()=>{try{
for(const type of QuestionTypeEnum.options){
 const base=FormSchema.parse({id:`compat-${type}`,title:'Fixture',mode:'survey',pages:[{id:'page-1',title:'First',questionIds:['before','after']}],questions:[{id:'before',type:'multiple_choice',title:'Before',pageId:'page-1',options:[{id:'a',label:'A'},{id:'b',label:'B'}]},{id:'after',type:'short_answer',title:'After',pageId:'page-1'}],logicRules:[{id:'rule',sourceQuestionId:'before',operator:'equals',value:'a',action:'jump_to_question',targetQuestionId:'after'}]});
 const before=JSON.stringify(base),classic=insert(base,type,false),v2=insert(base,type,true);
 assert.deepEqual(v2,classic,`${type}: both interfaces create identical data`);assert.equal(JSON.stringify(base),before,`${type}: source untouched`);
 assert.equal(v2.questions.length,3);assert.equal(v2.questions[1].type,type);assert.deepEqual(v2.logicRules,base.logicRules);
 let stored=await saveForm(FormSchema.parse(v2),'test-owner');const questions=JSON.stringify(stored.questions),rules=JSON.stringify(stored.logicRules);
 let reopened=await getFormById(stored.id);assert.equal(JSON.stringify(reopened.questions),questions);assert.equal(JSON.stringify(reopened.logicRules),rules);
 reopened.title='Classic title edit';stored=await saveForm(reopened,'test-owner');reopened=await getFormById(stored.id);reopened.description='V2 description edit';stored=await saveForm(reopened,'test-owner');
 assert.equal(JSON.stringify(stored.questions),questions,`${type}: reopen/save preserves all field metadata`);assert.equal(JSON.stringify(stored.logicRules),rules);assert.equal(stored.revision,3);
}
console.log(`PASS V1/V2 field compatibility: actual shared factory for all ${QuestionTypeEnum.options.length} types, insertion identity, untouched source/branch rules and three isolated storage revisions preserving field metadata. Browser editing remains a separate gate.`);
}finally{fs.rmSync(root,{recursive:true,force:true})}})().catch(error=>{console.error(error);process.exitCode=1});
