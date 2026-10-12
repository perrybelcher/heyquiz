const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { ResultEmailCopySchema, DEFAULT_RESULT_EMAIL_COPY, resolveResultEmailCopy, validateResolvedResultEmailCopy, previewResultEmailCopy, renderResultEmailCopy } = require('../lib/result-email-copy.ts');
const { FormSchema } = require('../lib/schema.ts');
let count = 0; const check = (name, fn) => { fn(); count++; console.log('PASS ' + name); };
const copy = values => ({ ...DEFAULT_RESULT_EMAIL_COPY, ...values });
const invalid = (value, field) => { const parsed = ResultEmailCopySchema.safeParse(value); assert.equal(parsed.success, false); if (field) assert.ok(parsed.error.issues.some(issue => issue.path[0] === field)); };
check('absent configuration stays absent; strict version/fields only', () => {
  const form = FormSchema.parse({ id: 'email-copy', mode: 'survey', title: 'Quiz' });
  assert.equal(form.resultEmailCopy, undefined);
  assert.deepEqual(FormSchema.parse({ ...form, resultEmailCopy: copy({}) }).resultEmailCopy, copy({}));
  for (const bad of [null, [], 'text', { subject: 'missing version' }, copy({ version: 2 }), copy({ html: '<img>' }), copy({ replyTo: 'bad@example.test' }), copy({ sender: 'bad' })]) invalid(bad);
});
check('defaults have exact sample text, fixed footer and inert preview link', () => {
  const preview = previewResultEmailCopy(copy({}));
  assert.equal(preview.subject, 'Your requested quiz result — local test');
  assert.equal(preview.text, 'LOCAL TEST ONLY — no email was sent.\n\nYou requested a private result link for Your sample quiz.\n\n[Example private result link — preview only, does not open]\n\nThis link expires on 2030-01-31 (UTC). Anyone with the link can view the saved result. This request does not subscribe you to marketing emails.');
  assert.ok(!preview.html.includes('<a')); assert.ok(!preview.html.includes('href='));
});
check('allowed tokens resolve once from bounded title/brand and missing values have literal defaults', () => {
  const resolved = resolveResultEmailCopy(copy({ subject: '{brand_name}: your result', introduction: 'Hello {brand_name}.\n\nYou requested {quiz_title}.', signOff: 'Thanks,\n{brand_name}' }), { quizTitle: 'A {brand_name} quiz', brandName: 'Studio' });
  assert.deepEqual(resolved, { version: 1, subject: 'Studio: your result', introduction: 'Hello Studio.\n\nYou requested A {brand_name} quiz.', signOff: 'Thanks,\nStudio' });
  assert.equal(resolveResultEmailCopy(copy({ introduction: '{quiz_title} / {brand_name}' }), {}).introduction, 'your quiz / Pippi');
  assert.equal(resolveResultEmailCopy(copy({ introduction: '{quiz_title} / {brand_name}' }), { quizTitle: '  ', brandName: '\n' }).introduction, 'your quiz / Pippi');
});
check('unknown, malformed and object-path tokens are rejected with useful field paths', () => {
  for (const value of ['{email}', '{contact.name}', '{{quiz_title}}', '{quiz_title', 'quiz_title}', '{}', '{ quiz_title }', '{QUIZ_TITLE}', '{__proto__}', '${brand_name} {score}']) for (const field of ['subject', 'introduction', 'signOff']) invalid(copy({ [field]: value }), field);
});
check('subject header/control/unicode-line/bidi injection rejected before trim; bodies allow paragraphs only', () => {
  for (const value of ['\nHello', 'Hello\r\nBcc: a@example.test', 'Hello\r', 'A\tB', 'A\0B', 'A\x7fB', 'A\x85B', 'A\u2028B', 'A\u2029B', 'A\u202eB', 'A\u2066B', 'A\ud800B']) invalid(copy({ subject: value }), 'subject');
  for (const field of ['introduction', 'signOff']) for (const value of ['A\0B', 'A\rB', 'A\tB', 'A\u2028B', 'A\u2069B', 'A\udfffB']) invalid(copy({ [field]: value }), field);
  assert.equal(ResultEmailCopySchema.parse(copy({ introduction: '  Hello\r\n\r\nGoodbye  ', signOff: 'A\nB' })).introduction, 'Hello\n\nGoodbye');
  assert.equal(ResultEmailCopySchema.parse(copy({ subject: '  A   useful  result ' })).subject, 'A useful result');
});
check('required fields, optional sign-off, raw bounds and multibyte total bounds are explicit', () => {
  invalid(copy({ subject: ' ' }), 'subject'); invalid(copy({ introduction: '\n' }), 'introduction');
  assert.equal(ResultEmailCopySchema.parse(copy({ signOff: '' })).signOff, '');
  for (const [field, limit] of [['subject', 120], ['introduction', 1200], ['signOff', 160]]) { assert.ok(ResultEmailCopySchema.safeParse(copy({ [field]: 'x'.repeat(limit) })).success); invalid(copy({ [field]: 'x'.repeat(limit + 1) }), field); }
  assert.throws(() => resolveResultEmailCopy(copy({ subject: '界'.repeat(120), introduction: '界'.repeat(1200), signOff: '界'.repeat(160) }), {}), error => error.issues.some(issue => issue.path[0] === 'introduction'));
  assert.ok(resolveResultEmailCopy(copy({ introduction: '😀'.repeat(500) }), {}).introduction.startsWith('😀'));
});
check('expanded bounds checked again; title and brand controls cannot become headers', () => {
  assert.throws(() => resolveResultEmailCopy(copy({ subject: '{quiz_title}' }), { quizTitle: 'q'.repeat(121) }), error => error.issues.some(issue => issue.path[0] === 'subject'));
  assert.throws(() => resolveResultEmailCopy(copy({ introduction: '{quiz_title}'.repeat(8) }), { quizTitle: 'q'.repeat(160) }));
  assert.equal(resolveResultEmailCopy(copy({ subject: '{brand_name}', introduction: '{quiz_title}' }), { brandName: 'Safe\r\nBcc:bad', quizTitle: 'A\u2028B\u202eC' }).subject, 'Safe Bcc:bad');
  assert.equal(resolveResultEmailCopy(copy({ introduction: '{quiz_title}/{brand_name}' }), { quizTitle: 'q'.repeat(10000), brandName: 'b'.repeat(10000) }).introduction, 'q'.repeat(160) + '/' + 'b'.repeat(100));
});
check('rendered values are escaped and URL-like creator text remains inert; fixed footer cannot be removed', () => {
  const resolved = resolveResultEmailCopy(copy({ subject: 'A <result>', introduction: '<img src=x onerror="bad()"> & \'quote\'\nhttps://evil.test\n\n{quiz_title}', signOff: '<a href="javascript:bad()">hello</a>' }), { quizTitle: '<script>bad()</script>' });
  const rendered = renderResultEmailCopy(resolved, { privateUrl: 'http://127.0.0.1:3164/result/abc.def', expiresOn: '2026-11-12' });
  assert.equal((rendered.html.match(/<a /g) || []).length, 1); assert.ok(rendered.html.includes('href="http://127.0.0.1:3164/result/abc.def"'));
  for (const forbidden of ['<img', '<script', '<a href="javascript:']) assert.ok(!rendered.html.includes(forbidden));
  for (const escaped of ['&lt;img', '&quot;bad()&quot;', '&amp;', '&#39;quote&#39;', '&lt;script&gt;']) assert.ok(rendered.html.includes(escaped));
  assert.ok(rendered.html.includes('<br>https://evil.test')); assert.ok(rendered.text.includes('<img src=x'));
  for (const fixed of ['LOCAL TEST ONLY — no email was sent.', '2026-11-12 (UTC)', 'Anyone with the link', 'does not subscribe you to marketing emails.']) assert.ok(rendered.text.includes(fixed));
  for (const privateUrl of ['javascript:bad()', 'data:text/html,bad', 'http://user:pass@127.0.0.1/result/abc.def', 'http://127.0.0.1/other', 'http://127.0.0.1/result/abc.def?email=x', 'http://127.0.0.1/result/abc.def#bad', '']) assert.throws(() => renderResultEmailCopy(resolved, { privateUrl, expiresOn: '2026-11-12' }));
});
check('frozen resolved text is not retokenized; invalid stored version/shape rejected', () => {
  const resolved = { version: 1, subject: 'A {email}', introduction: 'A literal {brand_name}', signOff: '' };
  assert.deepEqual(validateResolvedResultEmailCopy(resolved), resolved);
  assert.ok(renderResultEmailCopy(resolved, { expiresOn: '2030-01-31' }).text.includes('A literal {brand_name}'));
  assert.throws(() => validateResolvedResultEmailCopy({ ...resolved, version: 2 }));
  assert.throws(() => validateResolvedResultEmailCopy({ ...resolved, email: 'no' }));
  assert.throws(() => renderResultEmailCopy(resolved, { expiresOn: '<bad>' }));
});
check('preview is deterministic and client-safe without network/jobs/tokens', () => {
  const source = fs.readFileSync(require.resolve('../lib/result-email-copy.ts'), 'utf8');
  assert.ok(!/from ["'](?:node:|\.\/(?:records|auth|result-reports|result-email-config|result-email-transport))/.test(source));
  assert.ok(!/\b(?:fetch|readRecord|writeRecord|issueResultReport)\s*\(/.test(source));
  assert.deepEqual(previewResultEmailCopy(copy({})), previewResultEmailCopy(copy({})));
});
console.log(`${count} result-email-copy pure groups passed; no network, recipient or runtime records.`);
