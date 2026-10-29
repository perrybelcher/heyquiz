// Acceptance checks for the responsive creation entry point. No browser or live services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(process.env.CREATION_TEST_ROOT||path.join(__dirname,'..'));
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
require.extensions['.css']=()=>{};
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...rest){return resolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,...rest);};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {quizTypes,quizTypeDefinitions}=require(path.join(root,'lib/quiz-types.ts'));
const {creationExamples}=require(path.join(root,'lib/creation-examples.ts'));
const {createQuizTemplate}=require(path.join(root,'lib/template-factory.ts'));
const {readGuestDraft}=require(path.join(root,'lib/guest-draft.ts'));
const {safeAuthReturn}=require(path.join(root,'lib/auth-return-path.ts'));
const {default:Landing}=require(path.join(root,'components/CreationLanding.tsx'));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
let selections=0,reads=0,writes=0;
Object.defineProperty(global,'localStorage',{configurable:true,get(){reads++;throw Error('storage unavailable');}});
Object.defineProperty(global,'sessionStorage',{configurable:true,get(){reads++;throw Error('storage unavailable');}});
const before=JSON.stringify(creationExamples);
function render(type,options={}){return renderToStaticMarkup(React.createElement(Landing,{selectedType:type,enabledTypes:quizTypes,example:creationExamples[type],onSelect:()=>selections++,...options}));}
for(const type of quizTypes){
 const example=creationExamples[type],form=createQuizTemplate(example.templateId,'acceptance-example');
 assert.equal(form.quizType,type,'Example must reference a template of its advertised type');
 for(const field of ['templateId','image','imageAlt','focalPoint','title','resultHeading','explanation','nextStep'])assert.ok(typeof example[field]==='string'&&example[field].trim(),`${type}: ${field}`);
 assert.ok(example.image.startsWith('/'),'Use a local image asset');assert.ok(fs.existsSync(path.join(root,'public',example.image)),'Example asset exists');
 assert.equal(example.title,form.title,'Show the actual template title');
 const html=render(type);
 for(const text of [example.title,example.resultHeading,example.explanation,example.nextStep])assert.ok(html.includes(escape(text)),`${type}: real example copy must render`);
 for(const target of [`/templates?quizType=${type}`,`/create/ai?quizType=${type}`,`/create/guided?quizType=${type}`])assert.ok(html.includes(`href="${target}"`),`${type}: ${target}`);
 assert.ok(html.includes(`href="/create/blank?quizType=${type}"`),'Blank creation carries the chosen outcome');
 assert.ok(!html.includes('class="cl-selected"'),'Redundant selected/preview badge is removed');
 assert.ok(!html.includes('class="cl-shortcuts"'),'Top strip is absent without a recoverable draft');
 assert.ok(/Example result/i.test(html));assert.ok(/View example/i.test(html));
 assert.ok(!html.includes('Continue where you left off'),'No resume action without valid draft');
 assert.equal(safeAuthReturn(`/create/ai?quizType=${type}`),`/create/ai?quizType=${type}`,'AI authentication accepts selected type');
 for(const candidate of quizTypes)assert.ok(html.includes(escape(quizTypeDefinitions[candidate].label)),`${type}: enabled chooser ${candidate}`);
}
const scored=['knowledge','scorecard'];
const gated=render('knowledge',{enabledTypes:scored});
for(const type of ['personality','product_finder','diagnostic','qualification'])assert.ok(!gated.includes(escape(quizTypeDefinitions[type].label)),'Disabled creation types absent from chooser');
assert.ok(gated.includes(escape(quizTypeDefinitions.knowledge.label)));assert.ok(gated.includes(escape(quizTypeDefinitions.scorecard.label)));
const draftA=createQuizTemplate(creationExamples.personality.templateId,'quiz-original');
const draftB=createQuizTemplate(creationExamples.knowledge.templateId,'quiz-another');
const records=new Map([['pippi-guest-draft',draftB.id],[`heyquiz-draft:${draftA.id}`,JSON.stringify(draftA)],[`heyquiz-draft:${draftB.id}`,JSON.stringify(draftB)]]);
const store={getItem:key=>records.get(key)??null,setItem(){writes++;}};
const resumeHtml=render('personality',{draft:{id:draftA.id,title:draftA.title}});
assert.ok(resumeHtml.includes(`href="/create/draft?draft=${draftA.id}"`),'Resume pins displayed draft even if shared pointer changes');
assert.ok(resumeHtml.includes(escape(draftA.title)));assert.ok(resumeHtml.includes('Continue where you left off'));
assert.equal(readGuestDraft(store,store,draftA.id).id,draftA.id,'Explicit draft wins over latest pointer');
assert.equal(readGuestDraft({getItem(){throw Error('blocked');}},store),null,'Blocked local storage fails safely');
assert.equal(readGuestDraft({getItem:key=>key==='pippi-guest-draft'?'bad':'{broken'}),null,'Corrupt draft is not resumable');
assert.equal(readGuestDraft({getItem:()=>null}),null,'No draft stays absent');
assert.equal(reads,0,'Presentation must not inspect browser storage during render');assert.equal(writes,0,'Preview/recovery reads never write drafts');assert.equal(selections,0,'Rendering must not trigger selection');assert.equal(JSON.stringify(creationExamples),before,'Rendering does not mutate authored example metadata');
console.log('PASS creation landing: six truthful typed previews, navigation/auth destinations, typed blank creation, feature gate, exact draft recovery, unavailable/corrupt storage and side-effect-free rendering');

