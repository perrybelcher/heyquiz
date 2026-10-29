const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {authoredTemplates,authoredTemplate}=require('../lib/authored-templates.ts');
const {createQuizTemplate}=require('../lib/template-factory.ts');
const {launchTemplates,launchTemplate}=require('../lib/launch-templates.ts');
const {outcomeTemplate}=require('../lib/outcome-templates.ts');
const {quizTypes,validateQuizType}=require('../lib/quiz-types.ts');
const {validateFormReferences,resolvePath,publicForm}=require('../lib/engine.ts');
const {validateMarketing,evaluateMarketing}=require('../lib/marketing.ts');
const {FormSchema}=require('../lib/schema.ts');
const {publicationFingerprint}=require('../lib/publication.ts');
const {readGuestDraft}=require('../lib/guest-draft.ts');
const {renameGuidedAnswer,removeGuidedQuestion,removeGuidedAnswer}=require('../lib/guided-editing.ts');
assert.equal(authoredTemplates.length,18);
assert.equal(new Set(authoredTemplates.map(t=>t.id)).size,18);
assert.equal(authoredTemplates.reduce((n,t)=>n+t.questionCount,0),276);
assert.equal(authoredTemplates.filter(t=>t.featured).length,6);
for(const type of quizTypes){
 assert.deepEqual(authoredTemplates.filter(t=>t.quizType===type).map(t=>t.questionCount).sort((a,b)=>a-b),[8,8,30]);
 assert.equal(outcomeTemplate(type,'starter').questions.length,8);
}
for(const t of authoredTemplates){
 const f=authoredTemplate(t.id,'one'),copy=authoredTemplate(t.id,'two');
 assert.equal(f.quizType,t.quizType);assert.equal(f.title,t.title);assert.equal(f.questions.length,t.questionCount);
 assert.equal(f.publishedAt,undefined);assert.equal(t.featured,t.length==='comprehensive');
 assert.ok(f.description?.trim());assert.ok(t.summary&&t.audience);
 validateQuizType(f);validateFormReferences(f);validateMarketing(f);
 assert.equal(new Set(f.questions.map(q=>q.id)).size,f.questions.length);
 assert.equal(new Set(f.questions.map(q=>q.title.trim().toLowerCase())).size,f.questions.length,'Repeated questions '+t.id);
 for(const q of f.questions){assert.ok(!['heading','subheading','divider','email','full_name'].includes(q.type),'Substantive question');assert.ok(q.title.trim());if(q.options){assert.equal(new Set(q.options.map(a=>a.id)).size,q.options.length);for(const a of q.options)assert.ok(a.label.trim());}}
 assert.deepEqual(FormSchema.parse(JSON.parse(JSON.stringify(f))),f);
 const storage={getItem:k=>k===`heyquiz-draft:${f.id}`?JSON.stringify(f):null};assert.deepEqual(readGuestDraft(storage,storage,f.id),f);
 const frozen=publicationFingerprint(f);
 f.questions[0].title='Changed instance';f.theme.primaryColor='#123456';if(f.marketing?.outcomes[0])f.marketing.outcomes[0].title='Changed result';
 assert.equal(publicationFingerprint(authoredTemplate(t.id,'one')),frozen,'Source remains unchanged');assert.notEqual(copy.questions[0].title,f.questions[0].title);
 const original=authoredTemplate(t.id,'check');const answers=Object.fromEntries(original.questions.map(q=>[q.id,q.options?.[0]?.id??q.minVal??0]));
 assert.equal(resolvePath(original,answers).questions.length,t.questionCount,'Full normal path');
 const before=evaluateMarketing(original,answers);original.theme.primaryColor='#123456';assert.deepEqual(evaluateMarketing(original,answers),before);
 const first=original.questions.find(q=>q.options?.length);if(first){const renamed=renameGuidedAnswer(original,first.id,first.options[0].id,'Edited label');const after=evaluateMarketing(renamed,answers);assert.equal(after?.outcomeId,before?.outcomeId);assert.equal(after?.overallScore,before?.overallScore);validateFormReferences(removeGuidedAnswer(original,first.id,first.options[0].id));}
 validateFormReferences(removeGuidedQuestion(original,original.questions[0].id));
 if(original.marketing?.kind==='qualification')assert.throws(()=>validateMarketing(original,true));
 for(const o of original.marketing?.outcomes??[]){assert.equal(o.ctaUrl,'');o.ctaUrl='https://example.test/next';}
 validateMarketing(original,true);validateFormReferences(original);
 assert.equal(publicForm(original).quizType,t.quizType);
}
for(const t of launchTemplates)assert.deepEqual(createQuizTemplate(t.id,'legacy'),launchTemplate(t.id,'legacy'));
assert.throws(()=>createQuizTemplate('missing','new'));
assert.throws(()=>authoredTemplate('missing','new'));
console.log('PASS 18 authored templates /276 questions, metadata, full paths, references, independent drafts, recovery, editing, design invariance and configured publication');
