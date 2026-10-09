# Reusable brand and offer profiles

Marketing quiz studio now includes account-saved profiles for complete briefs: audience, offer, concerns, voice, action, quiz type, question count and result/category definitions. Users can save a new named profile, apply it after reviewing a replacement confirmation, or explicitly update a saved profile. Applying copies the brief; editing the brief or profile never changes existing quizzes. Profiles do not invoke AI or publish automatically.

API routes require authentication, check ownership for individual records, use non-cacheable responses, validate the shared brief schema and reject cross-origin writes. Updates use record revisions to prevent lost edits. Storage uses the existing generic record table; no database migration is needed.

Passed: production build, TypeScript, and tests/brand-profiles.cjs (Playwright Chrome). Tests cover unauthenticated access, cross-account list/read/update isolation, malformed input, cross-origin writes, save/reload, reuse/cancel, independent draft edits, stale revision conflict, starter generation, and 390px layout. Screenshot: /tmp/pippi-brand-profiles.png.

Scope: manually supplied, complete brief profiles. Website research, visual brand kits, team sharing, archive/delete controls and AI rewriting of existing quizzes are not part of this release.
