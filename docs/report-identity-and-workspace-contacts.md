# Report identity and workspace Contacts

Release verification is tracked by the Git commit and Vercel production deployment status.

## Changes

- Focused reports display captured names and emails. The label falls back to the legacy respondent name, then email, then “Response” for anonymous records. Search includes captured name/email, legacy name, answer wording and saved outcome; matching ignores case and surrounding whitespace.
- Contacts is a primary desktop/mobile workspace destination, using the existing save-before-navigation guard and active-link styling.
- `/contacts` provides an authenticated directory across the account's quizzes. It reuses the existing contact search, consent filter, saved score/outcome interpretation and 25-row pagination. Users can also filter by quiz, refresh, open a report, or open existing per-quiz management/export tools.
- Reports link directly to `/contacts?quiz=...`. Selected quiz IDs must belong to the signed-in account.
- The server checks owner and quiz membership, retains canonical record IDs and omits raw answers/grading from the overview props. Failed storage reads propagate as errors, not empty-directory claims. Anonymous access redirects to sign-in.
- No contact deduplication or consent changes: contacts remain one per retained response, and repeat attempts remain separate. Capture, scoring, branching, exports, integrations and publication behavior are unchanged. No migrations, dependencies or environment changes.

## Validation

- `npm test`: regression and identity/search cases, including anonymous/legacy records and existing answer/outcome search.
- `npm run test:workspace`: header links/active state, editor navigation, profile and new Contacts server-page isolation checks.
- TypeScript/production build passed. Lint has zero errors and the existing 68 warnings.
- Compiled app with isolated local records and Supabase disabled: `tests/browser-contacts-navigation.cjs` verifies name/email search, desktop/mobile navigation, 1024px/375px fit, quiz/consent filters, pagination/reset, refresh, report deep link, authentication/foreign-owner exclusion, omitted private answers and acknowledged dirty-editor departure.
- `tests/browser-workspace.cjs` verifies existing navigation, save protection, profile and mobile flows with the new link.

Browser scripts require explicit loopback `TEST_BASE_URL`, isolated `HEYQUIZ_DATA_DIR` and `ARTIFACT_DIR`. No production quiz/contact data was changed.

## Compatibility and rollback

Existing record shapes and editor Contacts links remain valid. This patch only reads retained contact data; it creates or modifies no contact records. Rolling back restores the earlier navigation/report view without requiring a data migration.
