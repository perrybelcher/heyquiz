# Live isolation, mobile and recovery QA — 2026-10-10

## Verified in production

Two new dedicated example.test accounts were created through Supabase administration without sending email. Both signed in independently to www.pippiapp.com. The live isolation script passed 28 checks: both directions of foreign quiz read/update/delete/publish denial, contacts/results CSV denial, analytics denial, foreign draft-preview denial, exclusion from listings, private attachment denial, and legitimate owner responses. The attachment denial is HTTP 401; form ownership denials are 404. Created quiz fixtures were deleted through the app. Dedicated accounts and isolated attachment/attempt records may remain for QA; no existing customer records were edited.

A 390×844 Chrome Playwright journey passed real UI login, quiz creation, publication, anonymous completion, recommendation display, owner results and exact one-start/one-completion analytics. The test deliberately dropped the first submission response after server acceptance; retry recovered the same response without duplicate conversion. These administrative test accounts do not validate signup confirmation email delivery. Mobile viewport emulation is not a physical-device test.

## Recovery checks

- Two-tab draft independence, failed-save reload restoration, stale revision rejection, blocked browser storage warning.
- Expired session: account links, separate sign-in tab, edits retained, successful retry.
- AI/provider failures versus authentication failures, brief restoration, non-AI starter fallback. Provider responses were mocked; local dummy key only enables the UI.
- Eleven account UI checks with mocked successful emails, plus 20 account-auth unit checks.
- Real local render failure from a deliberately corrupted synthetic fixture: fallback screen, support reference, restore record, Try again returns to editor.

## Error reporting added

`pippi.failure` structured events now reach hosting logs for API failures/service outages, framework-caught server errors and client render-boundary reports. API responses include a reference ID and header. The new error screen offers retry and a workspace link. Its same-origin report endpoint accepts no data payload for logging and has a process-local 10/minute backstop. Report events contain only timestamp, generated reference, source and status. They omit error messages, request URLs, cookies, tokens and quiz/contact data. Existing framework logs are separate from these custom events.

The client source is explicitly untrusted: it is a signal, not proof of server failure. Existing generic API validation errors retain their response behavior and may produce diagnostic events. Client event-handler failures and rejected promises outside the render boundary are not comprehensively captured.

Use Vercel Logs to search `pippi.failure` or a support reference; the hosting platform supplies request context. This is searchable error reporting, not a configured paging/email alert service. Log retention depends on the hosting plan. Production probe and deployment verification are recorded separately in the task response.

## Supabase review

Security advisor reports RLS enabled with no policies for hq_records. This is intentional server-only storage: grants exist for postgres/service_role, not anon/authenticated. App ownership checks were verified with two live users. Compromised-password screening is disabled; this remains an Auth configuration follow-up, not an isolation failure. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Reproduce

- tests/live-owner-isolation.cjs and tests/live-mobile-journey.cjs require QA_ACCOUNTS_FILE with two dedicated example.test account credentials; never commit credentials.
- Local tests accept TEST_BASE_URL: browser-draft-protection.cjs, browser-save-auth.cjs, browser-marketing-recovery.cjs, browser-error-recovery.cjs.
- browser-auth.cjs accepts AUTH_TEST_URL.
- npm run build passed.

CRM and Stripe remain deferred. A physical-device check, fresh signup/email round trip and alert routing remain separate evidence gaps.

## Production follow-up

Deployment 861f4bd169556decbb7975bfac4f6b57160258e5 completed successfully. One synthetic diagnostic request returned HTTP 200 with reference dfa1266b-de0a-4351-b55c-23b8d1dd4a6a; that exact structured event was found in Vercel production logs.

A separate fresh signup using a dedicated alias of the user's authorized Gmail mailbox passed real mobile UI registration, receipt in Inbox, same-browser PKCE confirmation and authenticated workspace access. The first email-link extraction in the test harness incorrectly retained a Markdown closing bracket; retrying with the HTML href passed. This was a harness issue, not an application callback defect. No provider mocking was used for the successful email round trip. Physical devices and automatic alert routing remain unverified/unconfigured.

The SMTP sender display name was still Quiznick. It was updated to Pippi in Supabase; a reload confirmed the saved value. SMTP credentials were not changed.
