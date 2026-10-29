const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, file);
const {outlineDropTarget} = require('../components/v2/editor-order.ts');
const initial = [{id:'a',pageId:'A',points:7},{id:'b',pageId:'B',points:9},{id:'c',pageId:'A',points:3},{id:'d',pageId:'B',points:2}];
const outline = ['a','c','b','d'];
function move(active, over) {
  const target = outlineDropTarget(initial, outline, active, over, 'A');
  const moved = initial.find(q=>q.id===active), rest = initial.filter(q=>q.id!==active);
  rest.splice(target.beforeId ? rest.findIndex(q=>q.id===target.beforeId) : rest.length,0,{...moved,pageId:target.targetPageId});
  return rest;
}
let result = move('a','c');
assert.deepEqual(result.filter(q=>q.pageId==='A').map(q=>q.id),['c','a'],'Downward same-page move works with interleaved storage order');
result = move('a','b');
assert.deepEqual(result.filter(q=>q.pageId==='B').map(q=>q.id),['b','a','d'],'Cross-page downward drop lands after hovered question');
assert.equal(result.find(q=>q.id==='a').points,7,'Question fields survive movement');
result = move('d','a');
assert.deepEqual(result.filter(q=>q.pageId==='A').map(q=>q.id),['d','a','c'],'Cross-page upward drop lands before hovered question');
result = move('a','d');
assert.deepEqual(result.filter(q=>q.pageId==='B').map(q=>q.id),['b','d','a'],'Dropping after final row appends to hovered page');
assert.equal(outlineDropTarget(initial,outline,'a','a','A'),null);
assert.equal(outlineDropTarget(initial,outline,'missing','a','A'),null);
assert.deepEqual(initial.map(q=>q.id),['a','b','c','d'],'Target resolution does not mutate input');
console.log('PASS V2 outline reorder: interleaved pages, upward/downward cross-page drops, final-row append, field preservation and no-op validation.');
