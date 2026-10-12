// Deployment smoke test: the child can load only this route's traced tree and Node builtins.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const entry = '.next/server/app/api/result/[token]/pdf/route.js';
const tracePath = path.join(root, entry + '.nft.json');
const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
// macOS exposes /var through /private/var; keep guards and cwd on the same real path.
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pippi-pdf-package-')));
const isolated = path.join(temporary, 'deployment');
const allowIncomplete = process.env.ALLOW_INCOMPLETE_TRACE === '1';
const artifactDir = process.env.ARTIFACT_DIR ? path.resolve(process.env.ARTIFACT_DIR) : null;
const expectedHashes = {
  'NotoSans-Regular.ttf': '478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823',
  'NotoSans-Bold.ttf': '1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913',
  'OFL.txt': 'cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a',
};
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
function inTree(base, target) { const relative = path.relative(base, target); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }

// Serialized into a clean process. It imports no test helper or application source.
async function exerciseCompiledRoute() {
  const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), Module = require('node:module');
  const cwd = process.cwd(), originalResolve = Module._resolveFilename;
  function inside(filename) { const rel = path.relative(cwd, filename); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); }
  Module._resolveFilename = function(request, ...args) {
    const resolved = originalResolve.call(this, request, ...args);
    if (!Module.isBuiltin(resolved) && !inside(resolved)) throw Error('External module resolution blocked.');
    return resolved;
  };
  let networkAttempts = 0, externalReads = 0;
  const noNetwork = () => { networkAttempts++; throw Error('Outbound network blocked.'); };
  global.fetch = noNetwork;
  for (const [name, methods] of [['node:http', ['request', 'get']], ['node:https', ['request', 'get']], ['node:net', ['connect', 'createConnection']], ['node:tls', ['connect']], ['node:dns', ['lookup', 'resolve', 'resolve4', 'resolve6']]]) {
    const api = require(name); for (const method of methods) api[method] = noNetwork;
  }
  for (const method of ['lookup', 'resolve', 'resolve4', 'resolve6']) require('node:dns').promises[method] = noNetwork;
  const { fileURLToPath } = require('node:url');
  function permitted(filename) {
    if (typeof filename === 'number') return;
    const absolute = path.resolve(filename instanceof URL ? fileURLToPath(filename) : String(filename));
    if (!inside(absolute)) { externalReads++; throw Error('External file read blocked.'); }
  }
  for (const method of ['readFileSync', 'readFile', 'openSync', 'open']) { const original = fs[method]; fs[method] = function(filename, ...args) { permitted(filename); return original.call(this, filename, ...args); }; }
  for (const method of ['readFile', 'open']) { const original = fs.promises[method]; fs.promises[method] = function(filename, ...args) { permitted(filename); return original.call(this, filename, ...args); }; }

  const formId = 'pdf-package-' + crypto.randomUUID(), submissionId = crypto.randomUUID(), owner = 'synthetic-package-owner', createdAt = new Date(Date.now() - 1000).toISOString(), expiresAt = Date.now() + 120000;
  const dataDir = process.env.HEYQUIZ_DATA_DIR, reportId = 'result-' + submissionId;
  function put(kind, id, payload, ownerId = owner) {
    const directory = path.join(dataDir, kind); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, id + '.json'), JSON.stringify({ kind, id, owner_id: ownerId, version: 1, payload }), { mode: 0o600 });
  }
  function token(claims) { const payload = Buffer.from(JSON.stringify(claims)).toString('base64url'); return payload + '.' + crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url'); }
  const capability = token({ purpose: 'result-view', id: reportId, exp: expiresAt });
  const report = {
    formId, submissionId, createdAt, expiresAt, quizTitle: 'Packaged assessment — Café Ελληνικά Кириллица',
    theme: { primaryColor: '#922c3b', brandName: 'Synthetic Studio', hidePippiBranding: false, logoUrl: 'https://never-fetch.example/logo.png' }, heading: 'Saved result', message: 'Synthetic content.',
    result: { totalPointsEarned: 0, totalPointsPossible: 0, percentageScore: 0, marketing: {
      kind: 'scorecard', status: 'scored', presentation: { layout: 'stacked' }, title: 'Your practical next step', message: 'A frozen report built from deployment files only.',
      overallScore: null, reasons: ['A preserved reason.'], priorities: [{ categoryId: 'area-a', title: 'Start small', action: 'Choose one habit.' }], advice: 'Make a little time each week.', ctaLabel: 'Read more', ctaUrl: 'https://example.test/plan',
      categories: [{ id: 'area-a', title: 'Consistency', description: 'Keep going.', score: 0, answered: 1, applicable: 2, minAnswers: 1 }, { id: 'area-b', title: 'Support', description: 'More context is needed.', score: null, answered: 0, applicable: 2, minAnswers: 1 }],
      resultSections: [{ id: 'section-a', type: 'image', title: 'Your plan', body: 'Media remains online.', label: 'View image', url: 'https://never-fetch.example/image.png' }],
    } },
  };
  put('forms', formId, { id: formId }); put('submissions', submissionId, { formId }); put('result_reports', reportId, report);
  const compiled = require('./.next/server/app/api/result/[token]/pdf/route.js');
  assert.equal(typeof compiled.routeModule?.userland?.GET, 'function', 'Compiled route must expose its actual GET handler.');
  const GET = compiled.routeModule.userland.GET;
  async function request(value = capability) {
    // The token is passed only through the required route parameter, never logged.
    return GET(new Request('http://localhost/api/result/synthetic/pdf', { headers: { 'x-forwarded-for': '127.0.0.1' } }), { params: Promise.resolve({ token: value }) });
  }
  function privacy(response) {
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('x-robots-tag'), /noindex/); assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  const results = [];
  if (process.env.PACKAGING_CASE === 'missing-font') {
    const font = path.join(cwd, 'assets/pdf-fonts/NotoSans-Regular.ttf'), held = font + '.held';
    fs.renameSync(font, held);
    try { const failed = await request(); assert.equal(failed.status, 503); privacy(failed); assert.equal((await failed.json()).code, 'pdf_unavailable'); results.push({ case: 'missing-font', status: 503 }); }
    finally { fs.renameSync(held, font); }
    const retry = await request(); assert.equal(retry.status, 200); privacy(retry); const pdf = Buffer.from(await retry.arrayBuffer()); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); results.push({ case: 'font-restored-retry', status: 200, pdfBytes: pdf.length });
  } else {
    for (const layout of ['stacked', 'score_overview', 'action_plan']) {
      report.result.marketing.presentation.layout = layout; put('result_reports', reportId, report);
      const started = performance.now(), response = await request(); assert.equal(response.status, 200); privacy(response);
      assert.equal(response.headers.get('content-type'), 'application/pdf'); assert.equal(response.headers.get('content-disposition'), 'attachment; filename="pippi-result.pdf"');
      const pdf = Buffer.from(await response.arrayBuffer()); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.equal(Number(response.headers.get('content-length')), pdf.length); assert.ok(pdf.length > 1000 && pdf.length <= 3 * 1024 * 1024);
      assert.ok(!pdf.includes(Buffer.from(capability))); assert.ok(!pdf.includes(Buffer.from(formId))); assert.ok(!pdf.includes(Buffer.from(submissionId)));
      results.push({ case: layout, status: 200, pdfBytes: pdf.length, elapsedMs: Math.round(performance.now() - started) });
    }
    const invalid = await request('invalid'); assert.equal(invalid.status, 404); privacy(invalid); assert.equal((await invalid.json()).code, 'result_unavailable'); results.push({ case: 'invalid-capability', status: 404 });
    put('submissions', submissionId, { formId }, 'other-synthetic-owner'); const foreign = await request(); assert.equal(foreign.status, 404); privacy(foreign); results.push({ case: 'mismatched-owner', status: 404 }); put('submissions', submissionId, { formId });
    report.result.marketing.message = 'Unsupported Arabic مرحبا'; put('result_reports', reportId, report); const unsupported = await request(); assert.equal(unsupported.status, 422); privacy(unsupported); assert.equal((await unsupported.json()).code, 'browser_print_required'); results.push({ case: 'unsupported-language', status: 422 });
    fs.unlinkSync(path.join(dataDir, 'submissions', submissionId + '.json')); const deleted = await request(); assert.equal(deleted.status, 404); privacy(deleted); results.push({ case: 'deleted-response', status: 404 });
  }
  assert.equal(networkAttempts, 0); assert.equal(externalReads, 0);
  const loaded = Object.keys(require.cache); assert.ok(loaded.every(inside));
  const loadedFonts = fs.readdirSync(path.join(cwd, 'assets/pdf-fonts')).filter(name => /\.(ttf|otf|woff2?)$/i.test(name)); assert.deepEqual(loadedFonts.sort(), ['NotoSans-Bold.ttf', 'NotoSans-Regular.ttf']);
  return { results, networkAttempts, externalReads, loadedModules: loaded.length, rssBytes: process.memoryUsage().rss, node: process.version };
}

