const common = ['campaign-reflection', 'campaign-result-faq'];
const category = (id, score, answered = 2) => ({ id, score, answered, applicable: 2, minAnswers: 2 });
const categories = (a, b, c) => [category('area0', a, a === null ? 0 : 2), category('area1', b, b === null ? 0 : 2), category('area2', c, c === null ? 0 : 2)];
// Expectations are authored independently of the evaluator. All IDs are the
// template's original stable option/category/outcome IDs, not production data.
module.exports = {
  common,
  matchingCases: [
    { name: 'First preference', options: ['a0', 'a0', 'a0', 'a0'], next: 'a0', status: 'matched', resultId: 'path0', score: null, categories: [], resultSectionIds: ['campaign-path0', ...common] },
    { name: 'Second preference', options: ['a1', 'a1', 'a1', 'a1'], next: 'a0', status: 'matched', resultId: 'path1', score: null, categories: [], resultSectionIds: ['campaign-path1', ...common] },
    { name: 'Third preference', options: ['a2', 'a2', 'a2', 'a2'], next: 'a0', status: 'matched', resultId: 'path2', score: null, categories: [], resultSectionIds: ['campaign-path2', ...common] },
    { name: 'All unsure', options: ['a3', 'a3', 'a3', 'a3'], next: 'a0', status: 'no_match', resultId: null, score: null, categories: [], resultSectionIds: common },
    { name: 'Not ready to choose', options: ['a0', 'a0', 'a0', 'a0'], next: 'a2', status: 'no_match', resultId: null, score: null, categories: [], resultSectionIds: common },
  ],
  scorecardCases: [
    { name: 'Foundation', options: ['a2', 'a2', 'a2', 'a2', 'a2', 'a2'], status: 'scored', resultId: 'foundation', score: 0, categories: categories(0, 0, 0), resultSectionIds: ['campaign-foundation', ...common] },
    { name: 'Consistency', options: ['a1', 'a1', 'a1', 'a1', 'a1', 'a1'], status: 'scored', resultId: 'consistent', score: 50, categories: categories(50, 50, 50), resultSectionIds: ['campaign-consistent', ...common] },
    { name: 'Refinement', options: ['a0', 'a0', 'a0', 'a0', 'a0', 'a0'], status: 'scored', resultId: 'refine', score: 100, categories: categories(100, 100, 100), resultSectionIds: ['campaign-refine', ...common] },
    { name: 'Mixed categories', options: ['a2', 'a2', 'a1', 'a1', 'a0', 'a0'], status: 'scored', resultId: 'consistent', score: 50, categories: categories(0, 50, 100), resultSectionIds: ['campaign-consistent', ...common] },
    { name: 'All unknown', options: ['a3', 'a3', 'a3', 'a3', 'a3', 'a3'], status: 'no_match', resultId: null, score: null, categories: categories(null, null, null), resultSectionIds: common },
    { name: 'Unknown first area', options: ['a3', 'a3', 'a0', 'a0', 'a0', 'a0'], status: 'scored', resultId: null, score: null, categories: categories(null, 100, 100), resultSectionIds: common },
  ],
  answers(form, expected) { return Object.fromEntries(form.questions.map((question, index) => [question.id, question.id === 'next' ? expected.next : expected.options[index]])); },
};
