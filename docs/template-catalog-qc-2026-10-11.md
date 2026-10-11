# Reusable template catalog — 2026-10-11

## Scope
Expanded the public library from three examples to 43 editable templates: 30 new product/service matchers and 10 new scorecards alongside the original three examples. The new catalog has no owner-specific brands, destinations, or offers.

Industry coverage includes food and drink, retail and gifts, home interiors, home services, professional services, education, fitness and hobbies, events and creative work, travel, property, pets, nonprofits, and technology.

Discovery supports text search, combined industry/goal filters, 12-card pagination, clear empty states, and question/result previews. Workspace purpose cards now lead into the full library rather than immediately creating one of three old examples.

## Scoring design
Each new matching quiz has four domain-specific preference questions and a final next-step preference. The first question has weight 3; the other preference questions have weight 2. Unknown answers have no rule. Ties follow the existing deterministic result order. Explicitly declining a next step excludes all recommendations. Results are suggested directions, with owner-editable advice and blank destination URLs, not verified inventory matches.

Each new scorecard has three areas with two questions per area. Yes/partly/not yet receive 2/1/0 points. Unknown answers remain unscored, and the overall score is withheld until all categories have sufficient coverage. Category advice is specific to the topic.

Capture remains optional; marketing consent is off by default. Template owners must customize their products, suitability requirements, result destinations, and privacy policy before launch.

## Validation
- TypeScript and production build.
- Existing launch-template regression suite, including 768 bag-finder paths.
- Catalog suite: 64,000 new scoring combinations covering ties, opt-outs, unknowns, score boundaries, and independent draft copies.
- Playwright discovery suite: search, combined filters, pagination, empty states, Escape/focus behavior, mobile overflow, and opening an editable guest draft.
- Playwright launch suite: every template preview and local create/publish/start/submit flow, with synthetic quiz cleanup.

Bulk submission tests are paced below the 40-starts-per-minute limit. Early unpaced attempts hit that limit; no production protection was relaxed. Browser screenshots reviewed at desktop and mobile sizes.

## Limits
These checks verify implementation, not conversion performance. No real customer emails, external CRM deliveries, or paid actions are performed. Product templates need a real catalog and business-specific eligibility rules before they can recommend actual inventory.
