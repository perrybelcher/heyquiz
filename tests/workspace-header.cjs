// Actual server-rendered header and exported click semantics; no HTTP/providers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
require.extensions['.css']=()=>{};const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...rest){return resolve.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,...rest)};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {default:Header,workspaceProfileLabel,workspaceProfileInitials,usesNativeWorkspaceLink}=require('../components/WorkspaceHeader.tsx');
const html=renderToStaticMarkup(React.createElement(Header,{active:'reports'}));
for(const href of ['/','/reports','/contacts','/templates','/create'])assert.ok(html.includes(`href="${href}"`),href);
const contactHeader=renderToStaticMarkup(React.createElement(Header,{active:'contacts'}));assert.match(contactHeader,/aria-current="page"[^>]*>Contacts<\/a>/);
assert.match(html,/<header[^>]*class="workspace-header"/);assert.match(html,/aria-current="page"[^>]*>Reports<\/a>/);assert.ok(!html.includes('aria-current="page" class="workspace-header-link is-current ">Templates'));
assert.match(html,/aria-label="Workspace menu"[^>]*aria-expanded="false"/);assert.match(html,/aria-label="Profile"[^>]*aria-expanded="false"/);
assert.equal(workspaceProfileLabel({name:'  Corné van Willigen ',email:'c@example.test'}),'Corné van Willigen');assert.equal(workspaceProfileInitials({name:'Corné Willigen',email:''}),'CW');assert.equal(workspaceProfileLabel({name:'',email:'c@example.test'}),'c@example.test');assert.equal(workspaceProfileLabel({name:'',email:'',local:true}),'Local workspace');assert.equal(workspaceProfileLabel(null),'My profile');
const click={button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false};assert.equal(usesNativeWorkspaceLink(click),false);for(const key of ['metaKey','ctrlKey','shiftKey','altKey','defaultPrevented'])assert.equal(usesNativeWorkspaceLink({...click,[key]:true}),true);assert.equal(usesNativeWorkspaceLink({...click,button:1}),true);
console.log('PASS workspace header: actual markup destinations/active indicators, accessible disclosure state, profile identity fallbacks and native modified-click semantics.');
