/* Offline, explicit-manifest audit. Never discovers files or reads Git history.
 * Findings intentionally contain relative path + rule only: no matching values,
 * lines, error messages, credentials, or decoded token payloads are printed. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const os = require('node:os');

const ROOT_FILES = new Set(['.env.example', 'README.md', 'AGENTS.md', '.gitignore', 'package.json', 'package-lock.json', 'eslint.config.mjs', 'instrumentation.ts', 'next.config.ts', 'tsconfig.json', 'test-framer.tsx']);
const SOURCE_ROOTS = new Set(['app', 'components', 'hooks', 'lib', 'tests', 'scripts', 'database', 'docs', 'public']);
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.md', '.mdx', '.sql', '.svg', '.txt', '.xml', '.webmanifest']);
const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif', '.woff', '.woff2', '.ttf']);
const PDF_ASSETS = new Set(['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'OFL.txt', 'README.md', 'provenance.json']);
const MAX_BYTES = 32 * 1024 * 1024;
const segmentDeny = /^(?:\.git|\.next|\.vercel|\.aws|\.ssh|\.heyquiz-data|node_modules|data|test-data|test-results|playwright-report|coverage|build|out|credentials?|secrets?)$/i;
function allowedPath(value) {
  if (typeof value !== 'string' || !value || value.length > 500 || /[\\\x00-\x1f\x7f]/.test(value) || path.posix.isAbsolute(value)) return false;
  if (value === 'app/favicon.ico') return true; // Next metadata asset; bytes are hashed only.
  if (value === '.env.example') return true; // Reviewed placeholder-only root exception; validated below.
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || segmentDeny.test(p) || /^\.env(?:\.|$)/i.test(p))) return false;
  if (/\.(?:log|har|zip|tar|gz|pdf|pem|key|p12|pfx|tsbuildinfo|map)$/i.test(value) || /(?:^|\/)(?:next-env\.d\.ts|\.DS_Store|\.npmrc|\.yarnrc.*|storage[-_.]?state(?:\.[^/]*)?|.*\.trace)(?:$|\/)/i.test(value)) return false;
  if (value.startsWith('docs/qa-')) return false;
  if (ROOT_FILES.has(value)) return true;
  if (value.startsWith('assets/pdf-fonts/')) return parts.length === 3 && PDF_ASSETS.has(parts[2]);
  if (!SOURCE_ROOTS.has(parts[0]) || parts.length < 2) return false;
  const ext = path.posix.extname(value).toLowerCase();
  if (parts[0] === 'docs') return ext === '.md';
  if (parts[0] === 'public') return TEXT_EXTENSIONS.has(ext) || ASSET_EXTENSIONS.has(ext);
  return TEXT_EXTENSIONS.has(ext);
}
// Exact fixture-like values only. A real test-mode provider key is still a key;
// "test" appearing somewhere inside an otherwise plausible key is not ignored.
function placeholder(value) {
  const v = value.replace(/^(?:sb_secret_|sk_(?:live|test)_|sk-proj-|gh[pousr]_|github_pat_|re_)/, '');
  return /^(?:(?:FAKE|TEST|EXAMPLE|DUMMY|PLACEHOLDER|REPLACE_ME|NOT_A_REAL)(?:[_-][A-Z0-9_-]+)?)$/i.test(v)
    || /^([A-Za-z0-9])\1{15,}$/.test(v)
    || /^(?:<[^<>]+>|\$\{[^}]+\})$/.test(v);
}
function contentRules(text) {
  const rules = new Set();
  const patterns = [
    ['private-key-block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b/g],
    ['google-api-key', /\bAIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g],
    ['supabase-secret-key', /\bsb_secret_[A-Za-z0-9_-]{20,150}\b/g],
    ['stripe-secret-key', /\bsk_(?:live|test)_[A-Za-z0-9]{24,150}\b/g],
    ['openai-secret-key', /\b(?:sk-proj-[A-Za-z0-9_-]{40,255}|sk-[A-Za-z0-9]{48})(?![A-Za-z0-9_-])/g],
    ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{24,180}\b/g],
    ['aws-access-key-id', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ];
  for (const [rule, regex] of patterns) {
    for (const match of text.matchAll(regex)) if (!placeholder(match[0])) rules.add(rule);
  }
  const assignments = /\b(SESSION_SECRET|SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)|GEMINI_API_KEY|NANGO_SECRET_KEY|TURNSTILE_SECRET_KEY|RESEND_API_KEY|STRIPE_SECRET_KEY)["']?\s*[:=]\s*["'`]([A-Za-z0-9_./+=-]{24,500})["'`]/g;
  for (const match of text.matchAll(assignments)) {
    const v = match[2];
    // Require a token-shaped, varied value, not a prose fixture description.
    if (!placeholder(v) && new Set(v).size >= 10 && (/^[a-f\d]{32,}$/i.test(v) || /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v))) rules.add('hardcoded-server-secret');
  }
  const jwt = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\b/g;
  for (const match of text.matchAll(jwt)) {
    try { if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8')).role === 'service_role') rules.add('privileged-service-role-token'); } catch { /* Not a parsed privileged JWT. */ }
  }
  return [...rules].sort();
}
function environmentExampleRules(text) {
  const keys = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const parsed = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!parsed || keys.has(parsed[1])) return ['environment-example-not-placeholder-only'];
    keys.add(parsed[1]);
    const key = parsed[1];
    let value = parsed[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
    if (!value) continue;
    if (key === 'HEYQUIZ_LOCAL_MODE' && /^[01]$/.test(value)) continue;
    if (key === 'GEMINI_MODEL' && /^[a-z][a-z0-9.-]{1,99}$/.test(value)) continue;
    if (key === 'NANGO_HUBSPOT_INTEGRATION_ID' && value === 'hubspot') continue;
    return ['environment-example-not-placeholder-only'];
  }
  return [];
}
function fileWithoutLinks(root, relative) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return null;
  }
  return current;
}
function audit(root, manifest) {
  const findings = [], add = (file, rule) => findings.push({path: file, rule});
  const entries = manifest && Array.isArray(manifest.files) ? manifest.files : null;
  if (!entries || !entries.length || entries.length > 10000) return {passed: false, filesListed: 0, textFilesChecked: 0, assetFilesHashed: 0, findings: [{path: '<manifest>', rule: 'invalid-explicit-manifest'}]};
  let textFilesChecked = 0, assetFilesHashed = 0;
  const seen = new Set();
  try { if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw Error(); } catch { return {passed: false, filesListed: entries.length, textFilesChecked, assetFilesHashed, findings: [{path: '<candidate>', rule: 'invalid-candidate-directory'}]}; }
  for (const entry of entries) {
    const file = entry && entry.path;
    const safeName = typeof file === 'string' && file.length <= 500 && !/[\x00-\x1f\x7f]/.test(file) ? file : '<manifest>';
    if (!allowedPath(file)) { add(safeName, 'path-not-allowlisted'); continue; }
    if (seen.has(file)) { add(file, 'duplicate-manifest-path'); continue; }
    seen.add(file);
    if (typeof entry.sha256 !== 'string' || !/^[a-f\d]{64}$/.test(entry.sha256)) { add(file, 'invalid-manifest-hash'); continue; }
    let fd;
    try {
      const filename = fileWithoutLinks(root, file);
      if (!filename) { add(file, 'symlink-not-permitted'); continue; }
      fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size > MAX_BYTES) { add(file, 'invalid-or-oversized-file'); continue; }
      const bytes = fs.readFileSync(fd);
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) add(file, 'manifest-hash-mismatch');
      const ext = path.posix.extname(file).toLowerCase();
      if (ASSET_EXTENSIONS.has(ext)) { assetFilesHashed++; continue; }
      let text;
      try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { add(file, 'non-utf8-source'); continue; }
      if (text.includes('\0')) { add(file, 'binary-source-content'); continue; }
      textFilesChecked++;
      if (file === '.env.example') for (const rule of environmentExampleRules(text)) add(file, rule);
      for (const rule of contentRules(text)) add(file, rule);
    } catch { add(file, 'file-unreadable'); } finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  return {passed: findings.length === 0, filesListed: entries.length, textFilesChecked, assetFilesHashed, findings};
}
function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pippi-audit-unit-'));
  let groups = 0;
  const check = fn => { fn(); groups++; };
  try {
    const hash = value => crypto.createHash('sha256').update(value).digest('hex');
    const put = (p, content) => { fs.mkdirSync(path.dirname(path.join(root,p)), {recursive: true}); fs.writeFileSync(path.join(root,p),content); return {path:p,sha256:hash(content)}; };
    const clean = put('lib/clean.ts', 'export const sample = process.env.SESSION_SECRET;');
    check(() => assert.equal(audit(root,{files:[clean]}).passed,true));
    const gh = ['gh','p_', 'Ab7Cd8Ef9Gh0Ij1Kl2Mn3Op4Qr5St6Uv7Wx8'].join('');
    const dirty = put('lib/dirty.ts',`const value = "${gh}";`);
    check(() => { const result=audit(root,{files:[dirty]}); assert.deepEqual(result.findings,[{path:'lib/dirty.ts',rule:'github-token'}]); assert.ok(!JSON.stringify(result).includes(gh)); });
    check(() => { const key=['-----BEGIN ','RSA PRIVATE',' KEY-----'].join(''); assert.deepEqual(contentRules(key),['private-key-block']); });
    check(() => { const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from('{"role":"service_role"}').toString('base64url'),'z'.repeat(43)].join('.'); assert.ok(contentRules(token).includes('privileged-service-role-token')); });
    check(() => { for(const value of ['sb_secret_'+'FAKE_'.repeat(8),'sk_live_'+'x'.repeat(30),'EXAMPLE_SESSION_SECRET_VALUE','process.env.SESSION_SECRET']) assert.deepEqual(contentRules(value),[]); });
    check(() => { const value=['sk_','test_', 'AB7Cd8Ef9Gh0Ij1Kl2Mn3Op4Qr5St6Uv'].join(''); assert.ok(contentRules(value).includes('stripe-secret-key')); });
    check(() => { for(const p of ['.env','.env.local','lib/.env.example','data/forms.json','.git/config','docs/qa-2026/log.md','public/archive.zip','tests/state/storage-state.json','lib/../lib/clean.ts','/absolute.ts','lib\\clean.ts']) assert.equal(allowedPath(p),false,p); });
    check(() => { const result=audit(root,{files:[{path:'.env.local',sha256:'a'.repeat(64)}]}); assert.equal(result.findings[0].rule,'path-not-allowlisted'); });
    check(() => assert.equal(audit(root,{files:[{...clean,sha256:'a'.repeat(64)}]}).findings[0].rule,'manifest-hash-mismatch'));
    check(() => { fs.symlinkSync(path.join(root,'lib/clean.ts'),path.join(root,'lib/link.ts')); assert.equal(audit(root,{files:[{path:'lib/link.ts',sha256:clean.sha256}]}).findings[0].rule,'symlink-not-permitted'); });
    check(() => { fs.symlinkSync(path.join(root,'lib'),path.join(root,'components')); assert.equal(audit(root,{files:[{path:'components/clean.ts',sha256:clean.sha256}]}).findings[0].rule,'symlink-not-permitted'); });
    check(() => assert.equal(audit(root,{files:[clean,clean]}).findings[0].rule,'duplicate-manifest-path'));
    check(() => { const fixture=put('public/test.png',Buffer.from([137,80,78,71,0])); const result=audit(root,{files:[fixture]}); assert.equal(result.passed,true); assert.equal(result.assetFilesHashed,1); assert.equal(result.textFilesChecked,0); });
    check(() => { const result=audit(root,{files:[{path:'lib/missing.ts',sha256:clean.sha256}]}); assert.deepEqual(result.findings,[{path:'lib/missing.ts',rule:'file-unreadable'}]); });
    check(() => { const fixture=put('lib/binary.ts',Buffer.from([255,0])); assert.equal(audit(root,{files:[fixture]}).findings[0].rule,'non-utf8-source'); });
    check(() => { const icon=put('app/favicon.ico',Buffer.from([0,0,1,0])); const result=audit(root,{files:[icon]}); assert.equal(result.passed,true); assert.equal(result.assetFilesHashed,1); assert.equal(allowedPath('app/unreviewed.png'),false); });
    check(() => assert.equal(audit(root,{files:[]}).findings[0].rule,'invalid-explicit-manifest'));
    check(() => { const example=put('.env.example','SESSION_SECRET=\nSUPABASE_URL=\nHEYQUIZ_LOCAL_MODE=0\nGEMINI_MODEL=gemini-example\nNANGO_HUBSPOT_INTEGRATION_ID=hubspot\n'); assert.equal(audit(root,{files:[example]}).passed,true); });
    check(() => { const example=put('.env.example','SESSION_SECRET=unexpected-short-value\n'); assert.deepEqual(audit(root,{files:[example]}).findings,[{path:'.env.example',rule:'environment-example-not-placeholder-only'}]); });
    check(() => { for(const text of ['SUPABASE_URL=https://example.com','UNREVIEWED_CONFIG=value','SESSION_SECRET=\nSESSION_SECRET=','not-an-assignment']) assert.deepEqual(environmentExampleRules(text),['environment-example-not-placeholder-only']); });
    console.log(`PASS source audit self-test: ${groups} groups; no candidate or original records read.`);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
if (require.main === module) {
  try {
    const args=process.argv.slice(2);
    if(args.length===1 && args[0]==='--self-test') selfTest();
    else if(args.length===4 && args[0]==='--root' && args[2]==='--manifest') {
      const stat=fs.lstatSync(args[3]);
      if(!stat.isFile() || stat.isSymbolicLink() || stat.size>2*1024*1024) throw Error();
      const report=audit(path.resolve(args[1]),JSON.parse(fs.readFileSync(args[3],'utf8')));
      console.log(JSON.stringify({scope:'explicit candidate files only; no history or provider validation',...report},null,2));
      if(!report.passed)process.exitCode=1;
    } else throw Error();
  } catch { console.log(JSON.stringify({passed:false,findings:[{path:'<audit>',rule:'invalid-arguments-or-manifest'}]})); process.exitCode=2; }
}
module.exports={allowedPath,contentRules,audit};
