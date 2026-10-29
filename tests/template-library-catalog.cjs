const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {templateLibraryItems:items,filterTemplateLibrary:filter}=require('../lib/template-library-catalog.ts');
const {authoredTemplates}=require('../lib/authored-templates.ts');
const {launchTemplates,launchTemplate}=require('../lib/launch-templates.ts');
const {createQuizTemplate}=require('../lib/template-factory.ts');
assert.equal(items.length,61);assert.equal(new Set(items.map(t=>t.id)).size,61);
assert.deepEqual(new Set(items.map(t=>t.id)),new Set([...authoredTemplates,...launchTemplates].map(t=>t.id)));
for(const item of items){
 const form=createQuizTemplate(item.id,'sample');assert.equal(item.questionCount,form.questions.length);assert.ok(item.title&&item.summary&&item.industry&&item.imageAlt);assert.match(item.image,/^(\/|https?:\/\/)/);assert.match(item.focalPoint,/^\d+% \d+%$/);
 const expected=form.quizType??({segmentation:'personality',product_finder:'product_finder',scorecard:'scorecard',qualification:'qualification'}[form.marketing?.kind]??'knowledge');assert.equal(item.quizType,expected);
 const other=createQuizTemplate(item.id,'other');form.questions[0].title='Edited instance';assert.notEqual(other.questions[0].title,'Edited instance');
}
for(const t of launchTemplates)assert.deepEqual(createQuizTemplate(t.id,'legacy'),launchTemplate(t.id,'legacy'),'Legacy content unchanged');
for(const type of ['personality','product_finder','diagnostic','qualification','knowledge','scorecard']){
 const newIds=new Set(authoredTemplates.filter(t=>t.quizType===type).map(t=>t.id));assert.equal(filter(items,{quizType:type}).filter(t=>newIds.has(t.id)).length,3);
}
assert.equal(filter(items,{length:'comprehensive'}).length,6);
assert.equal(filter(items,{length:'short'}).length,12);
assert.equal(filter(items,{length:'standard'}).length,43);
assert.equal(filter(items,{quizType:'personality',length:'comprehensive'}).length,1);
assert.equal(filter(items,{query:'  TRAVELLER  '}).some(t=>t.id==='personality-traveller'),true);
assert.equal(filter(items,{query:'[does not exist]'}).length,0);
const industry=items.find(t=>t.id==='ideal-coffee-8').industry;
assert.equal(filter(items,{quizType:'product_finder',industry,query:'coffee',length:'short'}).length,1);
assert.equal(filter(items,{quizType:'qualification',industry,query:'coffee'}).length,0);
assert.equal(filter(items,{length:'all',industry:'all',query:'  '}).length,61);
assert.equal(new Set(items.map(t=>t.image)).size,items.length,'Every template has a unique image');
const crypto=require('node:crypto'),path=require('node:path');
const hashes=items.map(item=>{
 const file=path.join(__dirname,'../public',item.image);
 assert.ok(fs.existsSync(file),`Image exists for ${item.id}`);
 return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
});
assert.equal(new Set(hashes).size,items.length,'Different filenames must not hide duplicate image content');
console.log('PASS unified61-template catalogue: actual counts/types, retained legacy content, imagery, independent instances and combined filters');
