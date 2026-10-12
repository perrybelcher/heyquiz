// Offline, deterministic PDF page-flow regression. No records, tokens or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { renderResultPdf } = require('../lib/result-pdf.ts');
const { launchTemplate } = require('../lib/launch-templates.ts');
const { gradeQuizSubmission } = require('../lib/scoring.ts');
const { evaluateMarketing } = require('../lib/marketing.ts');
const { makeResultReport } = require('../lib/result-reports.ts');
const campaignFixtures = require('./template-campaigns-batch11.cjs');
const output = path.resolve(process.env.PDF_ARTIFACT_DIR || '../pippi-overnight-2026-10-12/compiled-verification-batch-12/pdf-pagination');
const python = process.env.PDF_TEST_PYTHON || '/Users/perry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
fs.mkdirSync(output, { recursive: true });
let outbound = 0;
global.fetch = () => { outbound++; throw Error('PDF pagination must not fetch'); };
for (const protocol of ['node:http', 'node:https']) for (const method of ['request', 'get']) require(protocol)[method] = () => { outbound++; throw Error('PDF pagination must not make HTTP requests'); };
const summaries = [];

function rental() {
  const form = launchTemplate('rental-readiness', 'PRIVATE-layout-form');
  const answers = campaignFixtures.answers(form, campaignFixtures.scorecards[3]);
  const result = { ...gradeQuizSubmission(form, answers), marketing: evaluateMarketing(form, answers), submittedAt: '2026-10-12T12:00:00.000Z' };
  return makeResultReport(form, result, 'PRIVATE-layout-response');
}

