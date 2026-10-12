const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...rest) { return resolve.call(this, name.startsWith('@/') ? path.join(process.cwd(), name.slice(2)) : name, ...rest); };
const { FormSchema } = require('../lib/schema.ts');
const { LandingSectionSchema, validateLanding, safeLandingImageUrl } = require('../lib/landing.ts');
const { catalogTemplates, catalogTemplate } = require('../lib/template-catalog.ts');
const { launchTemplates, launchTemplate } = require('../lib/launch-templates.ts');
const { renderToStaticMarkup } = require('react-dom/server');
const { createElement } = require('react');
const QuizLanding = require('../components/QuizLanding.tsx').default;
const section = (type, patch = {}) => LandingSectionSchema.parse({ id: `landing-${type}`, type, ...patch });
const fixture = () => FormSchema.parse({ id: 'landing-fixture', title: 'Quiz title', description: 'Quiz description', mode: 'quiz', questions: [{ id: 'question', type: 'multiple_choice', title: 'A question', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, { id: 'display', type: 'heading', title: 'Display only' }], coverPage: { enabled: true, title: 'Your useful discovery', buttonText: 'Find my direction', imageUrl: '/template-images/coffee.webp' } });
const render = form => renderToStaticMarkup(createElement(QuizLanding, { form, busy: false, onStart() {} }));
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
test('Existing catalog and launch templates remain valid without migration', () => {
  for (const template of catalogTemplates) { const form = catalogTemplate(template.id, `legacy-${template.id}`); FormSchema.parse(form); validateLanding(form.coverPage, true); }
  for (const template of launchTemplates) { const form = launchTemplate(template.id, `launch-${template.id}`); FormSchema.parse(form); validateLanding(form.coverPage, true); }
});
test('Missing cover retains a short introduction and no composed sections', () => {
  const form = fixture(); delete form.coverPage;
  const html = render(form); assert.match(html, /Quiz title/); assert.match(html, /Quiz description/); assert.match(html, /1 question/); assert.doesNotMatch(html, /<img/);
});
test('Disabled cover hides its custom image, title, sections and time while keeping their draft values', () => {
  const form = fixture(); form.coverPage.enabled = false; form.coverPage.estimatedMinutes = 8; form.coverPage.sections = [section('text', { body: 'Custom hidden context' })];
  const html = render(form); assert.match(html, /Quiz title/); assert.doesNotMatch(html, /Your useful discovery|Custom hidden context|About 8 minutes|<img/); assert.equal(form.coverPage.sections.length, 1);
});
test('Question count respects its flag and excludes display fields', () => {
  const form = fixture(); assert.match(render(form), /1 question/);
  form.coverPage.showQuestionCount = false; assert.doesNotMatch(render(form), /1 question/);
});
test('Every structured section is escaped and validated before publication', () => {
  const form = fixture(); form.coverPage.sections = [section('benefits', { items: ['A useful insight', 'A clear next step'] }), section('text', { body: '<script>alert(1)</script>' }), section('testimonial', { body: 'Specific feedback', title: 'An actual reviewer' }), section('faq', { title: 'What happens next?', body: 'You see a result.' }), section('video', { url: 'https://youtu.be/dQw4w9WgXcQ', label: 'the introduction' }), section('start', { label: 'Discover my direction' })];
  validateLanding(form.coverPage, true); const html = render(form);
  assert.match(html, /A useful insight/); assert.match(html, /An actual reviewer/); assert.match(html, /Discover my direction/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>|<iframe/);
});
test('Incomplete sections can be saved as drafts but cannot be published', () => {
  for (const type of ['benefits', 'text', 'testimonial', 'faq', 'video', 'start']) {
    const form = fixture(); form.coverPage.sections = [section(type)];
    FormSchema.parse(form); validateLanding(form.coverPage, false); assert.throws(() => validateLanding(form.coverPage, true), /Landing section 1/);
  }
});
test('Unsafe image/video URLs are rejected and spoofed video providers cannot publish', () => {
  for (const imageUrl of ['javascript:alert(1)', 'data:text/html,hi', '//evil.test/image', '/\\evil.test/image', 'https://user:password@example.com/photo']) {
    assert.equal(safeLandingImageUrl(imageUrl), false); const form = fixture(); form.coverPage.imageUrl = imageUrl; assert.equal(FormSchema.safeParse(form).success, false);
  }
  assert.equal(LandingSectionSchema.safeParse({ id: 'bad', type: 'video', url: 'javascript:alert(1)' }).success, false);
  const form = fixture(); form.coverPage.sections = [section('video', { url: 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ' })]; assert.throws(() => validateLanding(form.coverPage, true), /supported HTTPS/); assert.doesNotMatch(render(form), /<iframe/);
});
test('Eight-section and six-benefit limits and unique IDs are enforced by the schema', () => {
  const form = fixture(); form.coverPage.sections = Array.from({ length: 9 }, (_, i) => section('text', { id: `s${i}`, body: 'Text' })); assert.equal(FormSchema.safeParse(form).success, false);
  form.coverPage.sections = [section('text'), section('text')]; assert.equal(FormSchema.safeParse(form).success, false);
  assert.equal(LandingSectionSchema.safeParse({ id: 'list', type: 'benefits', items: Array(7).fill('A benefit') }).success, false);
});
test('Legacy button, subtitle, media and timing values survive parsing', () => {
  const form = fixture(); form.coverPage.subtitle = 'Existing welcome'; form.coverPage.estimatedMinutes = 3;
  assert.deepEqual(FormSchema.parse(form).coverPage, form.coverPage); const html = render(form); assert.match(html, /Existing welcome/); assert.match(html, /About 3 minutes/); assert.match(html, /Find my direction/);
});
console.log(`${passed} landing scenarios passed.`);