try {
  assert.ok(Array.isArray(trace.files) && trace.files.length > 0, 'Missing compiled file trace.');
  assert.ok(!trace.additionalRoots?.length, 'Additional tracing roots need explicit packaging review.');
  const sources = [...new Set([path.join(root, entry), ...trace.files.map(file => path.resolve(path.dirname(tracePath), file))])];
  const inventory = [];
  for (const source of sources) {
    assert.ok(inTree(root, source), 'A trace file is outside the project root.'); assert.ok(inTree(root, fs.realpathSync(source)), 'A trace symlink leaves the project.');
    const relative = path.relative(root, source), destination = path.join(isolated, relative), data = fs.readFileSync(source);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, data);
    inventory.push({ path: relative, bytes: data.length, sha256: sha256(data) });
  }
  const gaps = [];
  const extras = inventory.filter(file => /^(?:data|docs|tests|coverage|\.heyquiz-data)\//.test(file.path) || /(?:^|\/)\.env(?:\.|$)/.test(file.path));
  if (extras.length) gaps.push('Unnecessary private/runtime/test paths traced: ' + extras.map(file => file.path).join(', '));
  const provenancePath = path.join(isolated, 'assets/pdf-fonts/provenance.json');
  assert.ok(fs.existsSync(provenancePath), 'Font provenance must be traced.');
  const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  assert.equal(provenance.release, 'NotoSans-v2.015'); assert.equal(provenance.source, 'https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSans-v2.015/NotoSans-v2.015.zip');
  assert.equal(provenance.files.length, 3);
  for (const [name, hash] of Object.entries(expectedHashes)) {
    const record = provenance.files.find(file => file.file === name); assert.ok(record); assert.equal(record.sha256, hash);
    const file = path.join(isolated, 'assets/pdf-fonts', name);
    if (!fs.existsSync(file)) { gaps.push('Required font/license asset not traced: ' + name); continue; }
    const data = fs.readFileSync(file); assert.equal(data.length, record.bytes); assert.equal(sha256(data), hash);
    if (name === 'OFL.txt') { assert.match(data.toString(), /SIL OPEN FONT LICENSE Version 1\.1/); assert.match(data.toString(), /Copyright/); }
  }
  const summaries = [];
  for (const packagingCase of ['normal', 'missing-font']) {
    const env = {
      PATH: process.env.PATH || '', NODE_ENV: 'production', NODE_PATH: '', NODE_OPTIONS: '', HOME: path.join(isolated, '.isolated-home'),
      SESSION_SECRET: crypto.randomBytes(40).toString('hex'), HEYQUIZ_LOCAL_MODE: '1', HEYQUIZ_DATA_DIR: path.join(isolated, '.synthetic-records-' + packagingCase), PACKAGING_CASE: packagingCase,
    };
    const script = '(' + exerciseCompiledRoute.toString() + ')().then(value=>process.stdout.write(JSON.stringify(value))).catch(error=>{process.stderr.write(JSON.stringify({name:error.name,message:error.message}));process.exitCode=1;});';
    const result = spawnSync(process.execPath, ['-e', script], { cwd: isolated, env, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    if (result.error) throw Error('Isolated compiled process failed: ' + result.error.code);
    assert.equal(result.status, 0, 'Isolated compiled route failed: ' + result.stderr);
    const summary = JSON.parse(result.stdout); summaries.push({ packagingCase, ...summary });
    for (const item of summary.results) console.log('PASS isolated compiled route ' + item.case + ' (' + item.status + ')' + (item.pdfBytes ? ', ' + item.pdfBytes + ' PDF bytes' : ''));
  }
  const report = { releaseGatePassed: gaps.length === 0, prototypeAllowance: allowIncomplete, traceFiles: trace.files.length, deploymentFilesIncludingEntry: inventory.length, totalBytes: inventory.reduce((sum, file) => sum + file.bytes, 0), fontRelease: provenance.release, gaps, summaries, inventory };
  if (artifactDir) { fs.mkdirSync(artifactDir, { recursive: true }); fs.writeFileSync(path.join(artifactDir, 'packaging-results.json'), JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify({ traceFiles: report.traceFiles, totalBytes: report.totalBytes, releaseGatePassed: report.releaseGatePassed, gaps }));
  if (gaps.length && !allowIncomplete) throw Error('Deployment trace gate failed; see inventory gaps above.');
  console.log(gaps.length ? 'PROTOTYPE ONLY: isolated runtime passed, but trace inventory is not release-ready.' : 'PASS traced-only compiled PDF package, font hashes/license and zero external file/network access.');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
