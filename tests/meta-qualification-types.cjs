const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);
const { authoredTemplates, authoredTemplate } = require('../lib/authored-templates.ts');
const { gradeQuizSubmission } = require('../lib/scoring.ts');
const { evaluateMarketing } = require('../lib/marketing.ts');
const { MetaSchema, defaultMeta } = require('../lib/meta/schema.ts');
const { qualify, validateMeta, metaRuleVersion } = require('../lib/meta/qualification.ts');
const { metaOutcomeOptions, metaScoreOptions } = require('../lib/meta/options.ts');
const { defaultCapture } = require('../lib/contacts.ts');
const fixtures = Object.assign({}, ...['a', 'b', 'c'].map(n => require(`./fixtures/authored-templates-${n}.json`)));
const config = rules => MetaSchema.parse({ ...defaultMeta, enabled: true, connectionId: 'test-connection', datasetId: '123456789012345', privacyUrl: 'https://example.com/privacy', rules });
const savedResult = (form, answers) => ({ ...gradeQuizSubmission(form, answers), answers, marketing: evaluateMarketing(form, answers) });
const validate = (form, meta) => validateMeta({ ...form, capture: { ...defaultCapture, enabled: true }, meta });
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
for (const template of authoredTemplates) {
  check(`${template.quizType}: ${template.id} supports answer and result qualification`, () => {
    const form = authoredTemplate(template.id, 'meta-type-test'), answers = fixtures[template.id].answers;
    const result = savedResult(form, answers);
    const question = form.questions.find(q => q.options?.some(o => answers[q.id] === o.id));
    const answer = config([{ kind: 'answer', questionId: question.id, optionId: answers[question.id] }]);
    validate(form, answer); assert.equal(qualify(answer, result).status, 'qualified');
    const outcomeId = result.marketing ? result.marketing.outcomeId : result.matchedTier?.id;
    assert.ok(outcomeId); assert.ok(metaOutcomeOptions(form).some(outcome => outcome.id === outcomeId));
    const outcome = config([{ kind: 'outcome', outcomeId }]);
    validate(form, outcome); assert.equal(qualify(outcome, result).status, 'qualified');
    const alternative = metaOutcomeOptions(form).find(outcome => outcome.id !== outcomeId);
    assert.equal(qualify(config([{ kind: 'outcome', outcomeId: alternative.id }]), result).status, 'disqualified');
    const missing = { ...result, matchedTier: undefined, marketing: result.marketing ? { ...result.marketing, status: 'no_match', outcomeId: undefined } : undefined };
    assert.equal(qualify(outcome, missing).status, 'unclassified');
    if (['knowledge', 'scorecard'].includes(template.quizType)) {
      const overall = config([{ kind: 'score', min: 0, max: 100 }]); validate(form, overall);
      assert.equal(qualify(overall, result).status, 'qualified');
    } else assert.equal(metaScoreOptions(form).length, 0);
  });
}
check('real qualification templates leave missing optional numeric requirements unclassified', () => {
  for (const [templateId, missingId] of [['implementation-fit-30', 'i21'], ['implementation-fit-30', 'i26'], ['training-route-8', 't02']]) {
    const form = authoredTemplate(templateId, 'missing-number'), answers = { ...fixtures[templateId].answers };
    const matched = savedResult(form, answers).marketing.outcomeId;
    delete answers[missingId]; const result = savedResult(form, answers);
    assert.equal(result.marketing.status, 'no_match');
    assert.equal(qualify(config([{ kind: 'outcome', outcomeId: matched }]), result).status, 'unclassified');
  }
});
for (const template of authoredTemplates.filter(t => t.quizType === 'scorecard')) {
  check(`category thresholds and absent scores: ${template.id}`, () => {
    const form = authoredTemplate(template.id, 'category-score'), result = savedResult(form, fixtures[template.id].answers);
    for (const category of result.marketing.categories) {
      assert.equal(typeof category.score, 'number');
      const exact = config([{ kind: 'score', categoryId: category.id, min: category.score, max: category.score }]);
      validate(form, exact); assert.equal(qualify(exact, result).status, 'qualified');
      const fail = config([{ kind: 'score', categoryId: category.id, min: category.score === 0 ? 1 : 0, max: category.score === 0 ? 100 : category.score - 1 }]);
      assert.equal(qualify(fail, result).status, 'disqualified');
      for (const missing of [null, undefined, NaN, Infinity, -1, 101]) {
        const changed = { ...result, marketing: { ...result.marketing, categories: result.marketing.categories.map(c => c.id === category.id ? { ...c, score: missing } : c) } };
        assert.equal(qualify(exact, changed).status, 'unclassified');
      }
      assert.equal(qualify(exact, { ...result, marketing: { ...result.marketing, overallScore: null } }).status, 'qualified');
    }
  });
}
check('scorecard overall bands match the actual evaluated score at all boundaries', () => {
  const form = authoredTemplate('scorecard-onboarding', 'bands');
  const seed = savedResult(form, fixtures['scorecard-onboarding'].answers);
  for (const value of [0, 33, 34, 66, 67, 100]) {
    const band = form.marketing.scorecard.bands.find(b => b.min <= value && b.max >= value);
    const result = { ...seed, marketing: { ...seed.marketing, overallScore: value, outcomeId: band.id } };
    assert.equal(qualify(config([{ kind: 'outcome', outcomeId: band.id }]), result).status, 'qualified');
  }
});
check('category-only scorecards work without enabling overall score results', () => {
  const form = authoredTemplate('scorecard-onboarding', 'category-only'); delete form.marketing.scorecard;
  assert.ok(metaScoreOptions(form).length); assert.ok(metaScoreOptions(form).every(s => s.id));
  assert.equal(metaOutcomeOptions(form).length, 0);
  validate(form, config([{ kind: 'score', categoryId: form.marketing.categories[0].id, min: 0, max: 100 }]));
  assert.throws(() => validate(form, config([{ kind: 'score', min: 0, max: 100 }])));
});
check('removed categories and bands block publication, and category identity affects the frozen rule version', () => {
  const form = authoredTemplate('scorecard-onboarding', 'references');
  assert.throws(() => validate(form, config([{ kind: 'score', categoryId: 'removed', min: 0, max: 100 }])));
  assert.throws(() => validate(form, config([{ kind: 'outcome', outcomeId: 'removed' }])));
  const a = config([{ kind: 'score', categoryId: form.marketing.categories[0].id, min: 0, max: 100 }]);
  const b = config([{ kind: 'score', categoryId: form.marketing.categories[1].id, min: 0, max: 100 }]);
  assert.notEqual(metaRuleVersion(a), metaRuleVersion(b));
  const legacy = config([{ kind: 'score', min: 0, max: 100 }]);
  assert.equal(legacy.rules[0].categoryId, undefined);
  assert.throws(() => validate(authoredTemplate('knowledge-coffee-basics', 'knowledge'), a));
});
check('missing information takes priority over another failed AND condition', () => {
  const form = authoredTemplate('scorecard-onboarding', 'missing-and');
  const result = savedResult(form, fixtures['scorecard-onboarding'].answers);
  result.marketing.overallScore = null;
  const rule = config([{ kind: 'answer', questionId: form.questions[0].id, optionId: 'not-yet' }, { kind: 'score', min: 70, max: 100 }]);
  assert.equal(qualify(rule, result).status, 'unclassified');
});
console.log(`${checks} Meta qualification groups passed across all 18 templates and six quiz types. No network requests.`);
