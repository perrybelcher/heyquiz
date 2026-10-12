# Results designer: first release

Added structured, reorderable result sections in Marketing → Results designer for scorecards, segmentation quizzes, and product finders. Available blocks: explanatory text, image with alt text, attributed testimonial, expandable FAQ, and a linked next step. Sections render after personalized scoring/advice and before the existing primary offer. The existing simulator previews the same component used by the player and saved contact results.

The schema caps content at 12 blocks. Publication rejects missing content, missing FAQ questions, and incomplete CTA/image URLs. Section IDs must be unique. Content uses React text rendering, not arbitrary HTML. New CTA links use existing offer-click tracking. Result sections are omitted from the public question payload and returned in evaluated results. Old quizzes without sections retain their existing layout.

Validation completed:
- TypeScript: passed.
- Production build: passed.
- tests/result-sections.cjs: three marketing types, malformed URLs, duplicate IDs, draft versus publication validation, public redaction.
- tests/scorecard-results.cjs: existing scoring and advice regressions passed.
- tests/browser-result-sections.cjs: Playwright Chrome added FAQ/CTA blocks, reordered, saved/reloaded, published, evaluated server outcome, verified rendered FAQ and CTA, checked tracking/analytics and 390px overflow.
- Screenshot: /tmp/pippi-result-sections.png.

The initial development-server browser attempt encountered continuous development reloads. The production-build browser run passed.

Scope: sections apply to every result. Conditional blocks, video embeds, PDF layout design, and rearranging the core score/category blocks are not included. This work is local and has not been deployed in this turn.
