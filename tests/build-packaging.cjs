// Run after next build. Deployment traces must not include local records or secrets.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = path.join(root, '.next/server');
let traces = 0;
const unsafe = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.nft.json')) {
      traces++;
      for (const referenced of JSON.parse(fs.readFileSync(file,'utf8')).files) {
        const relative = path.relative(root, path.resolve(path.dirname(file),referenced));
        if (/^(?:\.heyquiz-data\/|\.env(?:\.|$)|tests\/|coverage\/)/.test(relative)) unsafe.push({trace:path.relative(root,file),file:relative});
      }
    }
  }
}
walk(server);
assert.ok(traces > 0,'Build first: no server traces found');
assert.deepEqual(unsafe, [], 'Local data, secrets, and QA artifacts must not ship');
console.log(`PASS ${traces} server traces contain no local records, env files, tests, or coverage`);
