# Workspace navigation, reports and profile

The shared creator header provides Overview, Reports, Templates, Experiments/Help under More, Create quiz, and Profile/Sign out. It uses the existing Pippi palette and typography and replaces repeated workspace branding. The editor keeps its existing Basic/Advanced controls and quiz toolbar. Public marketing, respondent quizzes, embeds and private respondent result pages are not wrapped in this header.

## Reports and navigation

`/reports` requires authentication and lists the current owner's quiz definitions with search and links to `/editor/:id?section=results`. The list sends minimal quiz summaries to the browser and does not load responses. The existing Results interface, calculations and exports remain authoritative. Allowlisted editor sections survive refresh and browser Back; explicitly choosing Basic returns to editing without retaining the report URL.

The header uses full-document navigation after registered guards approve. Owned editor drafts must save successfully before leaving. Guest drafts require a confirmed device copy and explicit leave confirmation. Unapplied email/report-design buffers require confirmed persistent recovery or remain in the editor. Guards examine current panel state after an asynchronous save; changed guard registrations trigger another bounded validation pass.

Editor and profile fields become inert throughout navigation and sign-out preparation. This prevents edits arriving after the leave check, including during cross-tab save coordination. Cancellation/failure restores editing. Safe sign-out retains its existing Retry, Cancel and Retain choices. Only an immediately approved navigation suppresses a duplicate native unload warning; ordinary tab closure/reload still uses existing recovery checks.

## Profile and account operations

`/profile` provides separate forms for name/company, email and password. `GET /api/profile` returns only `{name, company, email, pendingEmail?, revision, local?}`. Profile display details are stored as an owner-bound `account_profiles` record using the existing adapter. No database table, provider, SDK, environment variable or billing change is required.

`PATCH /api/profile` accepts `{name, company, revision}`. `POST /api/profile/email` accepts `{email, currentPassword}`. `POST /api/profile/password` accepts `{currentPassword, password}`. Every mutation requires `X-Pippi-Account`, bound to the opaque account key rendered by the authenticated profile page. Missing/stale account binding returns 403 before changing data, so another tab switching accounts cannot redirect old form entries into the new account. Metadata conflicts retain the entered values and offer an explicit confirmed reload.

Supabase remains authoritative for confirmed email and password. Sensitive changes reauthenticate the current confirmed identity, verify the same owner, and install fresh encrypted credentials under the existing opaque session handle with a version-checked lease held through the provider update. Logout tombstones win concurrent changes. No provider tokens or passwords are returned, logged or stored in browser recovery data. A provider request already handed to the network cannot be recalled by a later logout.

Pending email is shown separately until authoritative confirmation. Its PKCE flow binds purpose, original account and requested address. The callback verifies provider identity and the confirmed target before establishing a normal session and returning to Profile. Signup and restricted password recovery retain separate flows. Password changes report a need for fresh sign-in only when the session is definitively invalid. Legacy access-only sessions can read/edit display details but need normal fresh sign-in before sensitive changes. Sign-in assistance opens another tab so current entries remain available.

Local mode supports name/company edits and explicitly disables provider email/password changes. Production account-service and storage outages preserve entries and return retryable failures, with private/no-store responses. No account IDs or permissions can be supplied through profile fields.

## Validation completed locally

- `npm run test:workspace`: navigation (14 groups), header rendering, profile/screens (7), actual editor departure callback, profile APIs/provider coordination (17), and safe authentication returns.
- `npm run test:browser-workspace`: 12 compiled browser journeys, including desktop/mobile navigation, profile saves/header refresh, report links/reload, failed save retention, unapplied panel/storage failures, and delayed sign-out freezing profile inputs. Email/password browser UI responses are explicitly mocked; provider/account correctness is covered by the separate API tests.
- Existing compiled browser recovery: 13 journeys passed after adapting the sign-out selector to the profile menu.
- Hosted-style session reliability: five journeys passed against a loopback fake Supabase service, including one token rotation shared by two independent Next instances and zero external/consequential requests.
- General regression, account authentication/session, save-error, draft/panel recovery, guided editing, publication receipt/pause, analytics and integration/lifecycle suites passed. Global ESLint without errors, TypeScript, diff checks and the Next.js 16.4.3 production build passed.
- Independent review reproduced the navigation/account timing failures, verified their repairs, exercised actual confirmation routes, and passed 13 compiled HTTP checks. No remaining blocking finding was reported.

Browser evidence: `/var/folders/c4/wpkf0rh17v3ggj99ytmntw340000gn/T/pippi-workspace-qa-GWyHPd/artifacts`. Hosted-style evidence: `/private/tmp/pippi-hosted-sessions-ev2Bvv`. All data and credentials were synthetic. Production and Preview share a resource and were not used for fault injection. Real confirmation-email delivery and actual provider account changes still require an authorized test-account check; mock acceptance does not establish email arrival.

## Release and rollback

These results describe a local patch, not a deployment. Existing quiz schemas, scoring, publication snapshots and integration dispatch behavior are unchanged. Keep `SESSION_SECRET` stable. Older releases ignore profile display records; retain them and existing device drafts during rollback. Rolling back application code does not reverse email/password changes already accepted by Supabase. Deployment and live-provider validation are separate release actions.