// Execute the production controller with deterministic hooks and browser state.
const vm=require('node:vm');
function controller(enabled=true,initialQuizType){
 const states=[],effects=[],listeners=new Map(),history=[];let index=0,mounted=false,tree,storageWrites=0;
 const values=new Map([['pippi-guest-draft',draftA.id],[`heyquiz-draft:${draftA.id}`,JSON.stringify(draftA)]]);
 const storage={getItem:key=>values.get(key)??null,setItem(){storageWrites++;throw Error('controller must only read');}};
 const location={href:'https://pippi.example/create'+(initialQuizType?`?quizType=${initialQuizType}`:''),search:initialQuizType?`?quizType=${initialQuizType}`:''};
 const window={location,history:{pushState(_state,_unused,url){history.push(url);location.href='https://pippi.example'+url;location.search=new URL(location.href).search;}},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const jsx=(type,props)=>({type,props});
 const hooks={useState(initial){const at=index++;if(!(at in states))states[at]=initial;return [states[at],value=>{states[at]=value;}];},useEffect(fn){if(!mounted)effects.push(fn);}};
 const mockRequire=name=>{
  if(name==='react')return hooks;
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
  if(name.endsWith('WorkspaceHeader'))return {__esModule:true,default:'header'};
  if(name.endsWith('CreationLanding'))return {__esModule:true,default:'landing'};
  if(name==='@/lib/creation-examples')return {creationExamples};
  if(name==='@/lib/quiz-types')return {quizTypes,quizTypeDefinitions};
  if(name==='@/lib/outcome-availability')return {outcomeCreationEnabled:enabled};
  if(name==='@/lib/guest-draft')return {readGuestDraft};
  if(name==='@/lib/creation-quiz-type')return {creationQuizType:value=>quizTypes.includes(value)&&(enabled||quizTypeDefinitions[value].scored)?value:undefined};
  throw Error('Unexpected controller dependency '+name);
 };
 const compiledModule={exports:{}};
 const output=ts.transpileModule(fs.readFileSync(path.join(root,'components/CreationStart.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(output,{module:compiledModule,exports:compiledModule.exports,require:mockRequire,window,localStorage:storage,sessionStorage:storage,URL,URLSearchParams,console});
 function render(){index=0;tree=compiledModule.exports.default({initialQuizType});return tree.props.children.find(node=>node.type==='landing').props;}
 const first=render();assert.equal(storageWrites,0);for(const effect of effects)effect();mounted=true;
 return {first,render,window,listeners,history,values,states,get writes(){return storageWrites;}};
}
const c=controller();assert.equal(c.first.selectedType,'personality');assert.equal(c.first.draft,null);assert.equal(c.render().draft.id,draftA.id);
c.render().onSelect('diagnostic');assert.equal(c.render().selectedType,'diagnostic');assert.deepEqual(c.history,['/create?quizType=diagnostic']);assert.equal(c.writes,0);
c.window.location.search='?quizType=knowledge';c.listeners.get('popstate')();assert.equal(c.render().selectedType,'knowledge','Browser Back restores the URL selection');
c.window.location.search='?quizType=invalid';c.listeners.get('popstate')();assert.equal(c.render().selectedType,'personality','Unknown URL types safely fall back');
c.values.set('pippi-guest-draft','missing');c.listeners.get('storage')();assert.equal(c.render().draft,null,'Storage deletion removes stale resume');
assert.equal(controller(true,'qualification').first.selectedType,'qualification','Initial validated route type survives reload');
const disabled=controller(false,'personality');assert.equal(disabled.first.selectedType,'knowledge');assert.deepEqual(Array.from(disabled.first.enabledTypes),['knowledge','scorecard']);disabled.render().onSelect('personality');assert.equal(disabled.history.length,0,'Disabled type cannot be selected');
console.log('PASS creation controller: initial/default selection, URL navigation and Back, safe invalid/fenced type fallback, storage synchronization, no draft writes');

// Exercise actual hover/focus handlers without changing committed selection or URL.
{
 const state=[];let cursor=0,selected='personality',confirmed=0;
 const jsx=(type,props)=>({type,props});
 const compiled={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(path.join(root,'components/CreationLanding.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const load=name=>name==='react'?{useRef:()=>({current:null}),useState:value=>{const i=cursor++;if(!(i in state))state[i]=value;return[state[i],v=>state[i]=v];}}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='next/link'||name==='next/image'?{__esModule:true,default:name}:name.endsWith('.css')?{}:require(name);
 vm.runInNewContext(source,{module:compiled,exports:compiled.exports,require:load});
 function nodes(node){if(!node||typeof node!=='object')return[];return[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
 function view(){cursor=0;return nodes(compiled.exports.default({selectedType:selected,enabledTypes:quizTypes,example:creationExamples[selected],onSelect:type=>{selected=type;confirmed++;}}));}
 const row=(all,type)=>all.filter(n=>n.type==='button'&&n.props.className==='cl-type')[quizTypes.indexOf(type)];
 row(view(),'diagnostic').props.onPointerEnter({pointerType:'mouse'});
 let all=view();assert.equal(confirmed,0);assert.equal(row(all,'personality').props['aria-pressed'],true);assert.equal(row(all,'diagnostic').props['data-preview'],true);
 assert.ok(all.some(n=>n.type==='h2'&&n.props.children===creationExamples.diagnostic.title));
 assert.ok(all.some(n=>n.props?.className==='cl-blank'&&n.props.href==='/create/blank?quizType=diagnostic'),'Blank and template actions follow the displayed outcome');
 assert.ok(all.filter(n=>n.type==='next/image').every(n=>n.props.unoptimized&&n.props.loading==='eager'),'Small static images warm before switching without transform delay');
 row(all,'diagnostic').props.onClick();all=view();assert.equal(selected,'diagnostic');assert.equal(confirmed,1);
 row(all,'knowledge').props.onPointerEnter({pointerType:'touch'});assert.equal(row(view(),'diagnostic').props['data-preview'],true,'Touch does not create a hover selection');
 row(view(),'knowledge').props.onFocus();assert.equal(row(view(),'knowledge').props['data-preview'],true,'Keyboard focus previews');
 view()[0].props.onPointerLeave();assert.equal(row(view(),'diagnostic').props['data-preview'],true,'Leaving restores confirmed choice');
 console.log('PASS hover previews: mouse/focus preview, click confirmation, touch behavior, restore and warmed static images');
}
