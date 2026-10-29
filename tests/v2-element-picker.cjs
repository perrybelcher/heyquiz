// Exercise the actual picker handlers with a deterministic hook harness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const Module = require('node:module');
const icons = require('lucide-react');
const source = fs.readFileSync('components/EditorStudio.tsx', 'utf8');
const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let paletteExpression;
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'PALETTE_SECTIONS') paletteExpression = node.initializer.getText(ast); ts.forEachChild(node, visit); }
visit(ast); assert.ok(paletteExpression, 'Use the real editor field registry');
const code = ts.transpileModule(`globalThis.result = ${paletteExpression}`, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const context = vm.createContext({...icons}); vm.runInContext(code, context);
const sections = context.result;
const expected = sections.flatMap(section => section.items.map(item => item.type));
assert.equal(new Set(expected).size, 51, 'Cover the current full field catalog');
let states = [], refs = [], si = 0, ri = 0;
const hooks = {
  ...require('react'), useId: () => 'picker-test', useEffect: () => {}, useMemo: fn => fn(),
  useState: initial => { const index = si++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
  useRef: initial => { const index = ri++; return refs[index] ||= {current:initial}; },
};
const originalLoad = Module._load;
Module._load = function(name, ...rest) { return name === 'react' ? hooks : originalLoad.call(this, name, ...rest); };
require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText, file);
const Picker = require('../components/v2/V2ElementPicker.tsx').default;
let inserted = [], closed = 0;
const props = {sections, location:'Insert after question 2', onSelect:type=>inserted.push(type), onClose:()=>closed++};
const render = () => { si=0;ri=0;return Picker(props); };
function nodes(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
let tree = render();
const options = tree => nodes(tree).filter(node => node.props?.['data-element-option']);
assert.deepEqual(options(tree).slice(0,8).map(node=>node.props['data-element-option']), ['multiple_choice','multiselect','picture_choice','short_answer','paragraph','dropdown','rating','switch']);
const seen = new Set();
for (let i=0;i<5;i++) {
  tree = render();
  const nav = nodes(tree).find(node => node.type === 'nav');
  nodes(nav).filter(node=>node.type==='button')[i].props.onClick();
  for (const option of options(render())) { assert.ok(!seen.has(option.props['data-element-option']), 'No field appears in multiple categories'); seen.add(option.props['data-element-option']); }
}
assert.deepEqual([...seen].sort(), [...expected].sort(), 'Every existing field remains discoverable');
tree = render();
const search = nodes(tree).find(node=>node.type==='input');
search.props.onChange({target:{value:'CAPTCHA'}});
assert.deepEqual(options(render()).map(node=>node.props['data-element-option']), ['captcha'], 'Search spans all categories');
search.props.onChange({target:{value:'NO SUCH FIELD'}});
assert.equal(options(render()).length, 0);
search.props.onChange({target:{value:'picture choice'}});
tree = render(); const option = options(tree)[0];
option.props.onClick(); option.props.onClick();
assert.deepEqual(inserted,['picture_choice'], 'Repeated activation inserts exactly once');
let prevented = false;
tree.props.onCancel({preventDefault(){prevented=true;}});
assert.equal(closed,1); assert.equal(prevented,true, 'Escape uses the controlled close handler');
console.log('PASS V2 picker: all 51 fields, exclusive categories, common ordering, cross-category search, no results, single insertion and Escape.');
