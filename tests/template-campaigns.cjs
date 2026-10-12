const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { launchTemplate, launchTemplates } = require('../lib/launch-templates.ts');
const { catalogTemplate, catalogTemplates } = require('../lib/template-catalog.ts');
const { campaignTemplateIds, templateCampaignDetails, applyTemplateCampaign } = require('../lib/template-campaigns.ts');
const { validateLanding } = require('../lib/landing.ts');
const { evaluateMarketing, validateMarketing } = require('../lib/marketing.ts');
const { evaluateJourneyCase } = require('../lib/journey-testing.ts');
const { createJourneyFixture, runJourneyFixture, serializeJourneyFixtures, parseJourneyFixtures } = require('../lib/journey-fixtures.ts');
const { gradeQuizSubmission } = require('../lib/scoring.ts');
const { makeResultReport } = require('../lib/result-reports.ts');
const { buildResultPdfModel } = require('../lib/result-pdf-model.ts');
const fixtures = require('./fixtures/template-campaigns.cjs');
let checked = 0;
assert.equal(launchTemplates.length, 43); assert.equal(campaignTemplateIds.length, 43);
assert.deepEqual(new Set(campaignTemplateIds.map(id => templateCampaignDetails(id).layout)), new Set(['stacked', 'action_plan', 'score_overview']));
// The three legacy constructors have different IDs/weights, covered literally in batch14.
for (const id of campaignTemplateIds.filter(id => catalogTemplates.some(template => template.id === id))) {
  const form = launchTemplate(id, 'synthetic-' + id), original = catalogTemplate(id, form.id), details = templateCampaignDetails(id);
  validateLanding(form.coverPage, true); validateMarketing(form, true);
  assert.deepEqual(form.questions, original.questions, 'Original question/option IDs and wording preserved');
  assert.deepEqual(form.marketing.rules, original.marketing.rules, 'Original scoring semantics preserved');
  assert.deepEqual(form.marketing.categories.map((category, index) => ({ ...category, description: original.marketing.categories[index].description })), original.marketing.categories, 'Category IDs, answer thresholds and full score-band advice/actions stay unchanged');
  for (const category of form.marketing.categories) {
    assert.ok(category.description.length > 50, 'Context explains the measured area');
    for (const band of category.bands) for (const field of ['advice', 'action']) assert.notEqual(category.description, band[field], 'Context must not repeat band advice/action verbatim');
  }
  assert.deepEqual(form.marketing.outcomes, original.marketing.outcomes);
  assert.equal(form.coverPage.sections.length, 5); assert.equal(new Set(form.coverPage.sections.map(s => s.id)).size, 5);
  assert.deepEqual(form.coverPage.sections.map(s => s.type), ['benefits', 'text', 'faq', 'faq', 'start']);
  assert.equal(form.marketing.resultSections.length, 5); assert.equal(form.marketing.presentation.layout, details.layout);
  assert.equal(form.capture.required, false); assert.equal(form.capture.marketingEnabled, false);
  assert.ok(form.marketing.resultSections.every(s => s.url === '' && !['cta', 'testimonial', 'video'].includes(s.type)));
  assert.ok(form.coverPage.sections.every(s => s.url === '' && !['testimonial', 'video'].includes(s.type)));
  assert.equal(details.checklist.length, 4); assert.ok(details.audience.length > 10);
  if (form.coverPage.imageUrl) assert.ok(fs.existsSync('public' + form.coverPage.imageUrl), 'Only existing local artwork');
  const before = JSON.stringify(original); applyTemplateCampaign(original, id); assert.equal(JSON.stringify(original), before, 'Enrichment leaves input untouched');
  const fresh = launchTemplate(id, 'second-' + id); form.coverPage.sections[0].items[0] = 'Changed local benefit'; assert.notEqual(fresh.coverPage.sections[0].items[0], 'Changed local benefit');
  for (const expected of form.marketing.kind === 'scorecard' ? fixtures.scorecardCases : fixtures.matchingCases) {
    const answers = fixtures.answers(form, expected), actual = evaluateJourneyCase(form, answers);
    const expectedValue = { status: expected.status, resultId: expected.resultId, score: expected.score, categories: expected.categories, resultSectionIds: expected.resultSectionIds, questionIds: form.questions.map(q => q.id) };
    const saved = createJourneyFixture(form, actual, expected.name, 'case-' + checked);
    assert.deepEqual(saved.expected, expectedValue, id + ': ' + expected.name);
    const roundtrip = parseJourneyFixtures(serializeJourneyFixtures(form.id, [{ ...saved, expected: expectedValue }]), form.id)[0];
    assert.equal(runJourneyFixture(form, roundtrip).passed, true);
    const result = { ...gradeQuizSubmission(form, answers), marketing: evaluateMarketing(form, answers) };
    assert.deepEqual(result.marketing.resultSections.map(s => s.id), expected.resultSectionIds);
    const report = makeResultReport(form, result, 'synthetic-response'), model = buildResultPdfModel(report), printed = model.blocks.map(b => b.text ?? b.label ?? '').join('\n');
    assert.equal(model.layout, details.layout); assert.ok(printed.includes(result.marketing.title));
    for (const section of result.marketing.resultSections) { assert.ok(printed.includes(section.title)); assert.ok(printed.includes(section.body)); }
    for (const section of form.marketing.resultSections.filter(s => !expected.resultSectionIds.includes(s.id))) assert.ok(!printed.includes(section.body), 'Unmatched guidance must not leak into PDF');
    assert.ok(!model.blocks.some(b => b.kind === 'link'), 'No live placeholder CTA');
    checked++;
  }
  console.log('PASS ' + id + ': independent campaign, unchanged scoring, landing/results/checklist and all expected paths');
}
assert.equal(templateCampaignDetails('toString'), null); assert.equal(templateCampaignDetails('not-a-template'), null);
const untouched = launchTemplate('candles', 'unselected'); assert.deepEqual(applyTemplateCampaign(untouched, 'not-a-template'), untouched);
console.log('PASS forty catalog campaigns plus three bespoke legacy campaigns,43 retained template IDs,' + checked + ' literal journey/category/section expectations, frozen report/PDF-model parity and no live destinations');