function plain(message) {
  return {
    submissionId: 'PRIVATE-layout-response', formId: 'PRIVATE-layout-form', createdAt: '2026-10-12T12:00:00.000Z', expiresAt: 1794484800000,
    quizTitle: 'Pagination fixture', theme: { brandName: 'Local studio', primaryColor: '#8a1c2b' }, heading: 'Unused', message: '',
    result: { totalPointsEarned: 5, totalPointsPossible: 10, percentageScore: 50, marketing: { kind: 'scorecard', status: 'scored', title: 'Boundary report', message, reasons: [], categories: [] } },
  };
}
function inspect(filename) {
  return JSON.parse(execFileSync(python, ['-c', `import sys,json,pdfplumber
from pypdf import PdfReader
reader=PdfReader(sys.argv[1]); pages=[]; violations=[]
with pdfplumber.open(sys.argv[1]) as pdf:
 for i,p in enumerate(pdf.pages):
  words=p.extract_words(x_tolerance=2,y_tolerance=3)
  pages.append({'text':reader.pages[i].extract_text(),'words':[{'text':w['text'],'x0':w['x0'],'x1':w['x1'],'top':w['top'],'bottom':w['bottom']} for w in words]})
  for c in p.chars:
   if c['text'].strip() and (c['x0']<47 or c['x1']>p.width-47 or c['top']<20 or c['bottom']>p.height-20): violations.append({'page':i+1,'x0':c['x0'],'x1':c['x1'],'top':c['top'],'bottom':c['bottom']})
print(json.dumps({'pages':pages,'violations':violations}))`, filename], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
}
function occurrences(info, text) {
  const wanted = text.trim().split(/\s+/), found = [];
  info.pages.forEach(({ words }, page) => {
    for (let index = 0; index <= words.length - wanted.length; index++) {
      if (!wanted.every((word, offset) => words[index + offset].text === word)) continue;
      const group = words.slice(index, index + wanted.length);
      found.push({ page: page + 1, top: Math.min(...group.map(w => w.top)), bottom: Math.max(...group.map(w => w.bottom)), x0: Math.min(...group.map(w => w.x0)), x1: Math.max(...group.map(w => w.x1)) });
    }
  });
  assert.ok(found.length, `PDF must contain ${text}`);
  return found;
}
function together(info, phrases) {
  let previous;
  const coordinates = phrases.map(phrase => {
    const found = occurrences(info, phrase).find(where => !previous || where.page > previous.page || where.page === previous.page && where.top >= previous.bottom - 1);
    assert.ok(found, `Ordered content after previous item: ${phrase}`);
    if (previous) assert.equal(found.page, previous.page, `Keep heading and following content together: ${phrases.join(' / ')}`);
    previous = found; return { phrase, ...found };
  });
  return coordinates;
}
async function render(name, report) {
  const before = JSON.stringify(report), pdf = await renderResultPdf(report);
  assert.equal(JSON.stringify(report), before, 'Frozen report not mutated');
  const filename = path.join(output, name + '.pdf'); fs.writeFileSync(filename, pdf);
  const info = inspect(filename);
  assert.deepEqual(info.violations, [], 'All content remains in page bounds');
  assert.ok(!JSON.stringify(info).includes('PRIVATE-'), 'No internal identifiers in visible PDF');
  info.pages.forEach(({ text }, page) => assert.ok(text.includes(`Page ${page + 1} of ${info.pages.length}`)));
  summaries.push({ name, pages: info.pages.length, bytes: pdf.length, groups: [] });
  return info;
}
function group(info, phrases) { summaries.at(-1).groups.push(together(info, phrases)); }

(async () => {
  // Same campaign and independently specified answers as batch11's three-page
  // rental PDF. The old renderer strands this band heading on page2.
  const exact = await render('rental-exact', rental());
  group(exact, ['Make it consistent', 'Check the listing against the actual property.', '2 of 2 applicable questions scored']);
  for (const extra of [1, 2]) {
    const report = rental(); report.result.marketing.message += '\n' + Array.from({ length: extra }, () => 'An extra synthetic context line.').join('\n');
    const info = await render('rental-offset-' + extra, report);
    group(info, ['Make it consistent', 'Check the listing against the actual property.', '2 of 2 applicable questions scored']);
  }
  for (const lines of [22, 23, 24, 25]) {
    const report = plain(Array.from({ length: lines }, (_, i) => `Introductory line ${i + 1}`).join('\n'));
    report.result.marketing.categories = [{ id: 'area', title: 'Category context', score: 40, description: 'A short description.', bandTitle: 'BAND HEADING MARKER', advice: 'ADVICE SENTENCE MARKER.', answered: 1, applicable: 1, minAnswers: 1 }];
    const info = await render('band-label-' + lines, report);
    group(info, ['BAND HEADING MARKER', 'ADVICE SENTENCE MARKER.', '1 of 1 applicable questions scored']);
  }
  for (const lines of [29, 30, 31, 32]) {
    const report = plain(Array.from({ length: lines }, (_, i) => `Introductory line ${i + 1}`).join('\n'));
    report.result.marketing.resultSections = [{ id: 'section', type: 'text', title: 'SECTION HEADING MARKER', body: 'FIRST BODY LINE.\nSECOND BODY LINE.\nTHIRD BODY LINE.', label: '', url: '' }];
    const info = await render('body-no-label-' + lines, report);
    group(info, ['SECTION HEADING MARKER', 'FIRST BODY LINE.', 'SECOND BODY LINE.', 'THIRD BODY LINE.']);
  }
  const long = plain('Long guidance still flows.');
  long.result.marketing.categories = [{ id: 'area', title: 'Long guidance category', score: 40, description: 'All practical guidance remains available.', bandTitle: 'LONG BODY HEADING', advice: Array.from({ length: 90 }, (_, i) => `Guidance line ${i + 1}: preserve this useful detail.`).join('\n'), answered: 1, applicable: 1, minAnswers: 1 }];
  const longInfo = await render('long-body', long);
  group(longInfo, ['LONG BODY HEADING', 'Guidance line 1: preserve this useful detail.', 'Guidance line 2: preserve this useful detail.', 'Guidance line 3: preserve this useful detail.']);
  group(longInfo, ['Guidance line 90: preserve this useful detail.', '1 of 1 applicable questions scored']);
  for (const page of longInfo.pages.slice(1)) assert.ok(page.text.includes('Long guidance category (continued)'));

  const tall = structuredClone(long);
  tall.result.marketing.categories[0].bandTitle = Array.from({ length: 90 }, (_, i) => `Long heading line ${i + 1}`).join('\n');
  tall.result.marketing.categories[0].advice = 'AFTER LONG HEADING BODY.';
  const tallInfo = await render('long-heading', tall);
  group(tallInfo, ['Long heading line 90', 'AFTER LONG HEADING BODY.', '1 of 1 applicable questions scored']);
  const allText = tallInfo.pages.map(page => page.text).join('\n');
  for (let i = 1; i <= 90; i++) assert.ok(allText.includes(`Long heading line ${i}`));
  assert.ok(tallInfo.pages.length >= 3 && tallInfo.pages.length <= 50);
  assert.equal(outbound, 0);
  fs.writeFileSync(path.join(output, 'pagination-results.json'), JSON.stringify({ passed: true, fixtures: summaries, outboundCalls: outbound }, null, 2));
  console.log(`PASS measured PDF pagination: ${summaries.length} fixtures, coordinate-checked heading/body groups, long flow and zero network calls.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
