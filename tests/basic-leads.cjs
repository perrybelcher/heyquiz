const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require.extensions['.ts']=require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const load=Module._load;Module._load=function(name,parent,main){return load.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,main)};
const Settings=require('../components/BasicLeadCaptureSettings.tsx').default;
const {defaultCapture,CaptureSchema,parseContact}=require('../lib/contacts.ts');
let config={...defaultCapture,enabled:true,marketingEnabled:false},changes=0;
function tree(){return Settings({config,onChange:value=>{config=value;changes++},children:React.createElement('input',{'aria-label':'Privacy-policy link'})})}
function nodes(t){return !t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)]}
function text(t){if(typeof t==='string')return t;if(!t||typeof t!=='object')return '';return [t.props?.children].flat(Infinity).map(text).join(' ')}
function label(name){const found=nodes(tree()).find(n=>n.type==='label'&&text(n).trim().startsWith(name));assert.ok(found,name);return nodes(found).find(n=>['input','select','textarea'].includes(n.type))}
function change(name,value){const node=label(name);node.props.onChange({target:node.props.type==='checkbox'?{checked:value}:{value}});CaptureSchema.parse(config)}
change('Require contact details',true);assert.equal(config.required,true);assert.equal(config.marketingEnabled,false);
change('Name field','required');change('Phone field','optional');assert.equal(config.name,'required');assert.equal(config.phone,'optional');
assert.throws(()=>parseContact(config,null,1),/contact details/);
change('Contact button label','Continue to my advice');change('When to ask','after_results');assert.equal(config.required,false);assert.equal(config.buttonText,'Continue to my advice');assert.equal(label('Require contact details').props.disabled,true);assert.equal(parseContact(config,null,1),undefined);
change('When to ask','before_results');assert.equal(config.required,false,'Returning before results must not silently require details');
config={...config,buttonText:'See my results'};change('When to ask','after_results');assert.equal(config.buttonText,'Save my details');
change('Offer a separate',true);change('Marketing consent wording','Optional updates, please');
assert.equal(parseContact(config,{email:'synthetic@example.test',name:'Synthetic',marketingConsent:false},1).marketingConsent,false);
const before={...config};change('Collect contact details',false);change('Collect contact details',true);assert.deepEqual(config,before);
const markup=renderToStaticMarkup(React.createElement(Settings,{config,onChange:()=>{},children:null}));
assert.match(markup,/<fieldset disabled=""/);assert.doesNotMatch(markup,/checked=""[^>]*type="checkbox"[^>]*required/);assert.match(markup,/Preview only/);assert.match(markup,/Skip for now/);
const preview=nodes(tree()).find(n=>typeof n.type==='function'&&n.type.name==='LeadCapture');assert.ok(preview);assert.equal(preview.props.config.marketingEnabled,true);assert.equal(changes>8,true);
console.log('PASS Basic lead settings: capture timing/optional invariant, fields, custom copy preservation, unchanged consent defaults, disable/re-enable retention and disabled respondent-form preview.');
