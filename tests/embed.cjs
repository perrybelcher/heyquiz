const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {quizEmbedCode,validEmbedHeight,validEmbedChannel,EMBED_MIN_HEIGHT,EMBED_MAX_HEIGHT}=require('../lib/embed.ts');
assert.equal(quizEmbedCode('javascript:alert(1)','quiz','Title'), '');
const code=quizEmbedCode('https://app.example','quiz-1','A "title" </iframe><script>alert(1)</script>');
assert.match(code,/title="A &quot;title&quot; &lt;\/iframe&gt;&lt;script&gt;/);assert.equal((code.match(/<script/g)||[]).length,1);assert.match(code,/\?embed=1/);assert.match(code,/height="700"/);assert.match(code,/new tab/);assert.doesNotMatch(quizEmbedCode('https://app.example','quiz-1','Quiz',false),/<script|data-pippi-embed/);
for(const value of [NaN,Infinity,-1,0,199,30001,500.5,'500',null,{},[]])assert.equal(validEmbedHeight(value),false);
assert.equal(validEmbedHeight(EMBED_MIN_HEIGHT),true);assert.equal(validEmbedHeight(EMBED_MAX_HEIGHT),true);assert.equal(validEmbedChannel('a'.repeat(32)),true);assert.equal(validEmbedChannel('<script>'),false);
const listeners={},elements=[],requests=[],scrolls=[],origin='https://app.example';let mutation;
function iframe(id,src=origin+'/play/'+id+'?embed=1'){
 const attributes={src,'data-pippi-embed':''},events={};const frame={isConnected:true,style:{height:'700px'},getBoundingClientRect:()=>({top:-1000}),getAttribute:n=>attributes[n],hasAttribute:n=>Object.hasOwn(attributes,n),setAttribute:(n,v)=>attributes[n]=v,addEventListener:(n,fn)=>events[n]=fn,removeEventListener:n=>delete events[n],contentWindow:{postMessage:(message,target)=>requests.push({id,message,target})},events};elements.push(frame);return frame;
}
const a=iframe('a'),b=iframe('b'),foreign=iframe('foreign','https://other.example/play/x?embed=1');
const context={URL,Map,Uint32Array,Number,Array,Object,Math,document:{currentScript:{src:origin+'/pippi-embed.js'},baseURI:'https://host.example/page',documentElement:{},querySelectorAll:()=>elements},window:{innerHeight:900,scrollY:2000,scrollTo:position=>scrolls.push(position),addEventListener:(name,fn)=>listeners[name]=fn},MutationObserver:class{constructor(fn){mutation=fn;}observe(){}}};
vm.createContext(context);const script=fs.readFileSync(require.resolve('../public/pippi-embed.js'),'utf8');vm.runInContext(script,context);
const channel=id=>requests.filter(r=>r.id===id).at(-1).message.channel;
const message=(frame,height,extra={})=>listeners.message({origin,source:frame.contentWindow,data:{type:'pippi:embed:resize',version:1,channel:channel(frame===a?'a':'b'),height},...extra});
assert.equal(requests.length,2);assert.equal(requests.every(r=>r.target===origin),true);assert.notEqual(channel('a'),channel('b'));
message(a,500);assert.equal(a.style.height,'500px');assert.equal(b.style.height,'700px');
message(a,900,{origin:'https://evil.example'});message(a,900,{source:foreign.contentWindow});message(a,900,{data:{type:'pippi:embed:resize',version:1,channel:channel('b'),height:900}});assert.equal(a.style.height,'500px');
for(const height of [NaN,Infinity,-2,199,30001,400.5,'800',null,{},[]])message(a,height);assert.equal(a.style.height,'500px');
message(b,1400);assert.equal(b.style.height,'1400px');assert.equal(a.style.height,'500px');
assert.equal(scrolls.length,0,'passive resizes never scroll');
context.document.activeElement=b;
message(a,500,{data:{type:'pippi:embed:resize',version:1,channel:channel('a'),height:500,revealTop:100,revealBottom:130}});assert.equal(scrolls.length,0,'a delayed response cannot take focus from another iframe');
context.document.activeElement={tagName:'BUTTON'};
message(a,500,{data:{type:'pippi:embed:resize',version:1,channel:channel('a'),height:500,revealTop:100,revealBottom:130}});assert.equal(scrolls.length,0,'a delayed response cannot scroll away from host content');
context.document.activeElement=a;
message(a,500,{data:{type:'pippi:embed:resize',version:1,channel:channel('a'),height:500,revealTop:100,revealBottom:130}});assert.equal(scrolls.length,1);assert.equal(scrolls[0].top,1076);
for(const revealTop of [-1,NaN,Infinity,501,'100'])message(a,500,{data:{type:'pippi:embed:resize',version:1,channel:channel('a'),height:500,revealTop,revealBottom:130}});assert.equal(scrolls.length,1,'invalid reveal coordinates cannot move the host');
const old=channel('a');a.events.load();assert.notEqual(channel('a'),old);message(a,1500,{data:{type:'pippi:embed:resize',version:1,channel:old,height:1500}});assert.equal(a.style.height,'500px');
vm.runInContext(script,context);assert.equal(requests.filter(r=>r.id==='a').length,2,'repeated snippets do not duplicate listeners/init');
a.isConnected=false;mutation();message(a,1300);assert.equal(a.style.height,'500px');
// An offscreen cross-origin iframe may receive messages while its animation
// frames are suspended. Its first height must not depend on rAF firing.
const queue=[],reported=[],childListeners={},parent={},observed={};let cleanup;
parent.postMessage=(message,target)=>reported.push({message,target});
const element={height:1200,getBoundingClientRect(){return {height:this.height,top:0}},querySelector:()=>null,addEventListener(){},removeEventListener(){}};
const childContext={exports:{},require:name=>name==='react'?{useRef:value=>({current:value}),useEffect:effect=>{cleanup=effect()}}:require('../lib/embed.ts'),queueMicrotask:callback=>queue.push(callback),requestAnimationFrame:()=>{throw Error('Offscreen measurement must not require a paint frame')},window:{parent,addEventListener:(type,callback)=>childListeners[type]=callback,removeEventListener:type=>delete childListeners[type]},document:{fonts:{ready:{then(){}}}},ResizeObserver:class{constructor(callback){observed.resize=callback}observe(){}disconnect(){}},MutationObserver:class{constructor(callback){observed.mutate=callback}observe(){}disconnect(){}}};
vm.createContext(childContext);vm.runInContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/EmbedResizeReporter.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,childContext);
childContext.exports.default({target:{current:element},navigationKey:'landing'});
assert.equal(reported[0].message.type,'pippi:embed:ready');
childListeners.message({source:parent,origin:'https://host.example',data:{type:'pippi:embed:init',version:1,channel:'abc123def456ghi789'}});
assert.equal(queue.length,1);while(queue.length)queue.shift()();assert.equal(reported.at(-1).message.height,1202);assert.equal(reported.at(-1).target,'https://host.example');
element.height=500;observed.resize();observed.mutate();assert.equal(queue.length,1,'notifications coalesce');while(queue.length)queue.shift()();assert.equal(reported.at(-1).message.height,502,'offscreen content can shrink');
const count=reported.length;observed.resize();cleanup();while(queue.length)queue.shift()();assert.equal(reported.length,count,'queued work is discarded after unmount');
console.log('PASS embed code/fallback, bounds, exact origin/source/channel isolation, reload/detached safety, active-frame-only reveal and offscreen measurement without animation frames');
