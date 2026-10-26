# Usability and choice validation

Release verification is tracked by the Git commit and Vercel production deployment status.

- Returning-user Overview shows the most recently updated quiz and the library before creation choices. New users retain the expanded creation choices.
- Library labels use quizzes consistently. Untitled quizzes receive naming guidance and their update timestamp.
- `/reports` reads owner-scoped submissions once to show retained response counts and latest response dates. No contact or answer details enter the overview DTO. Failed reads do not become zero-response claims.
- `/reports/[id]` authenticates and checks quiz ownership before reading responses. It reuses the existing analytics component, displays read-only answer snapshots, and supports response search/refresh. Editing, response management, and CSV export remain explicit links to the existing editor. Old editor Results links continue to work.
- Publication now requires at least two labeled options for all ten choice types. The shared rule runs in readiness checks and server publication; draft saving remains unchanged. Advanced removal controls preserve two answers. Existing published snapshots are untouched until a valid explicit publication.
- No schema migrations, dependencies, environment changes, scoring changes, or respondent-flow changes.

## Verification

- `npm test`: existing regression coverage plus isolated choice-publication tests. All ten types reject unusable choices, incomplete drafts remain saveable, and rejected publications preserve existing public snapshots.
- `node tests/publish-readiness.cjs`, `node tests/guided-checklist.cjs`, `node tests/guided-editing.cjs`.
- `npm run test:workspace`, `npm run test:reliability`.
- `npm run lint` (zero errors; existing warnings), TypeScript and production build.
- Compiled loopback app with isolated synthetic records and all Supabase configuration disabled: `tests/browser-workspace.cjs` (12 journeys), `tests/browser-usability.cjs` (publication rejection, draft retention, response counts/details/search/refresh, report authentication, unknown-quiz 404, returning Overview, mobile layout, and protected answer removal).

Browser scripts require explicit `TEST_BASE_URL`, `HEYQUIZ_DATA_DIR`, and `ARTIFACT_DIR`; never target production for fault injection. Actual provider email delivery and password changes are outside this patch's validation.

## Compatibility and rollback

No records are rewritten or migrated. Older quizzes with fewer than two options remain editable and their current published version remains available; they must be corrected before republishing. Rollback restores prior navigation and publication policy; existing editor Results links remain usable.
