// Independent rendering checks against the production catalogue and component.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
require.extensions['.css']=()=>{};
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...rest){return resolve.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,...rest);};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {templateLibraryItems,filterTemplateLibrary}=require('../lib/template-library-catalog.ts');
const {authoredTemplates}=require('../lib/authored-templates.ts');
const {launchTemplates}=require('../lib/launch-templates.ts');
const {createQuizTemplate}=require('../lib/template-factory.ts');
const {default:Library}=require('../components/UnifiedTemplateLibrary.tsx');
const expectedIds=[...authoredTemplates,...launchTemplates].map(t=>t.id);
assert.equal(templateLibraryItems.length,61);assert.deepEqual(templateLibraryItems.map(t=>t.id),expectedIds);
const before=JSON.stringify(templateLibraryItems);let creates=0;
function render(type){return renderToStaticMarkup(React.createElement(Library,{initialQuizType:type,onCreate:()=>creates++,error:''}));}
for(const type of ['personality','product_finder','diagnostic','qualification','knowledge','scorecard']){
 const html=render(type),items=filterTemplateLibrary(templateLibraryItems,{quizType:type});
 for(const item of items.slice(0,15))assert.ok(html.includes(`data-template-id="${item.id}"`),`${type}: missing row ${item.id}`);
 const selected=createQuizTemplate(items[0].id,'check');
 assert.ok(html.includes('aria-label="Template details"'));assert.ok(html.includes('role="tablist"'));assert.ok(html.includes('aria-label="Template preview sections"'));
 assert.ok(html.includes('Questions ('+selected.questions.length+')'));
 if(selected.marketing?.kind==='scorecard')for(const category of selected.marketing.categories)assert.ok(html.includes(category.title),'Real category content');
 else if(selected.marketing)for(const outcome of selected.marketing.outcomes)assert.ok(html.includes(outcome.title),'Real outcome content');
 else for(const tier of selected.outcomeTiers)assert.ok(html.includes(tier.title),'Real grading feedback');
 assert.ok(html.includes('Use this template'));assert.ok(html.includes('Back to templates'));assert.ok(html.includes('aria-controls="tl-tab-content"'));
 assert.ok(!html.includes('Browse additional existing templates'),'Single catalogue experience');
 const authored=authoredTemplates.filter(t=>t.quizType===type);
 assert.equal(authored.length,3);assert.deepEqual(authored.map(t=>createQuizTemplate(t.id,'counts').questions.length).sort((a,b)=>a-b),[8,8,30]);
}
const all=render();assert.ok(all.includes('61 templates'));assert.equal(creates,0,'Inspecting previews must not create drafts');assert.equal(JSON.stringify(templateLibraryItems),before,'Rendering must not mutate metadata');
for(const type of ['personality','product_finder','diagnostic','qualification','knowledge','scorecard']){
 const items=filterTemplateLibrary(templateLibraryItems,{quizType:type,length:'comprehensive'});assert.equal(items.length,1);
 const same=filterTemplateLibrary(templateLibraryItems,{quizType:type,length:'comprehensive',industry:items[0].industry,query:items[0].title.toUpperCase()});assert.deepEqual(same.map(t=>t.id),[items[0].id]);
 assert.equal(filterTemplateLibrary(templateLibraryItems,{quizType:type,query:'[not-a-template]'}).length,0);
}
console.log('PASS independent unified library:61 preserved IDs, six actual type previews, keyboard tab semantics, no preview side effects, real result content and combined filters');
