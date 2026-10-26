// Execute the actual server page against synthetic owner-scoped dependencies.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),jsx=require('react/jsx-runtime');
const compiled=ts.transpileModule(fs.readFileSync('app/contacts/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const row=(id,owner,formId,contact=true)=>({id,owner_id:owner,payload:{id:'untrusted-payload-id',formId,submittedAt:'2026-10-26',contact:contact?{name:id,email:id+'@example.test'}:undefined,grading:[{private:'answer'}],answers:{private:'answer'}}});
let signedIn=true,storeFailed=false,reads=0;
const m={exports:{}};
vm.runInNewContext(compiled,{module:m,exports:m.exports,Set,Promise,require:name=>{
 if(name==='react/jsx-runtime')return jsx;
 if(name==='next/navigation')return {notFound(){throw Error('404')}};
 if(name==='@/lib/auth')return {requirePageUser:async()=>{if(!signedIn)throw Error('login');return{id:'owner-one'}}};
 if(name==='@/lib/storage')return {getAllForms:async owner=>{reads++;assert.equal(owner,'owner-one');return[{id:'owned-quiz',title:'Owned'}]}};
 if(name==='@/lib/records')return {listRecords:async(kind,owner)=>{reads++;assert.equal(kind,'submissions');assert.equal(owner,'owner-one');if(storeFailed)throw Error('storage unavailable');return[row('canonical-one',owner,'owned-quiz'),row('foreign-owner','owner-two','owned-quiz'),row('foreign-quiz',owner,'other-quiz'),row('no-contact',owner,'owned-quiz',false)]}};
 if(name==='@/lib/seo')return {privateMetadata:{robots:{index:false}}};
 return {default:name.includes('ContactsOverview')?'ContactsOverview':'WorkspaceHeader'};
}});
function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]}
(async()=>{
 const result=await m.exports.default({searchParams:Promise.resolve({quiz:'owned-quiz'})});const overview=nodes(result).find(node=>node.type==='ContactsOverview');assert.equal(overview.props.contacts.length,1);const contact=overview.props.contacts[0];assert.equal(contact.id,'canonical-one');assert.equal(contact.answers,undefined);assert.equal(contact.grading.length,0);assert.equal(overview.props.initialQuiz,'owned-quiz');
 await assert.rejects(()=>m.exports.default({searchParams:Promise.resolve({quiz:'other-quiz'})}),/404/);
 storeFailed=true;await assert.rejects(()=>m.exports.default({searchParams:Promise.resolve({})}),/storage unavailable/);storeFailed=false;
 signedIn=false;reads=0;await assert.rejects(()=>m.exports.default({searchParams:Promise.resolve({})}),/login/);assert.equal(reads,0);
 console.log('PASS Contacts page: authentication before reads, owner/quiz isolation, canonical response IDs, omitted answers, selected quiz ownership and storage failure never shown as an empty directory.');
})().catch(error=>{console.error(error);process.exitCode=1});
