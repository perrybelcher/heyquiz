const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { renderResultPdf, PdfRenderError } = require('../lib/result-pdf.ts');
const artifacts = process.env.PDF_ARTIFACT_DIR || path.resolve(__dirname, '../../pippi-overnight-2026-10-12/native-pdf-renderer');
const python = process.env.PDF_TEST_PYTHON || '/Users/perry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
fs.mkdirSync(artifacts, { recursive: true });

function report() {
  return {
    submissionId: 'PRIVATE-response-id', formId: 'PRIVATE-form-id', createdAt: '2026-10-12T12:00:00.000Z', expiresAt: 1794484800000,
    quizTitle: 'Your growth readiness', theme: { brandName: 'Northstar Studio', primaryColor: '#8a1c2b' },
    heading: 'A useful next step', message: 'Café déjà vu — Καλημέρα κόσμε — Привет мир. Your saved result remains yours.',
    cta: { label: 'Explore your next step', url: 'https://example.test/next' },
    result: { totalPointsEarned: 7, totalPointsPossible: 10, percentageScore: 70 },
  };
}
function marketing(layout) {
  const r = report();
  r.theme = { ...r.theme, backgroundColor: '#111111', cardColor: '#161616', textColor: '#ffffff', primaryColor: '#fefefe', logoUrl: 'http://169.254.169.254/latest/meta-data' };
  r.result.marketing = {
    kind: 'scorecard', status: 'scored', presentation: { layout }, title: 'Your next chapter', message: 'Keep your strengths. Make room for the next improvement.', overallScore: null,
    reasons: ['Your answers point to one practical priority.'], advice: 'Start with one small, measurable change.', priorities: [{ categoryId: 'low', title: 'Capture', action: 'Make the next step clear.' }],
    ctaLabel: 'Explore your plan', ctaUrl: 'https://example.test/plan',
    categories: [
      { id: 'low', title: 'Capture', description: 'A clear next step helps.', score: 0, answered: 2, applicable: 2, minAnswers: 2, bandTitle: 'Opportunity', advice: 'Ask for one useful detail.' },
      { id: 'high', title: 'Follow-through', description: 'Keep what is working.', score: 100, answered: 1, applicable: 1, minAnswers: 1, bandTitle: 'Strong', advice: 'Maintain the habit.' },
      { id: 'unknown', title: 'Measurement', description: 'More information is needed.', score: null, answered: 0, applicable: 1, minAnswers: 1 },
    ],
    resultSections: [
      { id: 'faq', type: 'faq', title: 'What comes next?', body: 'The full FAQ answer must be present.', label: '', url: '' },
      { id: 'image', type: 'image', title: 'Your visual guide', body: 'The image description remains available.', label: 'View your guide', url: 'http://127.0.0.1:9/no-network' },
      { id: 'video', type: 'video', title: 'A quick walkthrough', body: 'Watch this when you have a moment.', label: 'Watch the walkthrough', url: 'https://example.test/video' },
      { id: 'proof', type: 'testimonial', title: 'A fictional example', body: 'One clear step made the plan easier.', label: '', url: '' },
    ],
  };
  return r;
}
function inspect(file) {
  const script = `import json,sys
from pypdf import PdfReader
import pdfplumber
r=PdfReader(sys.argv[1]); pages=[]; links=[]; fonts=[]; violations=[]
for i,p in enumerate(r.pages):
 pages.append(p.extract_text())
 for a in p.get('/Annots',[]):
  a=a.get_object(); action=a.get('/A',{}); links.append(str(action.get('/URI','')))
 for key,f in p.get('/Resources',{}).get('/Font',{}).items(): fonts.append(str(f.get_object().get('/BaseFont')))
with pdfplumber.open(sys.argv[1]) as pdf:
 for i,p in enumerate(pdf.pages):
  for c in p.chars:
   if c['text'].strip() and (c['x0'] < 47 or c['x1'] > p.width-47 or c['top'] < 20 or c['bottom'] > p.height-20): violations.append({'page':i+1,'text':c['text'],'x0':c['x0'],'x1':c['x1'],'top':c['top'],'bottom':c['bottom']})
print(json.dumps({'pages':pages,'links':links,'fonts':fonts,'violations':violations,'metadata':{str(k):str(v) for k,v in r.metadata.items()},'tagged':bool(r.trailer['/Root'].get('/StructTreeRoot'))},ensure_ascii=False))`;
  const result = spawnSync(python, ['-c', script, file], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
async function save(name, input) {
  const before = JSON.stringify(input), started = performance.now();
  const pdf = await renderResultPdf(input);
  assert.equal(JSON.stringify(input), before, 'renderer does not mutate the frozen result');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length < 3 * 1024 * 1024);
  const file = path.join(artifacts, name + '.pdf'); fs.writeFileSync(file, pdf);
  const info = inspect(file); assert.deepEqual(info.violations, [], 'all visible glyphs stay inside page margins');
  assert.ok(info.tagged, 'report has a logical structure');
  assert.ok(info.fonts.every(font => font.includes('NotoSans')), 'all rendered fonts come from bundled assets');
  info.pages.forEach((text, index) => assert.ok(text.includes(`Page ${index + 1} of ${info.pages.length}`), 'every page has correct final numbering'));
  assert.ok(!JSON.stringify(info).includes('PRIVATE-'), 'internal identifiers never reach content, metadata or annotations');
  console.log(JSON.stringify({ name, pages: info.pages.length, bytes: pdf.length, elapsedMs: Math.round(performance.now() - started) }));
  return info;
}

(async () => {
  const simple = await save('simple', report());
  assert.equal(simple.pages.length, 1);
  assert.ok(simple.pages[0].includes('70%')); assert.ok(simple.pages[0].includes('7 of 10 points'));
  assert.ok(simple.pages[0].includes('Café déjà vu')); assert.ok(simple.pages[0].includes('Καλημέρα κόσμε')); assert.ok(simple.pages[0].includes('Привет мир'));
  assert.deepEqual(simple.links, ['https://example.test/next']);
  if (process.env.PDF_SPIKE_ONLY === '1') { console.log('PASS native PDF initial single-page/font/Unicode/annotation/margin spike'); return; }

  const network = ['node:http', 'node:https'].map(id => { const transport = require(id); const originals = { request: transport.request, get: transport.get }; transport.request = transport.get = () => { throw Error('Renderer attempted network I/O'); }; return [transport, originals]; });
  const originalFetch = global.fetch; global.fetch = () => { throw Error('Renderer attempted fetch'); };
  try {
    for (const layout of ['stacked', 'score_overview', 'action_plan']) {
      const info = await save(layout, marketing(layout)), text = info.pages.join('\n');
      for (const wanted of ['0%', '100%', 'Not enough information', '2 of 2 applicable questions scored', '0 of 1 applicable questions scored', '1 needed', 'The full FAQ answer must be present.', 'Image available online.', 'Video available online.']) assert.ok(text.includes(wanted), wanted);
      assert.ok(info.links.includes('https://example.test/plan'));
      assert.ok(info.pages.some(page => page.replace(/\s+([.,])/g, '$1').includes('One clear step made the plan easier.') && page.includes('A fictional example')), 'short testimonial and its attribution stay on the same page');
      assert.ok(!text.includes('169.254.169.254'), 'remote logo is never fetched or printed');
      if (layout === 'action_plan') assert.ok(text.indexOf('A useful first step') < text.indexOf('Overall score'));
      if (layout === 'score_overview') assert.ok(text.indexOf('Your scores at a glance') < text.indexOf('A closer look at each area'));
    }
  } finally { global.fetch = originalFetch; for (const [transport, originals] of network) Object.assign(transport, originals); }

  const long = report();
  const words = Array.from({ length: 175 }, (_, index) => `Paragraph ${index + 1}: an actionable report must preserve every practical detail without clipping the result.`);
  long.message = words.join('\n') + '\n' + 'W'.repeat(1600) + '\nFINAL-CONTENT-MARKER';
  const multi = await save('long', long), multiText = multi.pages.join('\n');
  assert.ok(multi.pages.length >= 5 && multi.pages.length <= 50);
  assert.ok(multiText.includes('Paragraph 1:')); assert.ok(multiText.includes('Paragraph 175:')); assert.ok(multiText.includes('FINAL-CONTENT-MARKER'));
  assert.equal((multiText.match(/W/g) || []).length, 1600, 'long unbroken text remains complete');

  for (const count of [30, 31, 32]) {
    const boundary = report();
    boundary.result.marketing = { kind: 'scorecard', status: 'scored', title: 'Boundary test', message: Array.from({ length: count }, (_, index) => `Introductory line ${index + 1}`).join('\n'), reasons: [], categories: [{ id: 'boundary', title: 'CATEGORY HEADING MARKER', description: '', score: 40, answered: 1, applicable: 1, minAnswers: 1 }] };
    const checked = await save('boundary-' + count, boundary);
    assert.ok(checked.pages.some(page => page.includes('CATEGORY HEADING MARKER') && page.includes('40%')), 'category heading stays with its full atomic score block near a page boundary');
  }
  const continuation = report();
  continuation.result.marketing = { kind: 'scorecard', status: 'scored', title: 'Detailed report', message: 'Long category narratives retain context on later pages.', reasons: [], categories: [{ id: 'continuation', title: 'Continuation category', description: Array.from({ length: 90 }, (_, index) => `Context line ${index + 1}: every detail remains available.`).join('\n'), score: 40, answered: 1, applicable: 1, minAnswers: 1 }] };
  const continued = await save('continuation', continuation);
  assert.ok(continued.pages.length > 1);
  for (const page of continued.pages.slice(1)) assert.ok(page.includes('Continuation category (continued)'), 'continued category pages repeat their context');
  assert.ok(continued.pages.join('\n').includes('Context line 90:'));

  for (const value of ['مرحبا 123', 'שלום 123', '漢字', 'नमस्ते', 'ไทย', 'Hello 👩‍💻', 'Hello\u202eWorld', 'A\ufe0f']) {
    await assert.rejects(renderResultPdf({ ...report(), message: value }), error => error instanceof PdfRenderError && error.status === 422 && error.code === 'unsupported_text' && !error.message.includes(value));
  }
  const composed = await renderResultPdf({ ...report(), message: 'Cafe\u0301' }); assert.ok(composed.length > 1000);
  await assert.rejects(renderResultPdf({ ...report(), message: 'x'.repeat(210 * 1024) }), error => error.code === 'report_too_large');
  await assert.rejects(renderResultPdf({ ...report(), message: 'x\n'.repeat(2600) }), error => error.code === 'report_too_large', 'page budget denies short but excessively tall content');
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(renderResultPdf(report(), { signal: cancelled.signal }), error => error.code === 'render_aborted');
  const during = new AbortController(); const pending = renderResultPdf(long, { signal: during.signal }); setImmediate(() => during.abort());
  await assert.rejects(pending, error => error.code === 'render_aborted', 'in-flight work observes cancellation');
  const realCwd = process.cwd(), emptyAssets = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'pippi-pdf-assets-'));
  try {
    process.chdir(emptyAssets);
    await assert.rejects(renderResultPdf(report()), error => error.code === 'render_unavailable' && error.status === 503, 'missing runtime fonts fail safely even after an earlier cached-font render');
  } finally { process.chdir(realCwd); fs.rmSync(emptyAssets, { recursive: true, force: true }); }
  const pdfkit = require('pdfkit'), PdfDocument = pdfkit.PDFDocument || pdfkit;
  const originalEmit = PdfDocument.prototype.emit; let injectOversize = true;
  try {
    PdfDocument.prototype.emit = function (event, ...args) {
      if (event === 'data' && injectOversize) { injectOversize = false; args[0] = Buffer.alloc(3 * 1024 * 1024 + 1); }
      return originalEmit.call(this, event, ...args);
    };
    await assert.rejects(renderResultPdf(report()), error => error.code === 'report_too_large' && error.status === 422, 'an oversized output stream is destroyed instead of returned');
    assert.equal(injectOversize, false, 'output fault injection reached the actual renderer stream');
  } finally { PdfDocument.prototype.emit = originalEmit; }
  const concurrent = await Promise.all([renderResultPdf(report()), renderResultPdf(report())]);
  assert.ok(concurrent.every(buffer => buffer.subarray(0, 5).toString() === '%PDF-'), 'failed/aborted render never poisons later documents');
  console.log('PASS native renderer: frozen parity, numeric/coverage states, layouts, remote asset isolation, glyphs/scripts, margins, 5+ page flow, long words, heading+score/attribution boundaries, continued category context, page/text/output budgets, missing-font and abort recovery, independent concurrent documents');
})().catch(error => { console.error(error); process.exitCode = 1; });
