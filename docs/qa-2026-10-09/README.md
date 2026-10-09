# Pippi QA — 9 October 2026

## Result and boundaries
31 suite/browser variants passed after the documented test repairs and targeted retests. This is a bounded test pass, not certification that every feature combination works. The application build passed before this run. No application-code changes were required by reproduced failures in this pass.

Tests ran against the current production-build source on an isolated local server at port 3150, with synthetic data in `/tmp/pippi-deep-qa`. Supabase storage and Nango secrets were disabled for this environment. Chrome, Playwright Firefox, and Playwright WebKit were used. WebKit is not a physical Safari/iPhone test.

## Coverage
| Area | Result | Evidence / qualification |
|---|---|---|
| Core logic, persistence and scoring | PASS | regression.log: 25 checks, including hidden/skipped answers, duplicate selections, atomic revisions, product exclusions, ties and fallback |
| Auth service logic | PASS, mocked provider | account-auth.log: 20 checks including PKCE, callback replay, recovery grant, expiry, origin checks and SMTP-error handling |
| Signup/recovery browser screens | PASS, simulated success | browser-auth.cjs.log: responsive screens, mismatched passwords, expired recovery, invalid callback. No real email sent |
| Guest → editor → local login → save | PASS | browser-guest-builder.cjs.log; draft survives reload and claims to authenticated account |
| Expired editor session recovery | PASS | browser-save-auth.cjs.log; separate login tab, retained edits, retry save |
| Draft/public sharing | PASS | browser-sharing.cjs.log; unpublished link unavailable, publish enables anonymous access, reload preserves published state |
| Theme editing | PASS | browser-theme.cjs.log; cancel, invalid hex, custom colors/fonts/corners, persisted player appearance and narrow dialog |
| Answer-level scoring controls | PASS | browser-answer-scoring.cjs.log; zero and weighted answers, exclusions, mode-change confirmation, persistence |
| Core API | PASS | api.mjs.log |
| Marketing API | PASS | marketing-api.cjs.log |
| Contact capture | PASS after test path repair | contacts-retest.log; required/optional/after capture, invalid input, storage failure retry, concurrent retries, independent consent, private lists, preview suppression and CSV escaping |
| Owner isolation | PASS, local record ownership | owner-isolation.cjs.log; read/edit/delete/publish/contacts/submissions/analytics deny other owner; cross-origin mutation denied |
| Integration API | PASS | integrations-api.cjs.log: 12 checks. Secrets hidden, stale edits rejected, credential protections, delivery queue deduplication |
| Visible question fields, Chrome | PASS after rate-limit retest | 49 visible field types completed and persisted; browser-matrix.cjs.log plus matrix-retest.log |
| Special field guards | PASS, limited | Hidden-only quiz guard; CAPTCHA publication rejected without configuration. No live CAPTCHA challenge solved |
| Branching and marketing journeys | PASS in Chrome, Firefox and WebKit | browser-journeys.cjs.log, journeys-firefox-retest.log, journeys-webkit.log |
| Selected fields, Firefox/WebKit | PASS | fields-firefox.log, fields-webkit.log: multiple choice, multiselect, dropdown, email, date, signature, file upload, choice matrix |
| Capture browser journey | PASS | browser-contacts.cjs.log |
| Analytics | PASS | analytics.log: 13 checks; browser-analytics.cjs.log: 15 browser/API checks |
| Tracking | PASS with simulated senders | tracking.log: 10 checks; browser-tracking.cjs.log. No advertising-platform receipt verified |
| Integration editor | PASS | browser-integrations.cjs.log |
| Integration transport logic | PASS, mocked external services | integrations.log; includes retry/authentication/SSRF defenses |
| Nango/HubSpot logic | PASS, mocked external services | nango.log: 15 checks |
| Other provider adapters | PASS, mocked external services | providers.log: 43 checks |
| Cloud pagination | PASS, mocked storage API | cloud-pagination.log: 1,205 records, owner filter, reduced server cap |
| Reliability | PASS | resilience.log: failed autosave retry, stale-tab overwrite prevention, mobile editor width, Escape closes theme dialog |
| Homepage | PASS after test updates | sales-final.log: six widths (320–2560), images, product demo results/fallback, keyboard focus, FAQ, create CTA, guest/auth routing, no submission writes or page errors |

## Initial failures and resolution
- Contact outage injection used `.heyquiz-data` instead of the isolated test directory. Updated the test to honor `HEYQUIZ_DATA_DIR`; outage and recovery checks then passed.
- Concurrent automated runs exceeded the 40-starts/minute backstop. Three Chrome field checks and the initial Firefox journey timed out. A captured screen showed “Too many requests.” Retesting without the overlapping burst passed. Rate limiting was not weakened. Future runs must serialize/rate-space these groups or use separate isolated server processes.
- Homepage image decoding raced lazy loading/hydration. The actual logo loaded with a nonzero natural width. The test now waits for loaded pixels with a bounded timeout.
- Homepage assertions still expected the former “Experience a quiz” CTA and old FAQ copy. Updated to verify the new `/create` journey and current copy; the full suite passed.
- Test URLs were hardcoded across different historical local ports. Tests now accept `TEST_BASE_URL` to run consistently against isolated builds (API scripts retain `TEST_URL`, auth retains `AUTH_TEST_URL`).

Initial logs are retained, including failures. Retest logs above supersede those results, not erase them.

## Not yet verified
- Real new-account email delivery, inbox placement, confirmation in an actual email client, and subsequent cloud-account draft ownership end to end. Auth screens and mocked protocol tests do not establish this.
- Live delivery to customer CRM/email accounts, OAuth refresh against real providers, actual provider outages and rate limits.
- Full Supabase production RLS/database-owner isolation audit; local ownership checks and mocked pagination are narrower evidence.
- Every field × theme × device × scoring × branching combination; native microphone recording/device permissions. Audio field tests upload a synthetic fixture.
- Physical iPhone/Android testing and a full accessibility audit (screen readers, all contrast pairs, all keyboard paths).
- Production concurrency/load, multi-instance rate limits, long-running sessions, backups/restores, independent penetration testing.

## Reproduction
Use `npm run build`, then start a local production server with local mode and a fresh test data directory; explicitly disable external provider configuration. Set `TEST_BASE_URL`, `TEST_URL`, and `AUTH_TEST_URL` to that server. Use the same `HEYQUIZ_DATA_DIR` for tests that inject filesystem failures/ownership fixtures. Never point mutation tests at production. Keep request-heavy browser groups sequential and allow the one-minute rate-limit window to reset between bursts.

New resilience checks: `TEST_BASE_URL=http://127.0.0.1:3150 node tests/browser-resilience.cjs`.
